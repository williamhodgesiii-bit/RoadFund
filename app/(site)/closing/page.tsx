import type { Metadata } from "next";
import Link from "next/link";
import { LetterRequestForm, VerifyForm } from "@/components/closing-forms";
import { LoanTable } from "@/components/loan-table";
import { money } from "@/lib/money";
import { LETTER_FEE } from "@/lib/pricing";

const fee = money(LETTER_FEE).replace(".00", "");

export const metadata: Metadata = {
  title: "For title companies, lenders and agents",
  description: "Request a Road Status Letter for a property on a private road, verify a letter, and see which loan types need a road maintenance agreement.",
};

export default function ClosingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="max-w-3xl text-[2.4rem] font-black leading-tight">Road Status Letters for homes on private roads</h1>
      <p className="mt-4 max-w-3xl text-[1.1rem]">
        For title companies, lenders, agents and closing attorneys. When a home sits on a private road, the buyer&apos;s lender may ask who maintains the road and who pays. Roads on Road Fund can answer in minutes with a dated,
        verifiable Road Status Letter, and can get a recorded maintenance agreement without chasing every signature by hand.
      </p>

      <div className="mt-12 grid gap-10 lg:grid-cols-[1.1fr_1fr]">
        <section id="request" className="scroll-mt-24">
          <h2 className="text-[1.6rem] font-black">Request a Road Status Letter</h2>
          <p className="mt-2 text-stone">The road captain is notified right away. The letter fee is {fee}, usually passed to the seller at closing, and includes one free update within 30 days.</p>
          <div className="mt-6">
            <LetterRequestForm />
          </div>
        </section>
        <aside className="space-y-6">
          <section className="rounded-[var(--radius-card)] border border-line bg-white p-6">
            <h2 className="text-[1.3rem] font-extrabold">What the letter covers</h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-stone">
              <li>Whether there&apos;s a road agreement, who signed it, and where it&apos;s recorded</li>
              <li>Where the access easement is recorded, and whether the road is open all year</li>
              <li>The seller&apos;s dues: billed, paid, owed, and any payment plan</li>
              <li>The road&apos;s balance and money set aside for repairs</li>
              <li>Upcoming projects and open votes</li>
              <li>Whether liability insurance is on file, and the state&apos;s road law where one applies</li>
            </ul>
          </section>
          <section className="rounded-[var(--radius-card)] border border-line bg-white p-6">
            <h2 className="text-[1.3rem] font-extrabold">Check a letter</h2>
            <p className="mt-1 text-stone">Every letter has a code. Enter it to see the letter as issued and when it expires. Free.</p>
            <div className="mt-4">
              <VerifyForm />
            </div>
          </section>
          <section className="rounded-[var(--radius-card)] border border-line bg-white p-6">
            <h2 className="text-[1.3rem] font-extrabold">Road not on Road Fund?</h2>
            <p className="mt-1 text-stone">
              Send the seller to{" "}
              <Link href="/start" className="font-semibold text-lake underline">
                set up their road
              </Link>
              . It takes about 10 minutes, and the captain can issue the letter the same day.
            </p>
          </section>
        </aside>
      </div>

      <section className="mt-16">
        <h2 className="text-[1.6rem] font-black">Which loans need a road maintenance agreement</h2>
        <p className="mt-2 max-w-3xl text-stone">
          From public guidelines, checked October 2026. Conventional loans sold to Fannie Mae are where the agreement matters most, and some lenders add their own
          rules. Confirm with the investor guidelines for your file.
        </p>
        <div className="mt-6">
          <LoanTable />
        </div>
      </section>

      <section id="before-you-list" className="mt-16 scroll-mt-24 rounded-[var(--radius-card)] border border-line bg-white p-6 sm:p-8">
        <h2 className="text-[1.6rem] font-black">Listing a home on a private road</h2>
        <p className="mt-2 max-w-3xl text-stone">For agents. Road questions tend to come up late, at appraisal or underwriting. Handle them when you list instead.</p>
        <ol className="mt-6 grid gap-5 md:grid-cols-2">
          {[
            ["When you list", "Ask the seller who keeps the road up and for the road code. If the road isn't on Road Fund, the road captain can set it up in about 10 minutes."],
            ["When you list", "Find out whether there's a recorded road agreement. If there isn't, and the state has no road-sharing law, buyers using some conventional loans may hit a snag."],
            ["Under contract", "Order the Road Status Letter as soon as you know the lender. It shows the agreement, the easement, the seller's dues and the road's savings."],
            ["If an agreement is needed", "Start right away. Writing it is quick; getting every owner on the road to sign can take weeks. Road Fund drafts it and collects signatures by phone."],
          ].map(([d, t], i) => (
            <li key={i} className="flex gap-4">
              <span className="h-fit shrink-0 rounded-lg bg-pine px-2.5 py-1 font-display text-[0.9rem] font-bold text-white">{d}</span>
              <p className="text-stone">{t}</p>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-[0.95rem] text-stone">Recording times vary by county. Road Fund doesn&apos;t give legal advice; the agreement should be reviewed by a local attorney.</p>
      </section>
    </div>
  );
}
