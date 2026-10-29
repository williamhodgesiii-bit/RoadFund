"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ExternalLink, Landmark, RefreshCw, ShieldCheck } from "lucide-react";
import { AmountInput } from "@/components/amount-input";
import { MoneyNav, PageHeader } from "@/components/app/common";
import { Button, Callout, Card, CardHeader, Field, Input, Toggle } from "@/components/ui";
import { useToast } from "@/components/toast";
import { stripeAction } from "@/lib/client/backend";
import { useRoad } from "@/lib/client/road-context";
import { fmtDate, isoDate } from "@/lib/dates";
import { computeCharge } from "@/lib/fees";
import { money } from "@/lib/money";
import { accountSummary, captainHome, displayName } from "@/lib/selectors";

export default function AccountPage() {
  const { road, dispatch, now, live } = useRoad();
  const acct = accountSummary(road, now);
  const [opening, setOpening] = useState(road.account.openingBalance);
  const [openingDate, setOpeningDate] = useState(road.account.openingDate ?? isoDate(now));
  const [setAside, setSetAside] = useState(road.reserve.setAside);
  const [connecting, setConnecting] = useState(false);
  const sample = computeCharge(30_000, "ach", road.settings.payerCoversFees);
  const cardSample = computeCharge(30_000, "card", road.settings.payerCoversFees);

  return (
    <>
      <PageHeader title="Money" sub="The road's own account, fees and starting balance." />
      <MoneyNav />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Road bank account" icon={<Landmark className="h-5 w-5" aria-hidden />} sub="Through Stripe. Road Fund never holds the money." />
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
                <p>Connect the bank account road money goes into, so neighbors can pay by bank or card.</p>
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
                <dt className="text-[0.88rem] text-stone">On its way</dt>
                <dd className="tnum text-[1.3rem] font-extrabold">{money(acct.pending)}</dd>
              </div>
            </dl>
          </div>
        </Card>

        <Card>
          <CardHeader title="Payment fees" sub="$1 per online payment plus the bank or card charge. Checking account: 0.8%, at most $5. Card: 2.9% + 30¢. Checks are free." />
          <div className="space-y-5 p-5">
            <Toggle
              checked={road.settings.payerCoversFees}
              onChange={(v) => dispatch({ type: "road.settings", patch: { payerCoversFees: v } }, v ? "Neighbors now cover the bank fee." : "The road now covers the bank fee.")}
              label="Neighbors cover the bank fee"
              hint={road.settings.payerCoversFees ? "Payments from a checking account reach the road in full." : "Neighbors pay exactly their share, and the road pays the fee."}
            />
            <p className="rounded-xl bg-paper p-3 text-[0.95rem]">
              On a $300 share paid from a checking account: the neighbor pays <strong className="tnum">{money(sample.total)}</strong> and the road gets{" "}
              <strong className="tnum">{money(sample.roadNet)}</strong>. Checks and cash are always free.
            </p>
            <p className="text-[0.95rem] text-stone">
              Card fees always come out of the road&apos;s side, about {money(cardSample.platformFee + cardSample.processingFee)} on a $300 share. Card rules don&apos;t allow adding a
              fee to debit cards, and some states limit it for credit cards, so Road Fund never adds it to a neighbor&apos;s bill.
            </p>
          </div>
        </Card>

        <CheckPayeeCard />

        <Card>
          <CardHeader title="Starting balance" sub="Money the road already had before Road Fund, so the payment record matches the bank." />
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
      <p>
        Connect the bank account road money goes into: the road&apos;s own account if it has one, or yours if it doesn&apos;t. Stripe, the payment company behind many online
        stores, moves the money. Every dollar shows on the record neighbors can see.
      </p>
      <ul className="list-disc space-y-1 pl-6">
        <li>Takes about 10 minutes on Stripe&apos;s site.</li>
        <li>Have the bank account and routing number ready. They&apos;re printed along the bottom of a check.</li>
        <li>Stripe asks for the road&apos;s tax ID (EIN) if it has one. Most roads don&apos;t, and that&apos;s fine: Stripe asks for yours instead.</li>
      </ul>
      <div className="rounded-lg bg-paper p-4">
        <p className="font-semibold">Why Stripe asks for your birth date and Social Security number</p>
        <p className="mt-1">
          Federal rules require payment companies to confirm who receives money online, the same check a bank does when you open an account. Stripe asks for your name,
          home address, date of birth and the last 4 digits of your Social Security number. Road Fund never sees any of it, and
          neighbors never see it either.
        </p>
      </div>
      <Button block loading={busy === "connect"} icon={<ShieldCheck className="h-5 w-5" aria-hidden />} onClick={() => go("connect")}>
        Connect with Stripe
      </Button>
    </>
  );
}

function CheckPayeeCard() {
  const { road, dispatch } = useRoad();
  const cap = captainHome(road);
  const fallback = cap ? displayName(cap) : road.name;
  const [payee, setPayee] = useState(road.settings.checkPayee ?? "");
  return (
    <Card>
      <CardHeader title="Checks" sub="Neighbors who pay by check see this on their page and on the slip they can print." />
      <div className="space-y-4 p-5">
        <Field label="Make checks out to" htmlFor="acct-payee" hint={`The name on the bank account checks go into. Leave it blank to use ${fallback}.`}>
          <Input id="acct-payee" value={payee} placeholder={fallback} onChange={(e) => setPayee(e.target.value)} />
        </Field>
        <Button variant="secondary" onClick={() => dispatch({ type: "road.settings", patch: { checkPayee: payee.trim() } }, "Saved.")}>
          Save
        </Button>
      </div>
    </Card>
  );
}
