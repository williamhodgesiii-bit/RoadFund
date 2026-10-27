// Builds the road maintenance agreement draft from the road's own data.
// It fills a fixed template; it never invents clauses. Each section carries a
// plain-English summary so neighbors know what they are signing.

import { money } from "./money.ts";
import { METHOD_INFO, usesBase } from "./split.ts";
import { defaultLaw, stateName } from "./states.ts";
import type { AgreementTerms, SplitSettings } from "./types.ts";

export interface AgreementInput {
  roadName: string;
  county: string;
  state: string;
  lengthFt: number;
  split: SplitSettings;
  terms: AgreementTerms;
  version: number;
  homes: { id: string; label: string; address: string; owners: string; sharePct: number | null }[];
}

export interface AgreementSection {
  id: string;
  title: string;
  summary: string;
  body: string[];
}

const pctText = (n: number | null) => (n === null ? "per the method above" : `${(Math.round(n * 100) / 100).toString()}%`);

export function buildAgreement(input: AgreementInput): AgreementSection[] {
  const t = input.terms;
  const law = defaultLaw(input.state);
  const st = stateName(input.state);
  const method = METHOD_INFO[input.split.method];
  const scope = [
    "grading, crowning and resurfacing",
    "adding gravel or other surface material",
    t.includesDrainage ? "ditches, culverts and other drainage that serves the road" : null,
    t.includesSnow ? "snow and ice removal" : null,
    "trimming trees and brush that block the road",
    "signs and other items needed for safe passage",
  ].filter(Boolean) as string[];

  const sections: AgreementSection[] = [
    {
      id: "parties",
      title: "1. Parties and property",
      summary: "Who this agreement covers and which road.",
      body: [
        `This Road Maintenance Agreement is made by the owners of the lots listed in Schedule A (each an "Owner"), all of which use the private road known as ${input.roadName} in ${input.county} County, ${st} (the "Road").`,
        `The Road is described as: ${t.roadDescription}. It is about ${input.lengthFt.toLocaleString("en-US")} feet long.`,
      ],
    },
    {
      id: "purpose",
      title: "2. What is maintained",
      summary: "What the shared money pays for.",
      body: [
        `The Owners will share the cost to keep the Road safe and passable year-round for ordinary vehicles and emergency vehicles. Maintenance includes ${scope.join(", ")}.`,
        "Each Owner pays for their own driveway from the Road to their lot.",
      ],
    },
    {
      id: "shares",
      title: "3. How costs are shared",
      summary: `${method.name}: ${method.short}`,
      body: [
        `Costs are shared by this method: ${method.name}. ${method.long}`,
        usesBase(input.split)
          ? `Before that method applies, ${input.split.basePct}% of each year's costs is split evenly among all lots as a base share.`
          : null,
        input.split.vacantWeight < 1
          ? `Lots without a home pay ${Math.round(input.split.vacantWeight * 100)}% of a full share until a home is built.`
          : "Lots without a home pay a full share.",
        "Current shares are listed in Schedule A. When a lot is split or a new lot gains access, shares are recalculated by the same method.",
      ].filter((x): x is string => !!x),
    },
    {
      id: "decisions",
      title: "4. Budgets and decisions",
      summary: `Routine repairs: ${t.repairThreshold === "majority" ? "majority" : "two-thirds"} vote. Upgrades like paving: ${t.improvementThreshold === "unanimous" ? "everyone" : "two-thirds"}.`,
      body: [
        `The Owners will meet once a year, in ${t.meetingMonth}, to approve a budget. Each lot has one vote.`,
        `Routine maintenance and repairs need approval from ${t.repairThreshold === "majority" ? "more than half of all lots" : "two-thirds of all lots"}.`,
        `Improvements that change the Road, such as paving, widening or adding lighting, need approval from ${t.improvementThreshold === "unanimous" ? "every lot" : "two-thirds of all lots"}.`,
        `In an emergency that blocks access or threatens safety, the Road Manager may spend up to ${money(t.emergencyLimit)} without a vote and must report it to all Owners within 7 days.`,
        "Votes may be cast in person, by phone, or by a written or electronic ballot. Results are kept with the Road's records.",
      ],
    },
    {
      id: "reserve",
      title: "5. Savings for big repairs",
      summary: `The road saves toward ${money(t.reserveTarget)} for major work.`,
      body: [
        `Part of each year's budget may go into a reserve for major work such as regrading, new gravel or culvert replacement. The target reserve is ${money(t.reserveTarget)}.`,
        "Reserve money is spent only on the Road and only with the approvals in Section 4.",
      ],
    },
    {
      id: "payments",
      title: "6. Paying and late payments",
      summary: `Pay within ${t.dueDays} days. Late fee ${money(t.lateFee)} after ${t.graceDays} more days.${t.lienRights ? " Unpaid shares can become a lien." : ""}`,
      body: [
        `Each Owner pays their share within ${t.dueDays} days of a written or electronic request.`,
        `If a share is unpaid ${t.graceDays} days after it is due, a late fee of ${money(t.lateFee)} is added${t.interestPct > 0 ? `, and interest of ${t.interestPct}% per year runs on the unpaid amount` : ""}.`,
        t.lienRights
          ? `To the extent allowed by ${st} law, an unpaid share, late fees and reasonable collection costs become a lien on the Owner's lot that may be recorded and enforced.`
          : "Unpaid shares, late fees and reasonable collection costs may be collected in court.",
        "The other Owners may collect an unpaid share in small claims court or any other court with jurisdiction.",
      ],
    },
    {
      id: "insurance",
      title: "7. Insurance",
      summary: t.insuranceRequired ? `The road carries ${money(t.insuranceMin)} liability coverage.` : "Insurance is optional.",
      body: t.insuranceRequired
        ? [
            `The Owners will keep general liability insurance for the Road of at least ${money(t.insuranceMin)} per occurrence, paid as a shared cost.`,
            "Each Owner should confirm with their own insurer how their homeowner policy covers the shared road.",
          ]
        : ["The Owners may buy liability insurance for the Road as a shared cost by the vote in Section 4."],
    },
    {
      id: "manager",
      title: "8. Road Manager and records",
      summary: "One neighbor manages the money and keeps records anyone can see.",
      body: [
        "The Owners choose a Road Manager by majority vote. The Road Manager collects shares, pays approved bills, keeps receipts and records of all money in and out, and gives every Owner a yearly report.",
        "Road money is kept in an account in the Road's name, separate from any Owner's personal money.",
        "Any Owner may see the Road's records at any time. The Road Manager may hand off the role to another Owner at any time.",
      ],
    },
    {
      id: "new-lots",
      title: "9. New lots and new owners",
      summary: t.newLots === "same-method" ? "New lots join on the same formula." : "New lots join by vote.",
      body: [
        t.newLots === "same-method"
          ? "A new lot that gains access to the Road joins this agreement and shares costs by the same method."
          : "A new lot that gains access to the Road joins this agreement on terms approved under Section 4.",
        "When a lot is sold, the seller's unpaid shares are due at closing. The buyer takes the lot subject to this agreement.",
      ],
    },
    {
      id: "disputes",
      title: "10. Disagreements",
      summary: t.disputes === "mediation-then-court" ? "Try mediation first, then court." : "Small claims court for money disputes.",
      body:
        t.disputes === "mediation-then-court"
          ? [
              "Owners will first try to settle a disagreement by talking it through at a meeting. If that fails, they will try mediation with a neutral mediator before going to court, except to collect an unpaid share.",
            ]
          : ["Disputes about money owed may be brought in small claims court. Other disputes may be brought in any court with jurisdiction."],
    },
    {
      id: "land",
      title: "11. Runs with the land",
      summary: "Binds future owners. Has no end date.",
      body: [
        "This agreement is a covenant that runs with the land. It binds and benefits each Owner and their heirs, buyers, lenders and anyone else who later owns a lot listed in Schedule A.",
        "This agreement has no end date. It continues until changed under Section 13.",
      ],
    },
    {
      id: "recording",
      title: "12. Recording",
      summary: `Recorded with ${input.county} County so it shows up in title searches.`,
      body: [
        `This agreement will be recorded in the land records of ${input.county} County, ${st}, against each lot in Schedule A, so that it appears in title searches.`,
      ],
    },
    {
      id: "amendments",
      title: "13. Changes",
      summary: "Changes need a signed, recorded amendment.",
      body: [
        "This agreement may be changed only by a written amendment signed by Owners of at least two-thirds of the lots and recorded in the same land records. A change to how costs are shared also needs the consent of each Owner whose share goes up.",
        "If any part of this agreement is found unenforceable, the rest stays in effect.",
      ],
    },
  ];

  if (law) {
    sections.push({
      id: "state-law",
      title: `${sections.length + 1}. ${st} law`,
      summary: `${st} has a default road law (${law.citation}). This agreement replaces the default where the law allows.`,
      body: [
        `${st} has a default private road law (${law.citation}): ${law.rule} Where the law allows, this agreement sets the Owners' duties in place of the default rule.`,
      ],
    });
  }

  sections.push({
    id: "schedule-a",
    title: "Schedule A: Lots and shares",
    summary: "Every lot on the road and its share.",
    body: input.homes.map(
      (h, i) => `${i + 1}. ${h.label}${h.address ? `, ${h.address}` : ""}${h.owners ? `. Owner(s): ${h.owners}` : ""}. Share: ${pctText(h.sharePct)}.`,
    ),
  });

  return sections;
}

