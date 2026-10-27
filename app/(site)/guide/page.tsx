import type { Metadata } from "next";
import { Check } from "lucide-react";
import { LoanTable } from "@/components/loan-table";
import { StateLookup } from "@/components/state-lookup";
import { ButtonLink, Callout } from "@/components/ui";
import { DEFAULT_LAWS, stateName } from "@/lib/states";

export const metadata: Metadata = {
  title: "Private road law guide: lenders, state laws, taxes",
  description:
    "Which mortgages require a private road maintenance agreement, which states have default road laws, what a lender-ready agreement must include, and the tax forms road groups file.",
};

const SOURCES: [string, string][] = [
  ["VA Circular 26-22-17, Private Roads and Shared Driveways (Nov 25, 2022)", "https://tenaco.com/wp-content/uploads/2022/11/VA-Circular-26-22-17-11-25-22.pdf"],
  ["HUD HOC Reference Guide, Private Roadways", "https://archives.hud.gov/offices/hsg/sfh/ref/sfhp1-15.cfm"],
  ["USDA HB-1-3555, 12.7 Street Access and Road Maintenance", "https://acesiq.atlassian.net/wiki/spaces/AI/pages/606899645/12.7+STREET+ACCESS+AND+ROAD+MAINTENANCE+7+CFR+3555.201+05+17+17"],
  ["Fannie Mae Selling Guide excerpt (NM Legislature handout)", "https://www.nmlegis.gov/handouts/CCJ%20113015%20Item%2015%20Homeowners%20Association%20December%202015%20(2).pdf"],
  ["LegalClarity, Private Road Maintenance Laws and Cost-Sharing Obligations (May 2026)", "https://legalclarity.org/private-road-maintenance-laws-and-cost-sharing-obligations/"],
  ["Vermont Statutes, 19 V.S.A. Chapter 27", "https://legislature.vermont.gov/statutes/fullchapter/19/027"],
  ["Maine Revised Statutes, 23 M.R.S. § 3121", "https://legislature.maine.gov/statutes/23/title23sec3121.html"],
  ["Pennsylvania Association of Realtors on Act 75 of 2021", "https://www.parealtors.org/blog/private-roadway-maintenance-agreements-legislation-signed-into-law/"],
  ["California Civil Code § 845", "https://law.justia.com/codes/california/code-civ/division-2/part-2/title-3/chapter-2/section-845"],
  ["Oregon ORS 105.175 summary", "https://www.deeds.com/forms/oregon/road-or-easement-maintenance-agreement-two-holders/"],
  ["Towne Mortgage, Private Road Requirements (2014)", "https://guidelines.townemortgage.com/Products_and_Guidelines/Helpful_Tips/Private_Road_Requirements.pdf"],
  ["Patriot Software, 1099 threshold $2,000 for 2026", "https://www.patriotsoftware.com/blog/accounting/1099-reporting-threshold/"],
  ["NotaryLive, remote online notary statistics 2026", "https://notarylive.com/blogs/ron-stats-2026-what-online-notary-service-data-shows/"],
  ["Maine DEP, A Guide to Forming Road Associations", "https://www.maine.gov/dep/land/watershed/road_assoc_guide_2020_edit.pdf"],
];

export default function GuidePage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <p className="sign-chip inline-block rounded-md px-3 py-1 text-[0.9rem] font-bold">Checked October 2026</p>
      <h1 className="mt-4 text-[2.4rem] font-black leading-tight">Private road law guide</h1>
      <p className="mt-4 text-[1.1rem] text-stone">
        What lenders actually require, which states fill the gap when there&apos;s no agreement, and the tax and insurance basics for a road group. Plain English, with
        sources.
      </p>
      <Callout tone="info" className="mt-6" title="Not legal advice">
        Laws and lender rules change. Have a real estate attorney in your state confirm anything you rely on.
      </Callout>

      <section className="mt-12">
        <h2 className="text-[1.7rem] font-black">The short answer</h2>
        <p className="mt-3 text-[1.05rem]">
          Mortgage rules don&apos;t force every private road to have a written agreement. FHA, VA and USDA loans no longer require one; they need a recorded easement and,
          for FHA and USDA, an all-weather road. The agreement matters most for <strong>conventional loans sold to Fannie Mae in states without a default road law</strong>,
          which covers most buyers with good credit and a down payment.
        </p>
        <p className="mt-3 text-[1.05rem]">
          So the honest pitch for an agreement is: it keeps every buyer&apos;s loan options open and protects your sale price. It isn&apos;t &ldquo;required by law.&rdquo;
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
        <h2 className="text-[1.7rem] font-black">States with a default road law</h2>
        <p className="mt-3 text-stone">
          In these states the law already says who pays when there&apos;s no agreement, and Fannie Mae accepts that in place of a written one. Other states may have
          similar laws.
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
      </section>

      <section className="mt-12">
        <h2 className="text-[1.7rem] font-black">What a lender-ready agreement must include</h2>
        <ul className="mt-5 space-y-3">
          {[
            ["Each owner's share of costs", "and how it's calculated: equal, by frontage, by distance or by use."],
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
          repairs and for upgrades like paving, a reserve fund, insurance, and how new lots join.
        </p>
      </section>

      <section className="mt-12 grid gap-5 md:grid-cols-2">
        <div className="rounded-[var(--radius-card)] border border-line bg-white p-6">
          <h2 className="text-[1.3rem] font-extrabold">Taxes</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-stone">
            <li>Most road groups don&apos;t qualify as tax-exempt 501(c)(4) organizations.</li>
            <li>A road association can often file IRS Form 1120-H to exclude members&apos; dues from taxable income. It needs an EIN.</li>
            <li>Paying a non-corporate contractor $2,000 or more in a year triggers a Form 1099-NEC. That threshold is new for payments made in 2026.</li>
          </ul>
        </div>
        <div className="rounded-[var(--radius-card)] border border-line bg-white p-6">
          <h2 className="text-[1.3rem] font-extrabold">Insurance and signing</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-stone">
            <li>Owners can be sued if someone is hurt by a known hazard on the road. Homeowner policies may not cover road-group roles, so budget for a liability policy.</li>
            <li>E-signatures are valid for most contracts. Recording usually needs a notary.</li>
            <li>Remote online notarization is legal in 49 states and DC. California is the holdout.</li>
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
