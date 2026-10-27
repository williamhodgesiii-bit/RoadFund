import { CommandError } from "@/lib/commands";
import { secretToken } from "@/lib/ids";
import { clientIp, errorResponse, json, limited, rateLimit, readJSON } from "@/lib/server/http";
import { kv, kvEnabled } from "@/lib/server/kv";
import { emailEnabled, sendEmail, validEmail } from "@/lib/server/notify";
import { loadRoad, roadIdsForCaptain, sha256 } from "@/lib/server/store";

const TTL = 20 * 60;

/** Emails a captain a one-time sign-in link for every road they captain. */
export async function POST(req: Request) {
  try {
    if (!kvEnabled || !emailEnabled) throw new CommandError("Email sign-in isn't set up here. Open the captain link you saved when you set up your road.", 501);
    const { email: raw } = await readJSON<{ email: string }>(req, 2_000);
    const email = String(raw ?? "").trim().toLowerCase();
    if (!validEmail(email)) throw new CommandError("Enter the email address you used for your road.");
    if (!(await rateLimit(`signin:${clientIp(req)}`, 8, 15 * 60_000)) || !(await rateLimit(`signin:${email}`, 4, 60 * 60_000))) return limited();

    const ids = await roadIdsForCaptain(email);
    const names: string[] = [];
    for (const id of ids) {
      const found = await loadRoad(id);
      if (found && !found.road.demo) names.push(found.road.name);
    }
    // Same answer whether or not the email matched, so nobody can probe for captains.
    if (names.length) {
      const token = secretToken();
      await kv("SET", `rf:login:${await sha256(token)}`, JSON.stringify({ email }), "EX", TTL);
      const link = `${new URL(req.url).origin}/signin#t=${token}`;
      await sendEmail({
        to: email,
        fromName: "Road Fund",
        subject: "Your Road Fund sign-in link",
        text: [
          `Tap this link to sign in to ${names.length === 1 ? names[0] : `${names.length} roads: ${names.join(", ")}`} on this device:`,
          link,
          `The link works once and expires in 20 minutes. If you didn't ask for it, ignore this email. Nobody can sign in without it.`,
        ].join("\n\n"),
      });
    }
    return json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
