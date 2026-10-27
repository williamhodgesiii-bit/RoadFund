"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app/common";
import { LetterBody } from "@/components/app/letter-body";
import { Button, Callout, Card, CardHeader, Field, Input, Select } from "@/components/ui";
import { useRoad } from "@/lib/client/road-context";
import { LETTER_FEE, newLetter } from "@/lib/letter";
import { money } from "@/lib/money";
import { displayName } from "@/lib/selectors";
import type { Requester, StatusLetter } from "@/lib/types";

export default function NewLetterPage() {
  const router = useRouter();
  const { road, dispatch, now } = useRoad();
  // Filled from a title company's request when opened from the inbox.
  const requestParam = useSearchParams().get("request");
  const [incoming] = useState(() => road.letterRequests.find((x) => x.id === requestParam) ?? null);
  const requestId = incoming?.id ?? null;
  const [homeId, setHomeId] = useState(
    () => incoming?.homeId ?? road.homes.find((h) => incoming && h.address && incoming.propertyAddress.toLowerCase().includes(h.address.toLowerCase()))?.id ?? road.homes[0]?.id ?? "",
  );
  const [req, setReq] = useState<Requester>(incoming?.requester ?? { name: "", company: "", email: "", phone: "", role: "title" });
  const [closingDate, setClosingDate] = useState(incoming?.closingDate ?? "");
  const [paidBy, setPaidBy] = useState<StatusLetter["paidBy"]>("seller");
  const [saving, setSaving] = useState(false);

  const preview = useMemo(
    () => (homeId ? newLetter(road, { homeId, requester: req, closingDate: closingDate || null, paidBy, requestId }, now) : null),
    [road, homeId, req, closingDate, paidBy, requestId, now],
  );

  const issue = async () => {
    if (!preview) return;
    setSaving(true);
    const ok = await dispatch({ type: "letter.create", letter: preview }, `Letter ${preview.code} issued.`);
    setSaving(false);
    if (ok) router.push(`/app/papers/letters/${preview.id}`);
  };

  return (
    <>
      <PageHeader back={{ href: "/app/papers/letters", label: "Status letters" }} title="New Road Status Letter" sub="Figures come from the road's records as of right now and are frozen when you issue it." />
      <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
        <Card className="h-fit">
          <CardHeader title="Letter details" />
          <div className="space-y-4 p-5">
            <Field label="Property" htmlFor="nl-home">
              <Select id="nl-home" value={homeId} onChange={(e) => setHomeId(e.target.value)}>
                {road.homes.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.address || h.label} · {displayName(h)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="For (name)" htmlFor="nl-name">
              <Input id="nl-name" value={req.name} onChange={(e) => setReq({ ...req, name: e.target.value })} />
            </Field>
            <Field label="Company" optional htmlFor="nl-co">
              <Input id="nl-co" value={req.company} onChange={(e) => setReq({ ...req, company: e.target.value })} />
            </Field>
            <Field label="Email" optional htmlFor="nl-email">
              <Input id="nl-email" type="email" value={req.email} onChange={(e) => setReq({ ...req, email: e.target.value })} />
            </Field>
            <Field label="Closing date" optional htmlFor="nl-close">
              <Input id="nl-close" type="date" value={closingDate} onChange={(e) => setClosingDate(e.target.value)} />
            </Field>
            <Field label={`Who pays the ${money(LETTER_FEE)} fee`} htmlFor="nl-pay">
              <Select id="nl-pay" value={paidBy} onChange={(e) => setPaidBy(e.target.value as StatusLetter["paidBy"])}>
                <option value="seller">The seller</option>
                <option value="closing">Paid through closing</option>
                <option value="road">The road</option>
              </Select>
            </Field>
            {preview && preview.snapshot.propertyDues.outstanding > 0 && (
              <Callout tone="warn">This property owes {money(preview.snapshot.propertyDues.outstanding)}. The letter says so, so it can be paid at closing.</Callout>
            )}
            <Button block size="lg" loading={saving} onClick={issue} disabled={!preview || !req.name.trim()}>
              Issue letter
            </Button>
            <p className="text-[0.88rem] text-stone">Test mode: the {money(LETTER_FEE)} fee is not charged.</p>
          </div>
        </Card>
        {preview && (
          <div className="rounded-[var(--radius-card)] border border-line bg-white p-6 shadow-card sm:p-8">
            <LetterBody letter={preview} draft />
          </div>
        )}
      </div>
    </>
  );
}
