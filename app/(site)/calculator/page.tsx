import type { Metadata } from "next";
import { ShareCalculator } from "@/components/share-calculator";

export const metadata: Metadata = {
  title: "Private road cost share calculator",
  description: "Split a private road's yearly costs equally, by frontage, by driveway distance, or by use. Free, no signup. See exactly why each home owes what it owes.",
};

export default function CalculatorPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <p className="sign-chip inline-block rounded-md px-3 py-1 text-[0.9rem] font-bold">Free tool · no signup</p>
      <h1 className="mt-4 text-[2.4rem] font-black leading-tight">Private road cost share calculator</h1>
      <p className="mt-3 max-w-3xl text-[1.1rem] text-stone">
        Enter the budget and each home&apos;s driveway distance from the main road. Try each method, compare them side by side, and copy the result into your group text.
        Distances can be rough; pacing it off or reading it from a county map is close enough to start.
      </p>
      <div className="mt-10">
        <ShareCalculator />
      </div>
      <section className="mt-16 grid gap-6 md:grid-cols-2">
        <div className="rounded-[var(--radius-card)] border border-line bg-white p-6">
          <h2 className="text-[1.3rem] font-extrabold">Which method is fair?</h2>
          <p className="mt-2 text-stone">
            If homes are spread evenly, equal shares are simplest and hardest to argue with. On a long dead-end road, the homes at the end use far more of it, and
            splitting by use is fairer. Most roads that split by use add a base share so every home pays something toward the entrance everyone drives.
          </p>
        </div>
        <div className="rounded-[var(--radius-card)] border border-line bg-white p-6">
          <h2 className="text-[1.3rem] font-extrabold">Already have a deed or agreement?</h2>
          <p className="mt-2 text-stone">
            Use what it says. Older deeds often split by frontage or name fixed percentages. Pick &ldquo;By frontage&rdquo; or &ldquo;Custom percentages&rdquo; to match it.
            In some states a default road law applies when there&apos;s no agreement; see the road law guide.
          </p>
        </div>
      </section>
    </div>
  );
}
