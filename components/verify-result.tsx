"use client";

import { useEffect, useState } from "react";
import { CircleAlert, CircleCheck, Clock } from "lucide-react";
import { verifyLetter } from "@/lib/client/backend";
import { fmtDate, isoDate } from "@/lib/dates";
import type { PublicLetter } from "@/lib/letter";
import { money } from "@/lib/money";
import { stateName } from "@/lib/states";
import { VerifyForm } from "./closing-forms";
import { Callout } from "./ui";

export function VerifyResult({ code }: { code: string }) {
  const [state, setState] = useState<{ loading: boolean; letter: PublicLetter | null; error: string | null }>({ loading: true, letter: null, error: null });

  useEffect(() => {
    let live = true;
    verifyLetter(code)
      .then((letter) => live && setState({ loading: false, letter, error: null }))
      .catch((e) => live && setState({ loading: false, letter: null, error: e instanceof Error ? e.message : "Lookup failed" }));
    return () => {
      live = false;
    };
  }, [code]);

  if (state.loading) return <p className="mt-6 text-stone">Checking {code}…</p>;
  if (state.error) return <Callout tone="danger" className="mt-6">{state.error}</Callout>;
  const l = state.letter;
  if (!l) {
    return (
      <div className="mt-6 space-y-6">
        <Callout tone="danger" title={`No letter found for ${code}`}>
          Check the code for typos. If it still doesn&apos;t match, the letter may not be genuine. Contact the road captain listed on the letter.
        </Callout>
        <div className="rounded-[var(--radius-card)] border border-line bg-white p-6">
          <VerifyForm initial={code} />
        </div>
      </div>
    );
  }
  const expired = l.validUntil < isoDate();
  return (
    <div className="mt-6 space-y-5">
      {expired ? (
        <Callout tone="warn" title="Genuine letter, but expired">
          Issued {fmtDate(l.createdAt)}, valid until {fmtDate(l.validUntil)}. Ask the road for a new letter.
        </Callout>
      ) : (
        <div className="flex items-start gap-3 rounded-xl border border-pine/30 bg-pine-50 px-4 py-4">
          <CircleCheck className="mt-0.5 h-6 w-6 shrink-0 text-pine" aria-hidden />
          <div>
            <p className="text-[1.1rem] font-bold">Genuine letter, valid until {fmtDate(l.validUntil)}</p>
            <p className="text-stone">Issued {fmtDate(l.createdAt)} for {l.requester}.</p>
          </div>
        </div>
      )}
      <dl className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-white">
        {[
          ["Code", l.code],
          ["Road", `${l.roadName}, ${l.county} County, ${stateName(l.state)}`],
          ["Property", l.property],
          ["Maintenance agreement", l.agreementStatus],
          ["Property dues outstanding", l.outstanding > 0 ? money(l.outstanding) : "None"],
          ["Road account balance", money(l.balance)],
        ].map(([k, v]) => (
          <div key={k} className="grid gap-1 px-5 py-3 sm:grid-cols-[13rem_1fr]">
            <dt className="font-semibold text-stone">{k}</dt>
            <dd className="font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="flex items-center gap-2 text-[0.92rem] text-stone">
        <Clock className="h-4 w-4" aria-hidden /> Figures are as of the issue date. <CircleAlert className="ml-1 h-4 w-4" aria-hidden /> Not legal advice.
      </p>
    </div>
  );
}
