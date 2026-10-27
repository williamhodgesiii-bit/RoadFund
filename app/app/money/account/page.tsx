"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ExternalLink, Landmark, RefreshCw, ShieldCheck } from "lucide-react";
import { AmountInput } from "@/components/amount-input";
import { MoneyNav, PageHeader } from "@/components/app/common";
import { Button, Callout, Card, CardHeader, Choice, Field, Input, Toggle } from "@/components/ui";
import { useToast } from "@/components/toast";
import { stripeAction } from "@/lib/client/backend";
import { useRoad } from "@/lib/client/road-context";
import { fmtDate, isoDate } from "@/lib/dates";
import { computeCharge } from "@/lib/fees";
import { money } from "@/lib/money";
import { accountSummary } from "@/lib/selectors";

export default function AccountPage() {
  const { road, dispatch, now, live } = useRoad();
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
            {live ? (
              <StripeAccount />
            ) : road.account.status === "connected" ? (
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

/** Real Stripe Connect onboarding: Stripe collects the road's details and bank, then pays out to it. */
function StripeAccount() {
  const { road, entry, replace } = useRoad();
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const [busy, setBusy] = useState<"connect" | "refresh" | "dashboard" | null>(null);
  const [due, setDue] = useState<number | null>(null);
  const handled = useRef(false);
  const a = road.account;

  const go = async (action: "connect" | "refresh" | "dashboard") => {
    setBusy(action);
    try {
      const res = await stripeAction(entry, { action });
      if (res.url) {
        window.location.assign(res.url);
        return;
      }
      if (res.road) replace(res.road);
      if (typeof res.due === "number") setDue(res.due);
      if (action === "refresh") toast(res.road?.account.status === "connected" ? "The road's account is ready for payments." : "Stripe is still reviewing the account.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Stripe didn't answer. Try again.", "error");
    }
    setBusy(null);
  };

  // Coming back from Stripe: check the account, or get a fresh link if the old one expired.
  const back = params.get("stripe");
  useEffect(() => {
    if (!back || handled.current) return;
    handled.current = true;
    router.replace("/app/money/account");
    void go(back === "refresh" ? "connect" : "refresh");
  }, [back]); // eslint-disable-line react-hooks/exhaustive-deps

  if (a.status === "connected") {
    return (
      <>
        <Callout tone="ok" title={a.bankName ? `${a.bankName} ••${a.last4}` : "Connected"}>
          Neighbors can pay by bank or card. Stripe sends the money to this account: bank payments in about 4 business days, cards in about 2.
        </Callout>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" loading={busy === "dashboard"} icon={<ExternalLink className="h-5 w-5" aria-hidden />} onClick={() => go("dashboard")}>
            Payouts and bank details
          </Button>
          <Button variant="ghost" loading={busy === "refresh"} icon={<RefreshCw className="h-5 w-5" aria-hidden />} onClick={() => go("refresh")}>
            Check status
          </Button>
        </div>
        <p className="text-[0.9rem] text-stone">To change the bank account or the road&apos;s tax details, use Payouts and bank details. Stripe handles it there.</p>
      </>
    );
  }
  if (a.status === "pending") {
    return (
      <>
        <Callout tone="warn" title="Almost there">
          {due ? `Stripe still needs ${due} item${due === 1 ? "" : "s"} from you. ` : "Stripe is checking the road's details. This usually takes a few minutes, sometimes a day. "}
          Neighbors can pay online once it&apos;s done. You can record checks and cash in the meantime.
        </Callout>
        <div className="flex flex-wrap gap-2">
          <Button loading={busy === "connect"} icon={<ShieldCheck className="h-5 w-5" aria-hidden />} onClick={() => go("connect")}>
            Finish with Stripe
          </Button>
          <Button variant="secondary" loading={busy === "refresh"} icon={<RefreshCw className="h-5 w-5" aria-hidden />} onClick={() => go("refresh")}>
            Check status
          </Button>
        </div>
      </>
    );
  }
  return (
    <>
      <p>Connect an account in the road&apos;s name so neighbors can pay by bank or card. Stripe, the payment company behind many online stores, holds and moves the money.</p>
      <ul className="list-disc space-y-1 pl-6 text-[0.95rem]">
        <li>Takes about 10 minutes.</li>
        <li>Have the road&apos;s bank account and routing number ready.</li>
        <li>Stripe asks for the road&apos;s tax ID (EIN) if it has one, or the captain&apos;s details if it doesn&apos;t.</li>
      </ul>
      <Button block loading={busy === "connect"} icon={<ShieldCheck className="h-5 w-5" aria-hidden />} onClick={() => go("connect")}>
        Connect with Stripe
      </Button>
    </>
  );
}
