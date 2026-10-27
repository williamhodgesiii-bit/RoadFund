import { CommandError } from "@/lib/commands";
import { kvEnabled } from "@/lib/server/kv";
import { clientIp, errorResponse, json, limited, rateLimit, readJSON } from "@/lib/server/http";
import { createRoad } from "@/lib/server/store";
import { stripeEnabled } from "@/lib/server/stripe";
import type { Road } from "@/lib/types";

export async function POST(req: Request) {
  try {
    if (!kvEnabled) throw new CommandError("Cloud storage is off.", 501);
    if (!(await rateLimit(`create:${clientIp(req)}`, 10, 60 * 60_000))) return limited();
    const { road } = await readJSON<{ road: Road }>(req);
    if (!road || road.schema !== 1 || !Array.isArray(road.homes)) throw new CommandError("That road wasn't valid.");
    let clean: Road = { ...road, updatedAt: new Date().toISOString() };
    // With real billing on, a new road starts free with no bank account; the
    // captain upgrades and connects through Stripe. Demo roads stay simulated.
    if (stripeEnabled && !road.demo) {
      clean = {
        ...clean,
        plan: "starter",
        billing: undefined,
        account: { ...clean.account, status: "none", stripeAccountId: null, bankName: "", last4: "", connectedAt: null },
        agreement: { ...clean.agreement, packagePurchasedAt: null },
      };
    }
    const result = await createRoad(clean);
    return json(result, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
