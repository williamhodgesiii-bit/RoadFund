"use client";

import { useState } from "react";
import { Check, Minus, Plus } from "lucide-react";
import { money } from "@/lib/money";
import { PLAN_LARGE, PLAN_SMALL, perHomeText, planPrice, SMALL_ROAD_HOMES } from "@/lib/pricing";
import { ButtonLink } from "./ui";

const FREE = ["One bill a year to every home", "Automatic reminders to homes that haven't paid", "Record checks and cash", "A payment record every neighbor can see", "Draft the road agreement and collect signatures"];
const PAID = [
  "Everything in Free",
  "As many bills as the road needs, including one-time project bills",
  "Mailed late notices, payment plans and a small-claims packet",
  "Pay the plow and grading bills from road money",
  "Votes neighbors answer from their phone",
  "Work log with photos, and the road's documents",
];

/** The two plans, with the Road Fund price worked out for the size of your road. */
export function PlanCards({ compact = false }: { compact?: boolean }) {
  const [homes, setHomes] = useState(10);
  const price = planPrice(homes);
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="flex flex-col rounded-[var(--radius-card)] border-2 border-line bg-white p-6">
        <h2 className="text-[1.25rem] font-extrabold">Free</h2>
        <p className="mt-2">
          <span className="tnum font-display text-[2.4rem] font-black">$0</span>
        </p>
        <p className="text-stone">For roads that send one bill a year.</p>
        <List items={FREE} />
        {!compact && (
          <ButtonLink href="/start" variant="secondary" block className="mt-6">
            Start free
          </ButtonLink>
        )}
      </section>
      <section className="flex flex-col rounded-[var(--radius-card)] border-2 border-pine bg-white p-6 shadow-lift">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[1.25rem] font-extrabold">Road Fund</h2>
          <span className="sign-chip rounded-md px-2 py-0.5 text-[0.8rem] font-bold">Most roads</span>
        </div>
        <p className="mt-2">
          <span className="tnum font-display text-[2.4rem] font-black">{money(price).replace(".00", "")}</span>
          <span className="ml-2 text-stone">a year</span>
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3 rounded-xl bg-paper p-3">
          <span id="homes-label" className="font-semibold">
            Homes on your road
          </span>
          <div className="flex items-center gap-1" role="group" aria-labelledby="homes-label">
            <button type="button" onClick={() => setHomes((h) => Math.max(3, h - 1))} className="flex h-11 w-11 items-center justify-center rounded-lg border-2 border-line bg-white" aria-label="Fewer homes">
              <Minus className="h-5 w-5" aria-hidden />
            </button>
            <output className="tnum w-12 text-center text-[1.3rem] font-black" aria-live="polite">
              {homes}
            </output>
            <button type="button" onClick={() => setHomes((h) => Math.min(30, h + 1))} className="flex h-11 w-11 items-center justify-center rounded-lg border-2 border-line bg-white" aria-label="More homes">
              <Plus className="h-5 w-5" aria-hidden />
            </button>
          </div>
          <span className="text-stone">That&apos;s {perHomeText(homes)}.</span>
        </div>
        <p className="mt-2 text-[0.95rem] text-stone">
          {money(PLAN_SMALL).replace(".00", "")} a year for {SMALL_ROAD_HOMES} homes or fewer, {money(PLAN_LARGE).replace(".00", "")} for 9 to 30. Most roads add it to the
          yearly budget, so it&apos;s shared like the plow bill.
        </p>
        <List items={PAID} />
        {!compact && (
          <ButtonLink href="/start" block className="mt-6">
            Start free, upgrade when you need it
          </ButtonLink>
        )}
      </section>
    </div>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="mt-5 flex-1 space-y-2.5">
      {items.map((l) => (
        <li key={l} className="flex gap-2">
          <Check className="mt-0.5 h-5 w-5 shrink-0 text-pine" aria-hidden />
          {l}
        </li>
      ))}
    </ul>
  );
}
