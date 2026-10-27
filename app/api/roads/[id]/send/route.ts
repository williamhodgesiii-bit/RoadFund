import { CommandError } from "@/lib/commands";
import { uid } from "@/lib/ids";
import { captainHome, displayName } from "@/lib/selectors";
import { errorResponse, json, limited, rateLimit, readJSON } from "@/lib/server/http";
import { emailEnabled, sendEmail, sendSms, serverChannel, smsEnabled } from "@/lib/server/notify";
import { checkCaptain, loadRoad, mutate } from "@/lib/server/store";
import { fillTokens, SMS_FOOTER, TEMPLATE_SUBJECT, type TemplateKind } from "@/lib/templates";
import type { Command } from "@/lib/commands";
import type { MessageLog } from "@/lib/types";

export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

interface Body {
  kind: TemplateKind;
  logKind: MessageLog["kind"];
  template: string;
  recipients: { homeId: string; values: Record<string, string> }[];
}

interface SendOutcome {
  homeId: string;
  channel: "text" | "email" | null;
  ok: boolean;
  error?: string;
}

const LOG_KINDS = new Set(["dues", "reminder", "notice", "vote", "agreement", "letter", "weather", "general"]);

/** Sends a captain's message from Road Fund: texts to neighbors who opted in, email to the rest. */
export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    if (!(await checkCaptain(id, req.headers.get("x-road-key")))) throw new CommandError("This captain link isn't valid for this road.", 401);
    if (!emailEnabled && !smsEnabled) throw new CommandError("Sending from Road Fund isn't set up on this deployment.", 501);
    const found = await loadRoad(id);
    if (!found) throw new CommandError("Road not found.", 404);
    const road = found.road;
    if (road.demo) throw new CommandError("The demo road doesn't send real messages.", 409);

    const body = await readJSON<Body>(req, 100_000);
    const template = String(body.template ?? "").trim();
    if (!template || template.length > 1200) throw new CommandError("Write a message first (1,200 characters at most).");
    if (!Array.isArray(body.recipients) || body.recipients.length === 0 || body.recipients.length > 60) throw new CommandError("Pick who to send to.");
    if (!(await rateLimit(`send:${id}`, 300, 24 * 60 * 60_000))) return limited();

    const origin = new URL(req.url).origin;
    const cap = captainHome(road);
    const subjectTemplate = TEMPLATE_SUBJECT[body.kind] ?? "A message about {road}";
    const seen = new Set<string>();
    const jobs: (() => Promise<SendOutcome>)[] = [];
    for (const r of body.recipients) {
      const home = road.homes.find((h) => h.id === r.homeId);
      if (!home || seen.has(home.id)) continue;
      seen.add(home.id);
      const link = `${origin}/n/${road.id}/${home.token}`;
      const values: Record<string, string> = {};
      for (const [k, v] of Object.entries(r.values ?? {})) if (typeof v === "string") values[k] = v.slice(0, 300);
      values.link = link; // always the neighbor's real page, never something typed in
      const text = fillTokens(template, values);
      const channel = serverChannel(home);
      jobs.push(async () => {
        if (channel === "text") {
          const res = await sendSms(home.phone, text.includes("STOP") ? text : `${text} ${SMS_FOOTER}`);
          return { homeId: home.id, channel, ok: res.ok, error: res.ok ? undefined : res.error };
        }
        if (channel === "email") {
          const res = await sendEmail({
            to: home.email,
            fromName: `${road.name} via Road Fund`,
            replyTo: cap?.email,
            subject: fillTokens(subjectTemplate, values),
            text: `${text}\n\n${cap ? `Reply to this email to reach ${displayName(cap)}.` : ""}\nYou get these emails because your home is on ${road.name}. To stop them, open your page and choose Settings: ${link}#settings`,
          });
          return { homeId: home.id, channel, ok: res.ok, error: res.ok ? undefined : res.error };
        }
        return { homeId: home.id, channel: null, ok: false, error: "No way to reach them from Road Fund" };
      });
    }

    const results: SendOutcome[] = [];
    for (let i = 0; i < jobs.length; i += 5) results.push(...(await Promise.all(jobs.slice(i, i + 5).map((j) => j()))));

    const logKind = LOG_KINDS.has(body.logKind) ? body.logKind : "general";
    const commands: Command[] = [];
    for (const ch of ["text", "email"] as const) {
      const ids = results.filter((r) => r.ok && r.channel === ch).map((r) => r.homeId);
      if (!ids.length) continue;
      const sample = road.homes.find((h) => h.id === ids[0])!;
      const values = body.recipients.find((r) => r.homeId === sample.id)?.values ?? {};
      commands.push({ type: "message.log", message: { id: uid("msg"), at: new Date().toISOString(), kind: logKind, channel: ch, homeIds: ids, body: fillTokens(template, { ...values, link: `${origin}/n/${road.id}/${sample.token}` }) } });
    }
    const next = commands.length
      ? await mutate(id, () => ({ commands, ctx: { at: new Date().toISOString(), actor: { kind: "captain", homeId: cap?.id ?? null, name: cap ? displayName(cap) : "Road captain" } } }))
      : road;
    return json({ results, road: next });
  } catch (err) {
    return errorResponse(err);
  }
}
