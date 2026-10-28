// State facts used in the guide, the agreement draft and Road Status Letters.
// Default-law list comes from the Road Fund research report (October 2026).
// It is not exhaustive. Every launch state needs a local attorney to confirm.

export interface DefaultLaw {
  citation: string;
  rule: string;
  source: string;
  /** The split that matches the law's own formula, used as the starting point in setup. */
  split: "equal" | "segment";
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
  CA: {
    citation: "Civil Code § 845",
    rule: "Owners who use the road share the cost in proportion to their use. Small claims court can be used to collect.",
    source: "California Civil Code",
    split: "segment",
  },
  CT: {
    citation: "Conn. Gen. Stat. § 47-42f (2014)",
    rule: "When there's no agreement, owners who benefit from the right-of-way share upkeep in proportion to the benefit.",
    source: "Connecticut General Statutes",
    split: "segment",
  },
  ME: {
    citation: "23 M.R.S. § 3121 (amended 2021) and § 3101",
    rule: "Owners share equally where the road is their main access, unless something else applies. Owners can also form a road association that votes on and collects shares.",
    source: "Maine Revised Statutes",
    split: "equal",
  },
  MO: {
    citation: "RSMo 228.369",
    rule: "A court can order owners to share upkeep and decide each owner's part.",
    source: "Missouri Revised Statutes",
    split: "equal",
  },
  NH: {
    citation: "RSA 231:81-a (2019)",
    rule: "Owners who use a private road share its upkeep equitably when there's no written agreement.",
    source: "New Hampshire Revised Statutes",
    split: "equal",
  },
  OR: {
    citation: "ORS 105.170 to 105.185",
    rule: "Costs are split by use: how often each owner drives the road and how heavy the vehicles are.",
    source: "Oregon Revised Statutes",
    split: "segment",
  },
  PA: {
    citation: "Act 75 of 2021",
    rule: "Owners on a private road share maintenance in proportion to use when there's no agreement. Realtors say it satisfies federally backed mortgage rules.",
    source: "Pennsylvania General Assembly",
    split: "segment",
  },
  VT: {
    citation: "19 V.S.A. § 2702",
    rule: "Everyone who benefits from the road pays a fair share (\"rateably\") and can go to court to enforce it.",
    source: "Vermont Statutes, Title 19",
    split: "segment",
  },
  WI: {
    citation: "Wis. Stat. § 710.20 (2021)",
    rule: "Owners share upkeep based on how much and how heavily each one uses the road.",
    source: "Wisconsin Statutes",
    split: "segment",
  },
};

/** States with a public route instead of a default duty. Shown in the guide and setup. */
export const STATE_NOTES: Record<string, string> = {
  MI: "Michigan has no default duty to share costs. Owners can petition the township for a special assessment district, which collects with property taxes.",
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
    answer: "Usually, unless the state has a road-sharing law.",
    needs:
      "An agreement (best if recorded) with each owner's share of costs, what happens if someone doesn't pay, and a term that binds future owners. Without one, the lender can still sell the loan but must cover Fannie Mae's losses, which many lenders won't do.",
    source: "Fannie Mae Selling Guide, B4-1.3-04",
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
    needs: "A permanent recorded easement (or HOA ownership) and a road a car can use all year.",
    source: "HUD Handbook 4000.1",
  },
  {
    loan: "VA",
    needsAgreement: "unclear",
    answer: "Probably not. Sources disagree.",
    needs: "A recorded permanent easement. A 2022 VA circular dropped the agreement rule, but some current VA pages still show the older wording. Ask the lender.",
    source: "VA Circular 26-22-17; VA Lender's Handbook, chapter 12",
  },
  {
    loan: "USDA Rural",
    needsAgreement: "no",
    answer: "No.",
    needs: "A recorded easement or HOA ownership, plus a road a car can use all year.",
    source: "USDA HB-1-3555, chapter 12",
  },
  {
    loan: "Portfolio / local banks",
    needsAgreement: "varies",
    answer: "Varies.",
    needs: "Ask the lender. Some work around a missing agreement.",
    source: "Lender practice",
  },
];
