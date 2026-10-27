import { after } from "next/server";
import { CommandError } from "@/lib/commands";
import { notifyLetterRequest } from "@/lib/server/effects";
import { clientIp, errorResponse, json, limited, rateLimit, readJSON } from "@/lib/server/http";
import { recordLetterSession, retrieveSession, stripeEnabled } from "@/lib/server/stripe";

/** The closing page calls this when the requester comes back from paying the letter fee. */
export async function POST(req: Request) {
  try {
    if (!stripeEnabled) throw new CommandError("Payments aren't connected on this deployment.", 501);
    if (!(await rateLimit(`lconf:${clientIp(req)}`, 20, 60_000))) return limited();
    const { sessionId } = await readJSON<{ sessionId: string }>(req, 2_000);
    const session = await retrieveSession(String(sessionId ?? ""));
    if (session.metadata?.kind !== "letter") throw new CommandError("That isn't a letter payment.");
    const done = await recordLetterSession(session);
    if (!done) return json({ ok: false, status: session.payment_status });
    after(() => notifyLetterRequest(done.road, done.requestId, new URL(req.url).origin));
    return json({ ok: true, roadName: done.road.name, email: session.metadata.requesterEmail ?? "" });
  } catch (err) {
    return errorResponse(err);
  }
}