export const AGREEMENT_DISCLAIMER =
  "Draft for attorney review. Road Fund is not a law firm and this is not legal advice. A licensed attorney in your state should review this agreement before anyone signs.";

/** Plain retrieval over the agreement for "Ask the agreement" when AI is off. */
export function searchAgreement(sections: AgreementSection[], question: string): { section: AgreementSection; score: number }[] {
  const stop = new Set(["the", "a", "an", "to", "of", "and", "or", "is", "are", "can", "we", "i", "my", "our", "do", "does", "if", "in", "on", "for", "what", "who", "how", "when", "it", "be", "this", "that", "with", "without", "have", "has"]);
  const synonyms: Record<string, string[]> = {
    pave: ["paving", "improvements", "upgrades"],
    paving: ["improvements", "upgrades"],
    late: ["unpaid", "late", "fee", "lien"],
    pay: ["payments", "share", "shares"],
    vote: ["approval", "votes", "decisions"],
    sell: ["sold", "closing", "buyer"],
    plow: ["snow"],
    snow: ["snow", "ice"],
    insurance: ["insurance", "liability"],
    fight: ["disagreement", "mediation", "court"],
    dispute: ["disagreement", "mediation", "court"],
    split: ["shares", "method"],
    change: ["amendment", "changes"],
  };
  const words = question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stop.has(w));
  const terms = new Set(words.flatMap((w) => [w, ...(synonyms[w] ?? [])]));
  return sections
    .map((section) => {
      const hay = `${section.title} ${section.summary} ${section.body.join(" ")}`.toLowerCase();
      let score = 0;
      for (const t of terms) {
        const stem = t.length > 5 ? t.slice(0, -2) : t;
        if (hay.includes(stem)) score += section.title.toLowerCase().includes(stem) ? 3 : 1;
      }
      return { section, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);
}

export function agreementPlainText(input: AgreementInput, sections = buildAgreement(input)): string {
  const lines = [
    `ROAD MAINTENANCE AGREEMENT: ${input.roadName.toUpperCase()}`,
    `${input.county} County, ${stateName(input.state)} · Version ${input.version}`,
    "",
    AGREEMENT_DISCLAIMER,
    "",
  ];
  for (const s of sections) {
    lines.push(s.title, ...s.body, "");
  }
  return lines.join("\n");
}
