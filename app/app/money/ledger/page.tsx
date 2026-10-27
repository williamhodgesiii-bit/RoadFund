"use client";

import { useMemo, useState } from "react";
import { Clock, Download, Paperclip } from "lucide-react";
import { FileThumb, MoneyNav, PageHeader } from "@/components/app/common";
import { ReceiptDialog } from "@/components/app/money-dialogs";
import { Button, Card, cx, Empty, Select } from "@/components/ui";
import { useRoad } from "@/lib/client/road-context";
import { downloadFile, toCsv } from "@/lib/client/links";
import { fmtDay, yearOf } from "@/lib/dates";
import { money } from "@/lib/money";
import { ledger } from "@/lib/selectors";
import type { Payment } from "@/lib/types";

export default function LedgerPage() {
  const { road, now } = useRoad();
  const all = useMemo(() => ledger(road, now), [road, now]);
  const years = [...new Set(all.map((e) => yearOf(String(e.date))))].sort((a, b) => b - a);
  const [year, setYear] = useState<number | "all">(years[0] ?? now.getFullYear());
  const [kind, setKind] = useState<"all" | "in" | "out">("all");
  const [receipt, setReceipt] = useState<Payment | null>(null);
  const [showFile, setShowFile] = useState<string | null>(null);

  const rows = all.filter((e) => (year === "all" || yearOf(String(e.date)) === year) && (kind === "all" || e.kind === kind || (kind === "in" && e.kind === "opening"))).reverse();

  const exportCsv = () => {
    const data: (string | number)[][] = [["Date", "Type", "Who / vendor", "Detail", "Amount", "Running balance", "Receipt", "Status"]];
    for (const e of all.filter((x) => year === "all" || yearOf(String(x.date)) === year)) {
      data.push([String(e.date).slice(0, 10), e.kind === "out" ? "Paid out" : e.kind === "in" ? "Received" : "Opening", e.label, e.detail, (e.amount / 100).toFixed(2), (e.balance / 100).toFixed(2), e.receiptNo ?? "", e.pending ? "Clearing" : "Cleared"]);
    }
    downloadFile(`${road.name.replace(/\W+/g, "-").toLowerCase()}-ledger-${year}.csv`, toCsv(data), "text/csv");
  };

  return (
    <>
      <PageHeader
        title="Money"
        sub="Every dollar in and out, with a running balance anyone on the road can check."
        actions={
          <Button variant="secondary" icon={<Download className="h-5 w-5" aria-hidden />} onClick={exportCsv}>
            Export CSV
          </Button>
        }
      />
      <MoneyNav />
      <div className="mb-4 flex flex-wrap gap-3">
        <Select value={year} onChange={(e) => setYear(e.target.value === "all" ? "all" : Number(e.target.value))} className="w-40" aria-label="Year">
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
          <option value="all">All years</option>
        </Select>
        <Select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className="w-44" aria-label="Show">
          <option value="all">Money in and out</option>
          <option value="in">Money in</option>
          <option value="out">Money out</option>
        </Select>
      </div>
      <Card>
        {rows.length === 0 ? (
          <Empty title="Nothing here yet">Payments and paid bills show up here automatically.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left">
              <caption className="sr-only">Ledger</caption>
              <thead className="border-b border-line bg-paper text-[0.88rem] text-stone">
                <tr>
                  <th className="px-5 py-2.5 font-semibold">Date</th>
                  <th className="px-3 py-2.5 font-semibold">Who / what</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Amount</th>
                  <th className="px-5 py-2.5 text-right font-semibold">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((e) => {
                  const payment = e.kind === "in" ? road.payments.find((p) => p.id === e.id) : null;
                  return (
                    <tr key={e.id} className="align-top">
                      <td className="whitespace-nowrap px-5 py-3 text-stone">{fmtDay(String(e.date), now)}</td>
                      <td className="px-3 py-3">
                        <p className="font-semibold">{e.label}</p>
                        <p className="text-[0.88rem] text-stone">
                          {e.detail}
                          {e.pending && (
                            <span className="ml-1.5 inline-flex items-center gap-1 text-lake">
                              <Clock className="h-3.5 w-3.5" aria-hidden /> clearing
                            </span>
                          )}
                        </p>
                        <div className="mt-1 flex gap-3 text-[0.85rem]">
                          {payment && (
                            <button className="font-semibold text-pine hover:underline" onClick={() => setReceipt(payment)}>
                              Receipt {payment.receiptNo}
                            </button>
                          )}
                          {e.fileId && (
                            <button className="inline-flex items-center gap-1 font-semibold text-pine hover:underline" onClick={() => setShowFile(showFile === e.fileId ? null : e.fileId)}>
                              <Paperclip className="h-3.5 w-3.5" aria-hidden /> Invoice
                            </button>
                          )}
                        </div>
                        {showFile && showFile === e.fileId && <FileThumb fileId={e.fileId} alt="Invoice" className="mt-2 h-40 w-40 rounded-lg" />}
                      </td>
                      <td className={cx("tnum whitespace-nowrap px-3 py-3 text-right font-bold", e.amount < 0 ? "text-charcoal" : "text-pine")}>
                        {e.amount < 0 ? `−${money(-e.amount)}` : `+${money(e.amount)}`}
                      </td>
                      <td className="tnum whitespace-nowrap px-5 py-3 text-right">{money(e.balance)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <p className="mt-3 text-[0.9rem] text-stone">Money in shows what the road received after any fees it covered. Voided payments are left out of the balance and kept on their receipts.</p>
      <ReceiptDialog payment={receipt} onClose={() => setReceipt(null)} />
    </>
  );
}
