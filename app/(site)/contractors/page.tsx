import type { Metadata } from "next";
import { Check, Receipt, Snowflake, Users } from "lucide-react";
import { ButtonLink } from "@/components/ui";

export const metadata: Metadata = {
  title: "For plow and grading contractors",
  description: "Private roads that use Road Fund collect each home's share up front and pay their contractor with one payment.",
};

export default function ContractorsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <p className="sign-chip inline-block rounded-md px-3 py-1 text-[0.95rem] font-bold">For plow, grading and gravel contractors</p>
      <h1 className="mt-4 text-[2.4rem] font-black leading-tight">Get paid once by the road, not by every house on it</h1>
      <p className="mt-4 text-[1.15rem] text-stone">
        You already work through one neighbor on most private roads. Road Fund helps that neighbor collect everyone&apos;s share before the work, so your bill gets paid in
        one piece and on time.
      </p>

      <ol className="mt-10 grid gap-5 md:grid-cols-3">
        {[
          {
            icon: <Users className="h-6 w-6" aria-hidden />,
            title: "The road agrees on the price",
            body: "The captain puts your quote in as the season's bill, or puts it to a vote for a bigger job like a culvert.",
          },
          {
            icon: <Snowflake className="h-6 w-6" aria-hidden />,
            title: "Each home pays its share",
            body: "Neighbors pay by bank, card or check before the work starts. Reminders go out without anyone chasing.",
          },
          {
            icon: <Receipt className="h-6 w-6" aria-hidden />,
            title: "You send one bill",
            body: "Email or hand the captain your invoice. They pay it from the road's money and keep a copy where every neighbor can see it.",
          },
        ].map((s) => (
          <li key={s.title} className="rounded-[var(--radius-card)] border border-line bg-white p-6">
            <span className="inline-flex rounded-xl bg-pine-50 p-2.5 text-pine">{s.icon}</span>
            <h2 className="mt-4 text-[1.2rem] font-extrabold">{s.title}</h2>
            <p className="mt-1.5 text-stone">{s.body}</p>
          </li>
        ))}
      </ol>

      <section className="mt-12 rounded-[var(--radius-card)] border border-line bg-white p-6 sm:p-8">
        <h2 className="text-[1.6rem] font-black">Tell the roads you work for</h2>
        <p className="mt-2 text-stone">If a road keeps paying you late, or one neighbor keeps covering everyone else, point them here. It costs you nothing.</p>
        <ul className="mt-5 space-y-2.5">
          {[
            "No account for you to set up. You get paid the way you already do.",
            "The road's captain sees who has paid before you start, so there are no surprises.",
            "Your quotes, invoices and before-and-after photos stay with the road, so the next captain knows the history.",
          ].map((t) => (
            <li key={t} className="flex gap-2">
              <Check className="mt-0.5 h-5 w-5 shrink-0 text-pine" aria-hidden />
              {t}
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href="/start">Set up a road</ButtonLink>
          <ButtonLink href="/demo" variant="secondary">
            Look around a sample road
          </ButtonLink>
        </div>
      </section>
    </div>
  );
}
