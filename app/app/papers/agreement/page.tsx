"use client";

import { useState } from "react";
import { BookOpen, Check, CircleDot, Download, FileSignature, Gavel, Pencil, Send, Stamp } from "lucide-react";
import { AskAgreement } from "@/components/app/ask-agreement";
import { PageHeader, PapersNav, useAiOn } from "@/components/app/common";
import { AmountInput } from "@/components/amount-input";
import { SendSheet } from "@/components/app/send-sheet";
import { Button, Callout, Card, CardHeader, Checkbox, cx, Dialog, Field, Input, Select, Textarea } from "@/components/ui";
import { AGREEMENT_DISCLAIMER, agreementPlainText, buildAgreement } from "@/lib/agreement";
import { downloadFile } from "@/lib/client/links";
import { signRecipients } from "@/lib/client/recipients";
import { useRoad } from "@/lib/client/road-context";
import { addTimeDays, fmtDate, fmtDateTime, isoDate } from "@/lib/dates";
import { money } from "@/lib/money";
import { latestShares } from "@/lib/neighbor";
import { agreementSigned, displayName } from "@/lib/selectors";
import { defaultLaw, RON_UNAVAILABLE, stateName } from "@/lib/states";
import type { AgreementStep, AgreementTerms } from "@/lib/types";

const STEPS: { step: AgreementStep; label: string; icon: React.ReactNode }[] = [
  { step: "draft", label: "Draft", icon: <Pencil className="h-4 w-4" aria-hidden /> },
  { step: "review", label: "Attorney review", icon: <Gavel className="h-4 w-4" aria-hidden /> },
  { step: "signing", label: "Signatures", icon: <FileSignature className="h-4 w-4" aria-hidden /> },
  { step: "notary", label: "Notary", icon: <Stamp className="h-4 w-4" aria-hidden /> },
  { step: "recording", label: "County recording", icon: <BookOpen className="h-4 w-4" aria-hidden /> },
  { step: "recorded", label: "Recorded", icon: <Check className="h-4 w-4" aria-hidden /> },
];

