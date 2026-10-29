import Image from "next/image";
import Link from "next/link";
import { LetterBody } from "@/components/app/letter-body";
import { DeploymentNote } from "@/components/deployment-note";
import { PlanTable } from "@/components/plan-table";
import { ShareCalculator } from "@/components/share-calculator";
import { ButtonLink } from "@/components/ui";
import { COMPANY, phoneText, telHref } from "@/lib/company";
import { fmtDate } from "@/lib/dates";
import { newLetter } from "@/lib/letter";
import { money } from "@/lib/money";
import { AGREEMENT_PACKAGE, LETTER_FEE } from "@/lib/pricing";
import { buildDemoRoad } from "@/lib/seed";
import { currentRequest, displayName, requestProgress } from "@/lib/selectors";
import { DEFAULT_LAWS, stateName } from "@/lib/states";
import { baseValues, budgetSummary, fillTokens, TOKEN_TEMPLATES } from "@/lib/templates";
import billShot from "@/public/screens/neighbor-bill.png";
import choicesShot from "@/public/screens/neighbor-pay-choices.png";
import whoPaidShot from "@/public/screens/captain-who-paid.png";

const $ = (c: number) => money(c).replace(".00", "");
const LAW_STATES = Object.keys(DEFAULT_LAWS).map(stateName);

/** Everything below comes from the sample road, built the same way the app builds it. */
function sample() {
  const now = new Date();
  const road = buildDemoRoad(now);
  const req = currentRequest(road)!;
  const prog = requestProgress(road, req, now);
  const captain = road.homes.find((h) => h.id === road.captainHomeId)!;
  const jamal = road.homes.find((h) => h.label === "Lot 6")!;
  const jamalLine = req.lines.find((l) => l.homeId === jamal.id)!;
  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const text = fillTokens(TOKEN_TEMPLATES.dues, {
    ...baseValues(road, jamal, site ? `${site}/n/…` : "[Jamal's own link]"),
    title: req.title,
    amount: money(jamalLine.amount),
    due: fmtDate(req.dueDate),
    budget: budgetSummary(req.budget.map((b) => b.label)),
  });
  const titleCo = road.letterRequests.find((r) => r.requester.role === "title") ?? road.letterRequests[0];
  const letter = newLetter(
    road,
    { homeId: jamal.id, requester: titleCo.requester, closingDate: titleCo.closingDate, paidBy: "closing", requestId: null },
    now,
  );
  const year = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return { road, req, prog, captain, text, letter, jamalAmount: jamalLine.amount, season: `${year}–${String(year + 1).slice(2)}` };
}

