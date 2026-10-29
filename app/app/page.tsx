"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { ArrowRight, CircleCheck, X } from "lucide-react";
import { RecordPaymentDialog } from "@/components/app/money-dialogs";
import { StatusPill } from "@/components/app/common";
import { useToast } from "@/components/toast";
import { Button, ButtonLink, cx, Pill, Progress } from "@/components/ui";
import { buildPayment } from "@/lib/commands";
import { useRoad } from "@/lib/client/road-context";
import { fmtDate, fmtDateTime, fmtDay, isoDate } from "@/lib/dates";
import { uid } from "@/lib/ids";
import { money } from "@/lib/money";
import {
  accountSummary,
  captainHome,
  checkInMail,
  currentRequest,
  displayName,
  dueSoonText,
  isCleared,
  nextActions,
  requestProgress,
  upcomingWork,
  voteState,
  type LineProgress,
} from "@/lib/selectors";
import type { DuesRequest } from "@/lib/types";

export default function HomePage() {
  const { road, entry, now } = useRoad();
  const actions = nextActions(road, now);
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? actions : actions.slice(0, 3);
  const req = currentRequest(road);
  const prog = req ? requestProgress(road, req, now) : null;
  const me = captainHome(road);

  return (
    <div className="space-y-10">
      <Welcome demo={entry.demo} roadId={road.id} />

      <div>
        <p className="text-stone">
          {greeting(now)}
          {me ? `, ${displayName(me).split(/\s|&/)[0]}` : ""}
        </p>
        <h1 className="text-[2rem] font-black leading-tight">{road.name}</h1>
        {req && prog && (
          <p className="mt-2 max-w-2xl text-[1.1rem]">
            {prog.homesPaid} of {prog.homesBilled} homes have paid {req.title} ({money(prog.collected)} of {money(prog.billed)}).{" "}
            {req.status === "closed" ? "This bill is closed." : `It ${dueSoonText(req.dueDate, now)}.`}
          </p>
        )}
      </div>

      {/* What to do, in plain view */}
      <section aria-labelledby="todo-h">
        <h2 id="todo-h" className="text-[1.4rem] font-extrabold">
          {actions.length ? "To do" : "Nothing to do right now"}
        </h2>
        {actions.length > 0 && (
          <ol className="mt-3 divide-y divide-line rounded-[var(--radius-card)] border border-line bg-white">
            {shown.map((a, i) => (
              <li key={a.id} className={cx("flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5", i === 0 && a.tone === "late" && "bg-brick-50/50")}>
                <div className="min-w-0">
                  <p className="text-[1.1rem] font-bold leading-snug">{a.label}</p>
                  <p className="mt-0.5 text-stone">{a.detail}</p>
                </div>
                <ButtonLink
                  href={a.href}
                  variant={i === 0 ? (a.tone === "late" ? "danger" : "primary") : "secondary"}
                  className="shrink-0 whitespace-nowrap"
                  icon={<ArrowRight className="h-5 w-5" aria-hidden />}
                >
                  {buttonText(a.id)}
                </ButtonLink>
              </li>
            ))}
          </ol>
        )}
        {actions.length > 3 && (
          <button onClick={() => setShowAll((s) => !s)} className="mt-2 min-h-12 font-semibold text-pine underline" aria-expanded={showAll}>
            {showAll ? "Show fewer" : `Show ${actions.length - 3} more`}
          </button>
        )}
      </section>

      {!entry.demo && <GettingStarted />}

      {/* Who has paid */}
      <section aria-labelledby="paid-h">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="paid-h" className="text-[1.4rem] font-extrabold">
            {req ? `Who has paid: ${req.title}` : "Who has paid"}
          </h2>
          {req && (
            <Link href={`/app/money/requests/${req.id}`} className="font-semibold text-pine underline">
              Open the bill
            </Link>
          )}
        </div>
        {req && prog ? (
          <>
            <div className="mt-3 max-w-md">
              <Progress value={prog.collected} max={prog.billed} label="Dues collected" />
            </div>
            <ul className="mt-4 divide-y divide-line rounded-[var(--radius-card)] border border-line bg-white">
              {prog.lines.map((l) => (
                <HouseholdRow key={l.home.id} line={l} request={req} />
              ))}
            </ul>
          </>
        ) : (
          <div className="mt-3 rounded-[var(--radius-card)] border border-line bg-white p-5">
            <p>No bill has gone out yet. Set this year&apos;s budget and send each home its share.</p>
            <ButtonLink href="/app/money/requests/new" className="mt-4">
              Start this year&apos;s bill
            </ButtonLink>
          </div>
        )}
      </section>

      <div className="grid gap-10 lg:grid-cols-2">
        <RoadMoney />
        <ComingUp />
      </div>

      <section aria-labelledby="activity-h">
        <h2 id="activity-h" className="text-[1.4rem] font-extrabold">
          Recent activity
        </h2>
        <p className="text-stone">Every change is recorded, so anyone can see what happened and when.</p>
        <ul className="mt-3 divide-y divide-line border-y border-line">
          {road.activity.slice(0, 6).map((a) => (
            <li key={a.id} className="flex flex-col gap-0.5 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
              <span>{a.text}</span>
              <span className="shrink-0 text-[0.95rem] text-stone">
                {a.actor} · {fmtDateTime(a.at)}
              </span>
            </li>
          ))}
        </ul>
        <Link href="/app/money/ledger" className="mt-3 inline-block font-semibold text-pine underline">
          See the full payment record
        </Link>
      </section>
    </div>
  );
}