export default function AgreementPage() {
  const { road, dispatch } = useRoad();
  const a = road.agreement;
  const [editing, setEditing] = useState(false);
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const shares = latestShares(road);
  const input = {
    roadName: road.name,
    county: road.county,
    state: road.state,
    lengthFt: road.lengthFt,
    split: road.split,
    terms: a.terms,
    version: a.version,
    homes: road.homes.map((h) => ({ id: h.id, label: h.label, address: h.address, owners: h.owners, sharePct: shares.get(h.id) ?? null })),
  };
  const sections = buildAgreement(input);
  const signed = agreementSigned(road);
  const law = defaultLaw(road.state);
  const aiOn = useAiOn();
  const idx = STEPS.findIndex((s) => s.step === a.step);
  const locked = a.step === "notary" || a.step === "recording" || a.step === "recorded";

  return (
    <>
      <PageHeader
        title="Votes & Papers"
        sub="A lender-ready road maintenance agreement, drafted from your road's own data."
        actions={
          <Button variant="secondary" icon={<Download className="h-5 w-5" aria-hidden />} onClick={() => downloadFile(`${road.name.replace(/\W+/g, "-").toLowerCase()}-agreement-v${a.version}.txt`, agreementPlainText(input, sections))}>
            Download draft
          </Button>
        }
      />
      <PapersNav />

      <ol className="mb-6 grid grid-cols-3 gap-2 sm:grid-cols-6" aria-label="Agreement progress">
        {STEPS.map((s, i) => (
          <li key={s.step} className={cx("rounded-xl border px-3 py-2.5", i < idx ? "border-pine/40 bg-pine-50" : i === idx ? "border-sign bg-sign-50" : "border-line bg-white")} aria-current={i === idx ? "step" : undefined}>
            <span className={cx("flex items-center gap-1.5 text-[0.85rem] font-bold", i < idx ? "text-pine" : i === idx ? "text-sign-ink" : "text-stone")}>
              {i < idx ? <Check className="h-4 w-4" aria-hidden /> : i === idx ? <CircleDot className="h-4 w-4" aria-hidden /> : s.icon}
              {i + 1}
            </span>
            <span className="mt-0.5 block text-[0.88rem] font-semibold leading-tight">{s.label}</span>
          </li>
        ))}
      </ol>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-6">
          <StepPanel onSign={() => setSending(true)} onRecord={() => setRecording(true)} signed={signed} />

          <Card>
            <CardHeader
              title={`${road.name} maintenance agreement`}
              sub={`Version ${a.version} · ${road.county} County, ${stateName(road.state)}`}
              action={
                !locked && (
                  <Button size="sm" variant="secondary" icon={<Pencil className="h-4 w-4" aria-hidden />} onClick={() => setEditing(true)}>
                    Edit terms
                  </Button>
                )
              }
            />
            <div className="border-b border-line bg-sign-50 px-5 py-3 text-[0.92rem]">{AGREEMENT_DISCLAIMER}</div>
            <div className="divide-y divide-line">
              {sections.map((s) => (
                <section key={s.id} className="px-5 py-4" id={`sec-${s.id}`}>
                  <h3 className="font-bold">{s.title}</h3>
                  <p className="mt-1 rounded-lg bg-pine-50 px-3 py-1.5 text-[0.92rem] text-pine">
                    <span className="font-semibold">In plain English: </span>
                    {s.summary}
                  </p>
                  <div className="mt-2 space-y-1.5 text-[0.95rem]">
                    {s.body.map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </Card>
        </div>

        <aside className="space-y-6">
          {law ? (
            <Callout tone="info" title={`${stateName(road.state)} has a default road law`}>
              {law.citation}: {law.rule} Lenders following Fannie Mae accept it, so this agreement is about clearer terms more than closings.
            </Callout>
          ) : (
            <Callout tone="warn" title={`${stateName(road.state)}: no default road law on our list`}>
              Buyers with conventional loans may need a recorded agreement. Confirm with a local attorney.
            </Callout>
          )}
          <AskAgreement sections={sections} aiOn={aiOn} />
          <Card>
            <CardHeader title="Signatures" sub={`${signed} of ${road.homes.length} owners · version ${a.version}`} />
            <ul className="divide-y divide-line">
              {road.homes.map((h) => {
                const s = a.signatures.find((x) => x.homeId === h.id && x.version === a.version);
                return (
                  <li key={h.id} className="flex items-center justify-between gap-2 px-5 py-2.5">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{displayName(h)}</span>
                      <span className="block text-[0.85rem] text-stone">{s ? `${s.name} · ${fmtDate(s.at)}` : h.label}</span>
                    </span>
                    {s ? <Check className="h-5 w-5 shrink-0 text-pine" aria-label="Signed" /> : <span className="shrink-0 text-[0.85rem] text-stone">Not signed</span>}
                  </li>
                );
              })}
            </ul>
          </Card>
        </aside>
      </div>

      {editing && <TermsDialog terms={a.terms} signedCount={a.signatures.length} onClose={() => setEditing(false)} />}
      {sending && <SendSheet open onClose={() => setSending(false)} kind="sign" heading="Send signing links" recipients={signRecipients(road)} logKind="agreement" onLogged={(message) => dispatch({ type: "message.log", message })} />}
      {recording && <RecordingDialog onClose={() => setRecording(false)} />}
    </>
  );
}

function StepPanel({ onSign, onRecord, signed }: { onSign: () => void; onRecord: () => void; signed: number }) {
  const { road, dispatch } = useRoad();
  const a = road.agreement;
  const total = road.homes.length;
  const ronOk = !RON_UNAVAILABLE.has(road.state);
  const bought = !!a.packagePurchasedAt;

  const purchase = (
    <Callout
      tone="info"
      title="Agreement package: $249"
      action={<Button onClick={() => dispatch({ type: "agreement.purchase" }, "Agreement package added (test mode, no charge).")}>Add the package</Button>}
    >
      Attorney review booking, e-signatures from every owner, {ronOk ? "remote online notary" : "notary scheduling"} and county recording. Attorney, notary and county fees are passed through at cost.
    </Callout>
  );

  switch (a.step) {
    case "draft":
      return (
        <Card className="p-5">
          <h2 className="text-[1.2rem] font-extrabold">Step 1: Check the draft</h2>
          <p className="mt-1 text-stone">Read each section and its plain-English summary. Edit the terms until they match how your road works, then send it to a partner attorney licensed in {stateName(road.state)}.</p>
          <div className="mt-4 space-y-3">
            {!bought && purchase}
            <Button
              disabled={!bought}
              icon={<Gavel className="h-5 w-5" aria-hidden />}
              onClick={() => dispatch({ type: "agreement.step", step: "review", review: { attorney: "Partner attorney", firm: `${stateName(road.state)} real estate attorney (test)`, requestedAt: new Date().toISOString(), approvedAt: null, notes: "" } }, "Sent for attorney review.")}
            >
              Send for attorney review
            </Button>
          </div>
        </Card>
      );
    case "review":
      return (
        <Card className="p-5">
          <h2 className="text-[1.2rem] font-extrabold">Step 2: Attorney review</h2>
          <p className="mt-1 text-stone">
            {a.review?.firm} has the draft{a.review?.requestedAt ? ` since ${fmtDate(a.review.requestedAt)}` : ""}.{" "}
            {a.review?.approvedAt ? `Approved ${fmtDate(a.review.approvedAt)}.` : "Most reviews take 3 to 5 business days."}
          </p>
          {a.review?.notes && <p className="mt-2 rounded-lg bg-paper p-3 text-[0.95rem]">Attorney notes: {a.review.notes}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            {!a.review?.approvedAt ? (
              <Button variant="secondary" onClick={() => dispatch({ type: "agreement.step", step: "review", review: { ...a.review!, approvedAt: new Date().toISOString(), notes: "Approved as drafted (test mode)." } }, "Attorney approval recorded.")}>
                Simulate attorney approval
              </Button>
            ) : (
              <Button icon={<FileSignature className="h-5 w-5" aria-hidden />} onClick={() => dispatch({ type: "agreement.step", step: "signing" }, "Open for signatures.")} disabled={!bought}>
                Open for signatures
              </Button>
            )}
          </div>
          {!bought && <div className="mt-4">{purchase}</div>}
        </Card>
      );
    case "signing":
      return (
        <Card className="p-5">
          <h2 className="text-[1.2rem] font-extrabold">Step 3: Every owner signs</h2>
          <p className="mt-1 text-stone">
            {signed} of {total} signed. Each owner reads the agreement and signs from their own link with a typed signature. Signing records the time and version.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {signed < total ? (
              <Button icon={<Send className="h-5 w-5" aria-hidden />} onClick={onSign}>
                Send signing links to {total - signed}
              </Button>
            ) : (
              <Button
                icon={<Stamp className="h-5 w-5" aria-hidden />}
                onClick={() => dispatch({ type: "agreement.step", step: "notary", notary: { provider: ronOk ? "Remote online notary (test)" : "In-person notary", scheduledFor: addTimeDays(new Date().toISOString(), 3), completedAt: null } }, "Notary scheduled.")}
              >
                Schedule the notary
              </Button>
            )}
          </div>
        </Card>
      );
    case "notary":
      return (
        <Card className="p-5">
          <h2 className="text-[1.2rem] font-extrabold">Step 4: Notary</h2>
          <p className="mt-1 text-stone">
            {ronOk
              ? `Owners acknowledge their signatures by video with a remote online notary${a.notary?.scheduledFor ? `, scheduled ${fmtDateTime(a.notary.scheduledFor)}` : ""}.`
              : "California doesn't allow remote online notarization, so owners need an in-person notary."}
          </p>
          <Button className="mt-4" variant="secondary" onClick={() => dispatch({ type: "agreement.step", step: "recording", notary: { ...a.notary!, completedAt: new Date().toISOString() } }, "Notarized.")}>
            Simulate completed notarization
          </Button>
        </Card>
      );
    case "recording":
      return (
        <Card className="p-5">
          <h2 className="text-[1.2rem] font-extrabold">Step 5: Record with {road.county} County</h2>
          <p className="mt-1 text-stone">Sent through an e-recording partner where the county accepts it, or by mail. Once recorded, it shows up in every title search on the road.</p>
          <Button className="mt-4" onClick={onRecord}>
            Enter recording details
          </Button>
        </Card>
      );
    case "recorded":
      return (
        <Callout tone="ok" title={`Recorded ${a.recording ? fmtDate(a.recording.recordedOn) : ""}`}>
          {road.county} County instrument {a.recording?.instrument}
          {a.recording?.bookPage ? `, ${a.recording.bookPage}` : ""}. Road Status Letters now show the recording details.
        </Callout>
      );
  }
}

function RecordingDialog({ onClose }: { onClose: () => void }) {
  const { road, dispatch } = useRoad();
  const [instrument, setInstrument] = useState("");
  const [bookPage, setBookPage] = useState("");
  const [date, setDate] = useState(isoDate());
  return (
    <Dialog
      open
      onClose={onClose}
      title="Recording details"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!instrument.trim()} onClick={async () => (await dispatch({ type: "agreement.step", step: "recorded", recording: { county: road.county, instrument: instrument.trim(), bookPage: bookPage.trim(), recordedOn: date } }, "Agreement recorded.")) && onClose()}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Instrument or document number" htmlFor="rec-inst">
          <Input id="rec-inst" value={instrument} onChange={(e) => setInstrument(e.target.value)} placeholder="2026-004812" />
        </Field>
        <Field label="Book and page" optional htmlFor="rec-bp">
          <Input id="rec-bp" value={bookPage} onChange={(e) => setBookPage(e.target.value)} placeholder="Liber 1288, Page 41" />
        </Field>
        <Field label="Recorded on" htmlFor="rec-date">
          <Input id="rec-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}

function TermsDialog({ terms, signedCount, onClose }: { terms: AgreementTerms; signedCount: number; onClose: () => void }) {
  const { dispatch } = useRoad();
  const [t, setT] = useState(terms);
  const set = (patch: Partial<AgreementTerms>) => setT((x) => ({ ...x, ...patch }));
  return (
    <Dialog
      open
      wide
      onClose={onClose}
      title="Agreement terms"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={async () => (await dispatch({ type: "agreement.terms", terms: t }, "Terms saved.")) && onClose()}>Save terms</Button>
        </>
      }
    >
      <div className="space-y-5">
        {signedCount > 0 && <Callout tone="warn">Changing terms creates a new version. The {signedCount} signature{signedCount === 1 ? "" : "s"} collected so far will need to be redone.</Callout>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Routine repairs need" htmlFor="t-rep">
            <Select id="t-rep" value={t.repairThreshold} onChange={(e) => set({ repairThreshold: e.target.value as AgreementTerms["repairThreshold"] })}>
              <option value="majority">More than half of all lots</option>
              <option value="two-thirds">Two-thirds of all lots</option>
            </Select>
          </Field>
          <Field label="Upgrades like paving need" htmlFor="t-imp">
            <Select id="t-imp" value={t.improvementThreshold} onChange={(e) => set({ improvementThreshold: e.target.value as AgreementTerms["improvementThreshold"] })}>
              <option value="two-thirds">Two-thirds of all lots</option>
              <option value="unanimous">Every lot</option>
            </Select>
          </Field>
          <Field label="Emergency spending without a vote, up to" htmlFor="t-emer">
            <AmountInput id="t-emer" value={t.emergencyLimit} onChange={(emergencyLimit) => set({ emergencyLimit })} />
          </Field>
          <Field label="Days to pay a request" htmlFor="t-due">
            <Input id="t-due" inputMode="numeric" value={t.dueDays} onChange={(e) => set({ dueDays: Number(e.target.value) || 30 })} />
          </Field>
          <Field label="Late fee" htmlFor="t-late">
            <AmountInput id="t-late" value={t.lateFee} onChange={(lateFee) => set({ lateFee })} />
          </Field>
          <Field label="Late fee applies after (days past due)" htmlFor="t-grace">
            <Input id="t-grace" inputMode="numeric" value={t.graceDays} onChange={(e) => set({ graceDays: Number(e.target.value) || 0 })} />
          </Field>
          <Field label="Interest on unpaid amounts" htmlFor="t-int">
            <Select id="t-int" value={t.interestPct} onChange={(e) => set({ interestPct: Number(e.target.value) })}>
              {[0, 4, 6, 8, 10, 12].map((n) => (
                <option key={n} value={n}>
                  {n ? `${n}% a year` : "None"}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Savings target for big repairs" htmlFor="t-res">
            <AmountInput id="t-res" value={t.reserveTarget} onChange={(reserveTarget) => set({ reserveTarget })} />
          </Field>
          <Field label="Annual meeting month" htmlFor="t-month">
            <Select id="t-month" value={t.meetingMonth} onChange={(e) => set({ meetingMonth: e.target.value })}>
              {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </Select>
          </Field>
          <Field label="New lots" htmlFor="t-new">
            <Select id="t-new" value={t.newLots} onChange={(e) => set({ newLots: e.target.value as AgreementTerms["newLots"] })}>
              <option value="same-method">Join by the same cost method</option>
              <option value="vote">Join on terms approved by vote</option>
            </Select>
          </Field>
          <Field label="Disagreements" htmlFor="t-disp">
            <Select id="t-disp" value={t.disputes} onChange={(e) => set({ disputes: e.target.value as AgreementTerms["disputes"] })}>
              <option value="mediation-then-court">Mediation first, then court</option>
              <option value="small-claims">Small claims court</option>
            </Select>
          </Field>
          {t.insuranceRequired && (
            <Field label="Liability coverage per occurrence" htmlFor="t-ins">
              <AmountInput id="t-ins" value={t.insuranceMin} onChange={(insuranceMin) => set({ insuranceMin })} />
            </Field>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Checkbox checked={t.lienRights} onChange={(v) => set({ lienRights: v })} label="Unpaid shares can become a lien" hint="Where state law allows. Strongest collection tool." />
          <Checkbox checked={t.insuranceRequired} onChange={(v) => set({ insuranceRequired: v })} label="The road carries liability insurance" />
          <Checkbox checked={t.includesDrainage} onChange={(v) => set({ includesDrainage: v })} label="Ditches and culverts are shared" />
          <Checkbox checked={t.includesSnow} onChange={(v) => set({ includesSnow: v })} label="Snow removal is shared" />
        </div>
        <Field label="Road description" hint="Ideally tied to a recorded plat or survey. Your attorney will tighten this." htmlFor="t-desc">
          <Textarea id="t-desc" rows={3} value={t.roadDescription} onChange={(e) => set({ roadDescription: e.target.value })} />
        </Field>
        <p className="text-[0.9rem] text-stone">Late fee shown to neighbors: {money(t.lateFee)} after {t.graceDays} days.</p>
      </div>
    </Dialog>
  );
}
