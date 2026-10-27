"use client";

import { useState } from "react";
import { Check, Copy, Mail, MessageSquare, Printer, Send, Sparkles } from "lucide-react";
import { Button, Callout, cx, Dialog, Textarea } from "@/components/ui";
import { useToast } from "@/components/toast";
import { ai, sendFromServer } from "@/lib/client/backend";
import { copyText, mailtoHref, smsHref } from "@/lib/client/links";
import { useRoad } from "@/lib/client/road-context";
import { uid } from "@/lib/ids";
import type { Channel, MessageLog } from "@/lib/types";
import { fillTokens, smsLength, SMS_FOOTER, TEMPLATE_SUBJECT, TOKEN_TEMPLATES, type TemplateKind } from "@/lib/templates";
import { useAiOn } from "./common";

export interface Recipient {
  homeId: string;
  name: string;
  label: string;
  address: string;
  phone: string;
  email: string;
  smsOptIn: boolean;
  emailOptIn?: boolean;
  values: Record<string, string>;
}

const usPhone = (p: string) => /^1?[2-9]\d{9}$/.test(p.replace(/\D/g, ""));

/**
 * Sends one message to many neighbors. When email or texting is set up, Road
 * Fund sends it: texts to neighbors who opted in, email to the rest. Anyone it
 * can't reach gets a one-tap button that opens the captain's own Messages or
 * email app with the text filled in, or a printed letter.
 */
