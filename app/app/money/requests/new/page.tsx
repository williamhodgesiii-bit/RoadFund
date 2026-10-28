"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { BudgetEditor } from "@/components/app/budget-editor";
import { PageHeader } from "@/components/app/common";
import { RoadStrip } from "@/components/road-strip";
import { Button, Callout, Card, Choice, Field, Input, Select, Textarea } from "@/components/ui";
import { useRoad } from "@/lib/client/road-context";
import type { Command } from "@/lib/commands";
import { addDays, isoDate } from "@/lib/dates";
import { benchmarkRange, suggestedBudget } from "@/lib/factory";
import { uid } from "@/lib/ids";
import { money } from "@/lib/money";
import { computeShares, METHOD_INFO } from "@/lib/split";
import type { BudgetLine, DuesRequest, SplitMethod } from "@/lib/types";

export default function NewRequestPage() {
  const router = useRouter();
  const { road, dispatch, now } = useRoad();
  const year = now.getFullYear();
  const hasAnnual = road.requests.some((r) => r.kind === "annual" && r.createdAt.startsWith(String(year)));
  // Arriving from a passed vote: bill the project before the work starts.
  const voteId = useSearchParams().get("vote");
  const vote = road.votes.find((v) => v.id === voteId && v.outcome === "passed" && v.amount && !v.requestId) ?? null;
  const [kind, setKind] = useState<"annual" | "special">(vote || hasAnnual ? "special" : "annual");
  const [title, setTitle] = useState(vote ? vote.question.replace(/\?$/, "").replace(/ for \$[\d,.]+$/, "") : hasAnnual ? "" : `${year} road dues`);
  const [budget, setBudget] = useState<BudgetLine[]>(() =>
    vote
      ? [{ id: uid("bud"), label: vote.question.replace(/\?$/, ""), category: "other", amount: vote.amount ?? 0 }]
      : hasAnnual
        ? [{ id: uid("bud"), label: "", category: "other", amount: 0 }]
        : road.budget.length
          ? road.budget.map((b) => ({ ...b, id: uid("bud") }))
          : suggestedBudget(road.lengthFt, road.surface),
  );
  const [split, setSplit] = useState(road.split);
  const [dueDate, setDueDate] = useState(addDays(isoDate(now), 30));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = budget.reduce((a, b) => a + b.amount, 0);
  const homes = road.homes.map((h) => ({ id: h.id, label: h.label, frontageFt: h.frontageFt, distanceFt: h.distanceFt, customPct: h.customPct, vacant: h.vacant }));
  const shares = useMemo(() => computeShares(total, homes, split), [total, split, road.homes]); // eslint-disable-line react-hooks/exhaustive-deps
  const bench = benchmarkRange(road.lengthFt);

  const create = async () => {
    if (!title.trim()) return setError("Give the request a title.");
    if (total <= 0) return setError("Add at least one budget amount.");
    if (!shares.ok) return setError(shares.problems.join(" "));
    setSaving(true);
    const request: DuesRequest = {
      id: uid("req"),
      title: title.trim(),
      kind,
      createdAt: new Date().toISOString(),
      dueDate,
      total,
      budget: budget.filter((b) => b.amount > 0),
      split,
      lines: shares.lines.map((l) => ({ homeId: l.homeId, amount: l.amount, reason: l.reason })),
      message: note,
      status: "open",
      sentAt: null,
      voteId: vote?.id ?? null,
    };
    const cmds: Command[] = [{ type: "request.create", request }];
    if (kind === "annual") cmds.unshift({ type: "road.budget", budget: request.budget });
    const ok = await dispatch(cmds);
    setSaving(false);
    if (ok) router.push(`/app/money/requests/${request.id}?send=1`);
  };

  return (
    <>
      <PageHeader title={vote ? "Bill the project" : "New bill"} back={{ href: "/app/money", label: "Money" }} sub="Set the amount, check each share, then send it." />
      <div className="space-y-6">
        {vote && (
          <Callout tone="ok" title="Collect before the work starts">
            Neighbors approved this by vote. Each home pays its share now, and you pay the contractor once the money is in, so nobody has to front it.
          </Callout>
        )}
        <Card className="space-y-5 p-5">
          <Choice
            name="kind"
            columns={2}
            value={kind}
            onChange={(k) => {
              setKind(k);
              if (k === "annual" && !title) setTitle(`${year} road dues`);
            }}
            options={[
              { value: "annual", label: "Yearly dues", hint: "The regular budget: plowing, grading, gravel, savings." },
              { value: "special", label: "Project share", hint: "One job, like a culvert or new gravel, usually after a vote." },
            ]}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title" htmlFor="nr-title">
              <Input id="nr-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === "special" ? "Creek culvert replacement" : `${year} road dues`} />
            </Field>
            <Field label="Due date" htmlFor="nr-due">
              <Input id="nr-due" type="date" value={dueDate} min={isoDate(now)} onChange={(e) => setDueDate(e.target.value)} />
            </Field>
          </div>
        </Card>

        <section>
          <h2 className="mb-1 text-[1.25rem] font-extrabold">What it covers</h2>
          <p className="mb-3 text-stone">
            Neighbors see these lines on their pay page.
            {kind === "annual" && (road.surface === "gravel" || road.surface === "dirt") && ` Typical gravel road upkeep for ${road.lengthFt.toLocaleString()} ft: ${money(bench.low)} to ${money(bench.high)} a year.`}
          </p>
          <BudgetEditor lines={budget} onChange={setBudget} />
          <p className="mt-3 flex items-baseline justify-between rounded-xl bg-white px-4 py-3 shadow-card">
            <span className="font-bold">Total</span>
            <span className="tnum font-display text-[1.5rem] font-black">{money(total)}</span>
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-[1.25rem] font-extrabold">How it&apos;s split</h2>
          <Card className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Method" htmlFor="nr-method">
                <Select id="nr-method" value={split.method} onChange={(e) => setSplit({ ...split, method: e.target.value as SplitMethod })}>
                  {(["equal", "segment", "distance", "frontage", "custom"] as SplitMethod[]).map((m) => (
                    <option key={m} value={m}>
                      {METHOD_INFO[m].name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Vacant lots pay" htmlFor="nr-vacant">
                <Select id="nr-vacant" value={split.vacantWeight} onChange={(e) => setSplit({ ...split, vacantWeight: Number(e.target.value) })}>
                  <option value={1}>A full share</option>
                  <option value={0.5}>Half a share</option>
                  <option value={0.25}>A quarter share</option>
                  <option value={0}>Nothing</option>
                </Select>
              </Field>
              {split.method !== "equal" && split.method !== "custom" && (
                <Field label="Base share" htmlFor="nr-base">
                  <Select id="nr-base" value={split.basePct} onChange={(e) => setSplit({ ...split, basePct: Number(e.target.value) })}>
                    {[0, 25, 50, 75].map((p) => (
                      <option key={p} value={p}>
                        {p ? `${p}% split evenly` : "None"}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
            </div>
            {(split.method !== road.split.method || split.vacantWeight !== road.split.vacantWeight || split.basePct !== road.split.basePct) && (
              <Callout tone="info">This request uses a different split than the road&apos;s usual one. Change the usual split on the Road tab.</Callout>
            )}
          </Card>
          {!shares.ok ? (
            <Callout tone="danger" className="mt-4" title="Can't split yet">
              {shares.problems.join(" ")} Add the missing details on the Road tab.
            </Callout>
          ) : (
            <Card className="mt-4">
              {shares.stretches.length > 0 && (split.method === "segment" || split.method === "distance") && (
                <div className="border-b border-line p-5">
                  <RoadStrip homes={road.homes} stretches={shares.stretches} lengthFt={road.lengthFt} />
                </div>
              )}
              <ul className="divide-y divide-line">
                {shares.lines.map((l) => {
                  const h = road.homes.find((x) => x.id === l.homeId)!;
                  return (
                    <li key={l.homeId} className="px-5 py-3">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-semibold">
                          {h.owners || h.label} <span className="font-normal text-stone">· {h.label}</span>
                        </span>
                        <span className="tnum font-bold">{money(l.amount)}</span>
                      </div>
                      <p className="mt-0.5 text-[0.88rem] text-stone">{l.reason}</p>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </section>

        <Field label="Note to neighbors" optional hint="Shown on their pay page, e.g. why this year is higher." htmlFor="nr-note">
          <Textarea id="nr-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
        </Field>

        {error && <Callout tone="danger">{error}</Callout>}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button size="lg" onClick={create} loading={saving} disabled={!shares.ok || total <= 0}>
            Create and choose how to send
          </Button>
          <Button size="lg" variant="ghost" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </div>
    </>
  );
}
