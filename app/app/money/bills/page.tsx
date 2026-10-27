"use client";

import { useState } from "react";
import { Check, Landmark, Lock, Plus, X } from "lucide-react";
import { FileThumb, hasPlan, MoneyNav, PageHeader } from "@/components/app/common";
import { AddBillDialog } from "@/components/app/money-dialogs";
import { Button, Card, CardHeader, Dialog, Empty } from "@/components/ui";
import { useRoad } from "@/lib/client/road-context";
import { fmtDate } from "@/lib/dates";
import { CATEGORY_LABEL } from "@/lib/factory";
import { money } from "@/lib/money";
import { accountSummary } from "@/lib/selectors";
import type { Expense } from "@/lib/types";

export default function BillsPage() {
  const { road, dispatch, now } = useRoad();
  const [adding, setAdding] = useState(false);
  const [paying, setPaying] = useState<Expense | null>(null);
  const acct = accountSummary(road, now);
  const waiting = road.expenses.filter((e) => e.status === "awaiting-approval");
  const approved = road.expenses.filter((e) => e.status === "approved");
  const paid = road.expenses.filter((e) => e.status === "paid").sort((a, b) => (b.paidAt ?? "").localeCompare(a.paidAt ?? ""));
  const rejected = road.expenses.filter((e) => e.status === "rejected");
  const canPayFromAccount = hasPlan(road.plan, "roadfund");

  return (
    <>
      <PageHeader
        title="Money"
        sub="Upload the invoice, approve it, pay the contractor from the road account."
        actions={
          <Button onClick={() => setAdding(true)} icon={<Plus className="h-5 w-5" aria-hidden />}>
            Add a bill
          </Button>
        }
      />
      <MoneyNav />

      <div className="space-y-6">
        <BillList
          title="Waiting for your approval"
          bills={waiting}
          empty="No bills waiting."
          render={(e) => (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => dispatch({ type: "expense.approve", expenseId: e.id }, "Approved.")} icon={<Check className="h-4 w-4" aria-hidden />}>
                Approve
              </Button>
              <Button size="sm" variant="ghost" onClick={() => dispatch({ type: "expense.reject", expenseId: e.id }, "Rejected.")} icon={<X className="h-4 w-4" aria-hidden />}>
                Reject
              </Button>
            </div>
          )}
        />
        <BillList
          title="Approved, ready to pay"
          sub={`Available in the road account: ${money(acct.available)}`}
          bills={approved}
          empty="Nothing approved and unpaid."
          render={(e) => (
            <Button size="sm" onClick={() => setPaying(e)} icon={<Landmark className="h-4 w-4" aria-hidden />}>
              Pay {money(e.amount)}
            </Button>
          )}
        />
        <BillList title="Paid" bills={paid} empty="No paid bills yet." render={(e) => (
            <span className="inline-flex items-start gap-1 text-[0.9rem] font-semibold text-pine">
              <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              Paid {e.paidAt ? fmtDate(e.paidAt) : ""} {e.paidVia === "road-account" ? "from road account" : e.paidVia === "check" ? "by check" : "as reimbursement"}
            </span>
          )} />
        {rejected.length > 0 && (
          <BillList
            title="Rejected"
            bills={rejected}
            empty=""
            render={(e) => (
              <Button size="sm" variant="ghost" onClick={() => dispatch({ type: "expense.delete", expenseId: e.id }, "Deleted.")}>
                Delete
              </Button>
            )}
          />
        )}
      </div>

      <AddBillDialog open={adding} onClose={() => setAdding(false)} />

      {paying && (
        <Dialog open onClose={() => setPaying(null)} title={`Pay ${paying.vendorName}`}>
          <div className="space-y-4">
            <p className="tnum font-display text-[2rem] font-black">{money(paying.amount)}</p>
            <p className="text-stone">{paying.description}</p>
            <div className="grid gap-2">
              <button
                className="flex items-center gap-3 rounded-xl border-2 border-pine bg-pine-50/60 p-4 text-left disabled:opacity-60"
                disabled={!canPayFromAccount || road.account.status !== "connected"}
                onClick={async () => {
                  if (await dispatch({ type: "expense.pay", expenseId: paying.id, via: "road-account" }, `Paid ${paying.vendorName} ${money(paying.amount)} (simulated).`)) setPaying(null);
                }}
              >
                {canPayFromAccount ? <Landmark className="h-6 w-6 text-pine" aria-hidden /> : <Lock className="h-6 w-6 text-sign-ink" aria-hidden />}
                <span>
                  <span className="block font-bold">Pay from the road account</span>
                  <span className="block text-[0.9rem] text-stone">
                    {!canPayFromAccount
                      ? "Part of the Road Fund plan. Upgrade in Settings."
                      : road.account.status !== "connected"
                        ? "Connect the road's bank account first."
                        : `Sent by bank transfer, arrives in 1–2 business days. ${money(acct.available)} available.`}
                  </span>
                </span>
              </button>
              <button
                className="flex items-center gap-3 rounded-xl border border-line p-4 text-left hover:bg-paper"
                onClick={async () => {
                  if (await dispatch({ type: "expense.pay", expenseId: paying.id, via: "check" }, "Recorded as paid by check.")) setPaying(null);
                }}
              >
                <Check className="h-6 w-6 text-stone" aria-hidden />
                <span>
                  <span className="block font-bold">I paid it by check from the road&apos;s bank</span>
                  <span className="block text-[0.9rem] text-stone">Records it in the ledger.</span>
                </span>
              </button>
              <button
                className="flex items-center gap-3 rounded-xl border border-line p-4 text-left hover:bg-paper"
                onClick={async () => {
                  if (await dispatch({ type: "expense.pay", expenseId: paying.id, via: "reimbursed" }, "Recorded as a reimbursement.")) setPaying(null);
                }}
              >
                <Check className="h-6 w-6 text-stone" aria-hidden />
                <span>
                  <span className="block font-bold">I paid it myself and the road paid me back</span>
                  <span className="block text-[0.9rem] text-stone">Records it as a reimbursement so the ledger stays complete.</span>
                </span>
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </>
  );
}

function BillList({ title, sub, bills, empty, render }: { title: string; sub?: string; bills: Expense[]; empty: string; render: (e: Expense) => React.ReactNode }) {
  const { road } = useRoad();
  return (
    <Card>
      <CardHeader title={`${title}${bills.length ? ` (${bills.length})` : ""}`} sub={sub} />
      {bills.length === 0 ? (
        <Empty title={empty} />
      ) : (
        <ul className="divide-y divide-line">
          {bills.map((e) => {
            const c = road.contractors.find((x) => x.id === e.contractorId);
            return (
              <li key={e.id} id={e.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                {e.invoiceFileId && <FileThumb fileId={e.invoiceFileId} alt={`Invoice from ${e.vendorName}`} className="h-16 w-16 shrink-0 rounded-lg" />}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {e.vendorName} · <span className="tnum">{money(e.amount)}</span>
                  </p>
                  <p className="text-[0.92rem] text-stone">
                    {e.description} · {CATEGORY_LABEL[e.category]} · invoice {fmtDate(e.invoiceDate)}
                    {c && !c.w9OnFile && !c.isCorporation && " · no W-9 on file"}
                  </p>
                </div>
                <div className="shrink-0">{render(e)}</div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
