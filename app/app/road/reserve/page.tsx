"use client";

import { useMemo, useState } from "react";
import { PiggyBank, Plus, Trash2 } from "lucide-react";
import { AmountInput } from "@/components/amount-input";
import { PageHeader, PlanGate, RoadNav } from "@/components/app/common";
import { ReserveChart } from "@/components/app/reserve-chart";
import { Button, Callout, Card, CardHeader, cx, Field, Input, Select } from "@/components/ui";
import { useRoad } from "@/lib/client/road-context";
import { benchmarkRange, defaultReserveItems } from "@/lib/factory";
import { fmtFeet } from "@/lib/geo";
import { uid } from "@/lib/ids";
import { money } from "@/lib/money";
import { reserveProjection } from "@/lib/selectors";
import type { Reserve } from "@/lib/types";

export default function ReservePage() {
  const { road, dispatch, now } = useRoad();
  const year = now.getFullYear();
  const [r, setR] = useState<Reserve>(road.reserve);
  const [view, setView] = useState<"current" | "recommended">("current");
  const dirty = JSON.stringify(r) !== JSON.stringify(road.reserve);
  const proj = useMemo(() => reserveProjection(r, year), [r, year]);
  const shown = useMemo(() => (view === "current" ? proj : reserveProjection({ ...r, yearlyContribution: proj.recommended }, year)), [view, proj, r, year]);
  const bench = benchmarkRange(road.lengthFt);
  const homes = road.homes.length || 1;
  const gap = proj.recommended - r.yearlyContribution;

  return (
    <>
      <PageHeader title="Road" sub="What the road will need in the next 10 years, and what to save each year so nobody gets a surprise bill." />
      <RoadNav />
      <PlanGate needs="roadfund" feature="The savings planner" pitch="Plan for regrading, new gravel and culverts years ahead, and see the yearly amount to save so a big repair never becomes a surprise assessment.">
        <div className="space-y-6">
          <Card>
            <CardHeader title="10-year outlook" icon={<PiggyBank className="h-5 w-5" aria-hidden />} sub={`Starts with ${money(r.setAside)} set aside · costs grow ${r.inflationPct}% a year`} />
            <div className="space-y-4 p-5">
              <div className="flex flex-wrap gap-2" role="tablist" aria-label="Scenario">
                {(
                  [
                    ["current", `Saving ${money(r.yearlyContribution)}/yr (now)`],
                    ["recommended", `Saving ${money(proj.recommended)}/yr (enough)`],
                  ] as const
                ).map(([k, label]) => (
                  <button key={k} role="tab" aria-selected={view === k} onClick={() => setView(k)} className={cx("rounded-full border-2 px-4 py-1.5 text-[0.92rem] font-semibold", view === k ? "border-pine bg-pine text-white" : "border-line bg-white")}>
                    {label}
                  </button>
                ))}
              </div>
              <ReserveChart rows={shown.rows} />
              {gap > 0 ? (
                <Callout tone="warn" title={`Save ${money(proj.recommended)} a year to stay ahead`}>
                  At {money(r.yearlyContribution)} a year the fund runs {money(-proj.lowest)} short in {proj.lowestYear}. The difference is about {money(Math.round(gap / homes))} more per home per year.
                </Callout>
              ) : (
                <Callout tone="ok" title="On track">
                  At {money(r.yearlyContribution)} a year the fund covers every planned repair through {year + 9}. Lowest point: {money(proj.lowest)} in {proj.lowestYear}.
                </Callout>
              )}
              <details>
                <summary className="cursor-pointer font-semibold text-pine">Show as a table</summary>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[520px] text-[0.92rem]">
                    <thead className="text-left text-stone">
                      <tr>
                        <th className="py-1.5 pr-3 font-semibold">Year</th>
                        <th className="py-1.5 pr-3 text-right font-semibold">Start</th>
                        <th className="py-1.5 pr-3 text-right font-semibold">Saved</th>
                        <th className="py-1.5 pr-3 font-semibold">Spent on</th>
                        <th className="py-1.5 text-right font-semibold">End</th>
                      </tr>
                    </thead>
                    <tbody className="tnum divide-y divide-line">
                      {shown.rows.map((row) => (
                        <tr key={row.year}>
                          <td className="py-1.5 pr-3">{row.year}</td>
                          <td className="py-1.5 pr-3 text-right">{money(row.start)}</td>
                          <td className="py-1.5 pr-3 text-right">{money(row.contribution)}</td>
                          <td className="py-1.5 pr-3">{row.spend.map((s) => `${s.name} ${money(s.cost)}`).join("; ") || "—"}</td>
                          <td className={cx("py-1.5 text-right font-semibold", row.end < 0 && "text-brick")}>{money(row.end)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </div>
          </Card>

          <Card>
            <CardHeader title="Big repairs to plan for" sub="Cost today, how many years each one lasts, and when it was last done." />
            <div className="space-y-2.5 p-5">
              <div className="hidden grid-cols-[1.6fr_8.5rem_6rem_6.5rem_auto] gap-2 text-[0.85rem] font-semibold text-stone sm:grid">
                <span>Item</span>
                <span>Cost today</span>
                <span>Lasts</span>
                <span>Last done</span>
                <span />
              </div>
              {r.items.map((it) => {
                const set = (patch: Partial<typeof it>) => setR({ ...r, items: r.items.map((x) => (x.id === it.id ? { ...x, ...patch } : x)) });
                return (
                  <div key={it.id} className="grid grid-cols-2 gap-2 rounded-xl border border-line p-3 sm:grid-cols-[1.6fr_8.5rem_6rem_6.5rem_auto] sm:border-0 sm:p-0">
                    <Input aria-label="Item" value={it.name} onChange={(e) => set({ name: e.target.value })} className="col-span-2 sm:col-span-1" />
                    <AmountInput label={`${it.name} cost`} value={it.cost} onChange={(cost) => set({ cost })} />
                    <Input aria-label={`${it.name} years it lasts`} inputMode="numeric" suffix="yrs" value={it.lifeYears || ""} onChange={(e) => set({ lifeYears: Math.max(1, Number(e.target.value) || 1) })} />
                    <Input aria-label={`${it.name} year last done`} inputMode="numeric" value={it.lastDoneYear || ""} onChange={(e) => set({ lastDoneYear: Number(e.target.value) || year })} />
                    <button className="justify-self-end rounded-lg p-2 text-stone hover:bg-brick-50 hover:text-brick" onClick={() => setR({ ...r, items: r.items.filter((x) => x.id !== it.id) })} aria-label={`Remove ${it.name}`}>
                      <Trash2 className="h-5 w-5" aria-hidden />
                    </button>
                  </div>
                );
              })}
              <div className="flex flex-wrap gap-2 pt-1">
                <Button size="sm" variant="secondary" icon={<Plus className="h-4 w-4" aria-hidden />} onClick={() => setR({ ...r, items: [...r.items, { id: uid("res"), name: "New item", cost: 100_000, lifeYears: 10, lastDoneYear: year }] })}>
                  Add item
                </Button>
                {r.items.length === 0 && (
                  <Button size="sm" variant="ghost" onClick={() => setR({ ...r, items: defaultReserveItems(road.lengthFt, road.surface, year) })}>
                    Use typical items for this road
                  </Button>
                )}
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Savings settings" />
            <div className="grid gap-4 p-5 sm:grid-cols-3">
              <Field label="Set aside today" htmlFor="rs-aside">
                <AmountInput id="rs-aside" value={r.setAside} onChange={(setAside) => setR({ ...r, setAside })} />
              </Field>
              <Field label="Saving per year" htmlFor="rs-yearly">
                <AmountInput id="rs-yearly" value={r.yearlyContribution} onChange={(yearlyContribution) => setR({ ...r, yearlyContribution })} />
              </Field>
              <Field label="Cost growth per year" htmlFor="rs-infl">
                <Select id="rs-infl" value={r.inflationPct} onChange={(e) => setR({ ...r, inflationPct: Number(e.target.value) })}>
                  {[0, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}%
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <p className="border-t border-line px-5 py-3 text-[0.92rem] text-stone">
              Straight-line savings (each item&apos;s cost divided by its life): {money(proj.straightLine)} a year.
              {(road.surface === "gravel" || road.surface === "dirt") && ` Public benchmark for all gravel road upkeep: $5,650–$6,850 per mile a year, or ${money(bench.low)}–${money(bench.high)} for ${fmtFeet(road.lengthFt)}.`}
            </p>
          </Card>

          <div className="flex flex-wrap gap-2">
            <Button disabled={!dirty} onClick={() => dispatch({ type: "reserve.save", reserve: r }, "Savings plan saved.")}>
              Save plan
            </Button>
            {gap > 0 && (
              <Button variant="secondary" onClick={() => setR({ ...r, yearlyContribution: proj.recommended })}>
                Use {money(proj.recommended)} a year
              </Button>
            )}
            {dirty && (
              <Button variant="ghost" onClick={() => setR(road.reserve)}>
                Undo changes
              </Button>
            )}
          </div>
        </div>
      </PlanGate>
    </>
  );
}
