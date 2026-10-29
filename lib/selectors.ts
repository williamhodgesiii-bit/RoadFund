// Read-only views over a road document. Status like "processing" or "late"
// is derived from timestamps at read time, so nothing needs a background job.

import { thresholdCount } from "./commands.ts";
import { addDays, daysBetween, endOfDayUS, fmtDate, isoDate, yearOf } from "./dates.ts";
import { CATEGORY_LABEL } from "./factory.ts";
import { money } from "./money.ts";
import type {
  DuesRequest,
  Expense,
  Home,
  ISODate,
  ISOTime,
  Payment,
  PaymentPlan,
  Road,
  Vote,
} from "./types.ts";


export function homeMap(road: Road): Map<string, Home> {
  return new Map(road.homes.map((h) => [h.id, h]));
}

export function captainHome(road: Road): Home | null {
  return road.homes.find((h) => h.id === road.captainHomeId) ?? null;
}

export function displayName(h: Home | null | undefined): string {
  if (!h) return "Unknown";
  return h.owners || h.label;
}

export function isCleared(p: Payment, now: Date): boolean {
  return new Date(p.clearsAt).getTime() <= now.getTime();
}

export interface AccountSummary {
  /** Everything received minus everything paid out. */
  balance: number;
  /** Balance minus money still settling. */
  available: number;
  pending: number;
  reserve: number;
}

export function accountSummary(road: Road, now: Date): AccountSummary {
  let incoming = 0;
  let pending = 0;
  for (const p of road.payments) {
    if (p.status !== "ok") continue;
    incoming += p.roadNet;
    if (!isCleared(p, now)) pending += p.roadNet;
  }
  const out = road.expenses.filter((e) => e.status === "paid").reduce((a, e) => a + e.amount, 0);
  const balance = road.account.openingBalance + incoming - out;
  return { balance, available: balance - pending, pending, reserve: Math.min(road.reserve.setAside, Math.max(0, balance)) };
}

export type LineStatus = "paid" | "processing" | "partial" | "plan" | "due" | "late" | "none";

export interface LineProgress {
  home: Home;
  due: number;
  paid: number;
  processing: number;
  outstanding: number;
  status: LineStatus;
  lastPaidAt: ISOTime | null;
  payments: Payment[];
  plan: PaymentPlan | null;
  reason: string;
}

export interface RequestProgress {
  request: DuesRequest;
  lines: LineProgress[];
  billed: number;
  collected: number;
  processing: number;
  outstanding: number;
  homesPaid: number;
  homesBilled: number;
  lateCount: number;
  isLate: boolean;
}

export function requestProgress(road: Road, request: DuesRequest, now: Date): RequestProgress {
  const homes = homeMap(road);
  const lateAfter = endOfDayUS(request.dueDate);
  const isLate = now.toISOString() > lateAfter;
  const lines: LineProgress[] = [];
  for (const line of request.lines) {
    const home = homes.get(line.homeId);
    if (!home) continue;
    const payments = road.payments.filter((p) => p.requestId === request.id && p.homeId === home.id && p.status === "ok");
    const paid = payments.reduce((a, p) => a + p.amount, 0);
    const processing = payments.filter((p) => !isCleared(p, now)).reduce((a, p) => a + p.amount, 0);
    const outstanding = Math.max(0, line.amount - paid);
    const plan = road.plans.find((p) => p.requestId === request.id && p.homeId === home.id && p.status === "active") ?? null;
    let status: LineStatus;
    if (line.amount === 0) status = "none";
    else if (outstanding === 0) status = processing > 0 ? "processing" : "paid";
    else if (plan) status = "plan";
    else if (paid > 0) status = "partial";
    else status = isLate ? "late" : "due";
    if (status === "partial" && isLate) status = "late";
    const lastPaidAt = payments.length ? payments.map((p) => p.paidAt).sort().at(-1)! : null;
    lines.push({ home, due: line.amount, paid, processing, outstanding, status, lastPaidAt, payments, plan, reason: line.reason });
  }
  const billed = lines.reduce((a, l) => a + l.due, 0);
  const collected = lines.reduce((a, l) => a + Math.min(l.paid, l.due), 0);
  return {
    request,
    lines,
    billed,
    collected,
    processing: lines.reduce((a, l) => a + l.processing, 0),
    outstanding: lines.reduce((a, l) => a + l.outstanding, 0),
    homesPaid: lines.filter((l) => l.status === "paid" || l.status === "processing").length,
    homesBilled: lines.filter((l) => l.due > 0).length,
    lateCount: lines.filter((l) => l.status === "late").length,
    isLate,
  };
}

