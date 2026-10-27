import { addDays, isoDate } from "./dates.ts";
import { letterCode, uid } from "./ids.ts";
import { defaultLaw } from "./states.ts";
import {
  accountSummary,
  agreementSigned,
  captainHome,
  currentRequest,
  displayName,
  lastAnnualShare,
  requestProgress,
  upcomingWork,
} from "./selectors.ts";
import type { LetterSnapshot, Requester, Road, StatusLetter } from "./types.ts";

export const LETTER_FEE = 7_500;
export const LETTER_VALID_DAYS = 30;

export function buildSnapshot(road: Road, homeId: string, now: Date): LetterSnapshot {
  const home = road.homes.find((h) => h.id === homeId);
  if (!home) throw new Error("Property not found");
  const acct = accountSummary(road, now);
  const cap = captainHome(road);
  const a = road.agreement;
  const signed = agreementSigned(road);

  // Dues for this property across every open request, plus the latest request if all are closed.
  const relevant = road.requests.filter((r) => r.status === "open");
  const current = currentRequest(road);
  if (current && !relevant.includes(current)) relevant.push(current);
  let billed = 0;
  let paid = 0;
  let lastPaidAt: string | null = null;
  let onPlan = false;
  let dueDate: string | null = null;
  for (const r of relevant) {
    const line = requestProgress(road, r, now).lines.find((l) => l.home.id === homeId);
    if (!line) continue;
    billed += line.due;
    paid += Math.min(line.paid, line.due);
    if (line.lastPaidAt && (!lastPaidAt || line.lastPaidAt > lastPaidAt)) lastPaidAt = line.lastPaidAt;
    if (line.plan) onPlan = true;
    if (line.outstanding > 0 && (!dueDate || r.dueDate < dueDate)) dueDate = r.dueDate;
  }

  const year = now.getFullYear();
  const yearRequests = road.requests.filter((r) => r.createdAt.startsWith(String(year)));
  let roadBilled = 0;
  let roadCollected = 0;
  const paidHomes = new Set<string>();
  const billedHomes = new Set<string>();
  for (const r of yearRequests) {
    const prog = requestProgress(road, r, now);
    roadBilled += prog.billed;
    roadCollected += prog.collected;
    for (const l of prog.lines) {
      if (l.due > 0) billedHomes.add(l.home.id);
      if (l.outstanding === 0 && l.due > 0) paidHomes.add(l.home.id);
    }
  }
  // A home counts as paid only if it is paid on every request this year.
  for (const r of yearRequests) {
    for (const l of requestProgress(road, r, now).lines) if (l.outstanding > 0) paidHomes.delete(l.home.id);
  }

  const share = lastAnnualShare(road, homeId);
  const law = defaultLaw(road.state);

  return {
    roadName: road.name,
    roadCode: road.code,
    county: road.county,
    state: road.state,
    lengthFt: road.lengthFt,
    surface: road.surface,
    homesCount: road.homes.length,
    property: { label: home.label, address: home.address, owners: home.owners },
    agreement: {
      status: a.step === "recorded" ? "recorded" : signed === road.homes.length && road.homes.length > 0 && a.step !== "draft" ? "signed" : a.step === "draft" && !a.review ? "none" : "in-progress",
      step: a.step,
      signed,
      total: road.homes.length,
      recording: a.recording,
      defaultLaw: law ? `${law.citation}: ${law.rule}` : null,
    },
    account: { balance: acct.balance, pending: acct.pending, reserve: acct.reserve },
    propertyDues: {
      title: relevant.map((r) => r.title).join(", ") || null,
      billed,
      paid,
      outstanding: Math.max(0, billed - paid),
      lastPaidAt,
      onPlan,
      dueDate,
    },
    annualShare: share?.amount ?? null,
    sharePct: share?.pct ?? null,
    shareMethod: road.split.method,
    roadDues: { year, billed: roadBilled, collected: roadCollected, homesPaid: paidHomes.size, homesBilled: billedHomes.size },
    upcoming: upcomingWork(road, now),
    insuranceOnFile: road.docs.some((d) => d.kind === "insurance"),
    captain: { name: displayName(cap), phone: cap?.phone ?? "", email: cap?.email ?? "" },
  };
}

export function newLetter(
  road: Road,
  input: { homeId: string; requester: Requester; closingDate: string | null; paidBy: StatusLetter["paidBy"]; requestId: string | null },
  now: Date,
): StatusLetter {
  return {
    id: uid("ltr"),
    code: letterCode(),
    createdAt: now.toISOString(),
    validUntil: addDays(isoDate(now), LETTER_VALID_DAYS),
    homeId: input.homeId,
    requester: input.requester,
    closingDate: input.closingDate,
    fee: LETTER_FEE,
    paidBy: input.paidBy,
    requestId: input.requestId,
    snapshot: buildSnapshot(road, input.homeId, now),
  };
}

export const AGREEMENT_STATUS_TEXT: Record<LetterSnapshot["agreement"]["status"], string> = {
  recorded: "Recorded maintenance agreement on file",
  signed: "Signed by all owners; recording pending",
  "in-progress": "Agreement in progress, not yet signed by all owners",
  none: "No written maintenance agreement on file",
};

/** Public view for /verify. Leaves out amounts owed by other homes and contact details. */
export interface PublicLetter {
  code: string;
  createdAt: string;
  validUntil: string;
  roadName: string;
  county: string;
  state: string;
  property: string;
  requester: string;
  agreementStatus: string;
  outstanding: number;
  balance: number;
}

export function publicLetter(l: StatusLetter): PublicLetter {
  return {
    code: l.code,
    createdAt: l.createdAt,
    validUntil: l.validUntil,
    roadName: l.snapshot.roadName,
    county: l.snapshot.county,
    state: l.snapshot.state,
    property: l.snapshot.property.address || l.snapshot.property.label,
    requester: l.requester.company || l.requester.name,
    agreementStatus: AGREEMENT_STATUS_TEXT[l.snapshot.agreement.status],
    outstanding: l.snapshot.propertyDues.outstanding,
    balance: l.snapshot.account.balance,
  };
}