/** One home on the current bill, with a two-tap way to record a check that came in. */
function HouseholdRow({ line: l, request }: { line: LineProgress; request: DuesRequest }) {
  const { road, now, dispatch } = useRoad();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const mailed = checkInMail(road, l.home.id, request.id, now);
  const owes = l.outstanding > 0 && l.status !== "processing";
  const name = displayName(l.home);

  const record = async () => {
    setSaving(true);
    const payment = buildPayment(road, {
      id: uid("pay"),
      homeId: l.home.id,
      requestId: request.id,
      amount: l.outstanding,
      method: "check",
      payerName: name,
      note: "",
      recordedBy: "captain",
      paidAt: new Date().toISOString(),
    });
    const ok = await dispatch({ type: "payment.record", payment });
    setSaving(false);
    setConfirming(false);
    if (ok) {
      toast(`Recorded a ${money(l.outstanding)} check from ${name}.`, "ok", {
        label: "Undo",
        onClick: () => void dispatch({ type: "payment.void", paymentId: payment.id, reason: "Recorded by mistake" }, "Removed that check."),
      });
    }
  };

  return (
    <li className="px-4 py-3 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="font-semibold">{name}</p>
          <p className="text-[0.95rem] text-stone">
            {l.home.label} · <span className="tnum">{money(l.due)}</span>
            {l.paid > 0 && l.outstanding > 0 && (
              <>
                {" · "}
                <span className="tnum">{money(l.outstanding)}</span> left
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {mailed && owes ? <Pill tone="info">Check in the mail</Pill> : <StatusPill status={l.status} />}
          {owes && !confirming && (
            <Button size="sm" variant="secondary" onClick={() => setConfirming(true)}>
              Got their check
            </Button>
          )}
        </div>
      </div>
      {mailed && owes && !confirming && (
        <p className="mt-1 text-[0.95rem] text-stone">
          They said they mailed it on {fmtDate(mailed.at.slice(0, 10))}. Did it arrive?
        </p>
      )}
      {confirming && (
        <div className="mt-3 rounded-lg bg-paper p-3">
          <p>
            Record a <strong className="tnum">{money(l.outstanding)}</strong> check from {name}, received today ({fmtDate(isoDate(now))})?
            {l.home.email ? " They'll get a receipt by email." : ""}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button loading={saving} onClick={record}>
              Record the check
            </Button>
            <Button variant="secondary" onClick={() => setEditing(true)}>
              Different amount or date
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      {editing && (
        <RecordPaymentDialog
          open
          onClose={() => {
            setEditing(false);
            setConfirming(false);
          }}
          home={l.home}
          request={request}
          outstanding={l.outstanding}
        />
      )}
    </li>
  );
}

function RoadMoney() {
  const { road, now } = useRoad();
  const acct = accountSummary(road, now);
  const clearing = road.payments.filter((p) => p.status === "ok" && !isCleared(p, now));
  const clearsBy = clearing.map((p) => p.clearsAt).sort().at(-1);
  const connected = road.account.status === "connected";
  return (
    <section aria-labelledby="money-h">
      <h2 id="money-h" className="text-[1.4rem] font-extrabold">
        Road money
      </h2>
      <p className="text-stone">{connected ? `${road.account.bankName} ••${road.account.last4} · as of ${now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : "No bank account connected yet. Checks still work."}</p>
      <dl className="mt-3 divide-y divide-line border-y border-line">
        <MoneyRow k="In the account" v={money(acct.balance)} big />
        <MoneyRow k="Ready to spend" v={money(acct.available)} />
        {acct.pending > 0 && <MoneyRow k={`On its way${clearsBy ? `, clears by ${fmtDate(clearsBy)}` : ""}`} v={money(acct.pending)} />}
        {road.reserve.setAside > 0 && <MoneyRow k="Set aside for big repairs" v={money(acct.reserve)} />}
      </dl>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        <Link href="/app/money/bills" className="font-semibold text-pine underline">
          Pay a bill
        </Link>
        <Link href="/app/money/ledger" className="font-semibold text-pine underline">
          Payment record
        </Link>
      </div>
    </section>
  );
}

function MoneyRow({ k, v, big }: { k: string; v: string; big?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt>{k}</dt>
      <dd className={cx("tnum font-display font-extrabold", big ? "text-[1.6rem]" : "text-[1.15rem]")}>{v}</dd>
    </div>
  );
}

function ComingUp() {
  const { road, now } = useRoad();
  const openVote = road.votes.map((v) => voteState(road, v, now)).find((v) => v.status === "open" || v.status === "ready");
  const upcoming = upcomingWork(road, now)
    .filter((u) => !u.status.startsWith("Vote"))
    .slice(0, 3);
  return (
    <section aria-labelledby="coming-h">
      <h2 id="coming-h" className="text-[1.4rem] font-extrabold">
        Coming up
      </h2>
      <ul className="mt-3 divide-y divide-line border-y border-line">
        {openVote && (
          <li className="py-3">
            <Link href={`/app/papers/votes/${openVote.vote.id}`} className="font-semibold text-pine underline">
              {openVote.vote.question}
            </Link>
            <p className="text-[0.95rem] text-stone">
              Vote: {openVote.yes} yes, {openVote.no} no. Needs {openVote.needed} yes.{" "}
              {openVote.status === "ready" ? "Voting has ended." : `Ends ${fmtDay(openVote.vote.deadline, now)}.`}
            </p>
          </li>
        )}
        {upcoming.map((u) => (
          <li key={u.title + u.status} className="flex items-start justify-between gap-3 py-3">
            <span>
              <span className="block font-semibold">{u.title}</span>
              <span className="block text-[0.95rem] text-stone">{u.status}</span>
            </span>
            {u.amount !== null && <span className="tnum shrink-0 font-semibold">{money(u.amount)}</span>}
          </li>
        ))}
        {!openVote && upcoming.length === 0 && <li className="py-3 text-stone">Nothing planned. Start a vote when the road needs work.</li>}
      </ul>
      <Link href="/app/papers?new=vote" className="mt-3 inline-block font-semibold text-pine underline">
        Start a vote
      </Link>
    </section>
  );
}

function greeting(now: Date): string {
  const h = now.getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function buttonText(id: string): string {
  if (id === "bank") return "Connect bank account";
  if (id.startsWith("letter-")) return "Write the letter";
  if (id === "dues") return "Start this year's bill";
  if (id.startsWith("send-")) return "Send it";
  if (id.startsWith("bill-")) return "Look it over";
  if (id.startsWith("pay-")) return "Pay it";
  if (id.startsWith("vote-")) return "Close the vote";
  if (id === "late" || id === "remind") return "Send reminders";
  if (id === "sign") return "Send signing links";
  if (id.startsWith("dmg-")) return "Open the work log";
  return "Open";
}

/** First-weeks list. Only what's needed to collect money; hides once done, or when dismissed. */
function GettingStarted() {
  const { road, entry, now } = useRoad();
  const key = `rf:checklist:${road.id}`;
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(key) === "hide";
    } catch {
      return false;
    }
  });
  const me = captainHome(road);
  const unreachable = road.homes.filter((h) => !h.phone && !h.email).length;
  const year = now.getFullYear();
  const items = [
    {
      done: unreachable === 0,
      label: unreachable ? `Add a phone or email for ${unreachable} home${unreachable === 1 ? "" : "s"}` : "Every home has a phone or email",
      href: "/app/neighbors",
    },
    { done: road.requests.some((r) => r.sentAt && new Date(r.createdAt).getFullYear() === year), label: `Send ${year} dues`, href: "/app/money" },
    ...(entry.where === "cloud" ? [{ done: !!me?.email, label: "Add your email so you can sign in on any device", href: "/app/settings" }] : []),
    { done: road.account.status === "connected", label: "Connect a bank account so neighbors can pay online", href: "/app/money/account" },
    { done: road.agreement.step !== "draft", label: "Read the draft road agreement", href: "/app/papers/agreement" },
  ];
  const done = items.filter((i) => i.done).length;
  if (hidden || done === items.length) return null;
  return (
    <section aria-labelledby="start-h">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="start-h" className="text-[1.4rem] font-extrabold">
          Getting started
        </h2>
        <button
          onClick={() => {
            try {
              localStorage.setItem(key, "hide");
            } catch {}
            setHidden(true);
          }}
          className="min-h-11 rounded-lg px-2 font-semibold text-stone underline hover:bg-paper-2"
        >
          Hide this list
        </button>
      </div>
      <p className="text-stone">
        {done} of {items.length} done. You can collect checks before any of this is finished.
      </p>
      <ul className="mt-3 divide-y divide-line rounded-[var(--radius-card)] border border-line bg-white">
        {items.map((i) => (
          <li key={i.label}>
            <Link href={i.href} className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-paper sm:px-5">
              {i.done ? <CircleCheck className="h-6 w-6 shrink-0 text-pine" aria-label="Done" /> : <span className="h-6 w-6 shrink-0 rounded-full border-2 border-field" aria-label="Not done" />}
              <span className={cx("flex-1", i.done && "text-stone line-through decoration-stone/50")}>{i.label}</span>
              {!i.done && <ArrowRight className="h-5 w-5 shrink-0 text-stone" aria-hidden />}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Welcome({ demo, roadId }: { demo: boolean; roadId: string }) {
  const key = `rf:welcome:${roadId}`;
  const welcomeParam = useSearchParams().get("welcome");
  const [show, setShow] = useState(() => {
    try {
      return !localStorage.getItem(key) && (demo || welcomeParam !== null);
    } catch {
      return false;
    }
  });
  if (!show) return null;
  const dismiss = () => {
    try {
      localStorage.setItem(key, "1");
    } catch {}
    setShow(false);
  };
  return (
    <section className="relative rounded-[var(--radius-card)] border-2 border-sign bg-sign-50 p-5 sm:p-6">
      <button onClick={dismiss} className="absolute right-2 top-2 flex min-h-11 items-center gap-1 rounded-lg px-2 font-semibold text-charcoal hover:bg-white/60">
        <X className="h-5 w-5" aria-hidden /> Close
      </button>
      {demo ? (
        <>
          <h2 className="pr-20 text-[1.3rem] font-extrabold">This is a sample road. You&apos;re Carol Jensen, the road captain.</h2>
          <p className="mt-1">Nine homes and a year and a half of history. Nothing here is real, so try anything. A few places to start:</p>
          <ul className="mt-3 list-disc space-y-1.5 pl-6">
            {[
              ["A title company is waiting on a Road Status Letter", "/app/papers/letters"],
              ["Pay as a neighbor: open Lot 6's page and pay", "/app/neighbors"],
              ["Approve and pay the plow contractor's bill", "/app/money/bills"],
              ["See who still needs to sign the road agreement", "/app/papers/agreement"],
            ].map(([t, href]) => (
              <li key={href}>
                <Link href={href} className="font-semibold text-pine underline">
                  {t}
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <h2 className="pr-20 text-[1.3rem] font-extrabold">Your road is set up.</h2>
          <p className="mt-1">Next, send this year&apos;s bill if you haven&apos;t. Neighbors can pay by check right away; online payments start once you connect a bank account.</p>
        </>
      )}
    </section>
  );
}
