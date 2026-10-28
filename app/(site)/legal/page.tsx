import type { Metadata } from "next";
import { DeploymentNote } from "@/components/deployment-note";

export const metadata: Metadata = { title: "Terms, privacy and disclaimers" };

export default function LegalPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="text-[2.2rem] font-black">Terms, privacy and disclaimers</h1>
      <p className="mt-2 text-stone">The plain-English version.</p>
      <DeploymentNote variant="legal" className="mt-6 rounded-xl border border-sign/50 bg-sign-50 px-4 py-3 text-sign-ink" />
      <Section title="Not a law firm">
        Road Fund is software. It fills in templates with your road&apos;s facts and explains them in plain English. It does not give legal advice, decide legal
        questions or recommend lawyers. A licensed attorney in your state should review any agreement before anyone signs. Attorney listings, when offered, are
        paid advertising at a flat fee and never a per-case referral fee.
      </Section>
      <Section title="Who holds the money">
        Each road connects a bank account through Stripe, and neighbors&apos; online payments go to it. That&apos;s the road&apos;s own account if it has one, or the
        captain&apos;s if it doesn&apos;t, which is common for informal roads. Road Fund never holds a road&apos;s money. Road Fund keeps $1 per online payment; the bank or
        card charge goes to Stripe. Checks and cash are free. Refunds and disputes follow Stripe&apos;s rules and the road&apos;s own decision.
      </Section>
      <Section title="Texts">
        Neighbors only get texts from Road Fund after they agree to them on their own page, and they get a confirmation text when they do. Every text says how to stop:
        reply STOP. Opting out takes effect right away. Messages the captain sends from their own phone are between the captain and the neighbor.
      </Section>
      <Section title="Your data">
        We collect only what running the road needs: names, addresses on the road, contact details neighbors give, payments and records. We never sell it. Neighbors
        see their own details, the road&apos;s totals and spending, but not other neighbors&apos; contact information. A captain can download everything as a file or
        delete the road at any time from Settings.
      </Section>
      <Section title="Where the records are kept">
        Road records are stored in Road Fund&apos;s database so links work on any phone. Payment details are handled by Stripe; Road Fund never sees card numbers or
        bank logins. On a site without cloud storage turned on, records stay in the browser that created the road.
      </Section>
      <Section title="Road Status Letters">
        A letter shows what the road&apos;s records say on the day it&apos;s issued. The road captain reviews it before it goes out. It isn&apos;t a title search, a survey
        or legal advice. The fee is paid by whoever requests it and is refunded if the road can&apos;t issue it.
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-[1.3rem] font-extrabold">{title}</h2>
      <p className="mt-2 text-[1.02rem]">{children}</p>
    </section>
  );
}
