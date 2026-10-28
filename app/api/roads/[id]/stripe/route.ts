import { CommandError } from "@/lib/commands";
import { after } from "next/server";
import { captainHome } from "@/lib/selectors";
import { notifyPurchase } from "@/lib/server/effects";
import { errorResponse, json, readJSON } from "@/lib/server/http";
import { checkCaptain, loadRoad, mutate } from "@/lib/server/store";
import {
  accountState,
  agreementCheckout,
  billingPortalUrl,
  dashboardUrl,
  ensureAccount,
  onboardingUrl,
  planCheckout,
  recordRoadPurchase,
  retrieveSession,
  usesStripe,
} from "@/lib/server/stripe";

type Params = { params: Promise<{ id: string }> };
type Body =
  | { action: "connect" }
  | { action: "refresh" }
  | { action: "dashboard" }
  | { action: "plan" }
  | { action: "agreement" }
  | { action: "portal" }
  | { action: "confirm"; sessionId: string };

const system = { kind: "system" as const, homeId: null, name: "Stripe" };

/** Everything a captain does with Stripe: connect the road's account, check it, buy a plan or package. */
export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    if (!(await checkCaptain(id, req.headers.get("x-road-key")))) throw new CommandError("This captain link isn't valid for this road.", 401);
    const found = await loadRoad(id);
    if (!found) throw new CommandError("Road not found.", 404);
    const road = found.road;
    if (!usesStripe(road)) throw new CommandError("Payments are simulated for this road.", 409);
    const origin = new URL(req.url).origin;
    const body = await readJSON<Body>(req, 5_000);
    const captain = captainHome(road);

    switch (body.action) {
      case "connect": {
        const acct = await ensureAccount(road, captain);
        if (acct !== road.account.stripeAccountId) {
          await mutate(id, () => ({ commands: [{ type: "account.stripe", stripeAccountId: acct, status: "pending", bankName: "", last4: "" }], ctx: { at: new Date().toISOString(), actor: system } }));
        }
        return json({ url: await onboardingUrl(acct, origin) });
      }
      case "refresh": {
        const acct = road.account.stripeAccountId;
        if (!acct) return json({ road, due: 0 });
        const s = await accountState(acct);
        const next = await mutate(id, (r) => ({
          commands:
            r.account.status === s.status && r.account.bankName === s.bankName && r.account.last4 === s.last4
              ? []
              : [{ type: "account.stripe", stripeAccountId: acct, status: s.status, bankName: s.bankName, last4: s.last4 }],
          ctx: { at: new Date().toISOString(), actor: system },
        }));
        return json({ road: next, due: s.due });
      }
      case "dashboard": {
        if (!road.account.stripeAccountId) throw new CommandError("Connect the road's account first.", 409);
        return json({ url: await dashboardUrl(road.account.stripeAccountId) });
      }
      case "plan":
        if (road.plan === "roadfund") throw new CommandError("This road is already on the Road Fund plan.", 409);
        return json({ url: await planCheckout(road, captain, origin) });
      case "agreement":
        return json({ url: await agreementCheckout(road, captain, origin) });
      case "portal":
        if (!road.billing?.customerId) throw new CommandError("No billing account yet.", 409);
        return json({ url: await billingPortalUrl(road.billing.customerId, origin) });
      case "confirm": {
        const session = await retrieveSession(body.sessionId);
        if (session.metadata?.roadId !== id) throw new CommandError("That payment belongs to a different road.", 403);
        const next = await recordRoadPurchase(session);
        if (next) after(() => notifyPurchase(next, session.id, session.metadata?.kind ?? "", origin));
        return json({ road: next ?? (await loadRoad(id))?.road, paid: !!next });
      }
      default:
        throw new CommandError("Unknown action.");
    }
  } catch (err) {
    return errorResponse(err);
  }
}
