"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useHash } from "@/lib/client/use-browser";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  CircleCheck,
  Clock,
  CreditCard,
  FileSignature,
  House,
  Landmark,
  LoaderCircle,
  Mail,
  MessageSquare,
  Phone,
  Printer,
  Receipt as ReceiptIcon,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { AskAgreement } from "@/components/app/ask-agreement";
import { StoredFileThumb } from "@/components/app/common";
import { LogoMark } from "@/components/logo";
import { RoadStrip } from "@/components/road-strip";
import { Button, Callout, Card, CardHeader, Checkbox, Choice, cx, Field, Input, Pill, Progress, Toggle } from "@/components/ui";
import { AmountInput } from "@/components/amount-input";
import { useToast } from "@/components/toast";
import { AGREEMENT_DISCLAIMER, buildAgreement } from "@/lib/agreement";
import { confirmCheckout, getStatus, neighborLoad, neighborSend, OFFLINE_STATUS, paysForReal, startCheckout, type Status } from "@/lib/client/backend";
import { mailtoHref, smsHref } from "@/lib/client/links";
import type { Command } from "@/lib/commands";
import { addBusinessDays, fmtDate, fmtDateTime, fmtDay } from "@/lib/dates";
import { CATEGORY_LABEL } from "@/lib/factory";
import { computeCharge, SETTLE_BUSINESS_DAYS } from "@/lib/fees";
import { uid } from "@/lib/ids";
import { money } from "@/lib/money";
import type { NeighborView } from "@/lib/neighbor";
import { methodSentence } from "@/lib/split";
import { stateName } from "@/lib/states";
import type { Payment } from "@/lib/types";

type Screen = { name: "home" } | { name: "pay"; requestId: string } | { name: "agreement" } | { name: "receipt"; id: string } | { name: "settings" };

function parseHash(h: string): Screen {
  if (h.startsWith("pay-")) return { name: "pay", requestId: h.slice(4) };
  if (h === "agreement") return { name: "agreement" };
  if (h === "settings") return { name: "settings" };
  if (h.startsWith("receipt-")) return { name: "receipt", id: h.slice(8) };
  return { name: "home" };
}

export function NeighborApp({ roadId, token }: { roadId: string; token: string }) {
  const toast = useToast();
  const [view, setView] = useState<NeighborView | null>(null);
  const [where, setWhere] = useState<"local" | "cloud">("local");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>(OFFLINE_STATUS);
  // Coming back from Stripe Checkout (?paid=...). Only shown once the page has loaded, so server and browser markup still match.
  const [returned, setReturned] = useState<{ payment: Payment | null; checking: boolean } | null>(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).has("paid") ? { payment: null, checking: true } : null,
  );
  const hash = useHash();
  const screen = useMemo(() => parseHash(hash), [hash]);

  const load = useCallback(
    () =>
      neighborLoad(roadId, token).then(
        (res) => {
          setView(res.view);
          setWhere(res.where);
        },
        (e) => setError(e instanceof Error ? e.message : "This link didn't open."),
      ),
    [roadId, token],
  );

  useEffect(() => {
    getStatus().then(setStatus);
  }, []);

  // Back from Stripe Checkout: confirm the payment and show the thank-you screen.
  useEffect(() => {
    const paid = new URLSearchParams(window.location.search).get("paid");
    if (!paid) return;
    window.history.replaceState(null, "", window.location.pathname + window.location.hash);
    let live = true;
    const check = async (tries: number): Promise<void> => {
      try {
        const res = await confirmCheckout(roadId, token, paid);
        if (!live) return;
        setView(res.view);
        const payment = res.view.receipts.find((p) => p.id === res.paymentId) ?? null;
        if (!payment && tries > 0) {
          setReturned({ payment: null, checking: true });
          window.setTimeout(() => check(tries - 1), 2000);
          return;
        }
        setReturned({ payment, checking: false });
      } catch (e) {
        if (live) toast(e instanceof Error ? e.message : "We couldn't confirm the payment yet. Check your page again in a minute.", "error");
      }
    };
    void check(3);
    return () => {
      live = false;
    };
  }, [roadId, token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
    // Neighbors often switch to their banking app and back; refresh when they return.
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load]);

  const go = (hash: string) => {
    window.location.hash = hash;
    window.scrollTo({ top: 0 });
  };

  const send = async (command: Command, ok?: string): Promise<NeighborView | null> => {
    try {
      const next = await neighborSend(roadId, token, command, where);
      setView(next);
      if (ok) toast(ok);
      return next;
    } catch (e) {
      toast(e instanceof Error ? e.message : "That didn't go through. Try again.", "error");
      return null;
    }
  };

  if (error) {
    return (
      <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-4">
        <LogoMark className="h-12 w-12" />
        <Callout tone="danger" title="This link didn't open">
          {error}
        </Callout>
      </main>
    );
  }
  if (!view) {
    return (
      <div className="flex min-h-dvh items-center justify-center gap-2 text-stone">
        <LoaderCircle className="h-6 w-6 animate-spin" aria-hidden /> Opening your page…
      </div>
    );
  }

  const first = (view.me.owners || view.me.label).split(/\s|&/)[0];
  const owed = view.bills.reduce((a, b) => a + b.line.outstanding, 0);
  const live = paysForReal(status, view.road) && where === "cloud";
  const banner = view.road.demo
    ? "Demo road: nothing here is real."
    : live
      ? status.stripe === "test"
        ? "Stripe test mode: no real money moves. Test card 4242 4242 4242 4242."
        : null
      : "Test mode: no real money moves.";

  return (
    <div className="min-h-dvh pb-24">
      <header className="bg-pine text-white">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3 px-4 pb-5 pt-5">
          <div className="min-w-0">
            <p className="truncate text-[0.82rem] font-semibold uppercase tracking-wider opacity-85">{view.road.name}</p>
            <p className="truncate font-display text-[1.4rem] font-extrabold">{screen.name === "home" ? `Hi ${first}` : screen.name === "pay" ? "Pay your share" : screen.name === "agreement" ? "Road agreement" : screen.name === "receipt" ? "Receipt" : "Your settings"}</p>
          </div>
          <span className="shrink-0 rounded-full bg-white/15 px-3 py-1 text-[0.85rem] font-semibold">{view.me.label}</span>
        </div>
      </header>
      {banner && <div className="border-b border-sign/50 bg-sign-50 px-4 py-1.5 text-center text-[0.82rem] text-sign-ink">{banner}</div>}

      <main id="main" className="mx-auto max-w-xl space-y-5 px-4 pt-5">
        {screen.name !== "home" && !returned && (
          <button onClick={() => go("")} className="inline-flex items-center gap-1.5 font-semibold text-pine">
            <ArrowLeft className="h-4 w-4" aria-hidden /> Back
          </button>
        )}
        {returned ? (
          <ThankYou view={view} payment={returned.payment} checking={returned.checking} go={go} onDone={() => setReturned(null)} />
        ) : (
          <>
            {screen.name === "home" && <HomeScreen view={view} where={where} go={go} send={send} />}
            {screen.name === "pay" && <PayScreen view={view} requestId={screen.requestId} go={go} send={send} live={live} roadId={roadId} token={token} />}
          </>
        )}
        {screen.name === "agreement" && <AgreementScreen view={view} send={send} aiOn={status.ai && view.road.plan !== "starter"} />}
        {screen.name === "receipt" && <ReceiptScreen view={view} id={screen.id} />}
        {screen.name === "settings" && <SettingsScreen view={view} send={send} />}
      </main>

      <nav aria-label="Your road" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white pb-[env(safe-area-inset-bottom)]">
        <ul className="mx-auto grid max-w-xl grid-cols-2">
          <li>
            <button onClick={() => go("")} aria-current={screen.name === "home" ? "page" : undefined} className={cx("flex min-h-16 w-full flex-col items-center justify-center gap-0.5 text-[0.8rem] font-semibold", screen.name === "home" ? "text-pine" : "text-stone")}>
              <House className="h-6 w-6" aria-hidden /> Home
            </button>
          </li>
          <li>
            <button
              onClick={() => (view.bills[0] ? go(`pay-${view.bills[0].request.id}`) : go(""))}
              aria-current={screen.name === "pay" ? "page" : undefined}
              className={cx("flex min-h-16 w-full flex-col items-center justify-center gap-0.5 text-[0.8rem] font-semibold", screen.name === "pay" ? "text-pine" : "text-stone")}
            >
              <Wallet className="h-6 w-6" aria-hidden /> {owed > 0 ? `Pay ${money(owed)}` : "Pay"}
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}

