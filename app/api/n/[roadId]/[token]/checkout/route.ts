import { after } from "next/server";
import { CommandError } from "@/lib/commands";
import { uid } from "@/lib/ids";
import { neighborView } from "@/lib/neighbor";
import { homeOpenBills } from "@/lib/selectors";
import { notifyPayment } from "@/lib/server/effects";
import { clientIp, errorResponse, json, limited, rateLimit, readJSON } from "@/lib/server/http";
import { loadRoad } from "@/lib/server/store";
import { duesCheckout, recordDuesSession, retrieveSession, usesStripe } from "@/lib/server/stripe";

type Params = { params: Promise<{ roadId: string; token: string }> };
type Body = { action: "start"; requestId: string; amount: number; method: "ach" | "card" } | { action: "confirm"; sessionId: string };

/** Neighbor payments through Stripe Checkout: start a session, then confirm it on return. */
export async function POST(req: Request, { params }: Params) {
  try {
    const { roadId, token } = await params;
    if (!(await rateLimit(`co:${clientIp(req)}`, 20, 60_000))) return limited();
    const found = await loadRoad(roadId);
    const home = found?.road.homes.find((h) => h.token === token);
    if (!found || !home) throw new CommandError("This link isn't valid anymore. Ask your road captain for a new one.", 404);
    const road = found.road;
    if (!usesStripe(road)) throw new CommandError("Payments are simulated for this road.", 409);
    const body = await readJSON<Body>(req, 5_000);

    if (body.action === "start") {
      const bill = homeOpenBills(road, home.id, new Date()).find((b) => b.request.id === body.requestId);
      if (!bill) throw new CommandError("This bill is already paid or closed.", 409);
      const amount = Math.min(Math.round(Number(body.amount)), bill.line.outstanding);
      if (!(amount >= 100)) throw new CommandError("Online payments must be at least $1.");
      const url = await duesCheckout({
        road,
        home,
        token,
        requestId: bill.request.id,
        requestTitle: bill.request.title,
        amount,
        method: body.method === "card" ? "card" : "ach",
        paymentId: uid("pay"),
        origin: new URL(req.url).origin,
      });
      return json({ url });
    }

    const session = await retrieveSession(body.sessionId);
    if (session.metadata?.roadId !== roadId || session.metadata?.homeId !== home.id) throw new CommandError("That payment belongs to a different home.", 403);
    const recorded = await recordDuesSession(session);
    const next = recorded ?? (await loadRoad(roadId))!.road;
    const paymentId = session.metadata?.paymentId;
    if (recorded && paymentId) after(() => notifyPayment(recorded, paymentId, new URL(req.url).origin));
    return json({
      view: neighborView(next, home.id, new Date()),
      paymentId: session.metadata?.paymentId ?? null,
      complete: session.status === "complete",
    });
  } catch (err) {
    return errorResponse(err);
  }
}
