// Every price in one place: the marketing site, the app and Stripe all read from here.

import { money } from "./money.ts";
import type { Plan } from "./types.ts";

/** Roads with this many homes or fewer pay the small-road price. */
export const SMALL_ROAD_HOMES = 8;
export const PLAN_SMALL = 7_900;
export const PLAN_LARGE = 14_900;

/** Yearly price of the Road Fund plan for a road with this many homes. */
export function planPrice(homes: number): number {
  return homes <= SMALL_ROAD_HOMES ? PLAN_SMALL : PLAN_LARGE;
}

/** "about $15 a home a year" */
export function perHomeText(homes: number): string {
  const each = Math.round(planPrice(homes) / Math.max(homes, 1) / 100);
  return `about $${each} a home a year`;
}

export const PLAN_NAME: Record<Plan, string> = { starter: "Free", roadfund: "Road Fund" };

export function planLabel(plan: Plan, homes: number): string {
  return plan === "starter" ? "Free" : `Road Fund · ${money(planPrice(homes)).replace(".00", "")}/yr`;
}

/** Paid by the title company, lender or seller who asks for the letter. Includes one update within 30 days. */
export const LETTER_FEE = 15_000;
export const LETTER_VALID_DAYS = 30;

/** Concierge help with the agreement; attorney, notary and county fees are extra, at cost. */
export const AGREEMENT_PACKAGE = 24_900;
