import type { Metadata } from "next";
import Link from "next/link";
import { COMPANY, phoneText, telHref } from "@/lib/company";
import { money } from "@/lib/money";
import { AGREEMENT_PACKAGE, LETTER_FEE, PLAN_LARGE, PLAN_SMALL, SMALL_ROAD_HOMES } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "About",
  description: "Who runs Road Fund, how it makes money, where road money goes, and what has changed lately.",
};

const $ = (c: number) => money(c).replace(".00", "");

// Dated from the project's own history. Add a line whenever something a captain or neighbor would notice changes.
const CHANGES: [string, string][] = [
  [
    "October 29, 2026",
    "Card fees are no longer added to what a neighbor pays. Each neighbor's page now opens with who the bill is from and how to check with them, and the captain's home page is a short to-do list.",
  ],
  ["October 28, 2026", "Two plans instead of three. Road Status Letters are $150 with one free update. Neighbors can tell the captain a check is in the mail, which stops reminders."],
  ["October 27, 2026", "Online payments by bank and card through Stripe, texts and emails to neighbors, captain sign-in by email, and automatic reminders."],
];

export default function AboutPage() {
  const runBy = [COMPANY.legalName, COMPANY.town].filter(Boolean);
  const hasContact = COMPANY.phone || COMPANY.email || COMPANY.address;
  return (
    <div className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="text-[2.4rem] font-black leading-tight">About Road Fund</h1>
      <p className="mt-4 text-[1.15rem]">
        Road Fund is for the person who looks after a private road: the neighbor who collects for plowing and gravel, keeps track of who paid, and answers the title
        company when a house on the road sells.
      </p>

      {(COMPANY.founder || runBy.length > 0) && (
        <section className="mt-12">
          <h2 className="text-[1.6rem] font-black">Who runs it</h2>
          <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-start">
            {COMPANY.founderPhoto && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={COMPANY.founderPhoto} alt={COMPANY.founder || "Founder"} width={160} height={160} className="h-40 w-40 shrink-0 rounded-md object-cover" />
            )}
            <div className="space-y-3">
              {COMPANY.founder && (
                <p className="text-[1.1rem]">
                  <strong>{COMPANY.founder}</strong>
                  {COMPANY.town && `, ${COMPANY.town}`}
                </p>
              )}
              {COMPANY.founderNote && <p className="whitespace-pre-line">{COMPANY.founderNote}</p>}
              {runBy.length > 0 && <p className="text-stone">Road Fund is run by {runBy.join(", ")}.</p>}
            </div>
          </div>
        </section>
      )}

      <section className="mt-12">
        <h2 className="text-[1.6rem] font-black">How Road Fund makes money</h2>
        <p className="mt-3">These are the only charges. There are no ads, and Road Fund doesn&apos;t sell information about you or your neighbors.</p>
        <table className="mt-4 w-full border-collapse text-left">
          <thead>
            <tr className="border-b-2 border-charcoal">
              <th className="py-2 pr-4 font-bold">What</th>
              <th className="py-2 pr-4 font-bold">Price</th>
              <th className="py-2 font-bold">Who pays</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            <Row what="Road Fund plan" price={`${$(PLAN_SMALL)} a year up to ${SMALL_ROAD_HOMES} homes, ${$(PLAN_LARGE)} for 9 to 30`} who="The road, usually from dues. The free plan costs nothing." />
            <Row what="Each online payment" price="$1" who="Added to the neighbor's bank payment, or covered by the road. The road's choice." />
            <Row what="Road Status Letter" price={$(LETTER_FEE)} who="Whoever asks for it, usually the seller at closing. Never the road." />
            <Row what="Help with the agreement" price={$(AGREEMENT_PACKAGE)} who="Only roads that ask for it." />
          </tbody>
        </table>
        <p className="mt-3 text-stone">
          Stripe charges its own fee on online payments: 0.8% for a checking account (at most $5) and 2.9% plus 30¢ for a card. Checks and cash cost nothing. Full details
          are on the <Link href="/pricing" className="font-semibold text-lake underline">pricing page</Link>.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-[1.6rem] font-black">Where the road&apos;s money goes</h2>
        <p className="mt-3">
          Online payments go through Stripe, the payment company, straight to the bank account the road captain connects. Road Fund never holds a road&apos;s money and never
          sees anyone&apos;s bank login or card number. Every payment in and every bill paid out shows on a record that everyone on the road can see.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-[1.6rem] font-black">What Road Fund is not</h2>
        <ul className="mt-3 list-disc space-y-2 pl-6">
          <li>Not a bank. The money sits in the road&apos;s own account.</li>
          <li>Not a law firm. It drafts a standard road agreement from your road&apos;s details, and a local attorney should review it before anyone signs.</li>
          <li>Not an HOA management company. The road captain runs the road; Road Fund keeps the books and sends the messages they choose to send.</li>
          <li>Not another account to keep track of. Neighbors pay from a link and never make a password.</li>
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="text-[1.6rem] font-black">Get in touch</h2>
        {hasContact ? (
          <dl className="mt-4 divide-y divide-line border-y border-line">
            {COMPANY.phone && (
              <div className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr]">
                <dt className="font-semibold">Phone</dt>
                <dd>
                  <a href={telHref(COMPANY.phone)} className="tnum font-semibold text-lake underline">
                    {phoneText(COMPANY.phone)}
                  </a>
                  {COMPANY.hours && <span className="text-stone"> · {COMPANY.hours}</span>}
                </dd>
              </div>
            )}
            {COMPANY.email && (
              <div className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr]">
                <dt className="font-semibold">Email</dt>
                <dd>
                  <a href={`mailto:${COMPANY.email}`} className="font-semibold text-lake underline">
                    {COMPANY.email}
                  </a>{" "}
                  <span className="text-stone">A person reads every message.</span>
                </dd>
              </div>
            )}
            {COMPANY.address && (
              <div className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr]">
                <dt className="font-semibold">Mail</dt>
                <dd>{COMPANY.address}</dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="mt-3">
            The <Link href="/help" className="font-semibold text-lake underline">help page</Link> answers the usual questions. Questions about your own road go to your road
            captain.
          </p>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-[1.6rem] font-black">Recent changes</h2>
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {CHANGES.map(([date, text]) => (
            <li key={date} className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr]">
              <span className="font-semibold">{date}</span>
              <span>{text}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Row({ what, price, who }: { what: string; price: string; who: string }) {
  return (
    <tr className="align-top">
      <td className="py-3 pr-4 font-semibold">{what}</td>
      <td className="tnum py-3 pr-4">{price}</td>
      <td className="py-3">{who}</td>
    </tr>
  );
}
