"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Banknote, CircleCheck, Hammer, Landmark, ListChecks, PiggyBank, Vote, X } from "lucide-react";
import { StatusPill } from "@/components/app/common";
import { ButtonLink, Card, CardHeader, cx, Empty, Progress } from "@/components/ui";
import { useRoad } from "@/lib/client/road-context";
import { fmtDateTime, fmtDay } from "@/lib/dates";
import { money } from "@/lib/money";
import { accountSummary, captainHome, currentRequest, displayName, dueSoonText, nextActions, requestProgress, upcomingWork, voteState } from "@/lib/selectors";

export default function HomePage() {
  const { road, entry, now } = useRoad();
  const acct = accountSummary(road, now);
  const actions = nextActions(road, now);
  const [first, ...rest] = actions;
  const req = currentRequest(road);
  const prog = req ? requestProgress(road, req, now) : null;
  const openVote = road.votes.map((v) => voteState(road, v, now)).find((v) => v.status === "open" || v.status === "ready");
  const upcoming = upcomingWork(road, now).filter((u) => !u.status.startsWith("Vote")).slice(0, 3);
  const me = captainHome(road);

  return (
    <div className="space-y-6">
      <Welcome demo={entry.demo} roadId={road.id} />

      <div>
        <p className="text-stone">{greeting(now)}{me ? `, ${displayName(me).split(/\s|&/)[0]}` : ""}</p>
        <h1 className="text-[1.9rem] font-black leading-tight">{road.name}</h1>
      </div>

      {/* The one big next action */}
      <Card className={cx("overflow-hidden border-2", first.tone === "late" ? "border-brick/40" : first.tone === "warn" ? "border-sign" : "border-pine/40")}>
        <div className="p-5 sm:p-6">
          <p className="text-[0.85rem] font-bold uppercase tracking-wider text-stone">Next up</p>
          <p className="mt-1 text-[1.35rem] font-extrabold leading-snug">{first.label}</p>
          <p className="mt-1 text-stone">{first.detail}</p>
          <ButtonLink href={first.href} size="lg" variant={first.tone === "late" ? "danger" : first.tone === "warn" ? "warn" : "primary"} className="mt-4 w-full sm:w-auto" icon={<ArrowRight className="h-5 w-5" aria-hidden />}>
            {buttonText(first.id)}
          </ButtonLink>
        </div>
        {rest.length > 0 && (
          <details className="border-t border-line">
            <summary className="flex cursor-pointer items-center gap-2 px-5 py-3 font-semibold sm:px-6">
              <ListChecks className="h-5 w-5 text-pine" aria-hidden /> {rest.length} more to do
            </summary>
            <ul className="divide-y divide-line border-t border-line">
              {rest.map((a) => (
                <li key={a.id}>
                  <Link href={a.href} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-paper sm:px-6">
                    <span>
                      <span className="block font-semibold">{a.label}</span>
                      <span className="block text-[0.9rem] text-stone">{a.detail}</span>
                    </span>
                    <ArrowRight className="h-5 w-5 shrink-0 text-stone" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        )}
      </Card>

      {!entry.demo && <GettingStarted />}

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        {/* Who has paid */}
        <Card>
          <CardHeader
            title={req ? req.title : "Dues"}
            icon={<Banknote className="h-5 w-5" aria-hidden />}
            sub={req && prog ? `${prog.homesPaid} of ${prog.homesBilled} homes paid · ${req.status === "closed" ? "closed" : dueSoonText(req.dueDate, now)}` : "No bill yet"}
            action={
              req && (
                <Link href={`/app/money/requests/${req.id}`} className="shrink-0 font-semibold text-pine hover:underline">
                  Open
                </Link>
              )
            }
          />
          {req && prog ? (
            <div>
              <div className="px-5 pt-4">
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="tnum font-display text-[1.4rem] font-extrabold">{money(prog.collected)}</span>
                  <span className="tnum text-stone">of {money(prog.billed)}</span>
                </div>
                <Progress value={prog.collected} max={prog.billed} label="Dues collected" />
              </div>
              <ul className="mt-3 divide-y divide-line">
                {prog.lines.map((l) => (
                  <li key={l.home.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{displayName(l.home)}</span>
                      <span className="block text-[0.85rem] text-stone">{l.home.label}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      <span className="tnum hidden text-[0.95rem] sm:inline">{money(l.due)}</span>
                      <StatusPill status={l.status} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <Empty title="No dues sent yet" action={<ButtonLink href="/app/money/requests/new">Send road dues</ButtonLink>}>
              Set the budget and send each neighbor their share.
            </Empty>
          )}
        </Card>

        <div className="space-y-6">
          {/* Balance */}
          <Card>
            <CardHeader title="Road account" icon={<Landmark className="h-5 w-5" aria-hidden />} sub={road.account.status === "connected" ? `${road.account.bankName} ••${road.account.last4}` : "Not connected"} action={<Link href="/app/money/ledger" className="shrink-0 font-semibold text-pine hover:underline">Payment record</Link>} />
            <div className="grid grid-cols-2 gap-4 p-5">
              <div>
                <p className="text-[0.85rem] font-semibold text-stone">Balance</p>
                <p className="tnum font-display text-[1.7rem] font-black leading-tight">{money(acct.balance)}</p>
              </div>
              <div>
                <p className="text-[0.85rem] font-semibold text-stone">Available now</p>
                <p className="tnum font-display text-[1.25rem] font-extrabold leading-tight">{money(acct.available)}</p>
                {acct.pending > 0 && <p className="text-[0.85rem] text-stone">{money(acct.pending)} still clearing</p>}
              </div>
              {road.reserve.setAside > 0 && (
                <p className="col-span-2 flex items-center gap-2 rounded-lg bg-paper px-3 py-2 text-[0.92rem]">
                  <PiggyBank className="h-4 w-4 text-pine" aria-hidden /> {money(acct.reserve)} set aside for big repairs
                </p>
              )}
            </div>
          </Card>

          {/* Next project */}
          <Card>
            <CardHeader title="Coming up" icon={<Hammer className="h-5 w-5" aria-hidden />} />
            <ul className="divide-y divide-line">
              {openVote && (
                <li>
                  <Link href={`/app/papers/votes/${openVote.vote.id}`} className="flex items-start gap-3 px-5 py-3 hover:bg-paper">
                    <Vote className="mt-0.5 h-5 w-5 shrink-0 text-lake" aria-hidden />
                    <span className="min-w-0">
                      <span className="block font-semibold">{openVote.vote.question}</span>
                      <span className="block text-[0.9rem] text-stone">
                        {openVote.yes} yes, {openVote.no} no · needs {openVote.needed} yes · {openVote.status === "ready" ? "voting ended" : `ends ${fmtDay(openVote.vote.deadline, now)}`}
                      </span>
                    </span>
                  </Link>
                </li>
              )}
              {upcoming.map((u) => (
                <li key={u.title + u.status} className="flex items-start justify-between gap-3 px-5 py-3">
                  <span>
                    <span className="block font-semibold">{u.title}</span>
                    <span className="block text-[0.9rem] text-stone">{u.status}</span>
                  </span>
                  {u.amount !== null && <span className="tnum shrink-0 font-semibold">{money(u.amount)}</span>}
                </li>
              ))}
              {!openVote && upcoming.length === 0 && <li className="px-5 py-4 text-stone">Nothing planned. Start a vote when the road needs work.</li>}
            </ul>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader title="Recent activity" sub="Every change is recorded, so anyone can see what happened and when." />
        <ul className="divide-y divide-line">
          {road.activity.slice(0, 8).map((a) => (
            <li key={a.id} className="flex flex-col gap-0.5 px-5 py-2.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
              <span>{a.text}</span>
              <span className="shrink-0 text-[0.85rem] text-stone">
                {a.actor} · {fmtDateTime(a.at)}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function greeting(now: Date): string {
  const h = now.getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function buttonText(id: string): string {
  if (id === "bank") return "Connect bank account";
  if (id.startsWith("letter-")) return "Create the letter";
  if (id === "dues") return "Start this year's bill";
  if (id.startsWith("send-")) return "Send it";
  if (id.startsWith("bill-")) return "Review the bill";
  if (id.startsWith("pay-")) return "Pay it";
  if (id.startsWith("vote-")) return "Close the vote";
  if (id === "late" || id === "remind") return "Send reminders";
  if (id === "sign") return "Send signing links";
  if (id.startsWith("dmg-")) return "Open the work log";
  return "Go";
}

/** First-weeks checklist. Hides itself once everything is done, or when dismissed. */
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
    { done: true, label: "Set up the road and its homes", href: "/app/neighbors" },
    {
      done: unreachable === 0,
      label: unreachable ? `Add a phone or email for ${unreachable} home${unreachable === 1 ? "" : "s"}` : "Every home has a phone or email",
      href: "/app/neighbors",
    },
    ...(entry.where === "cloud" ? [{ done: !!me?.email, label: "Add your email so you can sign in on any device", href: "/app/settings" }] : []),
    { done: road.account.status === "connected", label: "Connect the road's bank account", href: "/app/money/account" },
    { done: road.requests.some((r) => r.sentAt && new Date(r.createdAt).getFullYear() === year), label: `Send ${year} dues`, href: "/app/money" },
    { done: road.contractors.length > 0, label: "Add your plow driver and grader", href: "/app/road/contractors" },
    { done: road.agreement.step !== "draft", label: "Read the draft road agreement", href: "/app/papers/agreement" },
  ];
  const done = items.filter((i) => i.done).length;
  if (hidden || done === items.length) return null;
  return (
    <Card>
      <CardHeader
        title="Getting started"
        icon={<ListChecks className="h-5 w-5" aria-hidden />}
        sub={`${done} of ${items.length} done`}
        action={
          <button
            onClick={() => {
              try {
                localStorage.setItem(key, "hide");
              } catch {}
              setHidden(true);
            }}
            className="rounded-lg px-2 py-1.5 text-[0.9rem] font-semibold text-stone hover:bg-paper-2"
          >
            Hide
          </button>
        }
      />
      <ul className="divide-y divide-line">
        {items.map((i) => (
          <li key={i.label}>
            <Link href={i.href} className="flex items-center gap-3 px-5 py-3 hover:bg-paper">
              {i.done ? <CircleCheck className="h-6 w-6 shrink-0 text-pine" aria-label="Done" /> : <span className="h-6 w-6 shrink-0 rounded-full border-2 border-field" aria-label="Not done" />}
              <span className={cx("flex-1", i.done && "text-stone line-through decoration-stone/50")}>{i.label}</span>
              {!i.done && <ArrowRight className="h-5 w-5 shrink-0 text-stone" aria-hidden />}
            </Link>
          </li>
        ))}
      </ul>
    </Card>
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
    <div className="relative rounded-[var(--radius-card)] bg-charcoal p-5 text-white sm:p-6">
      <button onClick={dismiss} className="absolute right-3 top-3 rounded-lg p-2 opacity-80 hover:bg-white/10 hover:opacity-100" aria-label="Dismiss">
        <X className="h-5 w-5" aria-hidden />
      </button>
      {demo ? (
        <>
          <p className="sign-chip inline-block rounded px-2 py-0.5 text-[0.8rem] font-bold">Demo road</p>
          <h2 className="mt-2 text-[1.35rem] font-extrabold">You&apos;re Carol Jensen, captain of Birch Hollow Lane.</h2>
          <p className="mt-1 opacity-90">Nine homes, real history, nothing real at stake. Things to try:</p>
          <ol className="mt-3 grid gap-2 sm:grid-cols-2">
            {[
              ["A title company is waiting on a Road Status Letter.", "/app/papers/letters"],
              ["Pay as a neighbor: open Lot 6's link and pay by bank.", "/app/neighbors"],
              ["Approve and pay the plow contractor's bill.", "/app/money/bills"],
              ["Check who still needs to sign the agreement.", "/app/papers/agreement"],
              ["See how the culvert vote is going.", "/app/papers"],
              ["Look at what each home paid this year.", "/app/money/ledger"],
            ].map(([t, href], i) => (
              <li key={href}>
                <Link href={href} className="flex items-start gap-2 rounded-lg bg-white/10 px-3 py-2 hover:bg-white/15">
                  <span className="font-display font-black text-sign">{i + 1}</span>
                  <span>{t}</span>
                </Link>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <>
          <p className="flex items-center gap-2 text-[1.2rem] font-extrabold">
            <CircleCheck className="h-6 w-6 text-sign" aria-hidden /> Your road is set up.
          </p>
          <p className="mt-1 opacity-90">Next: send this year&apos;s dues if you haven&apos;t, and add the people who plow and grade the road.</p>
        </>
      )}
    </div>
  );
}
