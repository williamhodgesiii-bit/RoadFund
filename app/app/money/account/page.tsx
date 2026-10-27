"use client";

import { useState } from "react";
import { Landmark, ShieldCheck } from "lucide-react";
import { AmountInput } from "@/components/amount-input";
import { MoneyNav, PageHeader } from "@/components/app/common";
import { Button, Callout, Card, CardHeader, Choice, Field, Input, Toggle } from "@/components/ui";
import { useRoad } from "@/lib/client/road-context";
import { fmtDate, isoDate } from "@/lib/dates";
import { computeCharge } from "@/lib/fees";
import { money } from "@/lib/money";
import { accountSummary } from "@/lib/selectors";

export default function AccountPage() {
  const { road, dispatch, now } = useRoad();
  const acct = accountSummary(road, now);
  const [opening, setOpening] = useState(road.account.openingBalance);
  const [openingDate, setOpeningDate] = useState(road.account.openingDate ?? isoDate(now));
  const [setAside, setSetAside] = useState(road.reserve.setAside);
  const [connecting, setConnecting] = useState(false);
  const sample = computeCharge(30_000, road.settings.defaultPayMethod, road.settings.payerCoversFees);

  return (
    <>
      <PageHeader title="Money" sub="The road's own account, fees and starting balance." />
      <MoneyNav />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Road bank account" icon={<Landmark className="h-5 w-5" aria-hidden />} sub="Through Stripe Connect. Money goes to the road, never to Road Fund." />
          <div className="space-y-4 p-5">
            {road.account.status === "connected" ? (
              <>
                <Callout tone="ok" title={`${road.account.bankName} ••${road.account.last4}`}>
                  Connected {road.account.connectedAt ? fmtDate(road.account.connectedAt) : ""}. Bank payments settle in about 4 business days, cards in about 2.
                </Callout>
                <Button
                  variant="ghost"
                  className="text-brick hover:bg-brick-50"
                  onClick={() => window.confirm("Disconnect the road's bank account? Neighbors won't be able to pay online until you reconnect.") && dispatch({ type: "account.disconnect" }, "Disconnected.")}
                >
                  Disconnect
                </Button>
              </>
            ) : (
              <>
                <p>Connect an account in the road&apos;s name so neighbors can pay by bank or card and you can pay contractors from it.</p>
                <p className="rounded-xl bg-paper p-3 text-[0.92rem] text-stone">Test mode uses Stripe&apos;s public test bank (routing 110000000). No real account is connected.</p>
                <Button
                  block
                  loading={connecting}
                  icon={<ShieldCheck className="h-5 w-5" aria-hidden />}
                  onClick={() => {
                    setConnecting(true);
                    window.setTimeout(async () => {
                      await dispatch({ type: "account.connect", bankName: "Test Bank", last4: "6789" }, "Bank account connected (test).");
                      setConnecting(false);
                    }, 800);
                  }}
                >
                  Connect test account
                </Button>
              </>
            )}
            <dl className="grid grid-cols-2 gap-3 border-t border-line pt-4">
              <div>
                <dt className="text-[0.88rem] text-stone">Balance</dt>
                <dd className="tnum text-[1.3rem] font-extrabold">{money(acct.balance)}</dd>
              </div>
              <div>
                <dt className="text-[0.88rem] text-stone">Clearing</dt>
                <dd className="tnum text-[1.3rem] font-extrabold">{money(acct.pending)}</dd>
              </div>
            </dl>
          </div>
        </Card>

        <Card>
          <CardHeader title="Payment fees" sub="$1 per payment plus processing. Bank: 0.8%, max $5. Card: 2.9% + 30¢." />
          <div className="space-y-5 p-5">
            <Toggle
              checked={road.settings.payerCoversFees}
              onChange={(v) => dispatch({ type: "road.settings", patch: { payerCoversFees: v } }, v ? "Neighbors now cover fees." : "The road now covers fees.")}
              label="Neighbors cover the fees"
              hint={road.settings.payerCoversFees ? "The road receives every share in full." : "Neighbors pay exactly their share; fees come out of the road account."}
            />
            <fieldset>
              <legend className="mb-2 font-semibold">Suggested way to pay</legend>
              <Choice
                name="paymethod"
                columns={2}
                value={road.settings.defaultPayMethod}
                onChange={(v) => dispatch({ type: "road.settings", patch: { defaultPayMethod: v } })}
                options={[
                  { value: "ach", label: "Bank", hint: "Cheapest" },
                  { value: "card", label: "Card", hint: "Fastest" },
                ]}
              />
            </fieldset>
            <p className="rounded-xl bg-paper p-3 text-[0.95rem]">
              On a $300 share: neighbor pays <strong className="tnum">{money(sample.total)}</strong>, road receives <strong className="tnum">{money(sample.roadNet)}</strong>.
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader title="Starting balance" sub="Money the road already had before Road Fund, so the ledger matches the bank." />
          <div className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Amount" htmlFor="acct-open">
                <AmountInput id="acct-open" value={opening} onChange={setOpening} />
              </Field>
              <Field label="As of" htmlFor="acct-open-date">
                <Input id="acct-open-date" type="date" value={openingDate} onChange={(e) => setOpeningDate(e.target.value)} />
              </Field>
            </div>
            <Button variant="secondary" onClick={() => dispatch({ type: "account.opening", amount: opening, date: openingDate }, "Starting balance saved.")}>
              Save starting balance
            </Button>
          </div>
        </Card>

        <Card>
          <CardHeader title="Set aside for big repairs" sub="Part of the balance the road saves for regrading, gravel and culverts." />
          <div className="space-y-4 p-5">
            <Field label="Amount set aside" htmlFor="acct-aside">
              <AmountInput id="acct-aside" value={setAside} onChange={setSetAside} />
            </Field>
            <Button variant="secondary" onClick={() => dispatch({ type: "reserve.save", reserve: { ...road.reserve, setAside } }, "Saved.")}>
              Save
            </Button>
          </div>
        </Card>
      </div>
    </>
  );
}
