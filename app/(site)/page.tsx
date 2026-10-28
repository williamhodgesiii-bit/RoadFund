import Link from "next/link";
import { ArrowRight, Banknote, FileSignature, FileText, Landmark, Mail, MessageSquare, Scale, ShieldCheck, Snowflake, Users } from "lucide-react";
import { DeploymentNote } from "@/components/deployment-note";
import { PhoneMock } from "@/components/phone-mock";
import { PlanCards } from "@/components/plan-cards";
import { ShareCalculator } from "@/components/share-calculator";
import { ButtonLink } from "@/components/ui";
import { money } from "@/lib/money";
import { AGREEMENT_PACKAGE, LETTER_FEE } from "@/lib/pricing";
import { DEFAULT_LAWS, stateName } from "@/lib/states";

const $ = (c: number) => money(c).replace(".00", "");
const LAW_STATES = Object.keys(DEFAULT_LAWS).map(stateName);

export default function Landing() {
  return (
    <>
      {/* Hero */}
      <section className="gravel border-b border-line">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 md:py-20 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <p className="sign-chip inline-flex items-center gap-2 rounded-md px-3 py-1 text-[0.95rem] font-bold">For private roads shared by 3 to 30 homes</p>
            <h1 className="mt-5 text-[2.5rem] font-black leading-[1.05] sm:text-[3.3rem]">Stop fronting the money for your road.</h1>
            <p className="mt-5 max-w-xl text-[1.2rem] text-stone">
              Road Fund keeps your road&apos;s money and paperwork in one place. Each neighbor gets their share and the reason for it, and pays by bank, card or check.
              Everyone sees the same numbers. No app to download, no password.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/start" size="lg" icon={<ArrowRight className="h-5 w-5" aria-hidden />}>
                Set up your road free
              </ButtonLink>
              <ButtonLink href="/demo" size="lg" variant="secondary">
                Look around a sample road
              </ButtonLink>
            </div>
            <p className="mt-5 text-[1rem] text-stone">Setup takes about 10 minutes. Free for one bill a year.</p>
          </div>
          <PhoneMock />
        </div>
      </section>

      {/* The problem */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="max-w-2xl text-[2rem] font-black">The same three problems come up on almost every private road</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          <Problem title="One neighbor pays first" body="Someone pays the plow driver in December and the grader in May, then spends weeks collecting from everyone else by text, check and Venmo." />
          <Problem title="Somebody doesn't pay" body="Without a clear amount, a reason and a record, asking a second time feels personal. So the same few neighbors cover the rest." />
          <Problem
            title="Nothing is in writing"
            body="Without a signed agreement, it's hard to make a neighbor pay. And when a house sells, some buyers' lenders ask who keeps the road up."
          />
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-y border-line bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-[2rem] font-black">How it works</h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-3">
            <Step n={1} title="Agree on a fair split" icon={<Users className="h-6 w-6" aria-hidden />}>
              Equal shares, or by how much of the road each home drives. In {LAW_STATES.length} states the law already says how. Road Fund shows every neighbor why their
              share is what it is.
            </Step>
            <Step n={2} title="Ask once, clearly" icon={<MessageSquare className="h-6 w-6" aria-hidden />}>
              Each home gets a text, email or printed letter from you with their amount, what it&apos;s for and the due date. They pay by bank, card or check. Reminders go out
              on their own.
            </Step>
            <Step n={3} title="Everyone sees the same numbers" icon={<FileText className="h-6 w-6" aria-hidden />}>
              Who paid, what the plow and gravel cost, and photos of the work, all in one record. When you hand off the job, it all goes to the next captain.
            </Step>
          </ol>
        </div>
      </section>

      {/* Plowing season */}
      <section className="mx-auto max-w-6xl px-4 pt-16">
        <div className="flex flex-col gap-6 rounded-[var(--radius-card)] bg-charcoal p-6 text-white sm:p-8 md:flex-row md:items-center">
          <span className="w-fit rounded-2xl bg-white/10 p-4 text-sign">
            <Snowflake className="h-9 w-9" aria-hidden />
          </span>
          <div className="flex-1">
            <h2 className="text-[1.6rem] font-black">Split this winter&apos;s plowing before the first storm</h2>
            <p className="mt-2 text-[1.08rem] opacity-90">
              Put the plow contract in as this year&apos;s bill, send each home its share, and pay the plow driver once from what comes in. No more covering the whole season
              yourself and chasing it in March.
            </p>
          </div>
          <ButtonLink href="/start" variant="warn" size="lg" className="whitespace-nowrap">
            Set up plowing dues
          </ButtonLink>
        </div>
      </section>

      {/* Calculator */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="max-w-2xl">
          <h2 className="text-[2rem] font-black">See what&apos;s fair on your road</h2>
          <p className="mt-3 text-[1.1rem] text-stone">
            Most roads start with equal shares. On a long dead-end road, the homes at the far end drive more of it. Switch the method below and watch the shares change.
          </p>
        </div>
        <div className="mt-8">
          <ShareCalculator compact />
        </div>
        <p className="mt-4">
          <Link href="/calculator" className="font-semibold text-lake underline">
            Try it with your own homes and distances
          </Link>
        </p>
      </section>

      {/* Agreement */}
      <section className="border-y border-line bg-white">
        <div className="mx-auto grid max-w-6xl items-start gap-10 px-4 py-16 lg:grid-cols-2">
          <div>
            <h2 className="text-[2rem] font-black">Put the deal in writing</h2>
            <p className="mt-3 text-[1.1rem] text-stone">
              A signed road agreement is what makes a share collectible. It says who pays for what, how the road decides on work, and what happens if someone doesn&apos;t
              pay. It also binds whoever buys a house on the road later.
            </p>
            <ul className="mt-5 space-y-3">
              <Point icon={<FileSignature className="h-5 w-5" aria-hidden />}>Road Fund drafts it from your road&apos;s details and explains each part in plain English. Free.</Point>
              <Point icon={<MessageSquare className="h-5 w-5" aria-hidden />}>Every owner reads and signs from their own phone. You can see who&apos;s left.</Point>
              <Point icon={<Scale className="h-5 w-5" aria-hidden />}>
                A local attorney should review it before anyone signs. Want us to line that up, plus the notary and county filing? That&apos;s {$(AGREEMENT_PACKAGE)}, with outside
                fees at cost.
              </Point>
            </ul>
          </div>
          <div className="rounded-[var(--radius-card)] border border-line bg-paper p-6">
            <p className="font-bold">States where the law already says neighbors share road costs</p>
            <p className="mt-2 text-stone">{LAW_STATES.join(", ")}.</p>
            <p className="mt-4 text-stone">
              Even there, the law gives no easy way to collect, so a clear bill and a record still matter. Everywhere else, a written agreement is usually the only thing
              that makes a neighbor&apos;s share something you can collect.
            </p>
            <Link href="/guide" className="mt-4 inline-block font-semibold text-lake underline">
              Read the road law guide
            </Link>
          </div>
        </div>
      </section>

      {/* Closing */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid items-start gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-[2rem] font-black">Ready when a house on the road sells</h2>
            <p className="mt-3 text-[1.1rem] text-stone">
              Title companies want to know who keeps the road up and whether the seller is paid up. With Road Fund, they request a Road Status Letter by the road&apos;s code
              and pay {$(LETTER_FEE)} for it, usually passed to the seller at closing. You review it and send it in about a minute. It costs the road nothing.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <ButtonLink href="/closing" variant="secondary">
                For title companies and agents
              </ButtonLink>
              <ButtonLink href="/guide" variant="ghost" icon={<Scale className="h-5 w-5" aria-hidden />}>
                What lenders ask for
              </ButtonLink>
            </div>
          </div>
          <LetterPreview />
        </div>
      </section>

      {/* Trust */}
      <section className="border-y border-line bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-[2rem] font-black">Built so your neighbors trust it</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Feature icon={<Mail className="h-6 w-6" aria-hidden />} title="It comes from you">
              Every message names you and the road, and tells neighbors how to check with you before paying. You can hand out a printed letter first.
            </Feature>
            <Feature icon={<Banknote className="h-6 w-6" aria-hidden />} title="Checks are welcome">
              Neighbors who&apos;d rather write a check can, at no charge. You record it, and they get a receipt like everyone else.
            </Feature>
            <Feature icon={<Landmark className="h-6 w-6" aria-hidden />} title="Money goes to your bank">
              Online payments go through Stripe to the bank account you connect, the road&apos;s own or yours. Road Fund never holds the money.
            </Feature>
            <Feature icon={<ShieldCheck className="h-6 w-6" aria-hidden />} title="No accounts for neighbors">
              Nobody creates a login or remembers a password. Each home has its own page, and it only shows that home&apos;s details.
            </Feature>
          </div>
        </div>
      </section>

      {/* Pricing summary */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-[2rem] font-black">Priced for a road, not an HOA</h2>
            <p className="mt-3 max-w-2xl text-[1.1rem] text-stone">Most roads add it to the yearly budget, so it&apos;s split like the plow bill.</p>
          </div>
          <ButtonLink href="/pricing" variant="secondary">
            See full pricing
          </ButtonLink>
        </div>
        <div className="mt-8">
          <PlanCards compact />
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-line bg-white">
        <div className="mx-auto max-w-3xl px-4 py-16">
          <h2 className="text-[2rem] font-black">Questions people ask</h2>
          <div className="mt-6 divide-y divide-line border-y border-line">
            <Faq q="Do my neighbors need to download an app?">
              No. They get a text, email or printed letter from you with a link to their own page: what they owe, why, and how to pay. No account and no password. Anyone
              can pay by check instead.
            </Faq>
            <Faq q="Will my neighbors think the text is a scam?">
              That&apos;s why every message names you and the road, gives the amount and what it&apos;s for, and tells them how to check with you without tapping the link.
              Before the first one goes out, Road Fund prints a short letter from you for each home.
            </Faq>
            <Faq q="Where does the money go?">
              To the bank account you connect through Stripe. If the road has its own account and tax ID (EIN), the money goes there. Most informal roads don&apos;t, so it
              goes to the captain&apos;s account, and every dollar in and out shows on the record neighbors can see. Road Fund never holds the money.
              <DeploymentNote variant="faq" className="mt-2" />
            </Faq>
            <Faq q="What if a neighbor won't pay?">
              Most do once there&apos;s a clear amount, a reason and a link. Road Fund sends polite reminders on its own. After that you can send a friendly note, mail a dated
              letter, set up a payment plan, and if it comes to it, print a small-claims packet with the whole record.
            </Faq>
            <Faq q="Does a buyer's lender need a road maintenance agreement?">
              Some do. Loans sold to Fannie Mae generally need one unless the state has a road-sharing law. FHA and USDA loans need a recorded easement, not an agreement, and
              sources disagree on VA. The <Link href="/guide" className="font-semibold text-lake underline">road law guide</Link> has the details and links to the rules.
            </Faq>
            <Faq q="Is the agreement legal advice?">
              No. Road Fund fills in a standard agreement with your road&apos;s facts and explains each part in plain English. Have a licensed attorney in your state review it
              before anyone signs.
            </Faq>
            <Faq q="What happens when I stop being the road captain?">
              Hand the job to another neighbor from the Neighbors page. The payment record, documents and history stay with the road, not with you.
            </Faq>
          </div>
        </div>
      </section>

      <section className="bg-pine">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 py-14 md:flex-row md:items-center">
          <div className="text-white">
            <h2 className="text-[1.9rem] font-black">Get this year&apos;s road money in without the chasing</h2>
            <p className="mt-2 text-[1.1rem] opacity-90">Set up your road free, or look around a sample road first.</p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <ButtonLink href="/start" variant="warn" size="lg" className="whitespace-nowrap">
              Set up your road
            </ButtonLink>
            <ButtonLink href="/demo" size="lg" className="whitespace-nowrap border-2 border-white/80 bg-transparent text-white hover:bg-white/10">
              See a sample road
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}

function Problem({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-white p-6 shadow-card">
      <h3 className="text-[1.25rem] font-extrabold">{title}</h3>
      <p className="mt-2 text-[1.05rem] text-stone">{body}</p>
    </div>
  );
}

function Step({ n, title, icon, children }: { n: number; title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="relative rounded-[var(--radius-card)] border border-line bg-paper p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-pine font-display text-[1.1rem] font-black text-white">{n}</span>
        <span className="text-pine">{icon}</span>
      </div>
      <h3 className="mt-4 text-[1.25rem] font-extrabold">{title}</h3>
      <p className="mt-2 text-[1.05rem] text-stone">{children}</p>
    </li>
  );
}

function Feature({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-paper p-6">
      <span className="inline-flex rounded-xl bg-pine-50 p-2.5 text-pine">{icon}</span>
      <h3 className="mt-4 text-[1.15rem] font-extrabold">{title}</h3>
      <p className="mt-1.5 text-stone">{children}</p>
    </div>
  );
}

function Point({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 h-fit rounded-lg bg-pine-50 p-1.5 text-pine">{icon}</span>
      <span className="text-[1.05rem]">{children}</span>
    </li>
  );
}

function LetterPreview() {
  const rows: [string, string][] = [
    ["Property", "301 Birch Hollow Ln (Lot 6)"],
    ["Road agreement", "Signed by 6 of 9 owners; recording pending"],
    ["Access easement", "Liber 412, Page 88"],
    ["Seller's dues", "$367.02 owed, can be paid at closing"],
    ["Road savings", "$1,200 set aside for repairs"],
    ["Coming up", "Creek culvert, $1,100, vote in progress"],
  ];
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-white p-6 shadow-lift" aria-label="Sample Road Status Letter">
      <div className="flex items-start justify-between gap-3 border-b border-line pb-4">
        <div>
          <p className="text-[0.85rem] font-bold uppercase tracking-wider text-stone">Road Status Letter</p>
          <p className="font-display text-[1.3rem] font-extrabold">Birch Hollow Lane</p>
          <p className="text-[0.95rem] text-stone">Leelanau County, Michigan</p>
        </div>
        <div className="rounded-lg bg-paper-2 px-3 py-2 text-right">
          <p className="text-[0.8rem] font-semibold text-stone">Check code</p>
          <p className="font-mono text-[0.95rem] font-bold">K7QM-2XPD</p>
        </div>
      </div>
      <dl className="divide-y divide-line">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[9rem_1fr] gap-3 py-2.5 text-[0.98rem]">
            <dt className="font-semibold text-stone">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-[0.88rem] text-stone">Sample. Real letters come from the road&apos;s own records and are good for 30 days.</p>
    </div>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="group py-4">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-[1.15rem] font-bold">
        {q}
        <span className="text-[1.4rem] text-pine transition-transform group-open:rotate-45" aria-hidden>
          +
        </span>
      </summary>
      <div className="mt-2 text-[1.05rem] text-stone">{children}</div>
    </details>
  );
}
