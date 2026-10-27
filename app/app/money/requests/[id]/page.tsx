"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BellRing, Copy, ExternalLink, FileWarning, MoreHorizontal, Receipt, Send, Wallet } from "lucide-react";
import { hasPlan, PageHeader, PlanGate, StatusPill } from "@/components/app/common";
import { PaymentPlanDialog, ReceiptDialog, RecordPaymentDialog } from "@/components/app/money-dialogs";
import { SendSheet } from "@/components/app/send-sheet";
import { Button, Callout, Card, CardHeader, cx, Dialog, Empty, Progress } from "@/components/ui";
import { useToast } from "@/components/toast";
import { neighborLink } from "@/lib/client/backend";
import { copyText } from "@/lib/client/links";
import { duesRecipients } from "@/lib/client/recipients";
import { useRoad } from "@/lib/client/road-context";
import { agreementPlainText } from "@/lib/agreement";
import { fmtDate, fmtDateTime, fmtDay } from "@/lib/dates";
import { CATEGORY_LABEL } from "@/lib/factory";
import { uid } from "@/lib/ids";
import { money } from "@/lib/money";
import { latestShares } from "@/lib/neighbor";
import { displayName, dueSoonText, requestProgress, type LineProgress } from "@/lib/selectors";
import { methodSentence } from "@/lib/split";
import type { NoticeKind, Payment } from "@/lib/types";
import type { TemplateKind } from "@/lib/templates";

type Sheet = { kind: TemplateKind; heading: string; which: "all" | "unpaid"; homeId?: string } | null;

