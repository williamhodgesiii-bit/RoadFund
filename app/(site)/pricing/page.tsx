import type { Metadata } from "next";
import { Check } from "lucide-react";
import { FeeCalculator } from "@/components/fee-calculator";
import { ButtonLink } from "@/components/ui";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Free Starter plan, $149 a year for the full Road Fund plan, $249 for Plus. Road Status Letters $75. Agreement package $249.",
};

const PLANS = [
  {
    name: "Starter",
    price: "Free",
    per: "",
    who: "Try it on this year's dues.",
    lines: ["Road setup and share calculator", "One dues request a year", "Neighbor pay links by text, email or letter", "Ledger and receipts", "Road Status Letters ($75 each)"],
  },
  {
    name: "Road Fund",
    price: "$149",
    per: "per road, per year",
    who: "For roads up to 30 homes. Usually paid from dues.",
    highlight: true,
    lines: [
      "Everything in Starter",
      "Unlimited dues requests and reminders",
      "Pay contractors from the road account",
      "Work log with photos and damage map",
      "Votes by text link",
      "Documents in one place",
      "AI assistant: messages, quotes, deeds",
      "Savings planner for big repairs",
      "Weather alerts to your plow contractor",
    ],
  },
  {
    name: "Road Fund Plus",
    price: "$249",
    per: "per year",
    who: "Larger roads, or a captain running several.",
    lines: ["Everything in Road Fund", "Late-payer toolkit: notices, payment plans, small-claims packet", "Tax pack: 1099 tracking, Form 1120-H checklist, year-end report", "Several roads in one browser"],
  },
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-[2.4rem] font-black">Pricing</h1>
      <p className="mt-3 max-w-2xl text-[1.1rem] text-stone">
        The cheapest HOA software for a 10-home road runs $468 to $588 a year. Road Fund costs less and is built for a road, not a board.
      </p>

      <div className="mt-10 grid gap-5 lg:grid-cols-3">
        {PLANS.map((p) => (
          <section key={p.name} className={`flex flex-col rounded-[var(--radius-card)] border-2 bg-white p-6 ${p.highlight ? "border-pine shadow-lift" : "border-line"}`}>
            <div className="flex items-center justify-between">
              <h2 className="text-[1.25rem] font-extrabold">{p.name}</h2>
              {p.highlight && <span className="sign-chip rounded-md px-2 py-0.5 text-[0.8rem] font-bold">Most roads</span>}
            </div>
            <p className="mt-2">
              <span className="tnum font-display text-[2.4rem] font-black">{p.price}</span>
              {p.per && <span className="ml-2 text-stone">{p.per}</span>}
            </p>
            <p className="text-stone">{p.who}</p>
            <ul className="mt-5 flex-1 space-y-2.5">
              {p.lines.map((l) => (
                <li key={l} className="flex gap-2">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-pine" aria-hidden />
                  {l}
                </li>
              ))}
            </ul>
            <ButtonLink href="/start" variant={p.highlight ? "primary" : "secondary"} block className="mt-6">
              {p.name === "Starter" ? "Start free" : "Start free, upgrade anytime"}
            </ButtonLink>
          </section>
        ))}
      </div>

      <h2 className="mt-16 text-[1.8rem] font-black">One-time services</h2>
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <section className="rounded-[var(--radius-card)] border border-line bg-white p-6">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-[1.2rem] font-extrabold">Road Status Letter</h3>
            <span className="tnum font-display text-[1.6rem] font-black">$75</span>
          </div>
          <p className="mt-2 text-stone">
            A dated letter for a buyer&apos;s lender or title company, ready in minutes. Usually paid by the seller or through closing. HOAs charge $75 to $375 for the
            same kind of letter; Texas caps resale certificates at $375 and Florida caps estoppel fees at $299.
          </p>
        </section>
        <section className="rounded-[var(--radius-card)] border border-line bg-white p-6">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-[1.2rem] font-extrabold">Agreement package</h3>
            <span className="tnum font-display text-[1.6rem] font-black">$249</span>
          </div>
          <p className="mt-2 text-stone">
            State template drafted from your road&apos;s data, booking with a partner attorney, e-signatures from every owner, remote online notary and county recording.
            Attorney, notary and county recording fees are passed through at cost.
          </p>
        </section>
      </div>

      <h2 className="mt-16 text-[1.8rem] font-black">What neighbors pay</h2>
      <p className="mt-3 max-w-2xl text-stone">
        Each online payment carries a $1 Road Fund fee plus processing. Bank payments are the default because they cost far less than cards. The road decides who
        covers fees.
      </p>
      <div className="mt-6">
        <FeeCalculator />
      </div>

      <p className="mt-10 rounded-xl bg-paper-2 px-4 py-3 text-[0.95rem] text-stone">
        Test deployment: plan upgrades and purchases are simulated, and you can switch plans freely from Settings.
      </p>
    </div>
  );
}
