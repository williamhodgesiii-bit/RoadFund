import { CommandError } from "@/lib/commands";
import { clientIp, errorResponse, json, limited, rateLimit, readJSON } from "@/lib/server/http";
import { kv, kvEnabled } from "@/lib/server/kv";
import { captainEmail, issueCaptainKey, loadRoad, roadIdsForCaptain, sha256 } from "@/lib/server/store";

/** Trades a one-time email link for a captain key on this device, one per road. */
export async function POST(req: Request) {
  try {
    if (!kvEnabled) throw new CommandError("Sign-in isn't available here.", 501);
    if (!(await rateLimit(`signin-v:${clientIp(req)}`, 20, 15 * 60_000))) return limited();
    const { token } = await readJSON<{ token: string }>(req, 2_000);
    if (typeof token !== "string" || token.length < 16 || token.length > 64) throw new CommandError("That sign-in link isn't valid.", 400);
    const raw = await kv<string | null>("GETDEL", `rf:login:${await sha256(token)}`);
    if (!raw) throw new CommandError("That sign-in link was already used or has expired. Ask for a new one.", 410);
    const { email } = JSON.parse(raw) as { email: string };
    const roads: { id: string; name: string; key: string }[] = [];
    for (const id of await roadIdsForCaptain(email)) {
      const found = await loadRoad(id);
      // The captain could have changed since the link was sent.
      if (!found || found.road.demo || captainEmail(found.road) !== email) continue;
      roads.push({ id, name: found.road.name, key: await issueCaptainKey(id) });
    }
    if (!roads.length) throw new CommandError("No roads list this email as the captain anymore.", 404);
    return json({ roads });
  } catch (err) {
    return errorResponse(err);
  }
}