export default function Landing() {
  const { road, req, prog, captain, text, letter, jamalAmount, season } = sample();
  const capFirst = displayName(captain).split(" ")[0];

  return (
    <>
      {/* Hero */}
      <section className="border-b border-line">
        <div className="mx-auto grid max-w-6xl items-start gap-12 px-4 py-12 md:py-16 lg:grid-cols-[1.2fr_1fr]">
          <div className="lg:pt-6">
            <h1 className="text-[2.4rem] font-black leading-[1.08] sm:text-[3.1rem]">Split the plowing and gravel bill with everyone on your road</h1>
            <p className="mt-5 max-w-xl text-[1.2rem]">
              Road Fund sends each home on a private road its share of the bill, with the reason and the due date. Neighbors pay by bank, card or check from a link in a text
              or email. Nobody downloads an app or makes a password. You see who has paid, and so does everyone else.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/start" size="lg">
                Set up your road
              </ButtonLink>
              <ButtonLink href="/demo" size="lg" variant="secondary">
                See a sample road
              </ButtonLink>
            </div>
            <p className="mt-5">For private roads with 3 to 30 homes. Setup takes about 10 minutes, and it&apos;s free for one bill a year.</p>
            <div className="mt-8 max-w-xl border-l-4 border-sign pl-4">
              <p className="font-bold">Got a bill from your road?</p>
              <p className="mt-1">
                Open the link in the text or email your road captain sent. If you&apos;re not sure it&apos;s real, call them before you pay. You can always pay by check
                instead.
              </p>
            </div>
          </div>
          <figure className="mx-auto w-full max-w-[22rem]">
            <Image
              src={billShot}
              alt={`A neighbor's page on the sample road: from ${displayName(captain)}, road captain. Your share of ${req.title}, ${money(jamalAmount)}, with a Pay button and a phone number to check it's real.`}
              className="h-auto w-full rounded-lg border border-line shadow-lift"
              sizes="(min-width: 1024px) 352px, 90vw"
              priority
            />
            <figcaption className="mt-3 text-[0.98rem] text-stone">
              Jamal&apos;s page on Birch Hollow Lane, our sample road. Every home gets its own, opened from a link {capFirst} sends.
            </figcaption>
          </figure>
        </div>
      </section>

      {/* The problem, in a paragraph */}
      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-14 md:grid-cols-[1fr_2fr]">
        <h2 className="text-[1.9rem] font-black leading-tight">Who usually ends up paying</h2>
        <div className="space-y-4 text-[1.12rem]">
          <p>
            On most private roads, one neighbor pays the plow driver in December and the grader in May, then spends weeks getting everyone else&apos;s share back by text,
            check and Venmo. A couple of homes pay late, or not at all, and asking twice starts to feel personal. Nothing is written down, so when a house sells, the title
            company calls to ask who keeps the road up.
          </p>
          <p>Road Fund gives that neighbor a clear bill to send, a record everyone can see, and the paperwork a sale needs.</p>
        </div>
      </section>

      {/* How it works: a worked year on the sample road */}
      <section id="how" className="scroll-mt-20 border-y border-line bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="text-[1.9rem] font-black">How it works: a year on Birch Hollow Lane</h2>
          <p className="mt-3 max-w-3xl text-[1.1rem]">
            Birch Hollow Lane is our sample road: {road.homes.length} lots on {road.lengthFt.toLocaleString()} feet of gravel in {road.county} County, {stateName(road.state)}.
            These are its real numbers in Road Fund.
          </p>

          <div className="mt-10 grid gap-12 lg:grid-cols-2">
            <div>
              <h3 className="text-[1.3rem] font-extrabold">The bill</h3>
              <table className="mt-3 w-full border-collapse">
                <caption className="sr-only">{req.title} budget</caption>
                <tbody className="divide-y divide-line">
                  {req.budget.map((b) => (
                    <tr key={b.id}>
                      <td className="py-2 pr-4">{b.label}</td>
                      <td className="tnum py-2 text-right">{money(b.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-charcoal">
                    <td className="py-2 pr-4 font-bold">{req.title}</td>
                    <td className="tnum py-2 text-right font-bold">{money(req.total)}</td>
                  </tr>
                </tfoot>
              </table>
              <p className="mt-5">
                Half is split evenly. The other half goes by how much of the road each home drives, so the homes at the far end pay more than the ones by the mailboxes.
              </p>
              <table className="mt-3 w-full border-collapse">
                <caption className="sr-only">Each home&apos;s share</caption>
                <tbody className="divide-y divide-line">
                  {prog.lines.map((l) => (
                    <tr key={l.home.id}>
                      <td className="py-1.5 pr-3 text-stone">{l.home.label}</td>
                      <td className="py-1.5 pr-3">{displayName(l.home)}</td>
                      <td className="tnum py-1.5 text-right">{money(l.due)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <h3 className="text-[1.3rem] font-extrabold">What happens after it goes out</h3>
              <ol className="mt-3 list-decimal space-y-4 pl-6 text-[1.05rem] marker:font-bold">
                <li>
                  {capFirst}, the road captain, sends the bill. Each home gets a text or email from her with their amount and a link to their own page. Neighbors who
                  don&apos;t text get a printed letter.
                </li>
                <li>Neighbors pay from their page: from a checking account, by card, or by check. Each choice shows any fee before they pay.</li>
                <li>Three days before it&apos;s due, homes that haven&apos;t paid get a polite reminder. Anyone who said their check is in the mail is skipped.</li>
                <li>When a check arrives, {capFirst} taps &ldquo;Got their check.&rdquo; The neighbor gets a receipt.</li>
                <li>The plow driver&apos;s bill comes in. {capFirst} pays it from the road&apos;s money, and it shows on the record everyone can see.</li>
              </ol>
              <figure className="mt-10">
                <Image
                  src={whoPaidShot}
                  alt={`The captain's list of who has paid ${req.title}: ${prog.homesPaid} of ${prog.homesBilled} homes paid, with a "Got their check" button next to each home that still owes.`}
                  className="h-auto w-full rounded-lg border border-line"
                  sizes="(min-width: 1024px) 560px, 95vw"
                />
                <figcaption className="mt-3 text-[0.98rem] text-stone">What {capFirst} sees: who has paid this year, and a button for the checks that come in.</figcaption>
              </figure>
            </div>
          </div>
        </div>
      </section>

      {/* What neighbors see */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-[1.9rem] font-black">What your neighbors see</h2>
        <div className="mt-8 grid gap-12 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <h3 className="text-[1.15rem] font-bold">The text Jamal gets from {capFirst}</h3>
            <blockquote className="mt-3 rounded-lg border border-line bg-white p-5 text-[1.08rem] leading-relaxed">{text}</blockquote>
            <ul className="mt-8 list-disc space-y-3 pl-6 text-[1.05rem]">
              <li>Every message comes from you by name, says which road and which bill, and tells people how to check with you before paying.</li>
              <li>Before the first one goes out, Road Fund prints a short letter from you for each home, so nobody is surprised by a text.</li>
              <li>Checks are always welcome, at no charge. A neighbor who mails one presses &ldquo;I mailed my check&rdquo; and the reminders stop.</li>
              <li>Everyone can see where the money went: each payment in, and each bill paid out.</li>
            </ul>
          </div>
          <figure className="mx-auto w-full max-w-[22rem]">
            <Image
              src={choicesShot}
              alt="Choosing how to pay: from my checking account, debit or credit card, or by check. Each choice shows its fee and how long it takes."
              className="h-auto w-full rounded-lg border border-line"
              sizes="(min-width: 1024px) 352px, 90vw"
            />
            <figcaption className="mt-3 text-[0.98rem] text-stone">Paying from the page. Any fee shows before anyone pays.</figcaption>
          </figure>
        </div>
      </section>

      {/* Season note */}
      <section className="mx-auto max-w-6xl px-4">
        <div className="border-y-2 border-charcoal py-6 sm:flex sm:items-baseline sm:gap-8">
          <h2 className="shrink-0 text-[1.3rem] font-extrabold">Snow season {season}</h2>
          <p className="mt-2 sm:mt-0">
            Collect the plowing money before the first storm. Put the plow contract in as this year&apos;s bill and pay the driver from what comes in, not from your own pocket.{" "}
            <Link href="/start" className="font-semibold text-lake underline">
              Set up your road
            </Link>
          </p>
        </div>
      </section>

      {/* Calculator */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-[1.9rem] font-black">What&apos;s fair on your road</h2>
        <p className="mt-3 max-w-3xl text-[1.1rem]">
          Most roads start with equal shares. On a long dead-end road, the homes at the far end drive more of it. Switch the method below and watch the shares change.
        </p>
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
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 lg:grid-cols-2">
          <div>
            <h2 className="text-[1.9rem] font-black">A written road agreement</h2>
            <p className="mt-3 text-[1.1rem]">
              A signed road agreement is what makes a share something you can collect. It says who pays for what, how the road decides on work, and what happens if someone
              doesn&apos;t pay. It also binds whoever buys a house on the road later.
            </p>
            <p className="mt-4">
              Road Fund drafts one from your road&apos;s details and explains each part in plain English, for free. Every owner reads and signs it from their own phone, and you
              can see who&apos;s left. A local attorney should look it over before anyone signs. If you&apos;d like us to line that up, along with the notary and the county
              filing, it&apos;s {$(AGREEMENT_PACKAGE)} plus outside fees at cost.
            </p>
          </div>
          <div>
            <h3 className="text-[1.2rem] font-bold">States where the law already says neighbors share road costs</h3>
            <p className="mt-2">{LAW_STATES.join(", ")}.</p>
            <p className="mt-4">
              Even there, the law gives no easy way to collect, so a clear bill and a record still matter. Everywhere else, a written agreement is usually the only thing that
              makes a neighbor&apos;s share collectible.
            </p>
            <Link href="/guide" className="mt-4 inline-block font-semibold text-lake underline">
              Road law by state
            </Link>
          </div>
        </div>
      </section>

      {/* Selling a home */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="max-w-3xl">
          <h2 className="text-[1.9rem] font-black">When a house on the road sells</h2>
          <p className="mt-3 text-[1.1rem]">
            Title companies want to know who keeps the road up and whether the seller is paid up. They request a Road Status Letter using the road&apos;s code and pay{" "}
            {$(LETTER_FEE)} for it, usually passed to the seller at closing. You look it over and send it in about a minute. It costs the road nothing. Here is the full letter
            for Jamal&apos;s house on the sample road.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href="/closing" variant="secondary">
              For title companies and agents
            </ButtonLink>
          </div>
        </div>
        <div className="mt-10 max-w-3xl border border-line bg-white p-6 shadow-lift sm:p-10">
          <LetterBody letter={letter} sample />
        </div>
      </section>

      {/* Price */}
      <section className="border-y border-line bg-white">
        <div className="mx-auto max-w-4xl px-4 py-14">
          <h2 className="text-[1.9rem] font-black">What it costs</h2>
          <div className="mt-6">
            <PlanTable />
          </div>
          <p className="mt-6">
            <Link href="/pricing" className="font-semibold text-lake underline">
              Pricing details and a fee calculator
            </Link>
          </p>
        </div>
      </section>

      {/* Questions */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-[1.9rem] font-black">Questions people ask</h2>
        <div className="mt-8 grid gap-x-12 gap-y-8 md:grid-cols-2">
          <Faq q="Do my neighbors need to download an app?">
            No. They get a text, email or printed letter from you with a link to their own page: what they owe, why, and how to pay. No account and no password. Anyone can pay
            by check instead.
          </Faq>
          <Faq q="Will my neighbors think the text is a scam?">
            Every message names you and the road, gives the amount and what it&apos;s for, and tells them how to check with you without tapping the link. Before the first one
            goes out, Road Fund prints a short letter from you for each home.
          </Faq>
          <Faq q="Where does the money go?">
            To the bank account you connect through Stripe, the payment company. If the road has its own account and tax ID, the money goes there. Most informal roads
            don&apos;t, so it goes to the captain&apos;s account, and every dollar in and out shows on the record neighbors see. Road Fund never holds the money.
            <DeploymentNote variant="faq" className="mt-2" />
          </Faq>
          <Faq q="What if a neighbor won't pay?">
            Most do once there&apos;s a clear amount, a reason and a link. Road Fund sends polite reminders on its own. After that you can send a friendly note, mail a dated
            letter, set up a payment plan, and if it comes to it, print a small-claims packet with the whole record.
          </Faq>
          <Faq q="Does a buyer's lender need a road maintenance agreement?">
            Some do. Loans sold to Fannie Mae generally need one unless the state has a road-sharing law. FHA and USDA loans need a recorded easement, not an agreement, and
            sources disagree on VA. The{" "}
            <Link href="/guide" className="font-semibold text-lake underline">
              road law guide
            </Link>{" "}
            has the details.
          </Faq>
          <Faq q="What happens when I stop being the road captain?">
            Hand the job to another neighbor from the Neighbors page. The payment record, documents and history stay with the road, not with you.
          </Faq>
        </div>
        <p className="mt-10">
          More answers are on the{" "}
          <Link href="/help" className="font-semibold text-lake underline">
            help page
          </Link>
          .
        </p>
      </section>

      {/* Close: a person and one button */}
      <section className="mx-auto max-w-6xl px-4">
        <div className="flex flex-col gap-6 border-t-2 border-charcoal pt-10 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-[1.6rem] font-black">Ready when you are</h2>
            {COMPANY.phone ? (
              <p className="mt-2 text-[1.1rem]">
                Questions first? Call{" "}
                <a href={telHref(COMPANY.phone)} className="tnum font-semibold text-lake underline">
                  {phoneText(COMPANY.phone)}
                </a>
                {COMPANY.hours ? ` (${COMPANY.hours})` : ""}
                {COMPANY.email ? (
                  <>
                    {" "}
                    or email{" "}
                    <a href={`mailto:${COMPANY.email}`} className="font-semibold text-lake underline">
                      {COMPANY.email}
                    </a>
                  </>
                ) : null}
                .
              </p>
            ) : COMPANY.email ? (
              <p className="mt-2 text-[1.1rem]">
                Questions first? Email{" "}
                <a href={`mailto:${COMPANY.email}`} className="font-semibold text-lake underline">
                  {COMPANY.email}
                </a>
                . A person reads every message.
              </p>
            ) : (
              <p className="mt-2 text-[1.1rem]">Set up takes about 10 minutes. You can look around the sample road first.</p>
            )}
          </div>
          <ButtonLink href="/start" size="lg" className="whitespace-nowrap">
            Set up your road
          </ButtonLink>
        </div>
      </section>
    </>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[1.15rem] font-bold">{q}</h3>
      <div className="mt-1.5 text-[1.05rem]">{children}</div>
    </div>
  );
}
