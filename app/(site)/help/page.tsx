import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Help",
  description: "Answers for neighbors paying road dues, road captains running the road, and title companies requesting letters.",
};

const SUPPORT = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="text-[2.4rem] font-black leading-tight">Help</h1>
      <p className="mt-3 text-[1.1rem] text-stone">Questions about your own road, like what it costs or when the plow comes, go to your road captain. Their name and number are on your road page.</p>
      <nav aria-label="Help sections" className="mt-6 flex flex-wrap gap-2">
        {[
          ["#neighbors", "I live on the road"],
          ["#captains", "I'm the road captain"],
          ["#closing", "I work in real estate"],
        ].map(([href, label]) => (
          <a key={href} href={href} className="rounded-xl border-2 border-line bg-white px-4 py-2.5 font-semibold hover:border-field">
            {label}
          </a>
        ))}
      </nav>

      <Section id="neighbors" title="For neighbors">
        <Q q="I got a text or email with a link. Is it real?">
          It comes from Road Fund on behalf of your road captain. The link opens a page with your road&apos;s name and your lot on it. Road Fund never asks for your bank
          password in a text or email. If something looks off, call your road captain before paying.
        </Q>
        <Q q="Do I need an app or a password?">No. Your link is your page. Keep the text or email, or bookmark the page. Anyone with your link can see your page, so don&apos;t post it publicly.</Q>
        <Q q="How do I pay?">
          Open your link and press Pay. Paying from your bank account has the lowest fee. You pick your bank and log in on Stripe&apos;s secure page, or type your account and
          routing numbers. Cards work too. You get a receipt by email if your captain has your email address.
        </Q>
        <Q q="Can I pay by check or cash instead?">
          Yes. Make the check out to the road (ask your captain for the exact name) and give it to the captain. They record it, and it shows on your page with a receipt.
        </Q>
        <Q q="Why is my share this amount?">
          Your page has a &ldquo;Why this amount&rdquo; button under your share. It shows how the road splits costs, such as equally or by how far along the road you live,
          and the budget line by line.
        </Q>
        <Q q="I paid, but it says clearing.">Bank payments take about 4 business days to arrive, cards about 2. Your page shows the date it should clear. You don&apos;t need to pay again.</Q>
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
          split costs, and send this year&apos;s dues. Your home page keeps a Getting started list until everything is done.
        </Q>
        <Q q="I got a new phone or computer.">
          Use <Link href="/signin" className="font-semibold text-lake underline">Captain sign-in</Link> with the email listed for your home, and we email you a one-time link. You
          can also open the captain link you copied from Settings.
        </Q>
        <Q q="A neighbor paid me by check.">Open Money, open the dues request, tap their row, and choose Record a check or cash. They get a receipt by email if you have their address.</Q>
        <Q q="Someone hasn't paid.">
          Road Fund sends reminders 3 days before the due date and 7 and 21 days after, only to homes that still owe. On the Plus plan, tapping a late home on the dues request
          also offers a friendly nudge, a formal notice, a final notice and a payment plan. Most roads never get past the friendly nudge.
        </Q>
        <Q q="Where does the money go?">
          Into an account in the road&apos;s name through Stripe, then to the road&apos;s bank. Road Fund never holds it. You see the account and payouts under Money, then Account.
        </Q>
        <Q q="I'm stepping down as captain.">
          Go to Neighbors and choose Hand off. Pick the new captain. Make sure their email is on file so they can sign in on their own phone.
        </Q>
        <Q q="What does it cost?">
          Starter is free for one dues request a year. Road Fund is $149 a year and Plus is $249 a year, usually paid from dues. Each online payment has a $1 fee plus
          processing, which the neighbor or the road covers depending on your setting. See <Link href="/pricing" className="font-semibold text-lake underline">pricing</Link>.
        </Q>
        <Q q="Do we need to file anything for taxes?">
          If the road pays a contractor who isn&apos;t a corporation $2,000 or more in a year, the road may need to send them a 1099-NEC. The Taxes page under Money tracks
          totals and W-9s. Ask a tax preparer about your road&apos;s situation.
        </Q>
      </Section>

      <Section id="closing" title="For title companies, lenders and agents">
        <Q q="How do I get a Road Status Letter?">
          Get the road code from the seller, then request it on the <Link href="/closing#request" className="font-semibold text-lake underline">closing page</Link>. The road
          captain is notified right away and the letter is emailed to you when it&apos;s issued.
        </Q>
        <Q q="How do I know a letter is genuine?">
          Every letter has a code at the top. Enter it on the <Link href="/verify" className="font-semibold text-lake underline">verify page</Link> to see the letter as issued.
        </Q>
      </Section>

      {SUPPORT && (
        <p className="mt-12 rounded-xl bg-paper-2 px-4 py-3">
          Still stuck? Email{" "}
          <a href={`mailto:${SUPPORT}`} className="font-semibold text-lake underline">
            {SUPPORT}
          </a>
          . A person answers, usually within one business day.
        </p>
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
