import type { Metadata } from "next";
import Link from "next/link";
import { DeploymentNote } from "@/components/deployment-note";
import { FeeCalculator } from "@/components/fee-calculator";
import { PlanCards } from "@/components/plan-cards";
import { money } from "@/lib/money";
import { AGREEMENT_PACKAGE, LETTER_FEE, PLAN_LARGE, PLAN_SMALL } from "@/lib/pricing";

const $ = (c: number) => money(c).replace(".00", "");

export const metadata: Metadata = {
  title: "Pricing",
  description: `Free for one bill a year. Road Fund is ${$(PLAN_SMALL)} a year for roads with up to 8 homes and ${$(PLAN_LARGE)} for 9 to 30. Checks and cash are always free.`,
};

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-[2.4rem] font-black">Pricing</h1>
      <p className="mt-3 max-w-2xl text-[1.15rem] text-stone">
        Free for one bill a year. One flat yearly price when the road needs more. Checks and cash never cost anything.
      </p>

      <div className="mt-10">
        <PlanCards />
      </div>

      <h2 className="mt-16 text-[1.8rem] font-black">When a house on the road sells</h2>
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <section className="rounded-[var(--radius-card)] border border-line bg-white p-6">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-[1.2rem] font-extrabold">Road Status Letter</h3>
            <span className="tnum font-display text-[1.6rem] font-black">{$(LETTER_FEE)}</span>
          </div>
          <p className="mt-2 text-stone">
            A dated letter for the buyer&apos;s title company or lender: whether there&apos;s a road agreement, what the seller owes, the road&apos;s savings and any planned work.
            Paid by whoever asks for it, usually passed to the seller at closing. Includes one free update within 30 days if the closing moves. Checking a letter&apos;s code
            is always free. The road captain is never charged.
          </p>
        </section>
        <section className="rounded-[var(--radius-card)] border border-line bg-white p-6">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-[1.2rem] font-extrabold">Help with the agreement</h3>
            <span className="tnum font-display text-[1.6rem] font-black">{$(AGREEMENT_PACKAGE)}</span>
          </div>
          <p className="mt-2 text-stone">
            Drafting the agreement and collecting every owner&apos;s signature is free in Road Fund. If you&apos;d like a person to do the rest, we line up a local attorney to
            review it, set up the notary and file it with your county.
          </p>
          <p className="mt-3 font-semibold">Costs paid to others, at cost:</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-stone">
            <li>Attorney review: often $200 to $800 for a simple agreement</li>
            <li>Notary: set by your state</li>
            <li>County recording: set by your county, usually by the page</li>
          </ul>
        </section>
      </div>

      <h2 className="mt-16 text-[1.8rem] font-black">What neighbors pay to pay online</h2>
      <p className="mt-3 max-w-2xl text-stone">
        Each online payment has a $1 Road Fund fee plus the bank or card company&apos;s charge. The neighbor sees the exact total before paying. The road decides whether
        neighbors or the road cover it. Paying by check or cash is always free.
      </p>
      <div className="mt-6">
        <FeeCalculator />
      </div>

      <p className="mt-10 text-stone">
        Questions? See <Link href="/help#captains" className="font-semibold text-lake underline">help for road captains</Link>.
      </p>
      <DeploymentNote variant="pricing" className="mt-6 rounded-xl bg-paper-2 px-4 py-3 text-[0.95rem] text-stone" />
    </div>
  );
}