export function SendSheet({
  open,
  onClose,
  kind,
  heading,
  recipients,
  logKind,
  onLogged,
}: {
  open: boolean;
  onClose: () => void;
  kind: TemplateKind;
  heading: string;
  recipients: Recipient[];
  logKind: MessageLog["kind"];
  onLogged: (message: MessageLog) => Promise<boolean> | boolean;
}) {
  const toast = useToast();
  const aiOn = useAiOn();
  const { road, entry, status, replace } = useRoad();
  const [template, setTemplate] = useState(TOKEN_TEMPLATES[kind]);
  const [touched, setTouched] = useState<Record<string, Channel>>({});
  const [serverSent, setServerSent] = useState<Set<string>>(() => new Set());
  const [failed, setFailed] = useState<{ homeId: string; name: string; error: string }[]>([]);
  const [sending, setSending] = useState(false);
  const server = entry.where === "cloud" && !road.demo && (status.email || status.sms);
  const reach = (r: Recipient): "text" | "email" | null =>
    status.sms && r.smsOptIn && usPhone(r.phone) ? "text" : status.email && r.email.includes("@") && r.emailOptIn !== false ? "email" : null;
  const [rewriting, setRewriting] = useState(false);
  const [tone, setTone] = useState<"friendly" | "firm">(kind === "formal" || kind === "final" ? "firm" : "friendly");

  const auto = server ? recipients.filter((r) => reach(r)) : recipients.filter((r) => r.smsOptIn && r.phone);
  const manual = server ? recipients.filter((r) => !reach(r) || failed.some((f) => f.homeId === r.homeId)) : recipients.filter((r) => !(r.smsOptIn && r.phone));
  const byText = auto.filter((r) => reach(r) === "text").length;
  const sample = recipients[0];
  const sampleText = sample ? fillTokens(template, sample.values) : template;
  const len = smsLength(`${sampleText} ${SMS_FOOTER}`);

  const bodyFor = (r: Recipient) => fillTokens(template, r.values);
  const subjectFor = (r: Recipient) => fillTokens(TEMPLATE_SUBJECT[kind], r.values);

  const mark = (homeId: string, channel: Channel) => setTouched((t) => ({ ...t, [homeId]: channel }));

  const log = async (homeIds: string[], channel: Channel) => {
    if (!homeIds.length) return true;
    return onLogged({ id: uid("msg"), at: new Date().toISOString(), kind: logKind, channel, homeIds, body: sample ? bodyFor(recipients.find((r) => homeIds.includes(r.homeId)) ?? sample) : template });
  };

  const sendAuto = async () => {
    if (server) {
      setSending(true);
      try {
        const res = await sendFromServer(entry, { kind, logKind, template, recipients: auto.map((r) => ({ homeId: r.homeId, values: r.values })) });
        replace(res.road);
        const ok = res.results.filter((x) => x.ok);
        const bad = res.results.filter((x) => !x.ok);
        setServerSent(new Set(ok.map((x) => x.homeId)));
        ok.forEach((x) => mark(x.homeId, x.channel === "text" ? "text" : "email"));
        setFailed(bad.map((x) => ({ homeId: x.homeId, name: recipients.find((r) => r.homeId === x.homeId)?.name ?? "A neighbor", error: x.error ?? "Didn't send" })));
        toast(bad.length ? `Sent to ${ok.length}. ${bad.length} didn't go through; they're listed below.` : `Sent to ${ok.length} neighbor${ok.length === 1 ? "" : "s"}.`, bad.length ? "error" : undefined);
      } catch (e) {
        toast(e instanceof Error ? e.message : "Sending failed. Try again.", "error");
      }
      setSending(false);
      return;
    }
    const ok = await log(
      auto.map((r) => r.homeId),
      "text",
    );
    if (ok) {
      auto.forEach((r) => mark(r.homeId, "text"));
      toast(`Texted ${auto.length} neighbor${auto.length === 1 ? "" : "s"} (simulated).`);
    }
  };

  const finish = async () => {
    const byChannel = new Map<Channel, string[]>();
    for (const [homeId, ch] of Object.entries(touched)) {
      if (serverSent.has(homeId)) continue; // Road Fund logged it when it sent
      if (!server && auto.some((a) => a.homeId === homeId) && ch === "text") continue; // already logged
      byChannel.set(ch, [...(byChannel.get(ch) ?? []), homeId]);
    }
    for (const [ch, ids] of byChannel) await log(ids, ch);
    onClose();
  };

  const rewrite = async () => {
    setRewriting(true);
    const facts: Record<string, string> = { road: road.name, "message type": kind, "tokens to keep exactly": "{first} {amount} {due} {link} {captain} {road} {title} {question} {deadline} {budget} {lateFee} {graceDays}" };
    const res = await ai<{ text: string }>({ task: "message", kind, tone, draft: template, facts, channel: "text" });
    setRewriting(false);
    if (res.ok && res.data?.text) {
      const missing = ["{link}"].filter((t) => template.includes(t) && !res.data!.text.includes(t));
      if (missing.length) return toast("The rewrite dropped the pay link, so it wasn't used. Try again.", "error");
      setTemplate(res.data.text);
    } else toast(res.error ?? "Rewrite failed.", "error");
  };

  const printLetters = (list: Recipient[]) => {
    const w = window.open("", "_blank");
    if (!w) return toast("Allow pop-ups to print letters.", "error");
    const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
    const pages = list
      .map(
        (r) => `<section><p>${esc(r.name)}<br>${esc(r.address || r.label)}</p><p>${esc(new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }))}</p><p>Dear ${esc(r.name)},</p><p>${esc(bodyFor(r)).replace(/https?:\/\/\S+/g, (u) => `<br><strong>${u}</strong><br>`)}</p><p>You can also pay by check made out to the road and given to the road captain.</p></section>`,
      )
      .join("");
    w.document.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>${esc(road.name)} letters</title><style>body{font:16px/1.6 Georgia,serif;color:#1E2320;margin:0}section{padding:1in;page-break-after:always;max-width:6.5in}strong{font-family:monospace;font-size:14px;word-break:break-all}</style></head><body>${pages}<script>window.onload=()=>window.print()</script></body></html>`,
    );
    w.document.close();
    list.forEach((r) => mark(r.homeId, "print"));
  };

  const touchedCount = Object.keys(touched).length;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={heading}
      wide
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button onClick={finish} disabled={touchedCount === 0} icon={<Check className="h-5 w-5" aria-hidden />}>
            Done{touchedCount ? ` · ${touchedCount} sent` : ""}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="send-template" className="font-semibold">
              Message
            </label>
            {aiOn && (
              <div className="flex items-center gap-2">
                <select value={tone} onChange={(e) => setTone(e.target.value as "friendly" | "firm")} className="rounded-lg border border-line bg-white px-2 py-1.5 text-[0.9rem]" aria-label="Tone">
                  <option value="friendly">Friendly</option>
                  <option value="firm">Firm</option>
                </select>
                <Button size="sm" variant="secondary" loading={rewriting} icon={<Sparkles className="h-4 w-4" aria-hidden />} onClick={rewrite}>
                  Rewrite in my voice
                </Button>
              </div>
            )}
          </div>
          <Textarea id="send-template" value={template} onChange={(e) => setTemplate(e.target.value)} rows={4} />
          <p className="mt-1.5 text-[0.88rem] text-stone">
            Words in braces fill in per neighbor: {"{first}"}, {"{amount}"}, {"{due}"}, {"{link}"}. Preview for {sample?.name ?? "a neighbor"}: {len.chars} characters
            {len.segments > 1 ? `, ${len.segments} text segments` : ""}.
          </p>
          {sample && <p className="mt-2 rounded-xl bg-paper p-3 text-[0.95rem]">{sampleText}</p>}
        </div>

        {auto.length > 0 && server && (
          <Callout
            tone="ok"
            title={`Road Fund can reach ${auto.length} neighbor${auto.length === 1 ? "" : "s"}`}
            action={
              <Button size="sm" loading={sending} icon={<Send className="h-4 w-4" aria-hidden />} onClick={sendAuto} disabled={auto.every((a) => serverSent.has(a.homeId))}>
                {auto.every((a) => serverSent.has(a.homeId)) ? "Sent" : `Send to ${auto.length} now`}
              </Button>
            }
          >
            {[byText ? `${byText} by text` : null, auto.length - byText ? `${auto.length - byText} by email` : null].filter(Boolean).join(", ")}.{" "}
            {byText ? <>Each text ends with &ldquo;{SMS_FOOTER}&rdquo; </> : null}
            Emails come from {road.name} via Road Fund, and replies go to you.
          </Callout>
        )}
        {failed.length > 0 && (
          <Callout tone="warn" title="These didn't go through">
            <ul className="list-disc pl-5">
              {failed.map((f) => (
                <li key={f.homeId}>
                  {f.name}: {f.error}
                </li>
              ))}
            </ul>
            Use the buttons below to send them yourself.
          </Callout>
        )}
        {auto.length > 0 && !server && (
          <Callout
            tone="ok"
            title={`${auto.length} neighbor${auto.length === 1 ? "" : "s"} agreed to texts`}
            action={
              <Button size="sm" icon={<Send className="h-4 w-4" aria-hidden />} onClick={sendAuto} disabled={auto.every((a) => touched[a.homeId])}>
                {auto.every((a) => touched[a.homeId]) ? "Sent" : `Text all ${auto.length} now`}
              </Button>
            }
          >
            Road Fund texts them with &ldquo;{SMS_FOOTER}&rdquo; added. {road.demo ? "Demo road: nothing is actually sent." : "Test mode: nothing is actually sent."}
          </Callout>
        )}

        <div>
          <p className="font-semibold">{auto.length ? "Everyone else" : "Send to each neighbor"}</p>
          <p className="text-[0.9rem] text-stone">Text and Email open your phone&apos;s own apps with the message filled in. You press send.</p>
          <ul className="mt-3 divide-y divide-line rounded-xl border border-line">
            {(auto.length ? manual : recipients).map((r) => {
              const body = bodyFor(r);
              const t = touched[r.homeId];
              return (
                <li key={r.homeId} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-semibold">
                      {r.name}
                      {t && (
                        <span className="inline-flex items-center gap-1 text-[0.82rem] font-semibold text-pine">
                          <Check className="h-4 w-4" aria-hidden /> {DONE_LABEL[t]}
                        </span>
                      )}
                    </p>
                    <p className="truncate text-[0.88rem] text-stone">{[r.values.amount, r.phone || null, r.email || null].filter(Boolean).join(" · ") || "No phone or email on file"}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {r.phone && (
                      <a href={smsHref(r.phone, body)} onClick={() => mark(r.homeId, "text")} className={chip(t === "text")}>
                        <MessageSquare className="h-4 w-4" aria-hidden /> Text
                      </a>
                    )}
                    {r.email && (
                      <a href={mailtoHref(r.email, subjectFor(r), body)} onClick={() => mark(r.homeId, "email")} className={chip(t === "email")}>
                        <Mail className="h-4 w-4" aria-hidden /> Email
                      </a>
                    )}
                    <button
                      type="button"
                      className={chip(t === "link")}
                      onClick={async () => {
                        if (await copyText(body)) {
                          mark(r.homeId, "link");
                          toast(`Copied ${r.name}'s message.`);
                        }
                      }}
                    >
                      <Copy className="h-4 w-4" aria-hidden /> Copy
                    </button>
                    <button type="button" className={chip(t === "print")} onClick={() => printLetters([r])}>
                      <Printer className="h-4 w-4" aria-hidden /> Letter
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          {manual.length > 1 && (
            <Button size="sm" variant="ghost" className="mt-2" icon={<Printer className="h-4 w-4" aria-hidden />} onClick={() => printLetters(manual.filter((m) => !m.phone && !m.email).length ? manual.filter((m) => !m.phone && !m.email) : manual)}>
              Print letters for {manual.filter((m) => !m.phone && !m.email).length ? "neighbors without phone or email" : "everyone listed"}
            </Button>
          )}
        </div>
      </div>
    </Dialog>
  );
}

const DONE_LABEL: Record<Channel, string> = { text: "texted", email: "emailed", print: "printed", link: "copied" };

function chip(on: boolean) {
  return cx(
    "inline-flex min-h-10 items-center gap-1.5 rounded-lg border-2 px-3 text-[0.9rem] font-semibold",
    on ? "border-pine bg-pine-50 text-pine" : "border-line bg-white text-charcoal hover:border-field",
  );
}