/** The request the Home tab is about: newest open one, else the newest. */
export function currentRequest(road: Road): DuesRequest | null {
  const sorted = [...road.requests].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return sorted.find((r) => r.status === "open") ?? sorted[0] ?? null;
}

export interface HomeOwed {
  request: DuesRequest;
  line: LineProgress;
}

/** Open bills for one home, oldest first. */
export function homeOpenBills(road: Road, homeId: string, now: Date): HomeOwed[] {
  return road.requests
    .filter((r) => r.status === "open")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((r) => ({ request: r, line: requestProgress(road, r, now).lines.find((l) => l.home.id === homeId) }))
    .filter((x): x is HomeOwed => !!x.line && x.line.outstanding > 0);
}

export interface LedgerEntry {
  id: string;
  date: ISOTime | ISODate;
  kind: "opening" | "in" | "out";
  label: string;
  detail: string;
  amount: number;
  balance: number;
  pending: boolean;
  receiptNo: string | null;
  category: string | null;
  fileId: string | null;
}

export function ledger(road: Road, now: Date): LedgerEntry[] {
  const homes = homeMap(road);
  const rows: Omit<LedgerEntry, "balance">[] = [];
  if (road.account.openingBalance > 0 || road.account.openingDate) {
    rows.push({
      id: "opening",
      date: road.account.openingDate ?? road.createdAt.slice(0, 10),
      kind: "opening",
      label: "Opening balance",
      detail: "Money the road had before Road Fund",
      amount: road.account.openingBalance,
      pending: false,
      receiptNo: null,
      category: null,
      fileId: null,
    });
  }
  for (const p of road.payments) {
    if (p.status !== "ok") continue;
    const req = road.requests.find((r) => r.id === p.requestId);
    const how = { ach: "Bank transfer", card: "Card", check: "Check", cash: "Cash" }[p.method];
    rows.push({
      id: p.id,
      date: p.paidAt,
      kind: "in",
      label: displayName(homes.get(p.homeId)),
      detail: `${how}${req ? ` · ${req.title}` : ""}${p.roadNet !== p.amount ? ` · fees ${money(p.amount - p.roadNet)}` : ""}`,
      amount: p.roadNet,
      pending: !isCleared(p, now),
      receiptNo: p.receiptNo,
      category: "dues",
      fileId: null,
    });
  }
  for (const e of road.expenses) {
    if (e.status !== "paid" || !e.paidAt) continue;
    rows.push({
      id: e.id,
      date: e.paidAt,
      kind: "out",
      label: e.vendorName,
      detail: `${CATEGORY_LABEL[e.category]} · ${e.description}`,
      amount: -e.amount,
      pending: false,
      receiptNo: null,
      category: e.category,
      fileId: e.invoiceFileId,
    });
  }
  rows.sort((a, b) => (a.kind === "opening" ? -1 : b.kind === "opening" ? 1 : String(a.date).localeCompare(String(b.date))));
  let running = 0;
  return rows.map((r) => {
    running += r.amount;
    return { ...r, balance: running };
  });
}

export interface YearTotals {
  year: number;
  duesIn: number;
  feesPaid: number;
  spent: number;
  byCategory: { category: Expense["category"]; amount: number }[];
}

export function yearTotals(road: Road, year: number): YearTotals {
  const pays = road.payments.filter((p) => p.status === "ok" && yearOf(p.paidAt) === year);
  const spentList = road.expenses.filter((e) => e.status === "paid" && e.paidAt && yearOf(e.paidAt) === year);
  const cats = new Map<Expense["category"], number>();
  for (const e of spentList) cats.set(e.category, (cats.get(e.category) ?? 0) + e.amount);
  return {
    year,
    duesIn: pays.reduce((a, p) => a + p.roadNet, 0),
    feesPaid: pays.reduce((a, p) => a + (p.amount - p.roadNet), 0),
    spent: spentList.reduce((a, e) => a + e.amount, 0),
    byCategory: [...cats.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount),
  };
}

export type VoteStatus = "open" | "ready" | "passed" | "failed";

export interface VoteState {
  vote: Vote;
  eligible: number;
  needed: number;
  yes: number;
  no: number;
  abstain: number;
  waiting: number;
  status: VoteStatus;
  /** Outcome is already certain even though the vote is still open. */
  decided: "pass" | "fail" | null;
  daysLeft: number;
}

