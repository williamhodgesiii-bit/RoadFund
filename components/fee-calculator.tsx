"use client";

import { useState } from "react";
import { computeCharge } from "@/lib/fees";
import { money, parseMoney } from "@/lib/money";
import { Field, Input, Toggle } from "./ui";

export function FeeCalculator() {
  const [text, setText] = useState("300");
  const [payerCovers, setPayerCovers] = useState(true);
  const share = parseMoney(text) ?? 0;
  const ach = computeCharge(share, "ach", payerCovers);
  const card = computeCharge(share, "card", payerCovers);

  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-white p-6 shadow-card">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="A neighbor's share" htmlFor="fee-share">
          <Input id="fee-share" inputMode="decimal" prefix="$" value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
        <Toggle checked={payerCovers} onChange={setPayerCovers} label="Neighbor covers the fees" hint={payerCovers ? "The road gets the full share." : "The road absorbs the fees."} />
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {[
          { name: "From a checking account", c: ach, note: "0.8%, at most $5, plus $1" },
          { name: "By debit or credit card", c: card, note: "2.9% + 30¢, plus $1" },
          { name: "By check or cash", c: { share, total: share, platformFee: 0, processingFee: 0, roadNet: share }, note: "Always free" },
        ].map(({ name, c, note }) => (
          <div key={name} className="rounded-xl bg-paper p-4">
            <p className="font-bold">{name}</p>
            <p className="text-[0.88rem] text-stone">{note}</p>
            <dl className="mt-3 space-y-1.5 text-[0.95rem]">
              <Row k="Neighbor pays" v={money(c.total)} strong />
              <Row k="Road Fund fee" v={money(c.platformFee)} />
              <Row k="Bank or card charge" v={money(c.processingFee)} />
              <Row k="Road receives" v={money(c.roadNet)} strong />
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className={strong ? "font-semibold" : "text-stone"}>{k}</dt>
      <dd className={`tnum ${strong ? "font-bold" : ""}`}>{v}</dd>
    </div>
  );
}
