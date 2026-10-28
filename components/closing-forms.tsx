"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, Search } from "lucide-react";
import { confirmLetterPayment, lookupRoad, requestLetter, type RoadLookup } from "@/lib/client/backend";
import { money } from "@/lib/money";
import { LETTER_FEE } from "@/lib/pricing";
import { stateName } from "@/lib/states";
import type { Requester } from "@/lib/types";
import { Button, Callout, Field, Input, Select, Textarea } from "./ui";

const fee = money(LETTER_FEE).replace(".00", "");

export function LetterRequestForm() {
  const [code, setCode] = useState("");
  const [road, setRoad] = useState<RoadLookup | null>(null);
  const [looking, setLooking] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [homeId, setHomeId] = useState("");
  const [address, setAddress] = useState("");
  const [closingDate, setClosingDate] = useState("");
  const [note, setNote] = useState("");
  const [req, setReq] = useState<Requester>({ name: "", company: "", email: "", phone: "", role: "title" });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [paidFor, setPaidFor] = useState<{ roadName: string; email: string } | null>(null);

  // Back from paying the letter fee.
  useEffect(() => {
    const paid = new URLSearchParams(window.location.search).get("paid");
    if (!paid) return;
    window.history.replaceState(null, "", window.location.pathname + window.location.hash);
    confirmLetterPayment(paid)
      .then((res) => {
        if (res.ok) setPaidFor({ roadName: res.roadName ?? "the road", email: res.email ?? "" });
        else setError("The payment hasn't finished yet. If you were charged, the request goes through automatically within a few minutes.");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "We couldn't confirm the payment."));
  }, []);

  const find = async (e: React.FormEvent) => {
    e.preventDefault();
    setLooking(true);
    setLookupError(null);
    setRoad(null);
    try {
      const found = await lookupRoad(code);
      if (!found) setLookupError("No road with that code. Check it with the seller, or ask them to set the road up on Road Fund.");
      setRoad(found);
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : "Lookup failed.");
    } finally {
      setLooking(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!road) return;
    const property = road.homes.find((h) => h.id === homeId);
    const propertyAddress = property ? property.address || property.label : address.trim();
    if (!propertyAddress) return setError("Pick the property or type its address.");
    if (!req.name.trim() || !req.email.includes("@")) return setError("Add your name and a valid email.");
    setSending(true);
    setError(null);
    try {
      const res = await requestLetter({ lookup: road, homeId: property?.id ?? null, propertyAddress, closingDate: closingDate || null, note, requester: req });
      if (res.url) return window.location.assign(res.url);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the request.");
    } finally {
      setSending(false);
    }
  };

  if (paidFor) {
    return (
      <Callout tone="ok" title="Paid. Your request is with the road captain.">
        <p>
          {paidFor.roadName} has your request and your {fee} payment. {paidFor.email ? `We'll email the letter to ${paidFor.email} when it's issued. ` : ""}If the road can&apos;t
          issue it, the fee is refunded in full.
        </p>
      </Callout>
    );
  }

  if (done && road) {
    return (
      <Callout tone="ok" title="Request sent to the road captain">
        <p>
          {road.name} will see your request at the top of their to-do list. The letter comes with a verification code you can check on this site. If the closing is
          close, call the seller so they can nudge the captain.
        </p>
      </Callout>
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={find} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field label="Road code" hint="The seller finds it in Road Fund under Settings. It looks like RF-7KQ2MX." className="flex-1" htmlFor="road-code">
          <Input id="road-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="RF-" autoCapitalize="characters" autoComplete="off" required />
        </Field>
        <Button type="submit" variant="secondary" loading={looking} icon={<Search className="h-5 w-5" aria-hidden />}>
          Find road
        </Button>
      </form>
      {lookupError && <Callout tone="warn">{lookupError}</Callout>}

      {road && (
        <form onSubmit={submit} className="space-y-5 rounded-[var(--radius-card)] border border-line bg-white p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <CircleCheck className="mt-1 h-5 w-5 text-pine" aria-hidden />
            <div>
              <p className="font-bold">{road.name}</p>
              <p className="text-stone">
                {road.county} County, {stateName(road.state)} · {road.homes.length} properties
              </p>
            </div>
          </div>
          <Field label="Property" htmlFor="lr-home">
            <Select id="lr-home" value={homeId} onChange={(e) => setHomeId(e.target.value)}>
              <option value="">Pick the property…</option>
              {road.homes.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.address ? `${h.address} (${h.label})` : h.label}
                </option>
              ))}
              <option value="">Not listed: I&apos;ll type it</option>
            </Select>
          </Field>
          {!homeId && (
            <Field label="Property address" optional htmlFor="lr-address">
              <Input id="lr-address" value={address} onChange={(e) => setAddress(e.target.value)} />
            </Field>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Your name" htmlFor="lr-name">
              <Input id="lr-name" value={req.name} onChange={(e) => setReq({ ...req, name: e.target.value })} autoComplete="name" required />
            </Field>
            <Field label="Company" optional htmlFor="lr-company">
              <Input id="lr-company" value={req.company} onChange={(e) => setReq({ ...req, company: e.target.value })} autoComplete="organization" />
            </Field>
            <Field label="Email" htmlFor="lr-email">
              <Input id="lr-email" type="email" value={req.email} onChange={(e) => setReq({ ...req, email: e.target.value })} autoComplete="email" required />
            </Field>
            <Field label="Phone" optional htmlFor="lr-phone">
              <Input id="lr-phone" type="tel" value={req.phone} onChange={(e) => setReq({ ...req, phone: e.target.value })} autoComplete="tel" />
            </Field>
            <Field label="You are the" htmlFor="lr-role">
              <Select id="lr-role" value={req.role} onChange={(e) => setReq({ ...req, role: e.target.value as Requester["role"] })}>
                <option value="title">Title or escrow company</option>
                <option value="attorney">Closing attorney</option>
                <option value="lender">Loan officer or processor</option>
                <option value="agent">Real estate agent</option>
                <option value="seller">Seller</option>
                <option value="buyer">Buyer</option>
                <option value="other">Other</option>
              </Select>
            </Field>
            <Field label="Closing date" optional htmlFor="lr-date">
              <Input id="lr-date" type="date" value={closingDate} onChange={(e) => setClosingDate(e.target.value)} />
            </Field>
          </div>
          <Field label="Note for the road captain" optional htmlFor="lr-note">
            <Textarea id="lr-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Loan type, what the lender asked for, file number" />
          </Field>
          {error && <Callout tone="danger">{error}</Callout>}
          <Button type="submit" loading={sending} block>
            {road.payFirst ? `Pay ${fee} and send the request` : "Request the letter"}
          </Button>
          <p className="text-[0.9rem] text-stone">
            {road.payFirst
              ? `You pay the ${fee} fee by card on Stripe's secure page. It includes one free update within 30 days, and it's refunded in full if the road can't issue the letter. Most title companies pass it to the seller at closing.`
              : `The ${fee} letter fee is usually passed to the seller at closing. It includes one free update within 30 days.`}
          </p>
        </form>
      )}
    </div>
  );
}

export function VerifyForm({ initial = "" }: { initial?: string }) {
  const router = useRouter();
  const [code, setCode] = useState(initial);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const clean = code.toUpperCase().replace(/[^0-9A-Z]/g, "");
        if (clean.length === 8) router.push(`/verify/${clean.slice(0, 4)}-${clean.slice(4)}`);
      }}
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
    >
      <Field label="Letter code" hint="Printed at the top right of every Road Status Letter." className="flex-1" htmlFor="verify-code">
        <Input id="verify-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="K7QM-2XPD" autoCapitalize="characters" autoComplete="off" />
      </Field>
      <Button type="submit">Verify</Button>
    </form>
  );
}