export function voteState(road: Road, vote: Vote, now: Date): VoteState {
  const eligible = road.homes.length;
  const needed = thresholdCount(vote.threshold, eligible);
  const homeIds = new Set(road.homes.map((h) => h.id));
  const ballots = vote.ballots.filter((b) => homeIds.has(b.homeId));
  const yes = ballots.filter((b) => b.choice === "yes").length;
  const no = ballots.filter((b) => b.choice === "no").length;
  const abstain = ballots.filter((b) => b.choice === "abstain").length;
  const waiting = eligible - ballots.length;
  const decided = yes >= needed ? "pass" : yes + waiting < needed ? "fail" : null;
  let status: VoteStatus;
  if (vote.closedAt) status = vote.outcome === "passed" ? "passed" : "failed";
  else if (now.toISOString() > endOfDayUS(vote.deadline)) status = "ready";
  else status = "open";
  return { vote, eligible, needed, yes, no, abstain, waiting, status, decided, daysLeft: daysBetween(isoDate(now), vote.deadline) };
}

export const THRESHOLD_TEXT: Record<Vote["threshold"], string> = {
  majority: "More than half of all homes",
  "two-thirds": "Two-thirds of all homes",
  unanimous: "Every home",
};

export interface NextAction {
  id: string;
  label: string;
  detail: string;
  href: string;
  tone: "go" | "warn" | "late" | "calm";
}

/** Ordered to-do list for the captain. The first item becomes the one big button on Home. */
export function nextActions(road: Road, now: Date): NextAction[] {
  const out: NextAction[] = [];
  const today = isoDate(now);
  const year = now.getFullYear();

  for (const r of road.letterRequests.filter((x) => x.status === "new")) {
    out.push({
      id: `letter-${r.id}`,
      label: `Send a Road Status Letter to ${r.requester.company || r.requester.name}`,
      detail: `For ${r.propertyAddress}${r.closingDate ? `, closing ${fmtDate(r.closingDate)}` : ""}. A sale may be waiting on it.`,
      href: `/app/papers/letters/new?request=${r.id}`,
      tone: "warn",
    });
  }

  const hasThisYear = road.requests.some((r) => yearOf(r.createdAt) === year && r.kind === "annual");
  if (!hasThisYear && road.homes.length > 0) {
    out.push({
      id: "dues",
      label: `Send ${year} road dues`,
      detail: "Set the budget, check each share, and send everyone a pay link.",
      href: "/app/money/requests/new",
      tone: "go",
    });
  }

  for (const r of road.requests.filter((x) => x.status === "open" && !x.sentAt)) {
    out.push({ id: `send-${r.id}`, label: `Send "${r.title}"`, detail: "It was created but not sent yet.", href: `/app/money/requests/${r.id}?send=1`, tone: "go" });
  }

  for (const e of road.expenses.filter((x) => x.status === "awaiting-approval")) {
    out.push({
      id: `bill-${e.id}`,
      label: `Approve the ${e.vendorName} bill (${money(e.amount)})`,
      detail: e.description,
      href: `/app/money/bills#${e.id}`,
      tone: "warn",
    });
  }
  for (const e of road.expenses.filter((x) => x.status === "approved")) {
    out.push({ id: `pay-${e.id}`, label: `Pay ${e.vendorName} ${money(e.amount)}`, detail: "Approved and ready to pay.", href: `/app/money/bills#${e.id}`, tone: "go" });
  }

  for (const v of road.votes) {
    const s = voteState(road, v, now);
    if (s.status === "ready") {
      out.push({ id: `vote-${v.id}`, label: "Close the vote and record the result", detail: v.question, href: `/app/papers/votes/${v.id}`, tone: "warn" });
    }
  }

  const current = currentRequest(road);
  if (current && current.status === "open" && current.sentAt) {
    const prog = requestProgress(road, current, now);
    const unpaid = prog.lines.filter((l) => l.status === "late" || l.status === "due" || l.status === "partial");
    const lastReminder = road.messages.find((m) => m.kind === "reminder");
    const sinceReminder = lastReminder ? daysBetween(lastReminder.at.slice(0, 10), today) : 99;
    if (prog.lateCount > 0) {
      out.push({
        id: "late",
        label: `Remind ${prog.lateCount} late neighbor${prog.lateCount === 1 ? "" : "s"}`,
        detail: `${money(prog.outstanding)} still owed on "${current.title}".`,
        href: `/app/money/requests/${current.id}`,
        tone: "late",
      });
    } else if (unpaid.length > 0 && sinceReminder >= 5 && daysBetween(today, current.dueDate) <= 7) {
      out.push({
        id: "remind",
        label: `Send a reminder to ${unpaid.length} neighbor${unpaid.length === 1 ? "" : "s"}`,
        detail: `"${current.title}" is due ${fmtDate(current.dueDate)}.`,
        href: `/app/money/requests/${current.id}`,
        tone: "go",
      });
    }
  }

  if (road.agreement.step === "signing") {
    const signed = road.agreement.signatures.filter((s) => s.version === road.agreement.version).length;
    if (signed < road.homes.length) {
      out.push({
        id: "sign",
        label: `${road.homes.length - signed} owner${road.homes.length - signed === 1 ? "" : "s"} still need to sign the agreement`,
        detail: "Send them their signing link.",
        href: "/app/papers/agreement",
        tone: "calm",
      });
    }
  }

  for (const w of road.work.filter((x) => x.kind === "damage" && x.status === "open").slice(0, 2)) {
    out.push({ id: `dmg-${w.id}`, label: `Plan a repair: ${w.title}`, detail: "Reported damage that isn't scheduled yet.", href: `/app/road/work#${w.id}`, tone: "calm" });
  }

  // Checks work without a bank account, so this comes after everything that's waiting on someone.
  if (road.account.status !== "connected") {
    out.push({
      id: "bank",
      label: "Connect a bank account for online payments",
      detail: "Until then, neighbors can still pay you by check.",
      href: "/app/money/account",
      tone: "go",
    });
  }

  if (out.length === 0) {
    out.push({ id: "log", label: "Log road work", detail: "Photos and notes now make next year's budget easy to explain.", href: "/app/road/work?new=work", tone: "calm" });
  }
  return out;
}

