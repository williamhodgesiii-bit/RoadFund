import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  BellRing,
  Camera,
  Check,
  FileSignature,
  FileText,
  Hammer,
  Landmark,
  MessageSquare,
  Minus,
  Scale,
  Vote,
  X,
} from "lucide-react";
import { PhoneMock } from "@/components/phone-mock";
import { ShareCalculator } from "@/components/share-calculator";
import { ButtonLink } from "@/components/ui";
import { computeCharge } from "@/lib/fees";
import { money } from "@/lib/money";

const achOn300 = computeCharge(30_000, "ach", true);
const cardOn300 = computeCharge(30_000, "card", true);

export default function Landing() {
  return (
    <>
      {/* Hero */}
      <section className="gravel border-b border-line">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 md:py-20 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <p className="sign-chip inline-flex items-center gap-2 rounded-md px-3 py-1 text-[0.9rem] font-bold">For private roads with 3 to 30 homes</p>
            <h1 className="mt-5 text-[2.5rem] font-black leading-[1.05] sm:text-[3.3rem]">Stop fronting the money for your road.</h1>
            <p className="mt-5 max-w-xl text-[1.15rem] text-stone">
              Road Fund collects each neighbor&apos;s fair share, pays the plow and grading bills from the road&apos;s own account, and keeps a record anyone on the road can
              check. Neighbors pay from a text message. No app to download, no password.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/start" size="lg" icon={<ArrowRight className="h-5 w-5" aria-hidden />}>
                Set up your road free
              </ButtonLink>
              <ButtonLink href="/demo" size="lg" variant="secondary">
                Walk through a demo road
              </ButtonLink>
            </div>
            <p className="mt-5 text-[0.95rem] text-stone">Setup takes about 10 minutes. The free plan covers one dues request a year.</p>
          </div>
          <PhoneMock />
        </div>
      </section>

      {/* The problem */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="max-w-2xl text-[2rem] font-black">Every private road has the same yearly problem.</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          <Problem
            title="One neighbor fronts the cost"
            body="Someone pays the plow contractor in December and the grader in May, then spends weeks collecting from everyone else by text, check and Venmo."
          />
          <Problem
            title="Not everyone pays"
            body="Road groups commonly see a third of owners skip their share. Without a record and a clear split, asking again feels personal."
          />
          <Problem
            title="Then a house sells"
            body="The buyer's lender asks for a recorded road maintenance agreement. Most informal roads don't have one, and the closing stalls."
          />
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-y border-line bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-[2rem] font-black">How it works</h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-3">
            <Step n={1} title="Set up in about 10 minutes" icon={<Landmark className="h-6 w-6" aria-hidden />}>
              Find your road, list the homes that use it, pick how to split costs, and connect the road&apos;s own bank account.
            </Step>
            <Step n={2} title="Send dues by text or email" icon={<MessageSquare className="h-6 w-6" aria-hidden />}>
              Each neighbor gets a link with their amount and the reason for it. They pay by bank or card in under a minute. Reminders go out on their own.
            </Step>
            <Step n={3} title="Every dollar on the record" icon={<FileText className="h-6 w-6" aria-hidden />}>
              Payments, bills, receipts, photos of the work and every vote land in one ledger anyone on the road can see.
            </Step>
          </ol>
        </div>
      </section>

      {/* Calculator */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="max-w-2xl">
          <h2 className="text-[2rem] font-black">See what&apos;s fair on your road</h2>
          <p className="mt-3 text-[1.1rem] text-stone">
            The home at the end of the road uses more of it. Splitting by use charges each stretch only to the homes that drive it, with a base share so nobody pays
            nothing. Change the method and watch the shares move.
          </p>
        </div>
        <div className="mt-8">
          <ShareCalculator compact />
        </div>
        <p className="mt-4">
          <Link href="/calculator" className="font-semibold text-lake underline">
            Open the full calculator with your own homes and distances
          </Link>
        </p>
      </section>

      {/* Features */}
      <section className="border-y border-line bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-[2rem] font-black">Everything the road captain does, in one place</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Feature icon={<Banknote className="h-6 w-6" aria-hidden />} title="Dues and fair shares">
              Equal, by frontage, by distance, or by use. Every neighbor sees exactly why they owe what they owe.
            </Feature>
            <Feature icon={<BellRing className="h-6 w-6" aria-hidden />} title="Reminders you don't have to send">
              Polite reminders before and after the due date. Firm notices and payment plans when you need them.
            </Feature>
            <Feature icon={<Landmark className="h-6 w-6" aria-hidden />} title="The road's own account">
              Money goes to an account in the road&apos;s name through Stripe. Anyone on the road can see the balance.
            </Feature>
            <Feature icon={<Hammer className="h-6 w-6" aria-hidden />} title="Pay the contractor">
              Snap the invoice, approve it, and pay the plow or grading company from the road account. 1099s tracked.
            </Feature>
            <Feature icon={<Camera className="h-6 w-6" aria-hidden />} title="Work log with photos">
              Before and after photos, potholes pinned on the map, and a savings plan for the big repairs coming up.
            </Feature>
            <Feature icon={<Vote className="h-6 w-6" aria-hidden />} title="Votes by text">
              &ldquo;Grade in spring for $2,400?&rdquo; Yes or no from a link, with a deadline and a permanent record.
            </Feature>
          </div>
        </div>
      </section>

      {/* Closing */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid items-start gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-[2rem] font-black">When a house on your road sells</h2>
            <p className="mt-3 text-[1.1rem] text-stone">
              Buyers with conventional loans often need proof the road is maintained and paid for. Road Fund puts that proof one click away.
            </p>
            <div className="mt-6 space-y-4">
              <Offer
                icon={<FileText className="h-6 w-6" aria-hidden />}
                title="Road Status Letter"
                price="$75"
                body="A dated letter for the buyer's lender or title company: agreement status, recording details, the seller's dues, the road balance and upcoming projects. Each letter has a code the title company can verify online."
              />
              <Offer
                icon={<FileSignature className="h-6 w-6" aria-hidden />}
                title="Lender-ready agreement package"
                price="$249"
                body="A state template filled from your road's data, attorney review, e-signatures from every owner, online notary and county recording. Attorney and county fees are passed through at cost."
              />
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <ButtonLink href="/closing" variant="secondary">
                For title companies and lenders
              </ButtonLink>
              <ButtonLink href="/guide" variant="ghost" icon={<Scale className="h-5 w-5" aria-hidden />}>
                What lenders require
              </ButtonLink>
            </div>
          </div>
          <LetterPreview />
        </div>
      </section>

      {/* Comparison */}
      <section className="border-y border-line bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-[2rem] font-black">How it compares</h2>
          <p className="mt-3 max-w-2xl text-[1.1rem] text-stone">Most roads use a group text and one tired neighbor. HOA software works, but it&apos;s built and priced for HOAs.</p>
          <ComparisonTable />
        </div>
      </section>

      {/* Pricing summary */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-[2rem] font-black">Priced for a road, not an HOA</h2>
            <p className="mt-3 max-w-2xl text-[1.1rem] text-stone">A 10-home road paying $300 a home collects $3,000 a year. The Road Fund plan is about 5% of that.</p>
          </div>
          <ButtonLink href="/pricing" variant="secondary">
            See full pricing
          </ButtonLink>
        </div>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          <Plan name="Starter" price="Free" lines={["Road setup and share calculator", "One dues request a year", "Ledger and receipts"]} />
          <Plan name="Road Fund" price="$149/yr" highlight lines={["Unlimited requests and reminders", "Pay contractors, work log, votes", "Documents, AI assistant, savings planner"]} />
          <Plan name="Road Fund Plus" price="$249/yr" lines={["Everything in Road Fund", "Late-payer toolkit and tax pack", "Several roads in one login"]} />
        </div>
        <p className="mt-5 text-stone">
          Neighbors pay $1 per payment plus processing. A {money(30_000)} share by bank costs them {money(achOn300.total - achOn300.share)}; by card {money(cardOn300.total - cardOn300.share)}. The road
          can choose to cover fees instead.
        </p>
      </section>

      {/* FAQ */}
      <section className="border-t border-line bg-white">
        <div className="mx-auto max-w-3xl px-4 py-16">
          <h2 className="text-[2rem] font-black">Questions people ask</h2>
          <div className="mt-6 divide-y divide-line border-y border-line">
            <Faq q="Do my neighbors need to download an app?">
              No. They get a text or email with a link that opens their page: what they owe, why, and a button to pay. No account, no password. Neighbors who prefer
              paper get a printed letter and can pay by check.
            </Faq>
            <Faq q="Who holds the money?">
              The road does. Each road gets its own payment account through Stripe Connect, and payments go straight to it. Road Fund never holds the road&apos;s money.
              In this test deployment, bank connections and payments are simulated.
            </Faq>
            <Faq q="Does my buyer's lender require a road maintenance agreement?">
              It depends on the loan. Conventional loans sold to Fannie Mae generally need one unless your state has a default road law. FHA, VA and USDA loans do not.
              The <Link href="/guide" className="font-semibold text-lake underline">road law guide</Link> has the details and sources.
            </Faq>
            <Faq q="Is the agreement legal advice?">
              No. Road Fund fills a template with your road&apos;s facts and explains each section in plain English. A licensed attorney in your state reviews it before
              anyone signs, and that review is part of the agreement package.
            </Faq>
            <Faq q="What if a neighbor won't pay?">
              Most do once there&apos;s a clear amount, a reason and a link. For the rest, Road Fund sends reminders, then friendly, formal and final notices, and can set up a
              payment plan. Plus includes a small-claims packet with the ledger, the agreement and every notice sent.
            </Faq>
            <Faq q="What happens when I stop being the road captain?">
              Hand the role to another neighbor in one click. The ledger, documents and history stay with the road, not with you.
            </Faq>
          </div>
        </div>
      </section>

      <section className="bg-pine">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 py-14 md:flex-row md:items-center">
          <div className="text-white">
            <h2 className="text-[1.9rem] font-black">Get this year&apos;s dues in without the chasing.</h2>
            <p className="mt-2 text-[1.1rem] opacity-90">Set up your road free, or try every feature on a demo road first.</p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <ButtonLink href="/start" variant="warn" size="lg">
              Set up your road
            </ButtonLink>
            <ButtonLink href="/demo" size="lg" className="border-2 border-white/80 bg-transparent text-white hover:bg-white/10">
              Try the demo
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
      <h3 className="text-[1.2rem] font-extrabold">{title}</h3>
      <p className="mt-2 text-stone">{body}</p>
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
      <h3 className="mt-4 text-[1.2rem] font-extrabold">{title}</h3>
      <p className="mt-2 text-stone">{children}</p>
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

function Offer({ icon, title, price, body }: { icon: React.ReactNode; title: string; price: string; body: string }) {
  return (
    <div className="flex gap-4 rounded-[var(--radius-card)] border border-line bg-white p-5 shadow-card">
      <span className="h-fit rounded-xl bg-sign-50 p-2.5 text-sign-ink">{icon}</span>
      <div>
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h3 className="text-[1.15rem] font-extrabold">{title}</h3>
          <span className="tnum font-bold text-pine">{price}</span>
        </div>
        <p className="mt-1 text-stone">{body}</p>
      </div>
    </div>
  );
}

function LetterPreview() {
  const rows: [string, string][] = [
    ["Property", "301 Birch Hollow Ln (Lot 6)"],
    ["Maintenance agreement", "Signed by 6 of 9 owners; recording pending"],
    ["Seller's dues", "$367.02 outstanding, due at closing"],
    ["Road account", "$2,093.53, including $1,200 set aside for repairs"],
    ["Coming up", "Creek culvert replacement, $1,100, vote in progress"],
  ];
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-white p-6 shadow-lift" aria-label="Sample Road Status Letter">
      <div className="flex items-start justify-between gap-3 border-b border-line pb-4">
        <div>
          <p className="text-[0.8rem] font-bold uppercase tracking-wider text-stone">Road Status Letter</p>
          <p className="font-display text-[1.3rem] font-extrabold">Birch Hollow Lane</p>
          <p className="text-[0.9rem] text-stone">Leelanau County, Michigan</p>
        </div>
        <div className="rounded-lg bg-paper-2 px-3 py-2 text-right">
          <p className="text-[0.75rem] font-semibold text-stone">Verify code</p>
          <p className="font-mono text-[0.95rem] font-bold">K7QM-2XPD</p>
        </div>
      </div>
      <dl className="divide-y divide-line">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[9rem_1fr] gap-3 py-2.5 text-[0.95rem]">
            <dt className="font-semibold text-stone">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-[0.82rem] text-stone">Sample. Real letters are generated from the road&apos;s live records and valid for 30 days.</p>
    </div>
  );
}

type Mark = "yes" | "part" | "no" | "na";
const COLS = ["Road Fund", "HOA software", "Payment pages", "Agreement templates", "Group text + Venmo"];
const ROWS: [string, Mark[]][] = [
  ["Built for 3 to 30 homes on a road", ["yes", "no", "part", "na", "part"]],
  ["Split costs by frontage, distance or use", ["yes", "part", "no", "na", "no"]],
  ["Neighbors pay with no login", ["yes", "no", "yes", "na", "yes"]],
  ["Bank (ACH) payments", ["yes", "yes", "yes", "na", "part"]],
  ["State agreement with e-sign, notary and recording", ["yes", "no", "no", "part", "no"]],
  ["Road Status Letter for closings", ["yes", "no", "no", "no", "no"]],
  ["Photo log of road work and votes", ["yes", "part", "no", "no", "no"]],
  ["Pay contractors from the road's account", ["yes", "part", "no", "no", "part"]],
];
const PRICES = ["$0–$249", "$468–$588", "$0–$180", "$0–$59 once", "$0"];

function MarkCell({ m }: { m: Mark }) {
  if (m === "yes")
    return (
      <span className="inline-flex items-center gap-1 font-semibold text-pine">
        <Check className="h-5 w-5" aria-hidden />
        Yes
      </span>
    );
  if (m === "part")
    return (
      <span className="inline-flex items-center gap-1 text-sign-ink">
        <Minus className="h-5 w-5" aria-hidden />
        Partly
      </span>
    );
  if (m === "no")
    return (
      <span className="inline-flex items-center gap-1 text-stone">
        <X className="h-5 w-5" aria-hidden />
        No
      </span>
    );
  return <span className="text-stone">n/a</span>;
}

function ComparisonTable() {
  return (
    <div className="mt-8 overflow-x-auto rounded-[var(--radius-card)] border border-line">
      <table className="w-full min-w-[760px] border-collapse text-left">
        <caption className="sr-only">Road Fund compared with other ways roads collect dues</caption>
        <thead className="bg-paper">
          <tr>
            <th scope="col" className="px-4 py-3 font-semibold text-stone">
              Feature
            </th>
            {COLS.map((c, i) => (
              <th key={c} scope="col" className={`px-4 py-3 ${i === 0 ? "bg-pine-50 font-extrabold text-pine" : "font-semibold"}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map(([label, marks]) => (
            <tr key={label} className="border-t border-line">
              <th scope="row" className="px-4 py-3 font-semibold">
                {label}
              </th>
              {marks.map((m, i) => (
                <td key={i} className={`px-4 py-3 ${i === 0 ? "bg-pine-50/60" : ""}`}>
                  <MarkCell m={m} />
                </td>
              ))}
            </tr>
          ))}
          <tr className="border-t border-line">
            <th scope="row" className="px-4 py-3 font-semibold">
              Yearly price, 10-home road
            </th>
            {PRICES.map((p, i) => (
              <td key={i} className={`tnum px-4 py-3 font-semibold ${i === 0 ? "bg-pine-50/60 text-pine" : ""}`}>
                {p}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function Plan({ name, price, lines, highlight }: { name: string; price: string; lines: string[]; highlight?: boolean }) {
  return (
    <div className={`rounded-[var(--radius-card)] border-2 bg-white p-6 ${highlight ? "border-pine shadow-lift" : "border-line"}`}>
      <p className="font-bold">{name}</p>
      <p className="tnum mt-1 font-display text-[2rem] font-black">{price}</p>
      <ul className="mt-4 space-y-2">
        {lines.map((l) => (
          <li key={l} className="flex gap-2">
            <Check className="mt-0.5 h-5 w-5 shrink-0 text-pine" aria-hidden />
            {l}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="group py-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[1.1rem] font-bold">
        {q}
        <span className="text-pine transition-transform group-open:rotate-45" aria-hidden>
          +
        </span>
      </summary>
      <div className="mt-2 text-stone">{children}</div>
    </details>
  );
}
