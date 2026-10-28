// What a neighbor sees from their link. No other neighbor's contact details,
// no other neighbor's payment history unless the road chooses to show names.

import { computeShares, type SplitResult } from "./split.ts";
import { accountSummary, agreementSigned, approvalText, captainHome, checkInMail, displayName, homeOpenBills, requestProgress, type HomeOwed, type VoteState, voteState } from "./selectors.ts";
import type { Agreement, BudgetLine, Expense, Home, Payment, Road, RoadSettings, SplitSettings, WorkEntry } from "./types.ts";

export interface NeighborView {
  road: {
    id: string;
    code: string;
    name: string;
    county: string;
    state: string;
    lengthFt: number;
    surface: Road["surface"];
    homesCount: number;
    accountConnected: boolean;
    plan: Road["plan"];
    /** The demo road: payments there are always simulated. */
    demo: boolean;
    settings: Pick<RoadSettings, "payerCoversFees">;
    split: SplitSettings;
  };
  me: Pick<Home, "id" | "label" | "address" | "owners" | "phone" | "email" | "smsOptIn" | "emailOptIn" | "distanceFt" | "frontageFt" | "vacant">;
  captain: { name: string; phone: string; email: string; address: string } | null;
  balance: { balance: number; pending: number; reserve: number };
  bills: (HomeOwed & {
    split: SplitResult;
    budget: BudgetLine[];
    progress: { homesPaid: number; homesBilled: number; collected: number; billed: number; paidNames: string[] | null };
    /** The neighbor said a check is on its way. */
    checkMailed: { amount: number; at: string } | null;
    /** For project bills: the vote that approved the work. */
    approval: string | null;
  })[];
  receipts: Payment[];
  spending: Pick<Expense, "id" | "vendorName" | "description" | "category" | "amount" | "paidAt">[];
  work: WorkEntry[];
  votes: (Omit<VoteState, "vote"> & { vote: Omit<VoteState["vote"], "ballots">; myChoice: "yes" | "no" | "abstain" | null })[];
  agreement: Pick<Agreement, "step" | "version" | "terms" | "recording"> & { signed: number; total: number; mySignature: { name: string; at: string } | null };
  /** Full road snapshot needed to render the agreement text for signing. */
  agreementHomes: { id: string; label: string; address: string; owners: string; sharePct: number | null }[];
  generatedAt: string;
}

export function neighborView(road: Road, homeId: string, now: Date): NeighborView {
  const me = road.homes.find((h) => h.id === homeId);
  if (!me) throw new Error("Home not found");
  const cap = captainHome(road);
  const acct = accountSummary(road, now);

  const bills = homeOpenBills(road, homeId, now).map((b) => {
    const prog = requestProgress(road, b.request, now);
    // Recompute the split with labels only, so the neighbor sees why, without seeing contacts.
    const split = computeShares(
      b.request.total,
      road.homes
        .filter((h) => b.request.lines.some((l) => l.homeId === h.id))
        .map((h) => ({ id: h.id, label: h.label, frontageFt: h.frontageFt, distanceFt: h.distanceFt, customPct: h.customPct, vacant: h.vacant })),
      b.request.split,
    );
    return {
      ...b,
      line: { ...b.line, home: me, payments: b.line.payments },
      split,
      budget: b.request.budget,
      approval: approvalText(road, b.request),
      checkMailed: (() => {
        const n = checkInMail(road, homeId, b.request.id, now);
        return n ? { amount: n.amount, at: n.at } : null;
      })(),
      progress: {
        homesPaid: prog.homesPaid,
        homesBilled: prog.homesBilled,
        collected: prog.collected,
        billed: prog.billed,
        paidNames: road.settings.showPaidNames
          ? prog.lines.filter((l) => l.status === "paid" || l.status === "processing").map((l) => displayName(l.home))
          : null,
      },
    };
  });

  const shares = latestShares(road);

  return {
    road: {
      id: road.id,
      code: road.code,
      name: road.name,
      county: road.county,
      state: road.state,
      lengthFt: road.lengthFt,
      surface: road.surface,
      homesCount: road.homes.length,
      accountConnected: road.account.status === "connected",
      demo: !!road.demo,
      plan: road.plan,
      settings: { payerCoversFees: road.settings.payerCoversFees },
      split: road.split,
    },
    me: {
      id: me.id,
      label: me.label,
      address: me.address,
      owners: me.owners,
      phone: me.phone,
      email: me.email,
      smsOptIn: me.smsOptIn,
      emailOptIn: me.emailOptIn,
      distanceFt: me.distanceFt,
      frontageFt: me.frontageFt,
      vacant: me.vacant,
    },
    captain: cap ? { name: displayName(cap), phone: cap.phone, email: cap.email, address: cap.address } : null,
    balance: { balance: acct.balance, pending: acct.pending, reserve: acct.reserve },
    bills,
    receipts: road.payments.filter((p) => p.homeId === homeId && p.status === "ok").sort((a, b) => b.paidAt.localeCompare(a.paidAt)),
    spending: road.expenses
      .filter((e) => e.status === "paid")
      .sort((a, b) => (b.paidAt ?? "").localeCompare(a.paidAt ?? ""))
      .slice(0, 12)
      .map(({ id, vendorName, description, category, amount, paidAt }) => ({ id, vendorName, description, category, amount, paidAt })),
    work: road.work.filter((w) => w.kind === "work" || w.status !== "fixed").slice(0, 12),
    votes: road.votes
      .map((v) => {
        const s = voteState(road, v, now);
        const { ballots, ...vote } = v;
        return { ...s, vote, myChoice: ballots.find((b) => b.homeId === homeId)?.choice ?? null };
      })
      .filter((v) => v.status === "open" || (v.vote.closedAt && now.getTime() - new Date(v.vote.closedAt).getTime() < 1000 * 86400 * 120)),
    agreement: {
      step: road.agreement.step,
      version: road.agreement.version,
      terms: road.agreement.terms,
      recording: road.agreement.recording,
      signed: agreementSigned(road),
      total: road.homes.length,
      mySignature: (() => {
        const s = road.agreement.signatures.find((x) => x.homeId === homeId && x.version === road.agreement.version);
        return s ? { name: s.name, at: s.at } : null;
      })(),
    },
    agreementHomes: road.homes.map((h) => ({ id: h.id, label: h.label, address: h.address, owners: h.owners, sharePct: shares.get(h.id) ?? null })),
    generatedAt: now.toISOString(),
  };
}

/** Each home's share of the most recent annual request, as a percent. */
export function latestShares(road: Road): Map<string, number> {
  const annual = [...road.requests].filter((r) => r.kind === "annual").sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const map = new Map<string, number>();
  if (annual && annual.total > 0) {
    for (const l of annual.lines) map.set(l.homeId, (l.amount / annual.total) * 100);
    return map;
  }
  const preview = computeShares(
    100_000,
    road.homes.map((h) => ({ id: h.id, label: h.label, frontageFt: h.frontageFt, distanceFt: h.distanceFt, customPct: h.customPct, vacant: h.vacant })),
    road.split,
  );
  if (preview.ok) for (const l of preview.lines) map.set(l.homeId, l.pct);
  return map;
}
