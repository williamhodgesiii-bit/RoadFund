import type { Metadata } from "next";
import { Check } from "lucide-react";
import { LoanTable } from "@/components/loan-table";
import { StateLookup } from "@/components/state-lookup";
import { ButtonLink, Callout } from "@/components/ui";
import { DEFAULT_LAWS, stateName } from "@/lib/states";

export const metadata: Metadata = {
  title: "Private road law guide: lenders and state laws",
  description:
    "Which home loans ask for a private road maintenance agreement, which states have road-sharing laws, and what a good agreement includes. Plain English, with sources.",
};

const SOURCES: [string, string][] = [
  ["Fannie Mae Selling Guide (see B4-1.3-04 on private roads)", "https://selling-guide.fanniemae.com/"],
  ["HUD Single Family Housing Policy Handbook 4000.1", "https://www.hud.gov/program_offices/housing/sfh/handbook_4000-1"],
  ["VA Circular 26-22-17, Private Roads and Shared Driveways (Nov 25, 2022)", "https://www.benefits.va.gov/HOMELOANS/documents/circulars/26_22_17.pdf"],
  ["USDA Rural Development handbooks, HB-1-3555 chapter 12", "https://www.rd.usda.gov/resources/directives/handbooks"],
  ["California Civil Code § 845", "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=845"],
  ["Maine Revised Statutes, 23 M.R.S. § 3101 and § 3121", "https://legislature.maine.gov/statutes/23/title23sec3101.html"],
  ["Vermont Statutes, 19 V.S.A. § 2702", "https://legislature.vermont.gov/statutes/section/19/027/02702"],
  ["Oregon Revised Statutes 105.170 to 105.185", "https://www.oregonlegislature.gov/bills_laws/ors/ors105.html"],
  ["New Hampshire RSA 231:81-a", "https://www.gencourt.state.nh.us/rsa/html/XX/231/231-81-a.htm"],
  ["Wisconsin Statutes § 710.20", "https://docs.legis.wisconsin.gov/statutes/statutes/710/20"],
  ["Pennsylvania Association of Realtors on Act 75 of 2021", "https://www.parealtors.org/blog/private-roadway-maintenance-agreements-legislation-signed-into-law/"],
  ["Maine DEP, A Guide to Forming Road Associations (2020)", "https://www.maine.gov/dep/land/watershed/road_assoc_guide_2020_edit.pdf"],
];

