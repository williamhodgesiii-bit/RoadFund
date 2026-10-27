import { after } from "next/server";
import { CommandError, isCommand, type Command } from "@/lib/commands";
import { captainHome, displayName } from "@/lib/selectors";
import { errorResponse, json, readJSON } from "@/lib/server/http";
import { afterCaptainChange } from "@/lib/server/effects";
import { checkCaptain, deleteRoad, loadRoad, mutate, revokeCaptainKey } from "@/lib/server/store";
import { usesStripe } from "@/lib/server/stripe";
import type { Road } from "@/lib/types";

/** Set only by Stripe webhooks or the server, never by a captain's browser. */
const SYSTEM_ONLY = new Set(["account.stripe", "road.billing"]);
/** Simulated in test mode; with Stripe on, these happen through real checkout and onboarding. */
const STRIPE_HANDLES = new Set(["account.connect", "account.disconnect", "road.plan", "agreement.purchase"]);

type Params = { params: Promise<{ id: string }> };

async function authorize(req: Request, id: string) {
  if (!(await checkCaptain(id, req.headers.get("x-road-key")))) throw new CommandError("This captain link isn't valid for this road.", 401);
}

export async function GET(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    await authorize(req, id);
    const found = await loadRoad(id);
    if (!found) throw new CommandError("Road not found.", 404);
    return json({ road: found.road });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    await authorize(req, id);
    const { commands } = await readJSON<{ commands: Command[] }>(req);
    if (!Array.isArray(commands) || commands.length === 0 || commands.length > 60 || !commands.every(isCommand)) {
      throw new CommandError("That change wasn't valid.");
    }
    let before: Road | null = null;
    const road = await mutate(id, (current) => {
      before = current;
      const cap = captainHome(current);
      for (const c of commands) {
        if (SYSTEM_ONLY.has(c.type)) throw new CommandError("That change can only come from the payment system.", 403);
        if (STRIPE_HANDLES.has(c.type) && usesStripe(current)) {
          throw new CommandError(c.type.startsWith("account.") ? "Manage the road's bank account through Stripe." : "Purchases go through secure checkout.", 409);
        }
      }
      return {
        commands,
        ctx: { at: new Date().toISOString(), actor: { kind: "captain", homeId: cap?.id ?? null, name: cap ? displayName(cap) : "Road captain" } },
      };
    });
    const prev = before as Road | null;
    if (prev && prev !== road) after(() => afterCaptainChange(prev, road, commands, new URL(req.url).origin));
    return json({ road });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Sign this device out: its captain key stops working. */
export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    await authorize(req, id);
    await revokeCaptainKey(id, req.headers.get("x-road-key")!);
    return json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    await authorize(req, id);
    const found = await loadRoad(id);
    if (found) await deleteRoad(id, found.road);
    return json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
