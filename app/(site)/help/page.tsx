import type { Metadata } from "next";
import Link from "next/link";
import { COMPANY, phoneText, telHref } from "@/lib/company";
import { money } from "@/lib/money";
import { LETTER_FEE, PLAN_LARGE, PLAN_SMALL } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Help",
  description: "Answers for neighbors paying road dues, road captains running the road, and title companies requesting letters.",
};

const $ = (c: number) => money(c).replace(".00", "");

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="text-[2.4rem] font-black leading-tight">Help</h1>
      <p className="mt-3 text-[1.1rem]">Questions about your own road, like what it costs or when the plow comes, go to your road captain. Their name and number are on your road page.</p>
      <nav aria-label="Help sections" className="mt-6 flex flex-wrap gap-2">
        {[
          ["#neighbors", "I live on the road"],
          ["#captains", "I'm the road captain"],
          ["#closing", "I work in real estate"],
        ].map(([href, label]) => (
          <a key={href} href={href} className="inline-flex min-h-12 items-center rounded-lg border-2 border-line bg-white px-4 font-semibold hover:border-field">
            {label}
          </a>
        ))}
      </nav>

      <Section id="neighbors" title="For neighbors">
        <Q q="I got a text or email with a link. Is it real?">
          Real messages come from your road captain by name, say which road and which bill, and tell you how to reach them. The link opens a page with your road&apos;s
          name and your lot on it. Road Fund never asks for a bank password in a text or email. If anything looks off, call your road captain before paying, or pay by
          check instead.
        </Q>
        <Q q="Do I need an app or a password?">No. Your link is your page. Keep the text or email, or bookmark the page. Anyone with your link can see your page, so don&apos;t post it publicly.</Q>
        <Q q="How do I pay?">
          Open your link and press Pay. Then choose how: from your checking account, by debit or credit card, or by check. Each choice shows the exact fee before you
          pay. For a checking account, you pick your bank and log in on Stripe&apos;s secure page, or type your account and routing numbers. You get a receipt by email if
          your captain has your email address.
        </Q>
        <Q q="Can I pay by check or cash instead?">
          Yes, at no charge. Press Pay, choose By check, and your page tells you who to make it out to and where to send it. Press &ldquo;I mailed my check&rdquo; so the
          reminders stop. When your captain gets it, it shows on your page with a receipt.
        </Q>
        <Q q="Why is my share this amount?">
          Your page has a &ldquo;Why this amount&rdquo; button under your share. It shows how the road splits costs, such as equally or by how far along the road you live,
          and the budget line by line.
        </Q>
        <Q q="I paid, but it says it's on its way.">
          Payments from a checking account take about 4 business days to arrive, cards about 2. Your page shows when it should be done. You don&apos;t need to pay again.
        </Q>
        <Q q="I can't pay it all at once.">Ask your road captain. Many roads can set up a payment plan on Road Fund, and your page will show each installment.</Q>
        <Q q="How do I stop the texts?">
          Reply STOP to any text, or open your page, choose Settings, and turn texts off. To get them again, reply START or turn them back on.
        </Q>
        <Q q="I lost my link.">Ask your road captain to send it again. Links don&apos;t expire.</Q>
        <Q q="The words are too small.">Open your page, choose Settings, and pick Larger under Text size. Your phone remembers it.</Q>
        <Q q="Who sees my information?">
          Your road captain sees your phone, email and payments. Other neighbors see road totals and spending, but not your contact information. Road Fund never sells it.
          Details are on the <Link href="/legal" className="font-semibold text-lake underline">terms and privacy</Link> page.
        </Q>
      </Section>

      <Section id="captains" title="For road captains">
        <Q q="How do I get started?">
          <Link href="/start" className="font-semibold text-lake underline">Set up your road</Link> in about 10 minutes: find the road on the map, list the homes, pick how to
          split costs, and send this year&apos;s bill. Your home page keeps a Getting started list until everything is done.
        </Q>
        <Q q="I got a new phone or computer.">
          Use <Link href="/signin" className="font-semibold text-lake underline">Captain sign-in</Link> with the email listed for your home, and we email you a one-time link. You
          can also open the captain link you copied from Settings.
        </Q>
        <Q q="A neighbor paid me by check.">
          Open Money, open the bill, tap the three dots next to their name, and choose Record a check or cash. They get a receipt by email if you have their address.
        </Q>
        <Q q="Will my neighbors think the texts are a scam?">
          The first time you send anything, Road Fund prints a short letter from you for each home saying a message is coming. Every text names you and the road and says
          how to check with you. Checks are always an option.
        </Q>
        <Q q="Someone hasn't paid.">
          Road Fund sends reminders 3 days before the due date and 7 and 21 days after, only to homes that still owe and haven&apos;t said a check is in the mail. On the
          Road Fund plan, tapping a late home also offers a friendly nudge, a dated letter to mail, a final letter, a payment plan and a small-claims packet. Most roads
          never get past the friendly nudge.
        </Q>
        <Q q="Where does the money go?">
          Online payments go through Stripe to the bank account you connect. If the road has its own account and tax ID (EIN), use that. Most informal roads don&apos;t, so
          the money goes to the captain&apos;s account, and every dollar shows on the record neighbors can see. Road Fund never holds it. You manage it under Money, then
          Bank account.
        </Q>
        <Q q="I'm stepping down as captain.">
          Go to Neighbors and choose Hand off. Pick the new captain. Make sure their email is on file so they can sign in on their own phone.
        </Q>
        <Q q="What does it cost?">
          Free for one bill a year. The Road Fund plan is {$(PLAN_SMALL)} a year for roads with up to 8 homes and {$(PLAN_LARGE)} for 9 to 30, usually paid from dues. Each
          online payment has a $1 fee plus the bank or card charge. For checking-account payments, you choose whether the neighbor or the road covers it. Card fees
          always come out of the road&apos;s side. Checks are free. See{" "}
          <Link href="/pricing" className="font-semibold text-lake underline">pricing</Link>.
        </Q>
        <Q q="Before the work starts, can everyone pay their part?">
          Yes. Start a vote with the cost. When it passes, choose &ldquo;Bill each home its share&rdquo;. Neighbors pay before the work, and you pay the contractor once the money
          is in, so nobody has to front it.
        </Q>
      </Section>

      <Section id="closing" title="For title companies, lenders and agents">
        <Q q="How do I get a Road Status Letter?">
          Get the road code from the seller, then request it on the <Link href="/closing#request" className="font-semibold text-lake underline">closing page</Link>. The fee
          is {$(LETTER_FEE)} and includes one free update within 30 days. The road captain is notified right away and the letter is emailed to you when it&apos;s issued.
        </Q>
        <Q q="How do I know a letter is genuine?">
          Every letter has a code at the top. Enter it on the <Link href="/verify" className="font-semibold text-lake underline">check a letter page</Link> to see the letter
          as issued. Checking is free.
        </Q>
      </Section>

      {(COMPANY.phone || COMPANY.email) && (
        <section className="mt-12 border-t-2 border-charcoal pt-6">
          <h2 className="text-[1.5rem] font-black">Still stuck?</h2>
          <p className="mt-2">
            {COMPANY.phone && (
              <>
                Call{" "}
                <a href={telHref(COMPANY.phone)} className="tnum font-semibold text-lake underline">
                  {phoneText(COMPANY.phone)}
                </a>
                {COMPANY.hours && ` (${COMPANY.hours})`}
                {COMPANY.email ? ", or email " : "."}
              </>
            )}
            {COMPANY.email && (
              <>
                {!COMPANY.phone && "Email "}
                <a href={`mailto:${COMPANY.email}`} className="font-semibold text-lake underline">
                  {COMPANY.email}
                </a>
                . A person answers, usually within one business day.
              </>
            )}
          </p>
        </section>
      )}
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-12 scroll-mt-24">
      <h2 className="text-[1.7rem] font-black">{title}</h2>
      <div className="mt-4 divide-y divide-line border-y border-line">{children}</div>
    </section>
  );
}

function Q({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div className="py-5">
      <h3 className="text-[1.15rem] font-bold">{q}</h3>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