type Send = (command: Command, ok?: string) => Promise<NeighborView | null>;

function HomeScreen({ view, where, go, send }: { view: NeighborView; where: "local" | "cloud"; go: (h: string) => void; send: Send }) {
  const [why, setWhy] = useState<string | null>(null);
  const a = view.agreement;
  const lastReceipt = view.receipts[0];

  return (
    <>
      {view.bills.length === 0 ? (
        <Card className="p-5">
          <p className="flex items-center gap-2 text-[1.25rem] font-extrabold">
            <CircleCheck className="h-7 w-7 text-pine" aria-hidden /> You&apos;re all paid up
          </p>
          {lastReceipt && (
            <p className="mt-1 text-stone">
              Last payment {money(lastReceipt.amount)} on {fmtDate(lastReceipt.paidAt)}.{" "}
              <button className="font-semibold text-pine underline" onClick={() => go(`receipt-${lastReceipt.id}`)}>
                Receipt
              </button>
            </p>
          )}
        </Card>
      ) : (
        view.bills.map((b) => {
          const plan = b.line.plan;
          const nextInstallment = plan?.installments.find((i) => i.due >= new Date().toISOString().slice(0, 10)) ?? plan?.installments.at(-1);
          return (
            <Card key={b.request.id} className="overflow-hidden">
              <div className="p-5">
                <p className="font-semibold text-stone">Your share of {b.request.title}</p>
                <p className="tnum mt-1 font-display text-[2.6rem] font-black leading-none">{money(b.line.outstanding)}</p>
                <p className="mt-2 text-stone">
                  {b.line.paid > 0 ? `${money(b.line.paid)} paid of ${money(b.line.due)} · ` : ""}
                  {b.line.status === "late" ? <strong className="text-brick">Was due {fmtDate(b.request.dueDate)}</strong> : `Due ${fmtDate(b.request.dueDate)}`}
                </p>
                {b.approval && <p className="mt-2 text-[0.95rem] text-pine">{b.approval}</p>}
                {plan && nextInstallment && (
                  <p className="mt-2 rounded-lg bg-sign-50 px-3 py-2 text-[0.95rem]">
                    You&apos;re on a payment plan. Next: {money(nextInstallment.amount)} by {fmtDate(nextInstallment.due)}.
                  </p>
                )}
                {b.line.processing > 0 && (
                  <p className="mt-2 flex items-center gap-1.5 text-[0.95rem] text-lake">
                    <Clock className="h-4 w-4" aria-hidden /> {money(b.line.processing)} is on its way
                  </p>
                )}
                {b.checkMailed ? (
                  <p className="mt-3 rounded-lg bg-pine-50 px-3 py-2 text-[0.98rem]">
                    You said your check is in the mail ({fmtDate(b.checkMailed.at.slice(0, 10))}). It shows as paid when {view.captain?.name ?? "the captain"} gets it.
                  </p>
                ) : (
                  <Button size="lg" block className="mt-4" onClick={() => go(`pay-${b.request.id}`)}>
                    Pay {money(plan && nextInstallment ? Math.min(nextInstallment.amount, b.line.outstanding) : b.line.outstanding)}
                  </Button>
                )}
                <button onClick={() => setWhy(why === b.request.id ? null : b.request.id)} className="mt-3 inline-flex w-full items-center justify-center gap-1 font-semibold text-pine" aria-expanded={why === b.request.id}>
                  Why this amount? <ChevronDown className={cx("h-4 w-4 transition-transform", why === b.request.id && "rotate-180")} aria-hidden />
                </button>
              </div>
              {why === b.request.id && (
                <div className="space-y-4 border-t border-line bg-paper p-5">
                  <p>{b.line.reason}</p>
                  <p className="text-[0.95rem] text-stone">{methodSentence(b.request.split)}</p>
                  {b.split.ok && b.split.stretches.length > 0 && (b.request.split.method === "segment" || b.request.split.method === "distance") && (
                    <div className="rounded-xl bg-white p-3">
                      <RoadStrip
                        homes={b.split.lines.map((l) => ({ id: l.homeId, label: l.label, distanceFt: stretchEnd(b.split.stretches, l.homeId) }))}
                        stretches={b.split.stretches}
                        lengthFt={view.road.lengthFt}
                        selectedId={view.me.id}
                      />
                    </div>
                  )}
                  <div>
                    <p className="font-semibold">What the {money(b.request.total)} covers</p>
                    <ul className="mt-1 divide-y divide-line rounded-xl border border-line bg-white">
                      {b.budget.map((l) => (
                        <li key={l.id} className="flex justify-between gap-3 px-3 py-2 text-[0.95rem]">
                          <span>{l.label}</span>
                          <span className="tnum font-semibold">{money(l.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {b.request.message && <p className="rounded-xl bg-white p-3 text-[0.95rem]">From {view.captain?.name ?? "the captain"}: {b.request.message}</p>}
                  <p className="text-[0.95rem] text-stone">
                    {b.progress.homesPaid} of {b.progress.homesBilled} homes have paid so far.
                    {b.progress.paidNames && ` Paid: ${b.progress.paidNames.join(", ")}.`}
                  </p>
                </div>
              )}
            </Card>
          );
        })
      )}

      {view.votes
        .filter((v) => v.status === "open")
        .map((v) => (
          <Card key={v.vote.id} className="p-5">
            <p className="text-[0.85rem] font-bold uppercase tracking-wide text-stone">Vote by {fmtDate(v.vote.deadline)}</p>
            <p className="mt-1 text-[1.15rem] font-bold">{v.vote.question}</p>
            {v.vote.detail && <p className="mt-1 text-stone">{v.vote.detail}</p>}
            <div className="mt-4 grid grid-cols-3 gap-2">
              {(["yes", "no", "abstain"] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => send({ type: "vote.cast", voteId: v.vote.id, ballot: { homeId: view.me.id, choice: c, at: new Date().toISOString(), via: "link" } }, "Vote recorded. Thank you.")}
                  className={cx(
                    "min-h-14 rounded-xl border-2 text-[1.05rem] font-bold capitalize",
                    v.myChoice === c ? (c === "yes" ? "border-pine bg-pine text-white" : c === "no" ? "border-brick bg-brick text-white" : "border-stone bg-stone text-white") : "border-line bg-white",
                  )}
                  aria-pressed={v.myChoice === c}
                >
                  {v.myChoice === c && <Check className="mr-1 inline h-5 w-5" aria-hidden />}
                  {c}
                </button>
              ))}
            </div>
            <p className="mt-3 text-[0.92rem] text-stone">
              {v.myChoice ? `You voted ${v.myChoice}. You can change it until the deadline. ` : ""}
              So far {v.yes} yes, {v.no} no. Needs {v.needed} yes of {v.eligible} homes.
            </p>
          </Card>
        ))}

      {a.step === "signing" && !a.mySignature && (
        <Card className="border-2 border-sign p-5">
          <p className="flex items-center gap-2 text-[1.15rem] font-bold">
            <FileSignature className="h-6 w-6 text-sign-ink" aria-hidden /> The road agreement is ready for your signature
          </p>
          <p className="mt-1 text-stone">
            {a.signed} of {a.total} owners have signed. It sets how costs are shared and how decisions are made, and it protects every home&apos;s sale.
          </p>
          <Button className="mt-4" block onClick={() => go("agreement")}>
            Read and sign
          </Button>
        </Card>
      )}
      {a.mySignature && a.step !== "recorded" && (
        <p className="flex items-center gap-2 rounded-xl bg-pine-50 px-4 py-3 text-pine">
          <Check className="h-5 w-5" aria-hidden /> You signed the road agreement {fmtDate(a.mySignature.at)}. {a.signed} of {a.total} have signed.
        </p>
      )}

      <Card>
        <CardHeader title="Road money" icon={<Landmark className="h-5 w-5" aria-hidden />} sub="Everyone on the road sees the same numbers." />
        <div className="p-5">
          <div className="flex items-baseline justify-between">
            <span className="text-stone">Road account</span>
            <span className="tnum font-display text-[1.6rem] font-black">{money(view.balance.balance)}</span>
          </div>
          {view.balance.reserve > 0 && <p className="text-[0.92rem] text-stone">{money(view.balance.reserve)} of it set aside for big repairs.</p>}
          {view.bills[0] && (
            <div className="mt-4">
              <div className="mb-1.5 flex justify-between text-[0.92rem]">
                <span>{view.bills[0].request.title}</span>
                <span className="tnum">
                  {money(view.bills[0].progress.collected)} of {money(view.bills[0].progress.billed)}
                </span>
              </div>
              <Progress value={view.bills[0].progress.collected} max={view.bills[0].progress.billed} label="Dues collected" />
            </div>
          )}
        </div>
        {view.spending.length > 0 && (
          <>
            <p className="border-t border-line px-5 pt-4 font-semibold">Where the money went</p>
            <ul className="divide-y divide-line">
              {view.spending.slice(0, 6).map((e) => (
                <li key={e.id} className="flex justify-between gap-3 px-5 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{e.vendorName}</span>
                    <span className="block truncate text-[0.88rem] text-stone">
                      {CATEGORY_LABEL[e.category]} · {e.paidAt ? fmtDay(e.paidAt) : ""}
                    </span>
                  </span>
                  <span className="tnum shrink-0 font-semibold">{money(e.amount)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      {view.work.length > 0 && (
        <Card>
          <CardHeader title="Work on the road" />
          <ul className="divide-y divide-line">
            {view.work.slice(0, 5).map((w) => (
              <li key={w.id} className="px-5 py-3">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {w.title}
                  {w.kind === "damage" && <Pill tone={w.status === "fixed" ? "paid" : "warn"}>{w.status === "scheduled" ? "Repair scheduled" : w.status === "fixed" ? "Fixed" : "Reported"}</Pill>}
                </p>
                <p className="text-[0.9rem] text-stone">{fmtDate(w.date)}</p>
                {w.photos.length > 0 && (
                  <div className="mt-2 flex gap-2 overflow-x-auto">
                    {w.photos.map((p) => (
                      <StoredFileThumb key={p.fileId} where={where} fileId={p.fileId} alt={w.title} className="h-20 w-24 shrink-0 rounded-lg" />
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {view.receipts.length > 0 && (
        <Card>
          <CardHeader title="Your receipts" icon={<ReceiptIcon className="h-5 w-5" aria-hidden />} />
          <ul className="divide-y divide-line">
            {view.receipts.map((p) => (
              <li key={p.id}>
                <button onClick={() => go(`receipt-${p.id}`)} className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left hover:bg-paper">
                  <span>
                    <span className="block font-semibold">{money(p.amount)}</span>
                    <span className="block text-[0.88rem] text-stone">
                      {fmtDate(p.paidAt)} · {p.receiptNo}
                    </span>
                  </span>
                  {new Date(p.clearsAt) > new Date() ? <Pill tone="processing">On its way</Pill> : <Pill tone="paid">Paid</Pill>}
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="p-5">
        <p className="font-bold">Questions?</p>
        {view.captain && (
          <>
            <p className="text-stone">{view.captain.name} is the road captain.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {view.captain.phone && (
                <a href={`tel:${view.captain.phone}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border-2 border-line px-3.5 font-semibold">
                  <Phone className="h-4 w-4" aria-hidden /> Call
                </a>
              )}
              {view.captain.phone && (
                <a href={smsHref(view.captain.phone, "")} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border-2 border-line px-3.5 font-semibold">
                  <MessageSquare className="h-4 w-4" aria-hidden /> Text
                </a>
              )}
              {view.captain.email && (
                <a href={mailtoHref(view.captain.email, `${view.road.name} question`, "")} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border-2 border-line px-3.5 font-semibold">
                  <Mail className="h-4 w-4" aria-hidden /> Email
                </a>
              )}
            </div>
          </>
        )}
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
          {a.step !== "draft" && (
            <button onClick={() => go("agreement")} className="font-semibold text-pine underline">
              Read the road agreement
            </button>
          )}
          <button onClick={() => go("settings")} className="font-semibold text-pine underline">
            Text and email settings
          </button>
        </div>
      </Card>
      <p className="flex items-center justify-center gap-2 pb-4 text-[0.85rem] text-stone">
        <ShieldCheck className="h-4 w-4" aria-hidden /> Payments handled by Stripe. We never see your bank login.
      </p>
    </>
  );
}

/** A home's driveway distance is the far end of the last stretch it uses. */
function stretchEnd(stretches: { toFt: number; homeIds: string[] }[], homeId: string): number | null {
  const mine = stretches.filter((s) => s.homeIds.includes(homeId));
  return mine.length ? mine[mine.length - 1].toFt : 0;
}

function ThankYou({ view, payment, checking, go, onDone }: { view: NeighborView; payment: Payment | null; checking: boolean; go: (h: string) => void; onDone: () => void }) {
  if (checking && !payment) {
    return (
      <Card className="p-6 text-center">
        <LoaderCircle className="mx-auto h-10 w-10 animate-spin text-pine" aria-hidden />
        <p className="mt-3 text-[1.2rem] font-bold">Confirming your payment…</p>
      </Card>
    );
  }
  if (!payment) {
    return (
      <Card className="p-6 text-center">
        <Clock className="mx-auto h-12 w-12 text-sign-ink" aria-hidden />
        <p className="mt-3 text-[1.3rem] font-black">Payment received by Stripe</p>
        <p className="mt-2 text-stone">It will show on your page in a few minutes. You don&apos;t need to pay again.</p>
        <Button className="mt-5" block onClick={onDone}>
          Back to your page
        </Button>
      </Card>
    );
  }
  return (
    <Card className="p-6 text-center">
      <CircleCheck className="mx-auto h-14 w-14 text-pine" aria-hidden />
      <p className="mt-3 text-[1.5rem] font-black">Thank you</p>
      <p className="tnum mt-1 text-[1.1rem]">
        {money(payment.amount)} paid to {view.road.name}
      </p>
      <p className="mt-2 text-stone">
        Receipt {payment.receiptNo}. {payment.method === "ach" ? `Bank payments take about 4 business days; it should clear by ${fmtDate(payment.clearsAt)}.` : "Card payments clear in about 2 business days."}
        {view.me.email ? ` A receipt is on its way to ${view.me.email}.` : ""}
      </p>
      <div className="mt-5 grid gap-2">
        <Button
          onClick={() => {
            onDone();
            go(`receipt-${payment.id}`);
          }}
          variant="secondary"
        >
          View receipt
        </Button>
        <Button
          onClick={() => {
            onDone();
            go("");
          }}
        >
          Back to your page
        </Button>
      </div>
    </Card>
  );
}

function PayScreen({ view, requestId, go, send, live, roadId, token }: { view: NeighborView; requestId: string; go: (h: string) => void; send: Send; live: boolean; roadId: string; token: string }) {
  const toast = useToast();
  const bill = view.bills.find((b) => b.request.id === requestId) ?? view.bills[0];
  const plan = bill?.line.plan;
  const today = new Date().toISOString().slice(0, 10);
  const nextInstallment = plan?.installments.find((i) => i.due >= today) ?? plan?.installments.at(-1);
  const suggested = bill ? (plan && nextInstallment ? Math.min(nextInstallment.amount, bill.line.outstanding) : bill.line.outstanding) : 0;
  const [which, setWhich] = useState<"suggested" | "full" | "other">("suggested");
  const [other, setOther] = useState(0);
  // Nothing is picked for them: bank, card and check are equal choices.
  const [method, setMethod] = useState<"ach" | "card" | "check" | null>(null);
  const [checkSent, setCheckSent] = useState(false);
  const [name, setName] = useState(view.me.owners.split(" & ")[0] || "");
  const [agree, setAgree] = useState(false);
  const [paying, setPaying] = useState(false);
  const [done, setDone] = useState<Payment | null>(null);

  // Checked first: paying in full removes the bill from the view.
  if (done) {
    return (
      <Card className="p-6 text-center">
        <CircleCheck className="mx-auto h-14 w-14 text-pine" aria-hidden />
        <p className="mt-3 text-[1.5rem] font-black">Thank you, {name.split(" ")[0] || "neighbor"}</p>
        <p className="tnum mt-1 text-[1.1rem]">
          {money(done.amount)} paid to {view.road.name}
        </p>
        <p className="mt-2 text-stone">
          Receipt {done.receiptNo}. {method === "ach" ? `Payments from a checking account take about 4 business days to arrive, so it should show as done by ${fmtDate(done.clearsAt)}.` : "Card payments arrive in about 2 business days."}
        </p>
        <div className="mt-5 grid gap-2">
          <Button onClick={() => go(`receipt-${done.id}`)} variant="secondary">
            View receipt
          </Button>
          <Button onClick={() => go("")}>Back to your page</Button>
        </div>
      </Card>
    );
  }

  if (!bill) {
    return (
      <Card className="p-5">
        <p className="flex items-center gap-2 text-[1.2rem] font-bold">
          <CircleCheck className="h-6 w-6 text-pine" aria-hidden /> Nothing to pay right now
        </p>
        <Button className="mt-4" variant="secondary" onClick={() => go("")}>
          Back to your page
        </Button>
      </Card>
    );
  }
  const online = view.road.accountConnected;
  const amount = which === "suggested" ? suggested : which === "full" ? bill.line.outstanding : Math.min(other, bill.line.outstanding);
  const onlineMethod = method === "ach" || method === "card" ? method : null;
  const charge = computeCharge(amount, onlineMethod ?? "ach", view.road.settings.payerCoversFees);
  const clears = addBusinessDays(new Date().toISOString(), SETTLE_BUSINESS_DAYS[onlineMethod ?? "ach"]);
  const feeFor = (m: "ach" | "card") => (view.road.settings.payerCoversFees ? computeCharge(amount, m, true).total - amount : 0);
  const cap = view.captain;
  const checkWhere = cap?.address ? `mail it or drop it off at ${cap.address}` : `give it to ${cap?.name ?? "the road captain"}`;

  const mailedCheck = async () => {
    setPaying(true);
    const next = await send({ type: "check.mailed", note: { id: uid("chk"), homeId: view.me.id, requestId: bill.request.id, amount: bill.line.outstanding, at: new Date().toISOString() } });
    setPaying(false);
    if (next) {
      setCheckSent(true);
      window.scrollTo({ top: 0 });
    }
  };

  const pay = async () => {
    if (amount < 100 || !onlineMethod) return;
    setPaying(true);
    if (live) {
      try {
        window.location.assign(await startCheckout(roadId, token, { requestId: bill.request.id, amount, method: onlineMethod }));
      } catch (e) {
        toast(e instanceof Error ? e.message : "The payment page didn't open. Try again.", "error");
        setPaying(false);
      }
      return;
    }
    const id = uid("pay");
    // Fees, timestamps and the receipt number are set by the reducer; these placeholders are rebuilt there.
    const next = await send({
      type: "payment.record",
      payment: { id, requestId: bill.request.id, homeId: view.me.id, amount, method: onlineMethod, payerName: name, note: "", recordedBy: "neighbor", paidAt: new Date().toISOString(), platformFee: 0, processingFee: 0, charged: 0, roadNet: 0, clearsAt: clears, status: "ok", receiptNo: "" },
    });
    setPaying(false);
    const recorded = next?.receipts.find((p) => p.id === id);
    if (recorded) {
      setDone(recorded);
      window.scrollTo({ top: 0 });
    }
  };

  if (checkSent || (bill.checkMailed && method === null)) {
    return (
      <Card className="p-6 text-center">
        <Mail className="mx-auto h-12 w-12 text-pine" aria-hidden />
        <p className="mt-3 text-[1.4rem] font-black">Thanks. We&apos;ll watch for your check.</p>
        <p className="mt-2 text-stone">
          {cap?.name ?? "Your road captain"} will mark it paid when it arrives, and you&apos;ll see it here. You won&apos;t get reminders about this bill in the meantime.
        </p>
        <div className="mt-5 grid gap-2">
          {!checkSent && (
            <Button variant="secondary" onClick={() => setMethod("ach")}>
              Pay online instead
            </Button>
          )}
          <Button onClick={() => go("")}>Back to your page</Button>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="p-5">
        <p className="font-semibold text-stone">{bill.request.title}</p>
        {plan || bill.line.outstanding !== suggested ? (
          <div className="mt-3">
            <Choice
              name="amount"
              value={which}
              onChange={setWhich}
              options={[
                ...(plan && nextInstallment ? [{ value: "suggested" as const, label: `This plan payment: ${money(suggested)}`, hint: `Due ${fmtDate(nextInstallment.due)}` }] : []),
                { value: "full" as const, label: `Everything you owe: ${money(bill.line.outstanding)}` },
                { value: "other" as const, label: "A different amount" },
              ]}
            />
          </div>
        ) : (
          <div className="mt-2">
            <p className="tnum font-display text-[2.4rem] font-black leading-none">{money(bill.line.outstanding)}</p>
            <p className="mt-1 text-stone">Due {fmtDate(bill.request.dueDate)}</p>
            {online && (
              <button className="mt-2 min-h-11 font-semibold text-pine underline" onClick={() => setWhich(which === "other" ? "suggested" : "other")}>
                {which === "other" ? "Pay the full amount" : "Pay part of it"}
              </button>
            )}
          </div>
        )}
        {which === "other" && (
          <Field label="Amount" className="mt-3" htmlFor="pay-other" error={other > bill.line.outstanding ? `The most you owe is ${money(bill.line.outstanding)}.` : null}>
            <AmountInput id="pay-other" value={other} onChange={setOther} />
          </Field>
        )}
      </Card>

      <Card className="p-5">
        <p className="mb-3 text-[1.1rem] font-bold">How would you like to pay?</p>
        <Choice
          name="method"
          value={method ?? ""}
          onChange={(v) => setMethod(v as "ach" | "card" | "check")}
          options={[
            ...(online
              ? [
                  {
                    value: "ach" as const,
                    label: <span className="flex items-center gap-2"><Landmark className="h-5 w-5" aria-hidden /> From my checking account</span>,
                    hint: `${feeFor("ach") ? `Fee ${money(feeFor("ach"))}` : "No fee to you"}. Arrives in about 4 business days.`,
                  },
                  {
                    value: "card" as const,
                    label: <span className="flex items-center gap-2"><CreditCard className="h-5 w-5" aria-hidden /> Debit or credit card</span>,
                    hint: `${feeFor("card") ? `Fee ${money(feeFor("card"))}` : "No fee to you"}. Arrives in about 2 business days.`,
                  },
                ]
              : []),
            {
              value: "check" as const,
              label: <span className="flex items-center gap-2"><Mail className="h-5 w-5" aria-hidden /> By check</span>,
              hint: "No fee. You mail it or drop it off.",
            },
          ]}
        />
        {!online && <p className="mt-3 text-[0.95rem] text-stone">Online payments aren&apos;t set up for this road yet, so checks are the way to pay for now.</p>}
      </Card>

      {method === "check" && (
        <Card className="p-5">
          <p className="text-[1.05rem]">
            Make the check out to <strong>{view.road.name}</strong> for <strong className="tnum">{money(bill.line.outstanding)}</strong>, write &ldquo;{view.me.label}&rdquo; on
            the memo line, and {checkWhere}.
          </p>
          {cap?.phone && (
            <p className="mt-2 text-stone">
              Questions? Call {cap.name} at{" "}
              <a href={`tel:${cap.phone}`} className="font-semibold text-pine underline">
                {cap.phone}
              </a>
              .
            </p>
          )}
          <Button size="lg" block className="mt-4" loading={paying} onClick={mailedCheck}>
            I mailed my check
          </Button>
          <p className="mt-2 text-center text-[0.92rem] text-stone">This tells {cap?.name ?? "the captain"} it&apos;s on its way and stops reminders.</p>
        </Card>
      )}

      {onlineMethod && (
        <Card className="p-5">
          {live ? (
            <p className="mb-4 rounded-xl bg-paper p-4 text-[0.95rem]">
              {onlineMethod === "ach"
                ? "Next you'll choose your bank on Stripe's secure page and log in there, or type your account and routing numbers. Road Fund never sees your bank login."
                : "Next you'll enter your card on Stripe's secure page."}
            </p>
          ) : (
            <div className="mb-4 rounded-xl bg-paper p-4">
              {onlineMethod === "ach" ? (
                <div className="space-y-1 text-[0.95rem]">
                  <p className="font-semibold">Test bank account ••6789</p>
                  <p className="text-stone">With payments switched on, you choose your bank and log in through Stripe. Road Fund never sees your login.</p>
                </div>
              ) : (
                <div className="grid grid-cols-[1fr_5.5rem_4.5rem] gap-2">
                  <Input aria-label="Card number" value="4242 4242 4242 4242" readOnly className="tnum bg-paper-2" />
                  <Input aria-label="Expiry" value="12/34" readOnly className="bg-paper-2" />
                  <Input aria-label="CVC" value="123" readOnly className="bg-paper-2" />
                  <p className="col-span-3 text-[0.88rem] text-stone">Stripe&apos;s test card. Nothing is charged.</p>
                </div>
              )}
              <Field label={onlineMethod === "ach" ? "Name on the account" : "Name on the card"} className="mt-4" htmlFor="pay-name">
                <Input id="pay-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </Field>
            </div>
          )}
          <dl className="space-y-1.5">
            <div className="flex justify-between">
              <dt>Your share</dt>
              <dd className="tnum">{money(charge.share)}</dd>
            </div>
            {view.road.settings.payerCoversFees ? (
              <div className="flex justify-between gap-3 text-stone">
                <dt>{onlineMethod === "ach" ? "Bank" : "Card"} fee (includes $1 to Road Fund)</dt>
                <dd className="tnum">{money(charge.platformFee + charge.processingFee)}</dd>
              </div>
            ) : (
              <p className="text-[0.95rem] text-stone">The road pays the fee for you.</p>
            )}
            <div className="flex justify-between border-t border-line pt-2 text-[1.2rem] font-bold">
              <dt>Total</dt>
              <dd className="tnum">{money(charge.total)}</dd>
            </div>
          </dl>
          {onlineMethod === "ach" && !live && (
            <div className="mt-4">
              <Checkbox checked={agree} onChange={setAgree} label={`Take ${money(charge.total)} from my checking account once`} hint="Only this one time. You can ask your bank to reverse it if something's wrong." />
            </div>
          )}
          <Button size="lg" block className="mt-4" loading={paying} disabled={amount < 100 || (!live && (!name.trim() || (onlineMethod === "ach" && !agree)))} onClick={pay}>
            {live ? `Continue to pay ${money(charge.total)}` : `Pay ${money(charge.total)}`}
          </Button>
          <p className="mt-3 flex items-center justify-center gap-2 text-center text-[0.9rem] text-stone">
            <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden /> Payments handled by Stripe. We never see your card number or bank login.
          </p>
        </Card>
      )}
    </>
  );
}

function ReceiptScreen({ view, id }: { view: NeighborView; id: string }) {
  const p = view.receipts.find((x) => x.id === id) ?? view.receipts[0];
  if (!p) return <p className="text-stone">Receipt not found.</p>;
  const how = { ach: "Bank transfer", card: "Card", check: "Check", cash: "Cash" }[p.method];
  return (
    <Card className="p-6">
      <p className="text-[0.85rem] font-bold uppercase tracking-wide text-stone">Receipt {p.receiptNo}</p>
      <p className="tnum mt-1 font-display text-[2.2rem] font-black">{money(p.amount)}</p>
      <dl className="mt-4 divide-y divide-line">
        {[
          ["Paid to", view.road.name],
          ["From", `${view.me.owners || view.me.label} (${view.me.label})`],
          ["For", view.bills.find((b) => b.request.id === p.requestId)?.request.title ?? "Road dues"],
          ["Date", fmtDateTime(p.paidAt)],
          ["Method", how],
          ...(p.charged !== p.amount ? [["Total charged, with the fee", money(p.charged)]] : []),
          ["Status", new Date(p.clearsAt) > new Date() ? `On its way, done by ${fmtDate(p.clearsAt)}` : "Done"],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 py-2">
            <dt className="text-stone">{k}</dt>
            <dd className="text-right font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      <Button variant="secondary" className="mt-5" icon={<Printer className="h-5 w-5" aria-hidden />} onClick={() => window.print()}>
        Print
      </Button>
    </Card>
  );
}

function AgreementScreen({ view, send, aiOn }: { view: NeighborView; send: Send; aiOn: boolean }) {
  const a = view.agreement;
  const sections = useMemo(
    () =>
      buildAgreement({
        roadName: view.road.name,
        county: view.road.county,
        state: view.road.state,
        lengthFt: view.road.lengthFt,
        split: view.road.split,
        terms: a.terms,
        version: a.version,
        homes: view.agreementHomes,
      }),
    [view, a],
  );
  const [name, setName] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const canSign = a.step === "signing" && !a.mySignature;

  return (
    <>
      <Card className="p-5">
        <p className="text-[1.2rem] font-extrabold">{view.road.name} maintenance agreement</p>
        <p className="text-stone">
          {view.road.county} County, {stateName(view.road.state)} · version {a.version} · {a.signed} of {a.total} signed
        </p>
        {a.recording && (
          <p className="mt-2 rounded-lg bg-pine-50 px-3 py-2 text-pine">
            Recorded {fmtDate(a.recording.recordedOn)}, instrument {a.recording.instrument}.
          </p>
        )}
        <p className="mt-3 rounded-lg bg-sign-50 px-3 py-2 text-[0.92rem]">{AGREEMENT_DISCLAIMER}</p>
      </Card>
      <Card>
        <CardHeader title="The short version" />
        <ul className="divide-y divide-line">
          {sections
            .filter((s) => s.id !== "schedule-a")
            .map((s) => (
              <li key={s.id} className="px-5 py-3">
                <details>
                  <summary className="cursor-pointer">
                    <span className="font-semibold">{s.title.replace(/^\d+\.\s*/, "")}: </span>
                    {s.summary}
                  </summary>
                  <div className="mt-2 space-y-1.5 text-[0.95rem] text-stone">
                    {s.body.map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                  </div>
                </details>
              </li>
            ))}
        </ul>
      </Card>
      <AskAgreement sections={sections} aiOn={aiOn} compact />
      {canSign && (
        <Card className="border-2 border-pine p-5">
          <p className="text-[1.15rem] font-bold">Sign for {view.me.label}</p>
          <Field label="Type your full name" className="mt-3" htmlFor="sign-name">
            <Input id="sign-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className="font-display text-[1.2rem] italic" />
          </Field>
          <div className="mt-3">
            <Checkbox checked={agree} onChange={setAgree} label="I've read the agreement and agree to it" hint="Typing your name is your electronic signature. A notary will confirm signatures before it's recorded." />
          </div>
          <Button
            size="lg"
            block
            className="mt-4"
            loading={busy}
            disabled={name.trim().length < 3 || !agree}
            onClick={async () => {
              setBusy(true);
              await send({ type: "agreement.sign", signature: { homeId: view.me.id, name: name.trim(), at: new Date().toISOString(), via: "link", version: a.version } }, "Signed. Thank you.");
              setBusy(false);
            }}
          >
            Sign the agreement
          </Button>
        </Card>
      )}
      {a.mySignature && (
        <Callout tone="ok" title={`Signed by ${a.mySignature.name}`}>
          {fmtDateTime(a.mySignature.at)}
        </Callout>
      )}
    </>
  );
}

function SettingsScreen({ view, send }: { view: NeighborView; send: Send }) {
  const [phone, setPhone] = useState(view.me.phone);
  const [email, setEmail] = useState(view.me.email);
  const [large, setLarge] = useState(() => typeof document !== "undefined" && document.documentElement.getAttribute("data-text") === "large");
  const setTextSize = (big: boolean) => {
    setLarge(big);
    if (big) document.documentElement.setAttribute("data-text", "large");
    else document.documentElement.removeAttribute("data-text");
    try {
      localStorage.setItem("rf:text", big ? "large" : "normal");
    } catch {}
  };
  return (
    <>
      <Card className="p-5">
        <p className="mb-3 font-bold">Text size</p>
        <div className="grid grid-cols-2 gap-3">
          {[false, true].map((big) => (
            <button
              key={String(big)}
              onClick={() => setTextSize(big)}
              className={cx("rounded-xl border-2 p-4 text-left", large === big ? "border-pine bg-pine-50/60" : "border-line bg-white")}
              aria-pressed={large === big}
            >
              <span className={cx("block font-bold", big ? "text-[1.35rem]" : "text-[1.1rem]")}>Aa</span>
              <span className="text-[0.95rem]">{big ? "Larger" : "Standard"}</span>
            </button>
          ))}
        </div>
      </Card>
      <Card className="space-y-5 p-5">
        <Toggle
          checked={view.me.smsOptIn}
          onChange={(v) =>
            send({ type: "home.contact", homeId: view.me.id, patch: v && phone.trim() !== view.me.phone ? { smsOptIn: v, phone: phone.trim() } : { smsOptIn: v } }, v ? "Texts turned on." : "Texts turned off.")
          }
          label="Get texts from the road"
          hint={`Dues reminders, votes and road work from ${view.road.name} via Road Fund. Up to 6 a month. Message and data rates may apply. Reply STOP to stop, HELP for help.`}
          disabled={!phone.trim()}
        />
        <Toggle
          checked={view.me.emailOptIn}
          onChange={(v) => send({ type: "home.contact", homeId: view.me.id, patch: { emailOptIn: v } }, v ? "Emails turned on." : "Emails turned off.")}
          label="Get emails from the road"
          disabled={!email.trim()}
        />
      </Card>
      <Card className="space-y-4 p-5">
        <Field label="Mobile phone" htmlFor="me-phone">
          <Input id="me-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
        </Field>
        <Field label="Email" htmlFor="me-email">
          <Input id="me-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </Field>
        <Button variant="secondary" onClick={() => send({ type: "home.contact", homeId: view.me.id, patch: { phone, email } }, "Saved.")}>
          Save contact info
        </Button>
        <p className="text-[0.9rem] text-stone">Only the road captain sees your phone and email. They&apos;re never sold or shared.</p>
      </Card>
      <p className="text-center text-[0.95rem]">
        <a href="/help#neighbors" className="font-semibold text-pine underline">
          Help and common questions
        </a>
      </p>
    </>
  );
}
