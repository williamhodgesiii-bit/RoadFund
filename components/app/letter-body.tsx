"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { fmtDate } from "@/lib/dates";
import { AGREEMENT_STATUS_TEXT } from "@/lib/letter";
import { money } from "@/lib/money";
import { METHOD_INFO } from "@/lib/split";
import { stateName } from "@/lib/states";
import type { StatusLetter } from "@/lib/types";


export function LetterBody({ letter, draft = false, sample = false }: { letter: StatusLetter; draft?: boolean; sample?: boolean }) {
  const s = letter.snapshot;
  const [qr, setQr] = useState<string>("");
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  useEffect(() => {
    if (!draft && !sample) QRCode.toString(`${window.location.origin}/verify/${letter.code}`, { type: "svg", margin: 0, color: { dark: "#1E2320", light: "#FFFFFF" } }).then(setQr).catch(() => {});
  }, [letter.code, draft, sample]);
  const d = s.propertyDues;

  return (
    <article className="font-serif text-[0.98rem] leading-relaxed">
      <header className="flex items-start justify-between gap-6 border-b-2 border-charcoal pb-4">
        <div>
          <p className="text-[0.8rem] font-bold uppercase tracking-[0.15em] text-stone">Road Status Letter</p>
          <h2 className="text-[1.6rem] font-black">{s.roadName}</h2>
          <p className="text-stone">
            {s.county} County, {stateName(s.state)} · private road · {s.lengthFt.toLocaleString()} ft {s.surface.replace("-", " ")} · {s.homesCount} lots
          </p>
        </div>
        <div className="shrink-0 text-right">
          {sample ? (
            <p className="-rotate-6 border-4 border-double border-brick px-3 py-1 font-sans text-[1.1rem] font-black tracking-widest text-brick">SAMPLE</p>
          ) : draft ? (
            <p className="rounded-md bg-sign-50 px-2 py-1 text-[0.85rem] font-bold text-sign-ink">Preview</p>
          ) : (
            <>
              {qr && <div className="ml-auto h-20 w-20" aria-hidden dangerouslySetInnerHTML={{ __html: qr }} />}
              <p className="mt-1 font-mono text-[0.95rem] font-bold">{letter.code}</p>
            </>
          )}
        </div>
      </header>

      <dl className="mt-4 grid gap-x-6 gap-y-1 sm:grid-cols-2">
        <Row k="Issued" v={fmtDate(letter.createdAt)} />
        <Row k="Valid until" v={fmtDate(letter.validUntil)} />
        <Row k="Prepared for" v={`${letter.requester.name}${letter.requester.company ? `, ${letter.requester.company}` : ""}`} />
        {letter.closingDate && <Row k="Closing date" v={fmtDate(letter.closingDate)} />}
        <Row k="Property" v={`${s.property.address || s.property.label} (${s.property.label})`} />
        {s.property.owners && <Row k="Owner of record (per road)" v={s.property.owners} />}
        <Row k="Recorded access easement" v={s.easementRef || "Not provided by the road"} />
        <Row k="Open all year" v={s.allWeather === true ? "Yes, passable by an ordinary car in every season" : s.allWeather === false ? "No, it can close in some seasons" : "Not stated"} />
      </dl>

      <Section n={1} title="Maintenance agreement">
        <p className="font-semibold">{AGREEMENT_STATUS_TEXT[s.agreement.status]}.</p>
        {s.agreement.recording ? (
          <p>
            Recorded {fmtDate(s.agreement.recording.recordedOn)} in {s.agreement.recording.county} County, instrument {s.agreement.recording.instrument}
            {s.agreement.recording.bookPage ? `, ${s.agreement.recording.bookPage}` : ""}.
          </p>
        ) : (
          s.agreement.status !== "none" && <p>{s.agreement.signed} of {s.agreement.total} owners have signed the current version.</p>
        )}
        {s.agreement.defaultLaw && <p>State default road law: {s.agreement.defaultLaw}</p>}
        <p>Costs are shared by this method: {METHOD_INFO[s.shareMethod].name.toLowerCase()}.</p>
      </Section>

      <Section n={2} title="Dues for this property">
        <table className="w-full max-w-xl">
          <tbody>
            {d.title && <TR k="Current billing" v={d.title} />}
            <TR k="Billed" v={money(d.billed)} />
            <TR k="Paid" v={money(d.paid)} />
            <TR k="Still owed" v={d.outstanding > 0 ? `${money(d.outstanding)}${d.dueDate ? ` (due ${fmtDate(d.dueDate)})` : ""}` : "None"} strong />
            {d.lastPaidAt && <TR k="Last payment" v={fmtDate(d.lastPaidAt)} />}
            {s.annualShare !== null && <TR k="Most recent yearly share" v={`${money(s.annualShare)}${s.sharePct !== null ? ` (${s.sharePct.toFixed(1)}% of the road)` : ""}`} />}
          </tbody>
        </table>
        {d.onPlan && <p>This property is on a payment plan approved by the road.</p>}
        {d.outstanding > 0 && <p className="font-semibold">Unpaid road dues should be settled at closing.</p>}
      </Section>

      <Section n={3} title="Road finances">
        <table className="w-full max-w-xl">
          <tbody>
            <TR k="Road account balance" v={money(s.account.balance)} strong />
            {s.account.pending > 0 && <TR k="Of which still on its way" v={money(s.account.pending)} />}
            <TR k="Set aside for major repairs" v={money(s.account.reserve)} />
            <TR k={`${s.roadDues.year} dues collected`} v={`${money(s.roadDues.collected)} of ${money(s.roadDues.billed)} (${s.roadDues.homesPaid} of ${s.roadDues.homesBilled} lots paid in full)`} />
          </tbody>
        </table>
      </Section>

      <Section n={4} title="Upcoming work and project bills">
        {s.upcoming.length === 0 ? (
          <p>None planned.</p>
        ) : (
          <ul className="list-disc pl-5">
            {s.upcoming.map((u, i) => (
              <li key={i}>
                {u.title}
                {u.amount !== null && ` · ${money(u.amount)}`} · {u.status}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section n={5} title="Insurance">
        <p>{s.insuranceOnFile ? "A road liability insurance certificate is on file with the road." : "No road liability insurance certificate is on file."}</p>
      </Section>

      <footer className="mt-6 border-t border-line pt-4 text-[0.9rem]">
        <p>
          Road contact: {s.captain.name}
          {s.captain.phone && ` · ${s.captain.phone}`}
          {s.captain.email && ` · ${s.captain.email}`}
        </p>
        {!draft && !sample && origin && (
          <p className="mt-1">
            Verify this letter at <span className="font-mono">{origin}/verify/{letter.code}</span>
          </p>
        )}
        <p className="mt-2 text-stone">
          Prepared from {s.roadName}&apos;s records kept in Road Fund (road code {s.roadCode}). Figures are as of the issue date. This letter is not a title opinion or
          legal advice.
        </p>
      </footer>
    </article>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-stone">{k}:</dt>
      <dd className="font-semibold">{v}</dd>
    </div>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 break-inside-avoid">
      <h3 className="text-[1.05rem] font-extrabold">
        {n}. {title}
      </h3>
      <div className="mt-1 space-y-1">{children}</div>
    </section>
  );
}

function TR({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <tr className="border-b border-line">
      <td className="py-1 pr-4 align-top text-stone sm:whitespace-nowrap">{k}</td>
      <td className={`tnum py-1 text-right ${strong ? "font-bold" : ""}`}>{v}</td>
    </tr>
  );
}
