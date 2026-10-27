"use client";

import { useState } from "react";
import { CircleAlert, CircleCheck, CircleHelp, Printer } from "lucide-react";
import { MoneyNav, PageHeader, PlanGate } from "@/components/app/common";
import { Button, Card, CardHeader, Pill, Select, Toggle } from "@/components/ui";
import { useRoad } from "@/lib/client/road-context";
import { yearOf } from "@/lib/dates";
import { CATEGORY_LABEL } from "@/lib/factory";
import { money } from "@/lib/money";
import { contractorTotals, ledger, ONE_099_THRESHOLD, yearTotals } from "@/lib/selectors";

export default function TaxesPage() {
  const { road, dispatch, now } = useRoad();
  const years = [...new Set([now.getFullYear(), ...road.payments.map((p) => yearOf(p.paidAt)), ...road.expenses.filter((e) => e.paidAt).map((e) => yearOf(e.paidAt!))])].sort((a, b) => b - a);
  const [year, setYear] = useState(years[0]);
  const t = yearTotals(road, year);
  const ctr = contractorTotals(road, year);
  const rows = ledger(road, now);
  const startBalance = rows.filter((r) => yearOf(String(r.date)) < year).at(-1)?.balance ?? 0;
  const endBalance = rows.filter((r) => yearOf(String(r.date)) <= year).at(-1)?.balance ?? 0;
  const maxCat = Math.max(1, ...t.byCategory.map((c) => c.amount));
  const net = t.duesIn - t.spent;

  return (
    <>
      <PageHeader
        title="Money"
        sub="Year-end report, 1099s and the Form 1120-H checklist."
        actions={
          <Button variant="secondary" icon={<Printer className="h-5 w-5" aria-hidden />} onClick={() => window.print()} className="no-print">
            Print report
          </Button>
        }
      />
      <div className="no-print">
        <MoneyNav />
      </div>
      <PlanGate needs="plus" feature="The tax pack" pitch="A year-end report for neighbors, 1099 tracking for contractors paid $2,000 or more, and a Form 1120-H checklist with your numbers filled in.">
        <div className="mb-4 flex items-center gap-3 no-print">
          <label htmlFor="tax-year" className="font-semibold">
            Tax year
          </label>
          <Select id="tax-year" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-32">
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title={`${road.name}: ${year} year-end report`} sub={`${road.county} County, ${road.state} · ${road.homes.length} homes`} />
            <div className="grid grid-cols-2 gap-5 p-5 sm:grid-cols-4">
              <Fig label="Started the year" value={money(startBalance)} />
              <Fig label="Dues received" value={money(t.duesIn)} />
              <Fig label="Spent" value={money(t.spent)} />
              <Fig label="Ended the year" value={money(endBalance)} />
            </div>
            <div className="border-t border-line p-5">
              <h3 className="font-bold">Where the money went</h3>
              {t.byCategory.length === 0 ? (
                <p className="mt-2 text-stone">No spending recorded in {year}.</p>
              ) : (
                <ul className="mt-3 space-y-2.5" aria-label={`Spending by category in ${year}`}>
                  {t.byCategory.map((c) => (
                    <li key={c.category} className="grid grid-cols-[9.5rem_1fr_auto] items-center gap-3" title={`${CATEGORY_LABEL[c.category]}: ${money(c.amount)}`}>
                      <span className="truncate text-[0.95rem]">{CATEGORY_LABEL[c.category]}</span>
                      <span className="h-5 rounded-r-[4px] bg-pine" style={{ width: `${Math.max(2, (c.amount / maxCat) * 100)}%`, maxWidth: "100%" }} aria-hidden />
                      <span className="tnum text-right font-semibold">{money(c.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {t.feesPaid > 0 && <p className="mt-3 text-[0.9rem] text-stone">Payment fees the road covered: {money(t.feesPaid)}.</p>}
            </div>
          </Card>

          <Card>
            <CardHeader title="1099-NEC tracker" sub={`Contractors paid ${money(ONE_099_THRESHOLD)} or more in ${year} need a 1099-NEC by January 31, unless they're a corporation.`} />
            <ul className="divide-y divide-line">
              {ctr.map((c) => (
                <li key={c.id} className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{c.name}</p>
                    <p className="text-[0.9rem] text-stone">
                      Paid <span className="tnum">{money(c.paid)}</span> in {year}
                      {c.isCorporation && " · corporation"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {c.needs1099 ? (
                      <Pill tone="late" icon={<CircleAlert className="h-4 w-4" aria-hidden />}>
                        1099 needed
                      </Pill>
                    ) : (
                      <Pill tone="neutral">No 1099</Pill>
                    )}
                    {!c.isCorporation && (
                      <Toggle
                        checked={c.w9OnFile}
                        onChange={(v) => {
                          const full = road.contractors.find((x) => x.id === c.id)!;
                          dispatch({ type: "contractor.save", contractor: { ...full, w9OnFile: v } });
                        }}
                        label="W-9 on file"
                      />
                    )}
                  </div>
                </li>
              ))}
              {ctr.length === 0 && <li className="px-5 py-4 text-stone">No contractors yet.</li>}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Form 1120-H checklist" sub="For homeowners associations, including many road associations. Have a tax preparer confirm before filing." />
            <ul className="divide-y divide-line">
              <Check ok label="Dues are the road's main income" detail={`Exempt function income (dues): ${money(t.duesIn)}. At least 60% of gross income must come from dues; for most roads it's 100%.`} />
              <Check label="At least 90% of spending is on the road" detail={`Spending recorded: ${money(t.spent)}. Plowing, grading, gravel, culverts and insurance all count. Confirm nothing else was paid from the account.`} />
              <Check label="At least 85% of lots are residential" detail={`${road.homes.filter((h) => !h.vacant).length} homes and ${road.homes.filter((h) => h.vacant).length} vacant lots on the road. Lots held for building homes generally count; confirm with your preparer.`} />
              <Check label="The road group has an EIN" detail="Form 1120-H needs an Employer Identification Number. Apply free at IRS.gov. Most informal road groups don't have one yet." />
              <Check ok={net <= 0} label="Taxable income" detail={`Income other than dues (for example interest) minus related costs, less a $100 deduction, is taxed at 30%. Road Fund records no non-dues income for ${year}.`} />
              <Check label={`Due April 15, ${year + 1}`} detail="The 15th day of the fourth month after a calendar tax year ends. Ask a tax preparer whether your road should file." />
            </ul>
          </Card>
        </div>
      </PlanGate>
    </>
  );
}

function Fig({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[0.85rem] font-semibold text-stone">{label}</p>
      <p className="tnum text-[1.35rem] font-extrabold">{value}</p>
    </div>
  );
}

function Check({ label, detail, ok }: { label: string; detail: string; ok?: boolean }) {
  return (
    <li className="flex gap-3 px-5 py-3.5">
      {ok ? <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-pine" aria-label="Looks fine" /> : <CircleHelp className="mt-0.5 h-5 w-5 shrink-0 text-sign-ink" aria-label="Confirm" />}
      <div>
        <p className="font-semibold">{label}</p>
        <p className="text-[0.92rem] text-stone">{detail}</p>
      </div>
    </li>
  );
}
