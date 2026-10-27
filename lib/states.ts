// State facts used in the guide, the agreement draft and Road Status Letters.
// Default-law list comes from the Road Fund research report (October 2026).
// It is not exhaustive. Every launch state needs a local attorney to confirm.

export interface DefaultLaw {
  citation: string;
  rule: string;
  source: string;
}

export const STATES: { code: string; name: string }[] = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"], ["CA", "California"],
  ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"], ["DC", "District of Columbia"], ["FL", "Florida"],
  ["GA", "Georgia"], ["HI", "Hawaii"], ["ID", "Idaho"], ["IL", "Illinois"], ["IN", "Indiana"],
  ["IA", "Iowa"], ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"],
  ["MD", "Maryland"], ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"], ["MS", "Mississippi"],
  ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"], ["NH", "New Hampshire"],
  ["NJ", "New Jersey"], ["NM", "New Mexico"], ["NY", "New York"], ["NC", "North Carolina"], ["ND", "North Dakota"],
  ["OH", "Ohio"], ["OK", "Oklahoma"], ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"],
  ["SC", "South Carolina"], ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"],
  ["VT", "Vermont"], ["VA", "Virginia"], ["WA", "Washington"], ["WV", "West Virginia"], ["WI", "Wisconsin"],
  ["WY", "Wyoming"],
].map(([code, name]) => ({ code, name }));

export const DEFAULT_LAWS: Record<string, DefaultLaw> = {
  PA: {
    citation: "Act 75 of 2021",
    rule: "Sets a minimum statutory maintenance agreement for all private-road properties. Realtors say it satisfies federally backed mortgage rules.",
    source: "Pennsylvania Association of Realtors",
  },
  VT: {
    citation: "19 V.S.A. § 2702",
    rule: "Everyone who benefits from the road contributes \"rateably\" and can sue to enforce.",
    source: "Vermont Statutes, Title 19, Chapter 27",
  },
  ME: {
    citation: "23 M.R.S. § 3121 and § 3101",
    rule: "Equal shares for residential owners if nothing else applies. Owners can form a statutory road association that can assess and collect.",
    source: "Maine Revised Statutes",
  },
  CA: {
    citation: "Civil Code § 845",
    rule: "Costs are shared in proportion to use. Small claims court is allowed for collection.",
    source: "California Civil Code",
  },
  OR: {
    citation: "ORS 105.175",
    rule: "Costs are split by use: trip frequency, vehicle size and weight.",
    source: "Oregon Revised Statutes",
  },
  CT: {
    citation: "Default easement-maintenance statute (effective Oct 1, 2014)",
    rule: "Sets maintenance duties when there is no agreement; cited in Fannie Mae discussions.",
    source: "Connecticut General Statutes",
  },
};

/** Remote online notarization: legal in 49 states + DC; California is the holdout. */
export const RON_UNAVAILABLE = new Set(["CA"]);

export function stateName(code: string): string {
  return STATES.find((s) => s.code === code)?.name ?? code;
}

export function defaultLaw(code: string): DefaultLaw | null {
  return DEFAULT_LAWS[code] ?? null;
}

export interface LoanRule {
  loan: string;
  needsAgreement: "yes" | "no" | "unclear" | "varies";
  answer: string;
  needs: string;
  source: string;
}

export const LOAN_RULES: LoanRule[] = [
  {
    loan: "Conventional (Fannie Mae)",
    needsAgreement: "yes",
    answer: "Yes, unless the state has a default road law.",
    needs:
      "A recorded agreement or covenant with each owner's share of costs, what happens if someone doesn't pay, and a term that binds future owners. Without one, the lender must indemnify Fannie Mae for road losses, which most lenders avoid.",
    source: "Fannie Mae Selling Guide excerpt",
  },
  {
    loan: "Conventional (Freddie Mac)",
    needsAgreement: "unclear",
    answer: "Sources conflict.",
    needs: "Confirm with 2 or 3 loan officers in your state.",
    source: "Towne Mortgage (2014); Realty ONE Group (2022)",
  },
  {
    loan: "FHA",
    needsAgreement: "no",
    answer: "No.",
    needs: "A permanent recorded easement (or HOA ownership) and an all-weather road.",
    source: "HUD Handbook 4000.1",
  },
  {
    loan: "VA",
    needsAgreement: "no",
    answer: "No, since Nov 25, 2022.",
    needs: "A recorded permanent easement or right-of-way.",
    source: "VA Circular 26-22-17",
  },
  {
    loan: "USDA Rural",
    needsAgreement: "no",
    answer: "No. \"Evidence of a road maintenance agreement is not required.\"",
    needs: "A recorded easement or HOA, plus an all-weather surface.",
    source: "USDA HB-1-3555, 12.7",
  },
  {
    loan: "Portfolio / local banks",
    needsAgreement: "varies",
    answer: "Varies.",
    needs: "Ask the lender. Some work around a missing agreement.",
    source: "Lender practice",
  },
];