export default function GuidePage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <p className="sign-chip inline-block rounded-md px-3 py-1 text-[0.9rem] font-bold">Checked October 2026</p>
      <h1 className="mt-4 text-[2.4rem] font-black leading-tight">Private road law guide</h1>
      <p className="mt-4 text-[1.1rem] text-stone">
        What lenders actually ask for, which states have a road-sharing law, and what a good road agreement says. Plain English, with links to the rules.
      </p>
      <Callout tone="info" className="mt-6" title="Not legal advice">
        Laws and lender rules change. Have a real estate attorney in your state confirm anything you rely on.
      </Callout>

      <section className="mt-12">
        <h2 className="text-[1.7rem] font-black">The short answer</h2>
        <p className="mt-3 text-[1.05rem]">
          Most home loans don&apos;t require a written road agreement. FHA and USDA loans need a recorded easement and a road a car can use all year. VA dropped its
          agreement rule in 2022, though some VA pages still show the old wording. The agreement matters most for{" "}
          <strong>conventional loans sold to Fannie Mae in states without a road-sharing law</strong>, and for any lender with its own stricter rule.
        </p>
        <p className="mt-3 text-[1.05rem]">
          The bigger reason for an agreement is closer to home: without one, it&apos;s hard to make a neighbor pay their share. With one, it&apos;s a written promise that
          binds future owners too.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-[1.7rem] font-black">What each loan type requires</h2>
        <div className="mt-5">
          <LoanTable />
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-[1.7rem] font-black">Look up your state</h2>
        <div className="mt-5">
          <StateLookup />
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-[1.7rem] font-black">States with a road-sharing law</h2>
        <p className="mt-3 text-stone">
          In these states the law already says owners share the cost when there&apos;s no agreement, and Fannie Mae accepts that in place of a written one. None of them gives
          neighbors an easy way to collect: it still takes a written request, and sometimes small claims court.
        </p>
        <div className="mt-5 overflow-x-auto rounded-[var(--radius-card)] border border-line bg-white" tabIndex={0} role="region" aria-label="State road laws">
          <table className="w-full min-w-[560px] text-left">
            <thead className="bg-paper">
              <tr>
                <th className="px-4 py-3 font-semibold">State</th>
                <th className="px-4 py-3 font-semibold">Law</th>
                <th className="px-4 py-3 font-semibold">Default rule</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(DEFAULT_LAWS).map(([code, law]) => (
                <tr key={code} className="border-t border-line align-top">
                  <th scope="row" className="px-4 py-3 font-bold">
                    {stateName(code)}
                  </th>
                  <td className="px-4 py-3">{law.citation}</td>
                  <td className="px-4 py-3 text-stone">{law.rule}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-stone">
          <strong>Michigan</strong> has no default duty, but owners can petition the township for a special assessment district that collects with property taxes. We found
          no road-sharing law in Washington, Virginia, West Virginia, Idaho, Montana, North Carolina, Texas, New York or Massachusetts. Many other states haven&apos;t been
          checked yet.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-[1.7rem] font-black">What a lender-ready agreement must include</h2>
        <ul className="mt-5 space-y-3">
          {[
            ["Each owner's share of costs", "and how it's worked out: equal shares, by how much road each home drives, or another method."],
            ["What happens when someone doesn't pay", "late fees, lien rights where allowed, and the right to go to court."],
            ["A term that runs with the land", "so it binds future owners, with no end date."],
            ["Recording with the county", "so it shows up in title searches. An unrecorded agreement lets a new owner claim they never agreed."],
          ].map(([a, b]) => (
            <li key={a} className="flex gap-3">
              <Check className="mt-1 h-5 w-5 shrink-0 text-pine" aria-hidden />
              <p>
                <strong>{a}</strong>, {b}
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-stone">
          Good practice beyond the minimum: a legal description tied to a recorded plat or survey, drainage and culverts named as shared, separate voting rules for
          repairs and for upgrades like paving, money set aside for big repairs, insurance, and how new lots join.
        </p>
      </section>

      <section className="mt-12 grid gap-5 md:grid-cols-2">
        <div className="rounded-[var(--radius-card)] border border-line bg-white p-6">
          <h2 className="text-[1.3rem] font-extrabold">Bank account and taxes</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-stone">
            <li>Most informal roads don&apos;t have their own tax ID (EIN), so road money often sits in the captain&apos;s account. That&apos;s fine if every dollar is on a record neighbors can see.</li>
            <li>A road that forms an association or wants its own bank account gets a free EIN from the IRS first.</li>
            <li>If the road pays a contractor who isn&apos;t a corporation $2,000 or more in a year, ask a tax preparer whether to send a 1099-NEC.</li>
          </ul>
        </div>
        <div className="rounded-[var(--radius-card)] border border-line bg-white p-6">
          <h2 className="text-[1.3rem] font-extrabold">Insurance and signing</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-stone">
            <li>Owners can be sued if someone is hurt by a known hazard on the road. Homeowner policies may not cover road-group roles, so ask an insurance agent.</li>
            <li>Signing on a phone is valid for most contracts. Recording with the county usually needs a notary.</li>
            <li>Most states allow notarizing by video call. California doesn&apos;t.</li>
          </ul>
        </div>
      </section>

      <div className="mt-12 flex flex-col gap-3 rounded-[var(--radius-card)] bg-pine p-6 text-white sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[1.15rem] font-bold">Draft your road&apos;s agreement from its own data, then have an attorney review it.</p>
        <ButtonLink href="/start" variant="warn">
          Set up your road
        </ButtonLink>
      </div>

      <section className="mt-12">
        <h2 className="text-[1.3rem] font-extrabold">Sources</h2>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-[0.92rem] text-stone">
          {SOURCES.map(([label, url]) => (
            <li key={url}>
              <a href={url} className="text-lake underline" rel="noopener noreferrer" target="_blank">
                {label}
              </a>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
