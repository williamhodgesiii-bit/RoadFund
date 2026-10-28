"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ClipboardList, Copy, Plus, Trash2 } from "lucide-react";
import { computeShares, METHOD_INFO, type SplitHome } from "@/lib/split";
import { money, parseMoney } from "@/lib/money";
import type { SplitMethod } from "@/lib/types";
import { RoadStrip } from "./road-strip";
import { Button, Callout, Card, Checkbox, Choice, cx, Field, Input, Select } from "./ui";
import { useToast } from "./toast";

export interface CalcDraft {
  budget: number;
  method: SplitMethod;
  vacantWeight: number;
  basePct: number;
  homes: SplitHome[];
}

export const CALC_KEY = "rf:calc";

const SAMPLE: SplitHome[] = [
  { id: "c1", label: "Lot 1", distanceFt: 300, frontageFt: 220, customPct: null, vacant: false },
  { id: "c2", label: "Lot 2", distanceFt: 650, frontageFt: 260, customPct: null, vacant: false },
  { id: "c3", label: "Lot 3", distanceFt: 900, frontageFt: 180, customPct: null, vacant: false },
  { id: "c4", label: "Lot 4", distanceFt: 1250, frontageFt: 300, customPct: null, vacant: true },
  { id: "c5", label: "Lot 5", distanceFt: 1600, frontageFt: 240, customPct: null, vacant: false },
  { id: "c6", label: "Lot 6", distanceFt: 2000, frontageFt: 280, customPct: null, vacant: false },
];

const METHODS: SplitMethod[] = ["equal", "segment", "distance", "frontage", "custom"];

