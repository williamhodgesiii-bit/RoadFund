"use client";

import { useState } from "react";
import { Check, Copy, Mail, MessageSquare, Printer, Send } from "lucide-react";
import { Button, Callout, Checkbox, cx, Dialog, Textarea } from "@/components/ui";
import { useToast } from "@/components/toast";
import { sendFromServer } from "@/lib/client/backend";
import { copyText, mailtoHref, smsHref } from "@/lib/client/links";
import { useRoad } from "@/lib/client/road-context";
import { uid } from "@/lib/ids";
import type { Channel, MessageLog } from "@/lib/types";
import { fillTokens, smsLength, SMS_FOOTER, TEMPLATE_SUBJECT, TOKEN_TEMPLATES, type TemplateKind } from "@/lib/templates";

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
 * Fund sends it: texts to neighbors who agreed to them, email to the rest.
 * Anyone it can't reach gets a button that opens the captain's own Messages
 * or email app with the message filled in, or a printed letter.
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
  const { road, entry, status, replace } = useRoad();
  const [template, setTemplate] = useState(TOKEN_TEMPLATES[kind]);
  const [touched, setTouched] = useState<Record<string, Channel>>({});
  const [serverSent, setServerSent] = useState<Set<string>>(() => new Set());
  const [failed, setFailed] = useState<{ homeId: string; name: string; error: string }[]>([]);
  const [sending, setSending] = useState(false);
  // Two steps: check the message and who gets it, then send.
  const [step, setStep] = useState<"check" | "send">("check");
  const [editing, setEditing] = useState(false);
  // The first message from Road Fund shouldn't be the first a neighbor hears of it.
  const firstTime = road.messages.length === 0 && kind !== "reminder" && kind !== "friendly";
  const [told, setTold] = useState(!firstTime);
  const server = entry.where === "cloud" && !road.demo && (status.email || status.sms);
  const reach = (r: Recipient): "text" | "email" | null =>
    status.sms && r.smsOptIn && usPhone(r.phone) ? "text" : status.email && r.email.includes("@") && r.emailOptIn !== false ? "email" : null;

  const auto = server ? recipients.filter((r) => reach(r)) : recipients.filter((r) => r.smsOptIn && r.phone);
  const manual = server ? recipients.filter((r) => !reach(r) || failed.some((f) => f.homeId === r.homeId)) : recipients.filter((r) => !(r.smsOptIn && r.phone));
  const byText = auto.filter((r) => reach(r) === "text").length;
  // Preview with a neighbor, not the captain writing to themselves.
  const sample = recipients.find((r) => r.homeId !== road.captainHomeId) ?? recipients[0];
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
      toast(`Texted ${auto.length} neighbor${auto.length === 1 ? "" : "s"} (test mode, nothing sent).`);
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

  const printLetters = (list: Recipient[], body: (r: Recipient) => string, markSent = true) => {
    const w = window.open("", "_blank");
    if (!w) return toast("Allow pop-ups to print letters.", "error");
    const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
    const dated = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const pages = list
      .map(
        (r) =>
          `<section><p>${esc(dated)}</p><p>${esc(r.name)}<br>${esc(r.address || r.label)}</p><p>Dear ${esc(r.name)},</p>${body(r)
            .split("\n\n")
            .map((p) => `<p>${esc(p).replace(/https?:\/\/\S+/g, (u) => `<br><strong>${u}</strong><br>`)}</p>`)
            .join("")}<p>${esc(r.values.captainFull ?? "")}<br>${esc(road.name)}</p></section>`,
      )
      .join("");
    w.document.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>${esc(road.name)} letters</title><style>body{font:17px/1.6 Georgia,serif;color:#1E2320;margin:0}section{padding:1in;page-break-after:always;max-width:6.5in}strong{font-family:monospace;font-size:15px;word-break:break-all}</style></head><body>${pages}<script>window.onload=()=>window.print()</script></body></html>`,
    );
    w.document.close();
    if (markSent) list.forEach((r) => mark(r.homeId, "print"));
  };

  /** A paper letter from the captain, so neighbors know a text from Road Fund is coming and that it's real. */
  const introLetter = (r: Recipient) =>
    [
      `Starting now, ${road.name} is keeping its road money on Road Fund: each home's share, what was paid, and every bill for plowing and gravel. Every neighbor can see the same numbers.`,
      `You'll get a text or email from me with a link to your own page. It shows what you owe, why, and how to pay by bank, card or check. There's nothing to download and no password. You can also type this address into your browser: ${r.values.link}`,
      `Paying by check is always fine. ${r.values.verify}`,
    ].join("\n\n");

  const touchedCount = Object.keys(touched).length;
  const howFor = (r: Recipient): string => {
    if (server) return reach(r) === "text" ? "Text from Road Fund" : reach(r) === "email" ? "Email from Road Fund" : "You send it, or print a letter";
    return r.smsOptIn && r.phone ? "Text (test mode)" : "You send it, or print a letter";
  };

  if (step === "check") {
    return (
      <Dialog
        open={open}
        onClose={onClose}
        title="Check before you send"
        wide
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            {auto.length > 0 ? (
              <Button
                loading={sending}
                disabled={!told}
                icon={<Send className="h-5 w-5" aria-hidden />}
                onClick={async () => {
                  await sendAuto();
                  setStep("send");
                }}
              >
                Send to {auto.length} home{auto.length === 1 ? "" : "s"}
              </Button>
            ) : (
              <Button disabled={!told} onClick={() => setStep("send")}>
                Next: send it yourself
              </Button>
            )}
          </>
        }
      >
        <div className="space-y-6">
          <p className="text-[1.05rem] font-semibold">{heading}</p>
          {firstTime && (
            <Callout tone="warn" title="First, tell your neighbors it's coming">
              <p>People are warned not to tap links in texts they weren&apos;t expecting. Before the first message, hand out or mail a short letter from you, or mention it in person.</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button size="sm" variant="secondary" icon={<Printer className="h-4 w-4" aria-hidden />} onClick={() => printLetters(recipients, introLetter, false)}>
                  Print a letter for each home
                </Button>
              </div>
              <div className="mt-3">
                <Checkbox checked={told} onChange={setTold} label="My neighbors know a message from me through Road Fund is coming" />
              </div>
            </Callout>
          )}

          <section>
            <h3 className="font-bold">What {sample?.name ?? "each neighbor"} will get</h3>
            {sample && <p className="mt-2 whitespace-pre-line rounded-lg border border-line bg-paper p-4">{sampleText}</p>}
            <p className="mt-1.5 text-[0.95rem] text-stone">
              Each home gets its own name, amount and link{len.segments > 1 ? `. As a text, it's ${len.segments} messages long` : ""}.
            </p>
            {editing ? (
              <div className="mt-3">
                <label htmlFor="send-template" className="mb-1.5 block font-semibold">
                  Change the wording
                </label>
                <Textarea id="send-template" value={template} onChange={(e) => setTemplate(e.target.value)} rows={4} />
                <p className="mt-1.5 text-[0.95rem] text-stone">Leave the words in braces, like {"{amount}"}, as they are. They fill in for each neighbor.</p>
              </div>
            ) : (
              <button onClick={() => setEditing(true)} className="mt-2 min-h-11 font-semibold text-pine underline">
                Change the wording
              </button>
            )}
          </section>

          <section>
            <h3 className="font-bold">
              Who gets it ({recipients.length} home{recipients.length === 1 ? "" : "s"})
            </h3>
            <ul className="mt-2 divide-y divide-line border-y border-line">
              {recipients.map((r) => (
                <li key={r.homeId} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2.5">
                  <span>
                    <span className="font-semibold">{r.name}</span>
                    {r.values.amount && <span className="tnum text-stone"> · {r.values.amount}</span>}
                  </span>
                  <span className="text-[0.95rem] text-stone">{howFor(r)}</span>
                </li>
              ))}
            </ul>
            {!server && auto.length > 0 && <p className="mt-2 text-[0.95rem] text-stone">{road.demo ? "Sample road: nothing is actually sent." : "Test mode: nothing is actually sent."}</p>}
          </section>
        </div>
      </Dialog>
    );
  }

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
        {auto.length > 0 && server && serverSent.size > 0 && (
          <Callout tone="ok" title={`Sent to ${serverSent.size} home${serverSent.size === 1 ? "" : "s"}`}>
            {[byText ? `${byText} by text` : null, auto.length - byText ? `${auto.length - byText} by email` : null].filter(Boolean).join(", ")}.{" "}
            {byText ? <>Each text ends with &ldquo;{SMS_FOOTER}&rdquo; </> : null}
            Emails come from {road.name} through Road Fund, and replies come to you.
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
        {auto.length > 0 && !server && auto.every((a) => touched[a.homeId]) && (
          <Callout tone="ok" title={`Texted ${auto.length} home${auto.length === 1 ? "" : "s"}`}>
            Road Fund added &ldquo;{SMS_FOOTER}&rdquo; to each text. {road.demo ? "Sample road: nothing is actually sent." : "Test mode: nothing is actually sent."}
          </Callout>
        )}

        <div>
          <p className="font-semibold">{auto.length ? (manual.length ? "Everyone else: send it yourself" : "Everyone has it") : "Send it to each neighbor"}</p>
          {(auto.length ? manual : recipients).length > 0 && (
            <p className="text-[0.95rem] text-stone">Text and Email open your own phone&apos;s apps with the message filled in. You press send. Letter prints a page to hand out or mail.</p>
          )}
          <ul className={cx("mt-3 divide-y divide-line rounded-lg border border-line", !(auto.length ? manual : recipients).length && "hidden")}>
            {(auto.length ? manual : recipients).map((r) => {
              const body = bodyFor(r);
              const t = touched[r.homeId];
              return (
                <li key={r.homeId} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-semibold">
                      {r.name}
                      {t && (
                        <span className="inline-flex items-center gap-1 text-[0.85rem] font-semibold text-pine">
                          <Check className="h-4 w-4" aria-hidden /> {DONE_LABEL[t]}
                        </span>
                      )}
                    </p>
                    <p className="truncate text-[0.9rem] text-stone">{[r.values.amount, r.phone || null, r.email || null].filter(Boolean).join(" · ") || "No phone or email on file"}</p>
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
                          toast(`Copied the message for ${r.name}.`);
                        }
                      }}
                    >
                      <Copy className="h-4 w-4" aria-hidden /> Copy
                    </button>
                    <button type="button" className={chip(t === "print")} onClick={() => printLetters([r], bodyFor)}>
                      <Printer className="h-4 w-4" aria-hidden /> Letter
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          {manual.length > 1 && (
            <Button
              size="sm"
              variant="ghost"
              className="mt-2"
              icon={<Printer className="h-4 w-4" aria-hidden />}
              onClick={() => printLetters(manual.filter((m) => !m.phone && !m.email).length ? manual.filter((m) => !m.phone && !m.email) : manual, bodyFor)}
            >
              Print letters for {manual.filter((m) => !m.phone && !m.email).length ? "neighbors without a phone or email" : "everyone listed"}
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
    "inline-flex min-h-11 items-center gap-1.5 rounded-lg border-2 px-3 text-[0.95rem] font-semibold",
    on ? "border-pine bg-pine-50 text-pine" : "border-line bg-white text-charcoal hover:border-field",
  );
}
