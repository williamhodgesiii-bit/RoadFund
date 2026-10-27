import type { Metadata } from "next";
import Link from "next/link";
import { LetterRequestForm, VerifyForm } from "@/components/closing-forms";
import { LoanTable } from "@/components/loan-table";

export const metadata: Metadata = {
  title: "For title companies, lenders and agents",
  description: "Request a Road Status Letter for a property on a private road, verify a letter, and see which loan types need a road maintenance agreement.",
};

export default function ClosingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <p className="sign-chip inline-block rounded-md px-3 py-1 text-[0.9rem] font-bold">Title · Lenders · Agents · Closing attorneys</p>
      <h1 className="mt-4 max-w-3xl text-[2.4rem] font-black leading-tight">Clear the private road condition before it stalls the closing</h1>
      <p className="mt-4 max-w-3xl text-[1.1rem] text-stone">
        When a home sits on a private road, the buyer&apos;s lender may ask who maintains the road and who pays. Roads on Road Fund can answer in minutes with a dated,
        verifiable Road Status Letter, and can get a recorded maintenance agreement without chasing every signature by hand.
      </p>

      <div className="mt-12 grid gap-10 lg:grid-cols-[1.1fr_1fr]">
        <section id="request" className="scroll-mt-24">
          <h2 className="text-[1.6rem] font-black">Request a Road Status Letter</h2>
          <p className="mt-2 text-stone">The road captain is notified right away. The letter fee is $75, and most title companies pass it through to the seller at closing.</p>
          <div className="mt-6">
            <LetterRequestForm />
          </div>
        </section>
        <aside className="space-y-6">
          <section className="rounded-[var(--radius-card)] border border-line bg-white p-6">
            <h2 className="text-[1.3rem] font-extrabold">What the letter covers</h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-stone">
              <li>Whether a maintenance agreement exists, who signed it, and its recording details</li>
              <li>The property&apos;s dues: billed, paid, outstanding, and any payment plan</li>
              <li>Road account balance and money set aside for repairs</li>
              <li>Upcoming projects, open votes and planned big repairs</li>
              <li>Whether liability insurance is on file</li>
              <li>The state&apos;s default road law, where one applies</li>
            </ul>
          </section>
          <section className="rounded-[var(--radius-card)] border border-line bg-white p-6">
            <h2 className="text-[1.3rem] font-extrabold">Verify a letter</h2>
            <p className="mt-1 text-stone">Every letter carries a code. Check that it&apos;s real and see when it expires.</p>
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
              . It takes about 10 minutes, and the letter can be issued the same day.
            </p>
          </section>
        </aside>
      </div>

      <section className="mt-16">
        <h2 className="text-[1.6rem] font-black">Which loans need a road maintenance agreement</h2>
        <p className="mt-2 max-w-3xl text-stone">
          Checked October 2026 from public guidelines. Conventional loans sold to Fannie Mae are where the agreement matters most. Confirm with the investor guidelines
          for your file.
        </p>
        <div className="mt-6">
          <LoanTable />
        </div>
      </section>

      <section className="mt-16 rounded-[var(--radius-card)] border border-line bg-white p-6 sm:p-8">
        <h2 className="text-[1.6rem] font-black">Clearing the condition in 5 business days</h2>
        <ol className="mt-5 grid gap-5 md:grid-cols-2">
          {[
            ["Day 1", "Ask the seller for the road code. If the road isn't set up, the seller sets it up the same day."],
            ["Day 1–2", "Request the Road Status Letter here. If there's a recorded agreement, the letter shows the recording details and the condition may clear on its own."],
            ["Day 2–4", "No agreement? The owners sign the state template electronically, a remote online notary acknowledges it, and it goes to the county for recording."],
            ["Day 5", "Send the lender the recorded agreement or recording receipt with the Road Status Letter. Verify the letter code on this site at any time."],
          ].map(([d, t]) => (
            <li key={d} className="flex gap-4">
              <span className="h-fit rounded-lg bg-pine px-2.5 py-1 font-display text-[0.9rem] font-bold text-white">{d}</span>
              <p className="text-stone">{t}</p>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-[0.9rem] text-stone">
          Recording times vary by county, and remote online notarization isn&apos;t available in California. Road Fund doesn&apos;t give legal advice.
        </p>
      </section>
    </div>
  );
}
