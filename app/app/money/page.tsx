"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Plus } from "lucide-react";
import { MoneyNav, PageHeader, PlanGate } from "@/components/app/common";
import { Button, ButtonLink, Card, Dialog, Empty, Pill, Progress, Stat } from "@/components/ui";
import { useRoad } from "@/lib/client/road-context";
import { STARTER_REQUEST_LIMIT, requestsThisYear } from "@/lib/commands";
import { fmtDate } from "@/lib/dates";
import { money } from "@/lib/money";
import { accountSummary, dueSoonText, requestProgress, yearTotals } from "@/lib/selectors";

export default function MoneyPage() {
  const { road, now } = useRoad();
  const acct = accountSummary(road, now);
  const year = now.getFullYear();
  const totals = yearTotals(road, year);
  const requests = [...road.requests].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const atLimit = road.plan === "starter" && requestsThisYear(road, year) >= STARTER_REQUEST_LIMIT;
  const [gate, setGate] = useState(false);

  return (
    <>
      <PageHeader
        title="Money"
        sub="Dues requests, bills, the ledger and the road's account."
        actions={
          atLimit ? (
            <Button onClick={() => setGate(true)} icon={<Plus className="h-5 w-5" aria-hidden />}>
              New dues request
            </Button>
          ) : (
            <ButtonLink href="/app/money/requests/new" icon={<Plus className="h-5 w-5" aria-hidden />}>
              New dues request
            </ButtonLink>
          )
        }
      />
      <MoneyNav />

      <Card className="mb-6 grid grid-cols-2 gap-5 p-5 sm:grid-cols-4">
        <Stat label="Balance" value={money(acct.balance)} sub={acct.pending ? `${money(acct.pending)} clearing` : "All cleared"} />
        <Stat label="Available" value={money(acct.available)} />
        <Stat label={`In, ${year}`} value={money(totals.duesIn)} tone="ok" />
        <Stat label={`Spent, ${year}`} value={money(totals.spent)} />
      </Card>

      <h2 className="mb-3 text-[1.3rem] font-extrabold">Dues requests</h2>
      {requests.length === 0 ? (
        <Card>
          <Empty title="No dues requests yet" action={<ButtonLink href="/app/money/requests/new">Create one</ButtonLink>}>
            Set this year&apos;s budget, check each home&apos;s share, and send everyone a pay link.
          </Empty>
        </Card>
      ) : (
        <ul className="space-y-3">
          {requests.map((r) => {
            const p = requestProgress(road, r, now);
            return (
              <li key={r.id}>
                <Link href={`/app/money/requests/${r.id}`} className="block rounded-[var(--radius-card)] border border-line bg-white p-5 shadow-card hover:border-field">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[1.15rem] font-bold">{r.title}</p>
                      <p className="text-stone">
                        {r.status === "closed" ? `Closed · was due ${fmtDate(r.dueDate)}` : `${dueSoonText(r.dueDate, now).replace(/^is /, "Due ").replace(/^was /, "Was ")}`} · {p.homesPaid} of {p.homesBilled} paid
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {r.status === "open" && !r.sentAt && <Pill tone="warn">Not sent</Pill>}
                      {p.lateCount > 0 && r.status === "open" && <Pill tone="late">{p.lateCount} late</Pill>}
                      {r.status === "closed" && <Pill tone="neutral">Closed</Pill>}
                      <ArrowRight className="h-5 w-5 text-stone" aria-hidden />
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-4">
                    <div className="flex-1">
                      <Progress value={p.collected} max={p.billed} label={`${r.title} collected`} />
                    </div>
                    <span className="tnum shrink-0 text-[0.95rem]">
                      <strong>{money(p.collected)}</strong> <span className="text-stone">of {money(p.billed)}</span>
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={gate} onClose={() => setGate(false)} title="One request a year on Starter">
        <PlanGate needs="roadfund" feature="Unlimited dues requests" pitch="Starter covers one dues request a year. Road Fund adds unlimited requests and special assessments, automatic reminders, contractor payments, votes and the work log.">
          <div className="space-y-4">
            <p>You&apos;re on Road Fund now.</p>
            <ButtonLink href="/app/money/requests/new" block>
              Create the request
            </ButtonLink>
          </div>
        </PlanGate>
      </Dialog>
    </>
  );
}