const numOrNull = (v: string): number | null => {
  if (v.trim() === "") return null;
  const n = Number(v.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};

export function ShareCalculator({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [budgetText, setBudgetText] = useState("3000");
  const [method, setMethod] = useState<SplitMethod>("equal");
  const [vacantWeight, setVacantWeight] = useState(0.5);
  const [basePct, setBasePct] = useState(compact ? 50 : 0);
  const [homes, setHomes] = useState<SplitHome[]>(SAMPLE);
  const [selected, setSelected] = useState<string | null>(compact ? "c6" : null);

  const budget = parseMoney(budgetText) ?? 0;
  const settings = { method, vacantWeight, basePct };
  const result = useMemo(() => computeShares(budget, homes, settings), [budget, homes, method, vacantWeight, basePct]); // eslint-disable-line react-hooks/exhaustive-deps
  const comparison = useMemo(
    () =>
      METHODS.filter((m) => m !== "custom").map((m) => ({
        method: m,
        result: computeShares(budget, homes, { method: m, vacantWeight, basePct: m === "equal" ? 0 : basePct }),
      })),
    [budget, homes, vacantWeight, basePct],
  );
  const usesBase = method === "segment" || method === "distance" || method === "frontage";

  const update = (id: string, patch: Partial<SplitHome>) => setHomes((hs) => hs.map((h) => (h.id === id ? { ...h, ...patch } : h)));
  const addHome = () =>
    setHomes((hs) => {
      const last = hs.at(-1);
      const n = hs.length + 1;
      return [...hs, { id: `c${Date.now()}`, label: `Lot ${n}`, distanceFt: (last?.distanceFt ?? 0) + 300, frontageFt: 250, customPct: null, vacant: false }];
    });

  const copyText = async () => {
    if (!result.ok) return;
    const lines = [
      `Road shares: ${money(budget)} budget, ${METHOD_INFO[method].name.toLowerCase()}${usesBase && basePct ? ` with a ${basePct}% base share` : ""}`,
      ...result.lines.map((l) => `${l.label}: ${money(l.amount)} (${l.pct.toFixed(1)}%)`),
      `Total: ${money(result.lines.reduce((a, l) => a + l.amount, 0))}`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast("Copied. Paste it into your group text or email.");
    } catch {
      toast("Couldn't copy. Select the table and copy it instead.", "error");
    }
  };

  const useForRoad = () => {
    const draft: CalcDraft = { budget, method, vacantWeight, basePct, homes };
    try {
      sessionStorage.setItem(CALC_KEY, JSON.stringify(draft));
    } catch {}
    router.push("/start?from=calculator");
  };

  const maxAmount = Math.max(1, ...(result.ok ? result.lines.map((l) => l.amount) : [1]));

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Inputs */}
      <div className="space-y-5">
        <Field label="This year's road budget" hint="Plowing, grading, gravel and savings, added up." htmlFor="calc-budget">
          <Input id="calc-budget" inputMode="decimal" prefix="$" value={budgetText} onChange={(e) => setBudgetText(e.target.value)} className="max-w-xs" />
        </Field>

        <fieldset>
          <legend className="mb-2 font-semibold">How to split it</legend>
          {compact ? (
            <Select value={method} onChange={(e) => setMethod(e.target.value as SplitMethod)} aria-label="Split method">
              {METHODS.filter((m) => m !== "custom").map((m) => (
                <option key={m} value={m}>
                  {METHOD_INFO[m].name}
                </option>
              ))}
            </Select>
          ) : (
            <Choice
              name="method"
              value={method}
              onChange={setMethod}
              options={METHODS.map((m) => ({ value: m, label: METHOD_INFO[m].name, hint: METHOD_INFO[m].short }))}
            />
          )}
          <p className="mt-2 text-[0.92rem] text-stone">{METHOD_INFO[method].long}</p>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Vacant lots pay" htmlFor="calc-vacant">
            <Select id="calc-vacant" value={vacantWeight} onChange={(e) => setVacantWeight(Number(e.target.value))}>
              <option value={1}>A full share</option>
              <option value={0.5}>Half a share</option>
              <option value={0.25}>A quarter share</option>
              <option value={0}>Nothing</option>
            </Select>
          </Field>
          {usesBase && (
            <Field label="Base share" hint="Split evenly before the method applies." htmlFor="calc-base">
              <Select id="calc-base" value={basePct} onChange={(e) => setBasePct(Number(e.target.value))}>
                <option value={0}>None</option>
                <option value={25}>25% split evenly</option>
                <option value={50}>50% split evenly</option>
                <option value={75}>75% split evenly</option>
              </Select>
            </Field>
          )}
        </div>

        {!compact && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-bold">Homes on the road</h3>
              <span className="text-[0.9rem] text-stone">{homes.length} homes</span>
            </div>
            <ul className="space-y-2.5">
              {homes.map((h) => (
                <li key={h.id} className={cx("rounded-xl border bg-white p-3", selected === h.id ? "border-pine" : "border-line")}>
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[1.1fr_1fr_1fr_auto]">
                    <Input aria-label="Name or lot" value={h.label} onChange={(e) => update(h.id, { label: e.target.value })} onFocus={() => setSelected(h.id)} />
                    <Input
                      aria-label={`${h.label} distance from entrance in feet`}
                      inputMode="numeric"
                      suffix="ft in"
                      value={h.distanceFt ?? ""}
                      onChange={(e) => update(h.id, { distanceFt: numOrNull(e.target.value) })}
                      onFocus={() => setSelected(h.id)}
                    />
                    {method === "custom" ? (
                      <Input aria-label={`${h.label} percentage`} inputMode="decimal" suffix="%" value={h.customPct ?? ""} onChange={(e) => update(h.id, { customPct: numOrNull(e.target.value) })} />
                    ) : (
                      <Input
                        aria-label={`${h.label} frontage in feet`}
                        inputMode="numeric"
                        suffix="ft front"
                        value={h.frontageFt ?? ""}
                        onChange={(e) => update(h.id, { frontageFt: numOrNull(e.target.value) })}
                      />
                    )}
                    <div className="flex items-center justify-between gap-2 sm:justify-end">
                      <Checkbox checked={h.vacant} onChange={(v) => update(h.id, { vacant: v })} label="Vacant" />
                      <button
                        className="rounded-lg p-2 text-stone hover:bg-brick-50 hover:text-brick disabled:opacity-40"
                        onClick={() => setHomes((hs) => hs.filter((x) => x.id !== h.id))}
                        disabled={homes.length <= 2}
                        aria-label={`Remove ${h.label}`}
                      >
                        <Trash2 className="h-5 w-5" aria-hidden />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <Button variant="secondary" size="sm" className="mt-3" icon={<Plus className="h-4 w-4" aria-hidden />} onClick={addHome} disabled={homes.length >= 40}>
              Add a home
            </Button>
          </div>
        )}
      </div>

      {/* Results */}
      <div className="space-y-4">
        <Card className="p-4 sm:p-5">
          <RoadStrip homes={homes} stretches={result.stretches.length ? result.stretches : computeShares(100, homes, { method: "segment", vacantWeight: 1, basePct: 0 }).stretches} selectedId={selected} onSelect={setSelected} />
        </Card>
        {result.problems.length > 0 && (
          <Callout tone={result.ok ? "warn" : "danger"} title={result.ok ? "Check this" : "Can't split yet"}>
            <ul className="list-disc pl-5">
              {result.problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </Callout>
        )}
        {result.ok && (
          <Card>
            <ul className="divide-y divide-line">
              {result.lines.map((l) => {
                const on = selected === l.homeId;
                return (
                  <li key={l.homeId}>
                    <button className={cx("block w-full px-4 py-3 text-left sm:px-5", on && "bg-pine-50/60")} onClick={() => setSelected(on ? null : l.homeId)} aria-expanded={on}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-semibold">{l.label}</span>
                        <span className="tnum font-display text-[1.15rem] font-extrabold">{money(l.amount)}</span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-3">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-paper-2">
                          <div className="h-full rounded-full bg-pine" style={{ width: `${(l.amount / maxAmount) * 100}%` }} />
                        </div>
                        <span className="tnum w-14 text-right text-[0.88rem] text-stone">{l.pct.toFixed(1)}%</span>
                      </div>
                      {on && <p className="mt-2 text-[0.92rem] text-stone">{l.reason}</p>}
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="flex items-center justify-between border-t border-line px-4 py-3 sm:px-5">
              <span className="text-stone">Adds up to</span>
              <span className="tnum font-bold">{money(result.lines.reduce((a, l) => a + l.amount, 0))}</span>
            </div>
          </Card>
        )}
        <p className="text-[0.9rem] text-stone">Tap a home to see why it owes what it owes.</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={useForRoad} icon={<ArrowRight className="h-5 w-5" aria-hidden />} disabled={!result.ok}>
            Use these shares for my road
          </Button>
          {!compact && (
            <Button variant="secondary" onClick={copyText} icon={<Copy className="h-5 w-5" aria-hidden />} disabled={!result.ok}>
              Copy as text
            </Button>
          )}
        </div>

        {!compact && result.ok && (
          <details className="rounded-xl border border-line bg-white">
            <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 font-semibold">
              <ClipboardList className="h-5 w-5 text-pine" aria-hidden /> Compare every method side by side
            </summary>
            <div className="overflow-x-auto border-t border-line" tabIndex={0} role="region" aria-label="Share comparison">
              <table className="w-full min-w-[520px] text-[0.92rem]">
                <thead>
                  <tr className="text-left text-stone">
                    <th className="px-4 py-2 font-semibold">Home</th>
                    {comparison.map((c) => (
                      <th key={c.method} className="px-3 py-2 text-right font-semibold">
                        {METHOD_INFO[c.method].name.replace(" (shared stretches)", "")}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="tnum">
                  {homes.map((h) => (
                    <tr key={h.id} className="border-t border-line">
                      <td className="px-4 py-2 font-semibold">{h.label}</td>
                      {comparison.map((c) => {
                        const line = c.result.lines.find((l) => l.homeId === h.id);
                        return (
                          <td key={c.method} className={cx("px-3 py-2 text-right", c.method === method && "bg-pine-50/60 font-bold")}>
                            {c.result.ok && line ? money(line.amount) : "—"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="border-t border-line px-4 py-3 text-[0.88rem] text-stone">
              Uses the same budget, vacant-lot rule{basePct ? ` and ${basePct}% base share` : ""} for every method except equal shares.
            </p>
          </details>
        )}
      </div>
    </div>
  );
}