export default function RequestPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { road, dispatch, now } = useRoad();
  const toast = useToast();
  const req = road.requests.find((r) => r.id === id);
  // Arriving from "Create and send" opens the send sheet straight away.
  const autoSend = useSearchParams().get("send") === "1";
  const [sheet, setSheet] = useState<Sheet>(() => (req && autoSend ? { kind: "dues", heading: `Send "${req.title}"`, which: "all" } : null));
  const [recording, setRecording] = useState<LineProgress | null>(null);
  const [planFor, setPlanFor] = useState<LineProgress | null>(null);
  const [toolsFor, setToolsFor] = useState<LineProgress | null>(null);
  const [receipt, setReceipt] = useState<Payment | null>(null);

  useEffect(() => {
    if (autoSend) window.history.replaceState(null, "", window.location.pathname);
  }, [autoSend]);

  if (!req) {
    return (
      <Card>
        <Empty title="Request not found" action={<Link href="/app/money" className="font-semibold text-pine underline">Back to Money</Link>} />
      </Card>
    );
  }
  const prog = requestProgress(road, req, now);
  const unpaid = prog.lines.filter((l) => l.outstanding > 0);
  const messages = road.messages.filter((m) => m.body.includes(req.title) || (m.kind === "reminder" && m.at >= req.createdAt)).slice(0, 8);
  const recipients = sheet ? duesRecipients(road, req, now, sheet.which).filter((r) => !sheet.homeId || r.homeId === sheet.homeId) : [];

  const logSend = async (message: Parameters<React.ComponentProps<typeof SendSheet>["onLogged"]>[0]) => {
    if (!sheet) return false;
    if (sheet.kind === "dues") return dispatch({ type: "request.sent", requestId: req.id, message });
    if (sheet.kind === "friendly" || sheet.kind === "formal" || sheet.kind === "final") {
      return dispatch([
        { type: "message.log", message: { ...message, kind: "notice" } },
        ...message.homeIds.map((homeId) => ({
          type: "notice.create" as const,
          notice: { id: uid("ntc"), homeId, requestId: req.id, kind: sheet.kind as NoticeKind, createdAt: message.at, channel: message.channel, body: message.body },
        })),
      ]);
    }
    return dispatch({ type: "message.log", message: { ...message, kind: "reminder" } });
  };

  return (
    <>
      <PageHeader
        back={{ href: "/app/money", label: "Money" }}
        title={req.title}
        sub={`${money(req.total)} · ${req.status === "closed" ? "closed" : dueSoonText(req.dueDate, now)} (${fmtDate(req.dueDate)})`}
        actions={
          req.status === "open" ? (
            <>
              <Button onClick={() => setSheet({ kind: "dues", heading: `Send "${req.title}"`, which: "all" })} icon={<Send className="h-5 w-5" aria-hidden />} variant={req.sentAt ? "secondary" : "primary"}>
                {req.sentAt ? "Send again" : "Send to neighbors"}
              </Button>
              {req.sentAt && unpaid.length > 0 && (
                <Button onClick={() => setSheet({ kind: "reminder", heading: `Remind ${unpaid.length} neighbor${unpaid.length === 1 ? "" : "s"}`, which: "unpaid" })} icon={<BellRing className="h-5 w-5" aria-hidden />}>
                  Remind unpaid
                </Button>
              )}
            </>
          ) : undefined
        }
      />

      {!req.sentAt && req.status === "open" && (
        <Callout tone="warn" className="mb-5" title="Not sent yet">
          Neighbors can&apos;t see this until you send it. Each one gets their own link with their amount and the reason for it.
        </Callout>
      )}

      <Card className="mb-6 p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[0.85rem] font-semibold uppercase tracking-wide text-stone">Collected</p>
            <p className="tnum font-display text-[2rem] font-black leading-tight">
              {money(prog.collected)} <span className="text-[1.1rem] font-bold text-stone">of {money(prog.billed)}</span>
            </p>
          </div>
          <p className="text-stone">
            {prog.homesPaid} of {prog.homesBilled} homes paid
            {prog.processing > 0 && ` · ${money(prog.processing)} clearing`}
            {prog.lateCount > 0 && <span className="font-semibold text-brick"> · {prog.lateCount} late</span>}
          </p>
        </div>
        <div className="mt-3">
          <Progress value={prog.collected} max={prog.billed} label="Collected" />
        </div>
      </Card>

      <Card className="mb-6">
        <CardHeader title="Each home" sub={methodSentence(req.split)} />
        <ul className="divide-y divide-line">
          {prog.lines.map((l) => (
            <li key={l.home.id} className="px-5 py-3.5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {displayName(l.home)} <span className="font-normal text-stone">· {l.home.label}</span>
                  </p>
                  <p className="text-[0.9rem] text-stone">
                    Share {money(l.due)}
                    {l.paid > 0 && ` · paid ${money(l.paid)}`}
                    {l.outstanding > 0 && l.paid > 0 && ` · owes ${money(l.outstanding)}`}
                    {l.lastPaidAt && ` · last paid ${fmtDay(l.lastPaidAt, now)}`}
                    {l.plan && ` · plan: ${l.plan.installments.length} payments`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill status={l.status} />
                  <button className="rounded-lg border border-line p-2 text-stone hover:bg-paper-2" onClick={() => setToolsFor(l)} aria-label={`Actions for ${displayName(l.home)}`}>
                    <MoreHorizontal className="h-5 w-5" aria-hidden />
                  </button>
                </div>
              </div>
              {l.payments.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {l.payments.map((p) => (
                    <button key={p.id} onClick={() => setReceipt(p)} className="inline-flex items-center gap-1 rounded-md bg-paper px-2 py-1 text-[0.82rem] text-stone hover:bg-paper-2">
                      <Receipt className="h-3.5 w-3.5" aria-hidden /> {p.receiptNo} · {money(p.amount)}
                    </button>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="What it covers" />
          <ul className="divide-y divide-line">
            {req.budget.map((b) => (
              <li key={b.id} className="flex justify-between gap-3 px-5 py-2.5">
                <span>
                  {b.label} <span className="text-[0.85rem] text-stone">· {CATEGORY_LABEL[b.category]}</span>
                </span>
                <span className="tnum font-semibold">{money(b.amount)}</span>
              </li>
            ))}
          </ul>
          {req.message && <p className="border-t border-line px-5 py-3 text-stone">Note to neighbors: {req.message}</p>}
        </Card>
        <Card>
          <CardHeader title="Messages sent" />
          {messages.length === 0 ? (
            <p className="px-5 py-4 text-stone">Nothing sent yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {messages.map((m) => (
                <li key={m.id} className="px-5 py-2.5">
                  <p className="font-semibold">
                    {m.kind === "dues" ? "Dues sent" : m.kind === "notice" ? "Notice sent" : "Reminder sent"} to {m.homeIds.length} by {m.channel}
                  </p>
                  <p className="text-[0.88rem] text-stone">{fmtDateTime(m.at)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {req.status === "open" ? (
          <Button variant="secondary" onClick={() => dispatch({ type: "request.close", requestId: req.id }, "Request closed.")}>
            Close request
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => dispatch({ type: "request.reopen", requestId: req.id }, "Request reopened.")}>
            Reopen
          </Button>
        )}
        {prog.collected === 0 && (
          <Button
            variant="ghost"
            className="text-brick hover:bg-brick-50"
            onClick={async () => {
              if (window.confirm(`Delete "${req.title}"? This can't be undone.`) && (await dispatch({ type: "request.delete", requestId: req.id }, "Request deleted."))) router.push("/app/money");
            }}
          >
            Delete
          </Button>
        )}
      </div>

      {sheet && <SendSheet open onClose={() => setSheet(null)} kind={sheet.kind} heading={sheet.heading} recipients={recipients} logKind={sheet.kind === "dues" ? "dues" : "reminder"} onLogged={logSend} />}
      {recording && <RecordPaymentDialog open onClose={() => setRecording(null)} home={recording.home} request={req} outstanding={recording.outstanding} />}
      {planFor && <PaymentPlanDialog open onClose={() => setPlanFor(null)} home={planFor.home} request={req} outstanding={planFor.outstanding} />}
      <ReceiptDialog payment={receipt} onClose={() => setReceipt(null)} />

      {toolsFor && (
        <Dialog open onClose={() => setToolsFor(null)} title={displayName(toolsFor.home)}>
          <div className="space-y-5">
            <div className="grid gap-2">
              {toolsFor.outstanding > 0 && (
                <ToolButton icon={<Wallet className="h-5 w-5" aria-hidden />} title="Record a check or cash" sub={`Owes ${money(toolsFor.outstanding)}`} onClick={() => { setRecording(toolsFor); setToolsFor(null); }} />
              )}
              <ToolButton
                icon={<Copy className="h-5 w-5" aria-hidden />}
                title="Copy their pay link"
                sub="Anyone with the link can see this home's page"
                onClick={async () => {
                  if (await copyText(neighborLink(road, toolsFor.home.token))) toast("Link copied.");
                }}
              />
              <a href={`/n/${road.id}/${toolsFor.home.token}`} target="_blank" rel="noopener" className="flex items-center gap-3 rounded-xl border border-line p-3.5 hover:bg-paper">
                <ExternalLink className="h-5 w-5 text-pine" aria-hidden />
                <span>
                  <span className="block font-semibold">Open their page</span>
                  <span className="block text-[0.9rem] text-stone">See exactly what they see</span>
                </span>
              </a>
            </div>
            {toolsFor.outstanding > 0 && (
              <div>
                <h3 className="mb-2 flex items-center gap-2 font-bold">
                  <FileWarning className="h-5 w-5 text-brick" aria-hidden /> Late-payer toolkit
                </h3>
                {hasPlan(road.plan, "plus") ? (
                  <div className="grid gap-2">
                    {(
                      [
                        ["friendly", "Friendly nudge", "Assumes it slipped by and offers a plan"],
                        ["formal", "Formal notice", "Cites the late fee in the agreement, 14 days to pay"],
                        ["final", "Final notice", "Small claims in 10 days unless paid or on a plan"],
                      ] as const
                    ).map(([k, t, s]) => (
                      <ToolButton
                        key={k}
                        icon={<BellRing className="h-5 w-5" aria-hidden />}
                        title={t}
                        sub={`${s}${road.notices.some((n) => n.homeId === toolsFor.home.id && n.requestId === req.id && n.kind === k) ? " · sent before" : ""}`}
                        onClick={() => {
                          setSheet({ kind: k, heading: `${t} to ${displayName(toolsFor.home)}`, which: "unpaid", homeId: toolsFor.home.id });
                          setToolsFor(null);
                        }}
                      />
                    ))}
                    {!toolsFor.plan && (
                      <ToolButton icon={<Wallet className="h-5 w-5" aria-hidden />} title="Set up a payment plan" sub="Split what's owed into monthly payments" onClick={() => { setPlanFor(toolsFor); setToolsFor(null); }} />
                    )}
                    <ToolButton icon={<Receipt className="h-5 w-5" aria-hidden />} title="Print small-claims packet" sub="Ledger, agreement terms and every notice sent" onClick={() => printPacket(road, req.id, toolsFor, now)} />
                  </div>
                ) : (
                  <PlanGate needs="plus" feature="The late-payer toolkit" pitch="Friendly, formal and final notices, payment plans, and a small-claims packet with the ledger, agreement and notices.">
                    {null}
                  </PlanGate>
                )}
              </div>
            )}
          </div>
        </Dialog>
      )}
    </>
  );
}

function ToolButton({ icon, title, sub, onClick }: { icon: React.ReactNode; title: string; sub: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cx("flex items-center gap-3 rounded-xl border border-line p-3.5 text-left hover:bg-paper")}>
      <span className="text-pine">{icon}</span>
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="block text-[0.9rem] text-stone">{sub}</span>
      </span>
    </button>
  );
}

function printPacket(road: ReturnType<typeof useRoad>["road"], requestId: string, line: LineProgress, now: Date) {
  const req = road.requests.find((r) => r.id === requestId)!;
  const notices = road.notices.filter((n) => n.homeId === line.home.id && n.requestId === requestId);
  const shares = latestShares(road);
  const agreement = agreementPlainText({
    roadName: road.name,
    county: road.county,
    state: road.state,
    lengthFt: road.lengthFt,
    split: road.split,
    terms: road.agreement.terms,
    version: road.agreement.version,
    homes: road.homes.map((h) => ({ id: h.id, label: h.label, address: h.address, owners: h.owners, sharePct: shares.get(h.id) ?? null })),
  });
  const payments = road.payments.filter((p) => p.homeId === line.home.id);
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Small-claims packet: ${esc(displayName(line.home))}</title><style>body{font:14px/1.5 Georgia,serif;color:#1E2320;max-width:7in;margin:0.6in auto}h1{font-size:22px}h2{font-size:17px;margin-top:28px;border-bottom:1px solid #ccc}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #ddd;padding:4px 6px;text-align:left}pre{white-space:pre-wrap;font:12px/1.45 Georgia,serif}</style></head><body>
<h1>${esc(road.name)}: record of unpaid road dues</h1>
<p>Prepared ${now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} by the road captain.<br>Owner: ${esc(displayName(line.home))}, ${esc(line.home.address || line.home.label)}</p>
<h2>1. Amount owed</h2><table><tr><th>Request</th><th>Due</th><th>Share</th><th>Paid</th><th>Owed</th></tr><tr><td>${esc(req.title)}</td><td>${fmtDate(req.dueDate)}</td><td>${money(line.due)}</td><td>${money(line.paid)}</td><td><b>${money(line.outstanding)}</b></td></tr></table>
<p>How the share was set: ${esc(line.reason)}</p>
<h2>2. Payment history for this property</h2><table><tr><th>Date</th><th>Receipt</th><th>For</th><th>Amount</th><th>Status</th></tr>${payments.map((p) => `<tr><td>${fmtDate(p.paidAt)}</td><td>${p.receiptNo}</td><td>${esc(road.requests.find((r) => r.id === p.requestId)?.title ?? "")}</td><td>${money(p.amount)}</td><td>${p.status === "void" ? "Voided: " + esc(p.voidReason ?? "") : "Received"}</td></tr>`).join("") || "<tr><td colspan=5>No payments</td></tr>"}</table>
<h2>3. Notices sent</h2>${notices.length ? notices.map((n) => `<p><b>${fmtDateTime(n.createdAt)}</b> (${n.kind} notice by ${n.channel})<br>${esc(n.body)}</p>`).join("") : "<p>No formal notices recorded.</p>"}
<h2>4. Road maintenance agreement (status: ${road.agreement.step})</h2><pre>${esc(agreement)}</pre>
</body></html>`;
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html + "<script>window.onload=()=>window.print()</script>");
  w.document.close();
}
