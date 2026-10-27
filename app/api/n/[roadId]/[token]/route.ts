import { after } from "next/server";
import { CommandError, isCommand, type Command } from "@/lib/commands";
import { prepareNeighborCommand } from "@/lib/neighbor-actions";
import { neighborView } from "@/lib/neighbor";
import { displayName } from "@/lib/selectors";
import { clientIp, errorResponse, json, limited, rateLimit, readJSON } from "@/lib/server/http";
import { afterNeighborChange } from "@/lib/server/effects";
import { loadRoad, mutate } from "@/lib/server/store";
import { usesStripe } from "@/lib/server/stripe";
import type { Road } from "@/lib/types";

type Params = { params: Promise<{ roadId: string; token: string }> };

function findHome(road: Road, token: string) {
  const home = road.homes.find((h) => h.token === token);
  if (!home) throw new CommandError("This link isn't valid anymore. Ask your road captain for a new one.", 404);
  return home;
}

export async function GET(req: Request, { params }: Params) {
  try {
    const { roadId, token } = await params;
    if (!(await rateLimit(`n:${clientIp(req)}`, 120, 60_000))) return limited();
    const found = await loadRoad(roadId);
    if (!found) throw new CommandError("This link isn't valid anymore. Ask your road captain for a new one.", 404);
    const home = findHome(found.road, token);
    return json({ view: neighborView(found.road, home.id, new Date()) });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const { roadId, token } = await params;
    if (!(await rateLimit(`nw:${clientIp(req)}`, 30, 60_000))) return limited();
    const { command } = await readJSON<{ command: Command }>(req, 50_000);
    if (!isCommand(command)) throw new CommandError("That change wasn't valid.");
    let homeId = "";
    let before: Road | null = null;
    const road = await mutate(roadId, (current) => {
      const home = findHome(current, token);
      homeId = home.id;
      before = current;
      // With real payments on, money only arrives through Stripe Checkout.
      if (command.type === "payment.record" && usesStripe(current)) throw new CommandError("Pay through the secure checkout on this page.", 409);
      const at = new Date().toISOString();
      return {
        commands: [prepareNeighborCommand(current, home.id, command, at)],
        ctx: { at, actor: { kind: "neighbor", homeId: home.id, name: displayName(home) } },
      };
    });
    const prev = before as Road | null;
    if (prev && prev !== road) after(() => afterNeighborChange(prev, road, homeId, command, new URL(req.url).origin));
    return json({ view: neighborView(road, homeId, new Date()) });
  } catch (err) {
    return errorResponse(err);
  }
}
