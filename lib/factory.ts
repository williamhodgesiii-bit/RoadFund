import { roadCode, secretToken, uid } from "./ids.ts";
import type {
  AgreementTerms,
  BudgetLine,
  ExpenseCategory,
  Home,
  ISOTime,
  Road,
  Surface,
} from "./types.ts";

export const FEET_PER_MILE = 5280;

/** Public benchmark: about $5,650–$6,850 per mile per year to maintain a gravel road (City of Milton, GA). */
export const GRAVEL_BENCHMARK = { lowPerMile: 565_000, highPerMile: 685_000 };

export function benchmarkRange(lengthFt: number): { low: number; high: number; miles: number } {
  const miles = lengthFt / FEET_PER_MILE;
  return {
    miles,
    low: Math.round((GRAVEL_BENCHMARK.lowPerMile * miles) / 100) * 100,
    high: Math.round((GRAVEL_BENCHMARK.highPerMile * miles) / 100) * 100,
  };
}

export const CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  plowing: "Snow plowing",
  grading: "Grading",
  gravel: "Gravel",
  culverts: "Culverts",
  ditches: "Ditches and drainage",
  trees: "Tree and brush work",
  paving: "Paving and patching",
  insurance: "Insurance",
  legal: "Legal and recording",
  reserve: "Savings for big repairs",
  other: "Other",
};

const round100 = (cents: number) => Math.round(cents / 10_000) * 10_000;

/** Starting budget scaled to road length. Captains replace these with real quotes. */
export function suggestedBudget(lengthFt: number, surface: Surface, snow = true): BudgetLine[] {
  const len = Math.max(lengthFt, 300);
  if (surface === "paved" || surface === "chip-seal") {
    return [
      snow && { id: uid("bud"), label: "Snow plowing (season)", category: "plowing" as const, amount: round100(len * 60) },
      { id: uid("bud"), label: "Patching and crack sealing", category: "paving" as const, amount: round100(len * 35) },
      { id: uid("bud"), label: "Savings for repaving", category: "reserve" as const, amount: round100(len * 90) },
      { id: uid("bud"), label: "Road liability insurance", category: "insurance" as const, amount: 45_000 },
    ].filter(Boolean) as BudgetLine[];
  }
  return [
    snow && { id: uid("bud"), label: "Snow plowing (season)", category: "plowing" as const, amount: round100(len * 55) },
    { id: uid("bud"), label: "Grading", category: "grading" as const, amount: round100(len * 25) },
    { id: uid("bud"), label: "Gravel top-up", category: "gravel" as const, amount: round100(len * 20) },
    { id: uid("bud"), label: "Savings for big repairs", category: "reserve" as const, amount: round100(len * 18) },
  ].filter(Boolean) as BudgetLine[];
}

export function defaultTerms(roadName: string): AgreementTerms {
  return {
    repairThreshold: "majority",
    improvementThreshold: "two-thirds",
    emergencyLimit: 50_000,
    dueDays: 30,
    lateFee: 2_500,
    graceDays: 30,
    interestPct: 0,
    lienRights: true,
    reserveTarget: 500_000,
    insuranceRequired: true,
    insuranceMin: 100_000_000,
    newLots: "same-method",
    disputes: "mediation-then-court",
    meetingMonth: "April",
    roadDescription: `${roadName}, as shown on the recorded plat or survey for the lots listed in this agreement`,
    includesDrainage: true,
    includesSnow: true,
  };
}

export function newHome(partial: Partial<Home> & { label: string }, at: ISOTime = new Date().toISOString()): Home {
  return {
    id: uid("home"),
    address: "",
    owners: "",
    phone: "",
    email: "",
    smsOptIn: false,
    smsOptInAt: null,
    emailOptIn: false,
    frontageFt: null,
    distanceFt: null,
    customPct: null,
    vacant: false,
    position: null,
    token: secretToken(),
    notes: "",
    joinedAt: at,
    ...partial,
  };
}

export interface NewRoadInput {
  name: string;
  state: string;
  county: string;
  town: string;
  surface: Surface;
  lengthFt: number;
  homes: Home[];
  captainHomeId: string | null;
}

export function createRoad(input: NewRoadInput, at: ISOTime = new Date().toISOString()): Road {
  return {
    schema: 1,
    id: uid("road"),
    code: roadCode(),
    name: input.name.trim(),
    state: input.state,
    county: input.county.trim(),
    town: input.town.trim(),
    createdAt: at,
    updatedAt: at,
    surface: input.surface,
    lengthFt: input.lengthFt,
    path: [],
    center: null,
    captainHomeId: input.captainHomeId,
    plan: "starter",
    split: { method: "equal", vacantWeight: 1, basePct: 0 },
    budget: suggestedBudget(input.lengthFt, input.surface),
    account: { status: "none", bankName: "", last4: "", connectedAt: null, openingBalance: 0, openingDate: null },
    settings: {
      payerCoversFees: true,
      showPaidNames: false,
      reminderDays: [-3, 7, 21],
    },
    homes: input.homes,
    requests: [],
    payments: [],
    expenses: [],
    contractors: [],
    work: [],
    votes: [],
    docs: [],
    agreement: {
      terms: defaultTerms(input.name.trim()),
      step: "draft",
      version: 1,
      updatedAt: at,
      packagePurchasedAt: null,
      review: null,
      signatures: [],
      notary: null,
      recording: null,
    },
    letters: [],
    letterRequests: [],
    reserve: { setAside: 0 },
    plans: [],
    notices: [],
    messages: [],
    activity: [{ id: uid("act"), at, actor: "Road Fund", text: `Road set up: ${input.name.trim()}` }],
  };
}
