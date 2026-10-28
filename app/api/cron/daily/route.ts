import { CommandError, type Command } from "@/lib/commands";
import { daysBetween, fmtDate, isoDate } from "@/lib/dates";
import { uid } from "@/lib/ids";
import { money } from "@/lib/money";
import { captainHome, checkInMail, requestProgress } from "@/lib/selectors";
import { errorResponse, json } from "@/lib/server/http";
import { kvEnabled } from "@/lib/server/kv";
import { emailEnabled, sendEmail, sendSms, serverChannel, smsEnabled, validEmail } from "@/lib/server/notify";
import { allRoadIds, loadRoad, mutate, once } from "@/lib/server/store";
import { baseValues, budgetSummary, fillTokens, SMS_FOOTER, TEMPLATE_SUBJECT, TOKEN_TEMPLATES } from "@/lib/templates";
import type { Road } from "@/lib/types";

export const maxDuration = 300;

// Runs once a day (vercel.json). Vercel sends "Authorization: Bearer $CRON_SECRET".
// Every send is guarded by a one-time marker, so a retry never double-sends.

const DAY = 24 * 60 * 60;

function origin(req: Request): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || new URL(req.url).origin;
}

interface Tally {
  roads: number;
  reminders: number;
  letters: number;
  errors: number;
}

async function reminders(road: Road, base: string, today: string, t: Tally) {
  if (road.settings.autoReminders === false || !(emailEnabled || smsEnabled)) return;
  const cap = captainHome(road);
  const sent: { homeId: string; channel: "text" | "email"; body: string }[] = [];
  for (const request of road.requests) {
    if (request.status !== "open" || !request.sentAt) continue;
    const offset = daysBetween(request.dueDate, today);
    if (!road.settings.reminderDays.includes(offset)) continue;
    const prog = requestProgress(road, request, new Date());
    for (const line of prog.lines) {
      // Skip homes that paid, are clearing, are on a payment plan, or said a check is in the mail.
      if (line.outstanding <= 0 || line.plan || line.processing > 0 || checkInMail(road, line.home.id, request.id, new Date())) continue;
      const home = line.home;
      const channel = serverChannel(home);
      if (!channel) continue;
      if (!(await once(`rem:${road.id}:${request.id}:${home.id}:${offset}`, 120 * DAY))) continue;
      const kind = offset <= 0 ? "reminder" : "friendly";
      const link = `${base}/n/${road.id}/${home.token}`;
      const values: Record<string, string> = {
        ...baseValues(road, home, link),
        amount: money(line.outstanding),
        due: fmtDate(request.dueDate),
        title: request.title,
        budget: budgetSummary(request.budget.map((b) => b.label)) || "plowing and upkeep",
      };
      const body = fillTokens(TOKEN_TEMPLATES[kind], values);
      const res =
        channel === "text"
          ? await sendSms(home.phone, `${body} ${SMS_FOOTER}`)
          : await sendEmail({
              to: home.email,
              fromName: `${road.name} via Road Fund`,
              replyTo: cap?.email,
              subject: fillTokens(TEMPLATE_SUBJECT[kind], values),
              text: `${body}\n\nThis is an automatic reminder. To stop these emails, open your page and choose Settings: ${link}#settings`,
            });
      if (res.ok) {
        sent.push({ homeId: home.id, channel, body });
        t.reminders++;
      }
    }
  }
  if (!sent.length) return;
  const commands: Command[] = (["text", "email"] as const)
    .map((ch) => sent.filter((s) => s.channel === ch))
    .filter((list) => list.length)
    .map((list) => ({ type: "message.log", message: { id: uid("msg"), at: new Date().toISOString(), kind: "reminder", channel: list[0].channel, homeIds: list.map((s) => s.homeId), body: list[0].body } }));
  await mutate(road.id, () => ({ commands, ctx: { at: new Date().toISOString(), actor: { kind: "system", homeId: null, name: "Automatic reminder" } } }));
}

async function letterNudges(road: Road, base: string, t: Tally) {
  if (!emailEnabled) return;
  const cap = captainHome(road);
  if (!cap || !validEmail(cap.email)) return;
  const waiting = road.letterRequests.filter((r) => r.status === "new" && Date.now() - Date.parse(r.createdAt) > 2 * DAY * 1000);
  for (const r of waiting) {
    if (!(await once(`lnudge:${road.id}:${r.id}`, 30 * DAY))) continue;
    await sendEmail({
      to: cap.email,
      fromName: "Road Fund",
      subject: `Still waiting: Road Status Letter for ${r.propertyAddress}`,
      text: `${r.requester.company || r.requester.name} asked for a Road Status Letter on ${fmtDate(r.createdAt.slice(0, 10))}${r.closingDate ? ` for a closing on ${fmtDate(r.closingDate)}` : ""}. It takes about a minute to issue, or you can decline it with a note.\n\n${base}/app/papers/letters`,
    });
    t.letters++;
  }
}

export async function GET(req: Request) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret) throw new CommandError("Set CRON_SECRET to turn on daily reminders.", 501);
    if (req.headers.get("authorization") !== `Bearer ${secret}`) throw new CommandError("Not allowed.", 401);
    if (!kvEnabled) return json({ skipped: "Cloud storage is off." });
    const base = origin(req);
    const today = isoDate();
    const t: Tally = { roads: 0, reminders: 0, letters: 0, errors: 0 };
    for (const id of await allRoadIds()) {
      try {
        const found = await loadRoad(id);
        if (!found || found.road.demo) continue;
        t.roads++;
        await reminders(found.road, base, today, t);
        await letterNudges(found.road, base, t);
      } catch (err) {
        t.errors++;
        console.error("cron road", id, err);
      }
    }
    return json(t);
  } catch (err) {
    return errorResponse(err);
  }
}
