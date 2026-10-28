"use client";

import { useState } from "react";
import { Check, Mail, MessageSquare, Printer } from "lucide-react";
import { Button, Callout, Dialog } from "@/components/ui";
import { useToast } from "@/components/toast";
import { mailtoHref, smsHref } from "@/lib/client/links";
import { neighborLink } from "@/lib/client/backend";
import { useRoad } from "@/lib/client/road-context";
import { uid } from "@/lib/ids";
import { displayName, type LineProgress } from "@/lib/selectors";
import { baseValues, fillTokens, noticeLetter, TOKEN_TEMPLATES } from "@/lib/templates";
import type { DuesRequest } from "@/lib/types";

/**
 * Formal and final notices go out as dated letters the captain mails, not as
 * texts: a court warning in a text reads like a scam, and several state laws
 * expect a written demand before a lawsuit.
 */
export function NoticeLetterDialog({ kind, line, request, onClose }: { kind: "formal" | "final"; line: LineProgress; request: DuesRequest; onClose: () => void }) {
  const { road, dispatch, now } = useRoad();
  const toast = useToast();
  const [printed, setPrinted] = useState(false);
  const home = line.home;
  const link = neighborLink(road, home.token);
  const formal = road.notices.find((n) => n.homeId === home.id && n.requestId === request.id && n.kind === "formal");
  const letter = noticeLetter({ kind, date: now, road, home, amount: line.outstanding, title: request.title, dueDate: request.dueDate, link, formalSentOn: formal?.createdAt.slice(0, 10) ?? null });
  const headsUp = fillTokens(TOKEN_TEMPLATES.letterSent, { ...baseValues(road, home, link), title: request.title });

  const print = () => {
    const w = window.open("", "_blank");
    if (!w) return toast("Allow pop-ups to print the letter.", "error");
    const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
    const html = letter.body
      .split("\n\n")
      .map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`)
      .join("");
    w.document.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>${esc(letter.subject)}</title><style>body{font:16px/1.6 Georgia,serif;color:#1E2320;margin:0}main{padding:1in;max-width:6.5in}p{margin:0 0 1em}</style></head><body><main>${html}</main><script>window.onload=()=>window.print()</script></body></html>`,
    );
    w.document.close();
    setPrinted(true);
  };

  const done = async () => {
    const at = new Date().toISOString();
    const ok = await dispatch(
      [
        { type: "message.log", message: { id: uid("msg"), at, kind: "notice", channel: "print", homeIds: [home.id], body: letter.body } },
        { type: "notice.create", notice: { id: uid("ntc"), homeId: home.id, requestId: request.id, kind, createdAt: at, channel: "print", body: letter.body } },
      ],
      "Recorded. The letter is in the small-claims packet.",
    );
    if (ok) onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      wide
      title={`${kind === "final" ? "Final letter" : "Letter"} to ${displayName(home)}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button icon={<Check className="h-5 w-5" aria-hidden />} onClick={done} disabled={!printed && !home.email}>
            I mailed it
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Callout tone="info" title={kind === "final" ? "Send this one by certified mail" : "Mail it, and keep a copy"}>
          {kind === "final"
            ? "Ask the post office for certified mail with a return receipt. It costs a few dollars and gives you proof the letter arrived, which a small claims judge will want to see."
            : "First-class mail is fine. Road Fund keeps a copy with the date, so it's in the record if you need it later."}
        </Callout>
        <div className="max-h-[22rem] overflow-y-auto whitespace-pre-line rounded-xl border border-line bg-white p-5 font-serif text-[1rem] leading-relaxed" tabIndex={0} aria-label="Letter preview">
          {letter.body}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button icon={<Printer className="h-5 w-5" aria-hidden />} onClick={print}>
            Print the letter
          </Button>
          {home.email && (
            <a
              href={mailtoHref(home.email, letter.subject, letter.body)}
              onClick={() => setPrinted(true)}
              className="inline-flex min-h-12 items-center gap-2 rounded-xl border-2 border-pine/80 bg-white px-5 font-semibold text-pine hover:bg-pine-50"
            >
              <Mail className="h-5 w-5" aria-hidden /> Email a copy too
            </a>
          )}
          {home.phone && (
            <a href={smsHref(home.phone, headsUp)} className="inline-flex min-h-12 items-center gap-2 rounded-xl border-2 border-line bg-white px-5 font-semibold hover:border-field">
              <MessageSquare className="h-5 w-5" aria-hidden /> Text that a letter is coming
            </a>
          )}
        </div>
      </div>
    </Dialog>
  );
}