export function agreementSigned(road: Road): number {
  return road.agreement.signatures.filter((s) => s.version === road.agreement.version).length;
}

export function lastAnnualShare(road: Road, homeId: string): { amount: number; pct: number; request: DuesRequest } | null {
  const annual = [...road.requests].filter((r) => r.kind === "annual").sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (!annual) return null;
  const line = annual.lines.find((l) => l.homeId === homeId);
  if (!line) return null;
  return { amount: line.amount, pct: annual.total ? (line.amount / annual.total) * 100 : 0, request: annual };
}

export function upcomingWork(road: Road, now: Date): { title: string; amount: number | null; status: string }[] {
  const out: { title: string; amount: number | null; status: string }[] = [];
  for (const v of road.votes) {
    const s = voteState(road, v, now);
    if (s.status === "open" || s.status === "ready") out.push({ title: v.question, amount: v.amount, status: "Vote in progress" });
    else if (s.status === "passed" && v.closedAt && daysBetween(v.closedAt.slice(0, 10), isoDate(now)) < 365) {
      out.push({ title: v.question, amount: v.amount, status: "Approved by vote" });
    }
  }
  return out.slice(0, 8);
}

export function dueSoonText(dueDate: ISODate, now: Date): string {
  const n = daysBetween(isoDate(now), dueDate);
  if (n < 0) return `was due ${-n} day${n === -1 ? "" : "s"} ago`;
  if (n === 0) return "is due today";
  if (n === 1) return "is due tomorrow";
  return `is due in ${n} days`;
}

export { addDays };

/** A neighbor's recent "my check is in the mail" note for this bill, if any (good for 30 days). */
export function checkInMail(road: Road, homeId: string, requestId: string, now: Date) {
  return (road.checkNotes ?? []).find((n) => n.homeId === homeId && n.requestId === requestId && now.getTime() - Date.parse(n.at) < 30 * 86_400_000) ?? null;
}

/** "Approved by vote on May 3: 6 of 9 homes voted yes." The consent record behind a project bill. */
export function approvalText(road: Road, request: DuesRequest): string | null {
  const v = request.voteId ? road.votes.find((x) => x.id === request.voteId) : null;
  if (!v || v.outcome !== "passed" || !v.closedAt) return null;
  const yes = v.ballots.filter((b) => b.choice === "yes").length;
  return `Approved by vote on ${fmtDate(v.closedAt.slice(0, 10))}: ${yes} of ${road.homes.length} homes voted yes.`;
}
