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
        Each road gets its own payment account through Stripe Connect and neighbors&apos; payments go straight to it. Road Fund never holds a road&apos;s money.
        Road Fund keeps a $1 fee per online payment; card and bank processing fees go to Stripe. Refunds and disputes follow Stripe&apos;s rules and the road&apos;s
        own decision.
      </Section>
      <Section title="Texts">
        Neighbors only get texts after they agree to them. Every text says how to stop: reply STOP. Opting out takes effect right away and is recorded on the road.
      </Section>
      <Section title="Your data">
        We collect only what running the road needs: names, addresses on the road, contact details neighbors give, payments and records. We never sell it. Neighbors
        see their own details, the road&apos;s totals and spending, but not other neighbors&apos; contact information. A captain can download everything as a file or
        delete the road at any time from Settings.
      </Section>
      <Section title="Where data lives in this deployment">
        Without cloud storage turned on, everything stays in the browser that created the road. With cloud storage on, road records are stored in the deployment&apos;s
        Upstash Redis database and shared links work on any device.
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
