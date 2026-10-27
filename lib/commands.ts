// Every change to a road is a command. The same reducer runs in the browser
// (local mode, optimistic updates) and on the server (shared mode), so the
// rules below are the single source of truth.

import { addBusinessDays, endOfDayUS, fmtDate, yearOf } from "./dates.ts";
import { computeCharge, SETTLE_BUSINESS_DAYS } from "./fees.ts";
import { uid } from "./ids.ts";
import { money } from "./money.ts";
import type {
  Activity,
  Agreement,
  AgreementStep,
  AgreementTerms,
  Ballot,
  Bid,
  BudgetLine,
  Contractor,
  DocItem,
  DuesRequest,
  Expense,
  Home,
  ISODate,
  ISOTime,
  LetterRequest,
  MessageLog,
  Notice,
  PayMethod,
  Payment,
  PaymentPlan,
  Plan,
  Quote,
  Reserve,
  Road,
  RoadSettings,
  Signature,
  SplitSettings,
  StatusLetter,
  Vote,
  WorkEntry,
} from "./types.ts";

export type Command =
  | { type: "road.update"; patch: Partial<Pick<Road, "name" | "state" | "county" | "town" | "surface" | "lengthFt" | "path" | "center">> }
  | { type: "road.split"; split: SplitSettings }
  | { type: "road.settings"; patch: Partial<RoadSettings> }
  | { type: "road.budget"; budget: BudgetLine[] }
  | { type: "road.plan"; plan: Plan }
  | { type: "account.connect"; bankName: string; last4: string }
  | { type: "account.disconnect" }
  | { type: "account.opening"; amount: number; date: ISODate }
  | { type: "home.add"; home: Home }
  | { type: "home.update"; homeId: string; patch: Partial<Omit<Home, "id" | "token" | "joinedAt">> }
  | { type: "home.remove"; homeId: string }
  | { type: "home.contact"; homeId: string; patch: Partial<Pick<Home, "phone" | "email" | "smsOptIn" | "emailOptIn">> }
  | { type: "captain.handoff"; homeId: string }
  | { type: "request.create"; request: DuesRequest }
  | { type: "request.sent"; requestId: string; message: MessageLog }
  | { type: "request.close"; requestId: string }
  | { type: "request.reopen"; requestId: string }
  | { type: "request.delete"; requestId: string }
  | { type: "message.log"; message: MessageLog }
  | { type: "payment.record"; payment: Payment }
  | { type: "payment.void"; paymentId: string; reason: string }
  | { type: "expense.create"; expense: Expense }
  | { type: "expense.approve"; expenseId: string }
  | { type: "expense.reject"; expenseId: string }
  | { type: "expense.pay"; expenseId: string; via: NonNullable<Expense["paidVia"]> }
  | { type: "expense.delete"; expenseId: string }
  | { type: "contractor.save"; contractor: Contractor }
  | { type: "contractor.remove"; contractorId: string }
  | { type: "work.save"; entry: WorkEntry }
  | { type: "work.remove"; entryId: string }
  | { type: "vote.create"; vote: Vote }
  | { type: "vote.cast"; voteId: string; ballot: Ballot }
  | { type: "vote.close"; voteId: string }
  | { type: "doc.add"; doc: DocItem }
  | { type: "doc.remove"; docId: string }
  | { type: "agreement.terms"; terms: AgreementTerms }
  | { type: "agreement.purchase" }
  | { type: "agreement.step"; step: AgreementStep; review?: Agreement["review"]; notary?: Agreement["notary"]; recording?: Agreement["recording"] }
  | { type: "agreement.sign"; signature: Signature }
  | { type: "letter.create"; letter: StatusLetter }
  | { type: "letterRequest.create"; request: LetterRequest }
  | { type: "letterRequest.decline"; requestId: string; note: string }
  | { type: "reserve.save"; reserve: Reserve }
  | { type: "bid.save"; bid: Bid }
  | { type: "bid.quote"; bidId: string; quote: Quote }
  | { type: "bid.removeQuote"; bidId: string; quoteId: string }
  | { type: "bid.award"; bidId: string; quoteId: string; voteId: string | null }
  | { type: "bid.remove"; bidId: string }
  | { type: "plan.create"; plan: PaymentPlan }
  | { type: "plan.cancel"; planId: string }
  | { type: "notice.create"; notice: Notice };

export type CommandType = Command["type"];

export interface Actor {
  kind: "captain" | "neighbor" | "public" | "system";
  homeId: string | null;
  name: string;
}

export interface Ctx {
  at: ISOTime;
  actor: Actor;
}

export class CommandError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "CommandError";
    this.status = status;
  }
}

function fail(message: string, status = 400): never {
  throw new CommandError(message, status);
}

function must<T>(value: T | undefined | null, what: string): T {
  if (value === undefined || value === null) fail(`${what} not found.`, 404);
  return value;
}

const MAX_LOG = 400;

function log(road: Road, ctx: Ctx, text: string): Activity[] {
  const entry = { id: uid("act"), at: ctx.at, actor: ctx.actor.name, text };
  return [entry, ...road.activity].slice(0, MAX_LOG);
}

function homeName(road: Road, homeId: string): string {
  const h = road.homes.find((x) => x.id === homeId);
  return h ? h.owners || h.label : "a home";
}

function replace<T extends { id: string }>(list: T[], item: T): T[] {
  const i = list.findIndex((x) => x.id === item.id);
  if (i === -1) return [item, ...list];
  const copy = list.slice();
  copy[i] = item;
  return copy;
}

export const STARTER_REQUEST_LIMIT = 1;

export function requestsThisYear(road: Road, year: number): number {
  return road.requests.filter((r) => yearOf(r.createdAt) === year).length;
}

export function nextReceiptNo(road: Road, at: ISOTime): string {
  const year = yearOf(at);
  const count = road.payments.filter((p) => yearOf(p.paidAt) === year).length + 1;
  return `${year}-${String(count).padStart(4, "0")}`;
}

/** Builds a payment with fees computed from the road's settings. Used by both the pay page and the server. */
export function buildPayment(
  road: Road,
  input: { id: string; homeId: string; requestId: string | null; amount: number; method: PayMethod; payerName: string; note?: string; recordedBy: "neighbor" | "captain"; paidAt: ISOTime },
): Payment {
  const online = input.method === "ach" || input.method === "card";
  const charge = online
    ? computeCharge(input.amount, input.method as "ach" | "card", road.settings.payerCoversFees)
    : { share: input.amount, platformFee: 0, processingFee: 0, total: input.amount, roadNet: input.amount };
  return {
    id: input.id,
    requestId: input.requestId,
    homeId: input.homeId,
    amount: input.amount,
    platformFee: charge.platformFee,
    processingFee: charge.processingFee,
    charged: charge.total,
    roadNet: charge.roadNet,
    method: input.method,
    paidAt: input.paidAt,
    clearsAt: online ? addBusinessDays(input.paidAt, SETTLE_BUSINESS_DAYS[input.method as "ach" | "card"]) : input.paidAt,
    status: "ok",
    receiptNo: "",
    payerName: input.payerName,
    note: input.note ?? "",
    recordedBy: input.recordedBy,
  };
}

function available(road: Road, at: ISOTime): number {
  const t = new Date(at).getTime();
  const incoming = road.payments
    .filter((p) => p.status === "ok" && new Date(p.clearsAt).getTime() <= t)
    .reduce((a, p) => a + p.roadNet, 0);
  const out = road.expenses.filter((e) => e.status === "paid").reduce((a, e) => a + e.amount, 0);
  return road.account.openingBalance + incoming - out;
}

export function applyCommand(road: Road, cmd: Command, ctx: Ctx): Road {
  const next = reduce(road, cmd, ctx);
  return next === road ? road : { ...next, updatedAt: ctx.at };
}

function reduce(road: Road, cmd: Command, ctx: Ctx): Road {
  switch (cmd.type) {
    case "road.update": {
      const patch = pick(cmd.patch, ["name", "state", "county", "town", "surface", "lengthFt", "path", "center"]);
      if (patch.name !== undefined && !patch.name.trim()) fail("The road needs a name.");
      if (patch.lengthFt !== undefined && (!Number.isFinite(patch.lengthFt) || patch.lengthFt < 0)) fail("Road length must be a positive number.");
      return { ...road, ...patch, activity: log(road, ctx, "Updated road details") };
    }
    case "road.split": {
      if (cmd.split.vacantWeight < 0 || cmd.split.vacantWeight > 1) fail("Vacant lot share must be between 0% and 100%.");
      if (!(cmd.split.basePct >= 0 && cmd.split.basePct <= 100)) fail("Base share must be between 0% and 100%.");
      return { ...road, split: cmd.split, activity: log(road, ctx, `Changed the cost split`) };
    }
    case "road.settings":
      return { ...road, settings: { ...road.settings, ...cmd.patch, weather: { ...road.settings.weather, ...(cmd.patch.weather ?? {}) } } };
    case "road.budget":
      if (cmd.budget.some((b) => b.amount < 0)) fail("Budget amounts can't be negative.");
      return { ...road, budget: cmd.budget, activity: log(road, ctx, "Updated this year's budget") };
    case "road.plan": {
      const names: Record<Plan, string> = { starter: "Starter (free)", roadfund: "Road Fund ($149/yr)", plus: "Road Fund Plus ($249/yr)" };
      return { ...road, plan: cmd.plan, activity: log(road, ctx, `Plan changed to ${names[cmd.plan]}`) };
    }

    case "account.connect":
      return {
        ...road,
        account: { ...road.account, status: "connected", bankName: cmd.bankName, last4: cmd.last4, connectedAt: ctx.at },
        activity: log(road, ctx, `Connected road bank account (${cmd.bankName} ••${cmd.last4})`),
      };
    case "account.disconnect":
      return { ...road, account: { ...road.account, status: "none", bankName: "", last4: "", connectedAt: null }, activity: log(road, ctx, "Disconnected the road bank account") };
    case "account.opening":
      if (cmd.amount < 0) fail("Opening balance can't be negative.");
      return {
        ...road,
        account: { ...road.account, openingBalance: cmd.amount, openingDate: cmd.date },
        activity: log(road, ctx, `Set opening balance to ${money(cmd.amount)}`),
      };

    case "home.add": {
      if (road.homes.length >= 60) fail("A road can have up to 60 homes.");
      if (road.homes.some((h) => h.id === cmd.home.id)) return road;
      if (!cmd.home.label.trim()) fail("Give the home a name or address.");
      return { ...road, homes: [...road.homes, cmd.home], activity: log(road, ctx, `Added ${cmd.home.owners || cmd.home.label}`) };
    }
    case "home.update": {
      const home = must(road.homes.find((h) => h.id === cmd.homeId), "Home");
      const patch: Partial<Home> = pick(cmd.patch, [
        "label", "address", "owners", "phone", "email", "smsOptIn", "emailOptIn",
        "frontageFt", "distanceFt", "customPct", "vacant", "position", "notes",
      ]);
      // Text consent must come from the neighbor themselves (TCPA), so a captain can only turn texts off.
      if (patch.smsOptIn === true && ctx.actor.kind !== "neighbor") delete patch.smsOptIn;
      if (patch.smsOptIn && !home.smsOptIn) patch.smsOptInAt = ctx.at;
      if (patch.smsOptIn === false) patch.smsOptInAt = null;
      const updated = { ...home, ...patch };
      if (!updated.label.trim()) fail("Give the home a name or address.");
      return { ...road, homes: road.homes.map((h) => (h.id === home.id ? updated : h)) };
    }
    case "home.remove": {
      const home = must(road.homes.find((h) => h.id === cmd.homeId), "Home");
      if (road.captainHomeId === home.id) fail("Hand off the captain role before removing this home.");
      if (road.payments.some((p) => p.homeId === home.id && p.status === "ok")) {
        fail("This home has payments on record. Keep it so the ledger stays complete.");
      }
      return {
        ...road,
        homes: road.homes.filter((h) => h.id !== home.id),
        activity: log(road, ctx, `Removed ${home.owners || home.label}`),
      };
    }
    case "home.contact": {
      const home = must(road.homes.find((h) => h.id === cmd.homeId), "Home");
      const p = cmd.patch;
      const updated: Home = {
        ...home,
        phone: p.phone ?? home.phone,
        email: p.email ?? home.email,
        smsOptIn: p.smsOptIn ?? home.smsOptIn,
        smsOptInAt: p.smsOptIn === true && !home.smsOptIn ? ctx.at : p.smsOptIn === false ? null : home.smsOptInAt,
        emailOptIn: p.emailOptIn ?? home.emailOptIn,
      };
      const changes: string[] = [];
      if (p.smsOptIn === false && home.smsOptIn) changes.push("stopped texts");
      if (p.smsOptIn === true && !home.smsOptIn) changes.push("agreed to texts");
      if (p.emailOptIn === false && home.emailOptIn) changes.push("stopped emails");
      if (p.emailOptIn === true && !home.emailOptIn) changes.push("agreed to emails");
      if ((p.phone !== undefined && p.phone !== home.phone) || (p.email !== undefined && p.email !== home.email)) changes.push("updated contact info");
      return {
        ...road,
        homes: road.homes.map((h) => (h.id === home.id ? updated : h)),
        activity: changes.length ? log(road, ctx, `${homeName(road, home.id)} ${changes.join(", ")}`) : road.activity,
      };
    }
    case "captain.handoff": {
      const home = must(road.homes.find((h) => h.id === cmd.homeId), "Home");
      return { ...road, captainHomeId: home.id, activity: log(road, ctx, `Captain role handed to ${home.owners || home.label}`) };
    }

    case "request.create": {
      const r = cmd.request;
      if (road.requests.some((x) => x.id === r.id)) return road;
      if (road.plan === "starter" && requestsThisYear(road, yearOf(ctx.at)) >= STARTER_REQUEST_LIMIT) {
        fail("The free Starter plan includes one dues request a year. Upgrade to Road Fund to send more.", 402);
      }
      if (!r.title.trim()) fail("Give the request a title.");
      if (r.total <= 0) fail("The total must be more than $0.");
      const lineSum = r.lines.reduce((a, l) => a + l.amount, 0);
      if (lineSum !== r.total) fail("Shares don't add up to the total.");
      for (const l of r.lines) must(road.homes.find((h) => h.id === l.homeId), "Home on this request");
      return { ...road, requests: [r, ...road.requests], activity: log(road, ctx, `Created dues request "${r.title}" for ${money(r.total)}`) };
    }
    case "request.sent": {
      const r = must(road.requests.find((x) => x.id === cmd.requestId), "Request");
      return {
        ...road,
        requests: road.requests.map((x) => (x.id === r.id ? { ...x, sentAt: x.sentAt ?? ctx.at } : x)),
        messages: [cmd.message, ...road.messages].slice(0, MAX_LOG),
        activity: log(road, ctx, `Sent "${r.title}" to ${cmd.message.homeIds.length} home${cmd.message.homeIds.length === 1 ? "" : "s"} by ${cmd.message.channel}`),
      };
    }
    case "request.close":
    case "request.reopen": {
      const r = must(road.requests.find((x) => x.id === cmd.requestId), "Request");
      const status = cmd.type === "request.close" ? "closed" : "open";
      return {
        ...road,
        requests: road.requests.map((x) => (x.id === r.id ? { ...x, status } : x)),
        activity: log(road, ctx, `${status === "closed" ? "Closed" : "Reopened"} "${r.title}"`),
      };
    }
    case "request.delete": {
      const r = must(road.requests.find((x) => x.id === cmd.requestId), "Request");
      if (road.payments.some((p) => p.requestId === r.id && p.status === "ok")) fail("This request has payments. Close it instead of deleting it.");
      return { ...road, requests: road.requests.filter((x) => x.id !== r.id), activity: log(road, ctx, `Deleted request "${r.title}"`) };
    }
    case "message.log":
      return { ...road, messages: [cmd.message, ...road.messages].slice(0, MAX_LOG) };

    case "payment.record": {
      const p = cmd.payment;
      if (road.payments.some((x) => x.id === p.id)) return road; // idempotent retry
      if (!Number.isInteger(p.amount) || p.amount <= 0) fail("Payment amount must be more than $0.");
      must(road.homes.find((h) => h.id === p.homeId), "Home");
      if (p.requestId) must(road.requests.find((r) => r.id === p.requestId), "Request");
      if ((p.method === "ach" || p.method === "card") && road.account.status !== "connected") {
        fail("The road's bank account isn't connected yet, so online payments are off. Ask your road captain.", 409);
      }
      const payment = { ...p, receiptNo: nextReceiptNo(road, p.paidAt) };
      const how = { ach: "bank transfer", card: "card", check: "check", cash: "cash" }[p.method];
      return {
        ...road,
        payments: [payment, ...road.payments],
        activity: log(road, ctx, `${homeName(road, p.homeId)} paid ${money(p.amount)} by ${how}`),
      };
    }
    case "payment.void": {
      const p = must(road.payments.find((x) => x.id === cmd.paymentId), "Payment");
      if (p.status === "void") return road;
      if (!cmd.reason.trim()) fail("Say why the payment is being voided.");
      return {
        ...road,
        payments: road.payments.map((x) => (x.id === p.id ? { ...x, status: "void", voidReason: cmd.reason } : x)),
        activity: log(road, ctx, `Voided receipt ${p.receiptNo} (${money(p.amount)}): ${cmd.reason}`),
      };
    }

    case "expense.create": {
      const e = cmd.expense;
      if (road.expenses.some((x) => x.id === e.id)) return road;
      if (!e.vendorName.trim()) fail("Who is the bill from?");
      if (e.amount <= 0) fail("The bill amount must be more than $0.");
      return { ...road, expenses: [e, ...road.expenses], activity: log(road, ctx, `Added bill from ${e.vendorName} for ${money(e.amount)}`) };
    }
    case "expense.approve":
    case "expense.reject": {
      const e = must(road.expenses.find((x) => x.id === cmd.expenseId), "Bill");
      if (e.status === "paid") fail("This bill is already paid.");
      const approved = cmd.type === "expense.approve";
      return {
        ...road,
        expenses: road.expenses.map((x) =>
          x.id === e.id ? { ...x, status: approved ? "approved" : "rejected", approvedAt: approved ? ctx.at : null } : x,
        ),
        activity: log(road, ctx, `${approved ? "Approved" : "Rejected"} ${e.vendorName} bill (${money(e.amount)})`),
      };
    }
    case "expense.pay": {
      const e = must(road.expenses.find((x) => x.id === cmd.expenseId), "Bill");
      if (e.status === "paid") return road;
      if (e.status === "rejected") fail("This bill was rejected.");
      if (cmd.via === "road-account" && road.account.status !== "connected") fail("Connect the road's bank account first.", 409);
      if (cmd.via === "road-account" && available(road, ctx.at) < e.amount) {
        fail(`The road account has ${money(Math.max(0, available(road, ctx.at)))} available. This bill is ${money(e.amount)}.`, 409);
      }
      const how = { "road-account": "from the road account", check: "by check", reimbursed: "as a reimbursement" }[cmd.via];
      return {
        ...road,
        expenses: road.expenses.map((x) =>
          x.id === e.id ? { ...x, status: "paid", approvedAt: x.approvedAt ?? ctx.at, paidAt: ctx.at, paidVia: cmd.via } : x,
        ),
        activity: log(road, ctx, `Paid ${e.vendorName} ${money(e.amount)} ${how}`),
      };
    }
    case "expense.delete": {
      const e = must(road.expenses.find((x) => x.id === cmd.expenseId), "Bill");
      if (e.status === "paid") fail("Paid bills stay on the ledger.");
      return { ...road, expenses: road.expenses.filter((x) => x.id !== e.id), activity: log(road, ctx, `Deleted bill from ${e.vendorName}`) };
    }

    case "contractor.save": {
      if (!cmd.contractor.name.trim()) fail("Add the contractor's name.");
      const isNew = !road.contractors.some((c) => c.id === cmd.contractor.id);
      return {
        ...road,
        contractors: replace(road.contractors, cmd.contractor),
        activity: isNew ? log(road, ctx, `Added contractor ${cmd.contractor.name}`) : road.activity,
      };
    }
    case "contractor.remove": {
      const c = must(road.contractors.find((x) => x.id === cmd.contractorId), "Contractor");
      if (road.expenses.some((e) => e.contractorId === c.id && e.status === "paid")) fail("This contractor has paid bills on record, so they stay on the list.");
      return { ...road, contractors: road.contractors.filter((x) => x.id !== c.id) };
    }

    case "work.save": {
      const e = cmd.entry;
      if (!e.title.trim()) fail("Add a short title.");
      const isNew = !road.work.some((w) => w.id === e.id);
      const what = e.kind === "damage" ? "Reported damage" : "Logged work";
      return {
        ...road,
        work: replace(road.work, e).sort((a, b) => b.date.localeCompare(a.date)),
        activity: isNew ? log(road, ctx, `${what}: ${e.title}`) : road.activity,
      };
    }
    case "work.remove":
      return { ...road, work: road.work.filter((w) => w.id !== cmd.entryId) };

    case "vote.create": {
      const v = cmd.vote;
      if (road.votes.some((x) => x.id === v.id)) return road;
      if (!v.question.trim()) fail("Write the question people are voting on.");
      return { ...road, votes: [v, ...road.votes], activity: log(road, ctx, `Started a vote: ${v.question}`) };
    }
    case "vote.cast": {
      const v = must(road.votes.find((x) => x.id === cmd.voteId), "Vote");
      if (v.closedAt) fail("This vote is closed.", 409);
      if (ctx.at > endOfDayUS(v.deadline)) fail(`Voting ended on ${fmtDate(v.deadline)}.`, 409);
      must(road.homes.find((h) => h.id === cmd.ballot.homeId), "Home");
      const ballots = [...v.ballots.filter((b) => b.homeId !== cmd.ballot.homeId), cmd.ballot];
      const changed = v.ballots.some((b) => b.homeId === cmd.ballot.homeId);
      return {
        ...road,
        votes: road.votes.map((x) => (x.id === v.id ? { ...x, ballots } : x)),
        activity: log(road, ctx, `${homeName(road, cmd.ballot.homeId)} ${changed ? "changed their vote" : "voted"} on "${v.question}"`),
      };
    }
    case "vote.close": {
      const v = must(road.votes.find((x) => x.id === cmd.voteId), "Vote");
      if (v.closedAt) return road;
      const outcome = votePasses(v, road.homes.length) ? "passed" : "failed";
      return {
        ...road,
        votes: road.votes.map((x) => (x.id === v.id ? { ...x, closedAt: ctx.at, outcome } : x)),
        activity: log(road, ctx, `Vote ${outcome}: ${v.question}`),
      };
    }

    case "doc.add":
      if (!cmd.doc.title.trim()) fail("Give the document a title.");
      return { ...road, docs: [cmd.doc, ...road.docs.filter((d) => d.id !== cmd.doc.id)], activity: log(road, ctx, `Added document: ${cmd.doc.title}`) };
    case "doc.remove": {
      const d = must(road.docs.find((x) => x.id === cmd.docId), "Document");
      return { ...road, docs: road.docs.filter((x) => x.id !== d.id), activity: log(road, ctx, `Removed document: ${d.title}`) };
    }

    case "agreement.terms": {
      const a = road.agreement;
      if (a.step === "notary" || a.step === "recording" || a.step === "recorded") {
        fail("The agreement is already signed. Changes now need a written amendment.", 409);
      }
      // Changing terms after people signed invalidates their signatures.
      const bumped = a.signatures.length > 0 || a.step !== "draft";
      return {
        ...road,
        agreement: {
          ...a,
          terms: cmd.terms,
          version: bumped ? a.version + 1 : a.version,
          step: bumped ? "draft" : a.step,
          review: bumped ? null : a.review,
          signatures: bumped ? [] : a.signatures,
          updatedAt: ctx.at,
        },
        activity: log(road, ctx, bumped ? "Changed agreement terms (signatures reset)" : "Edited the agreement draft"),
      };
    }
    case "agreement.purchase":
      if (road.agreement.packagePurchasedAt) return road;
      return {
        ...road,
        agreement: { ...road.agreement, packagePurchasedAt: ctx.at },
        activity: log(road, ctx, "Bought the agreement package ($249)"),
      };
    case "agreement.step": {
      const a = road.agreement;
      const order: AgreementStep[] = ["draft", "review", "signing", "notary", "recording", "recorded"];
      if (order.indexOf(cmd.step) > order.indexOf(a.step) + 1) fail("Finish the earlier steps first.", 409);
      if (cmd.step !== "draft" && cmd.step !== "review" && !a.packagePurchasedAt) fail("Signing, notary and recording are part of the agreement package.", 402);
      if (cmd.step === "notary" && a.signatures.filter((s) => s.version === a.version).length < road.homes.length) {
        fail("Every owner needs to sign before the notary step.", 409);
      }
      if (cmd.step === "recorded" && !(cmd.recording ?? a.recording)?.instrument) fail("Enter the recording number from the county.");
      const labels: Record<AgreementStep, string> = {
        draft: "Agreement back to draft",
        review: "Sent agreement for attorney review",
        signing: "Agreement opened for signatures",
        notary: "Signatures complete; notary scheduled",
        recording: "Notarized; sent for recording",
        recorded: "Agreement recorded with the county",
      };
      return {
        ...road,
        agreement: {
          ...a,
          step: cmd.step,
          review: cmd.review !== undefined ? cmd.review : a.review,
          notary: cmd.notary !== undefined ? cmd.notary : a.notary,
          recording: cmd.recording !== undefined ? cmd.recording : a.recording,
          updatedAt: ctx.at,
        },
        activity: log(road, ctx, labels[cmd.step]),
      };
    }
    case "agreement.sign": {
      const a = road.agreement;
      if (a.step !== "signing") fail("The agreement isn't open for signatures.", 409);
      const s = cmd.signature;
      must(road.homes.find((h) => h.id === s.homeId), "Home");
      if (s.version !== a.version) fail("The agreement changed since you opened it. Reload and read the new version.", 409);
      if (s.name.trim().length < 3) fail("Type your full name to sign.");
      if (a.signatures.some((x) => x.homeId === s.homeId && x.version === a.version)) return road;
      return {
        ...road,
        agreement: { ...a, signatures: [...a.signatures, s] },
        activity: log(road, ctx, `${s.name} signed the agreement (${road.homes.find((h) => h.id === s.homeId)?.label ?? "a lot"})`),
      };
    }

    case "letter.create": {
      const l = cmd.letter;
      if (road.letters.some((x) => x.id === l.id)) return road;
      must(road.homes.find((h) => h.id === l.homeId), "Property");
      return {
        ...road,
        letters: [l, ...road.letters],
        letterRequests: road.letterRequests.map((r) => (r.id === l.requestId ? { ...r, status: "fulfilled", letterId: l.id } : r)),
        activity: log(road, ctx, `Issued Road Status Letter ${l.code} for ${l.snapshot.property.address || l.snapshot.property.label}`),
      };
    }
    case "letterRequest.create": {
      const r = cmd.request;
      if (road.letterRequests.some((x) => x.id === r.id)) return road;
      if (!r.requester.name.trim() || !r.requester.email.includes("@")) fail("Add your name and a valid email.");
      if (!r.propertyAddress.trim()) fail("Add the property address.");
      const open = road.letterRequests.filter((x) => x.status === "new").length;
      if (open >= 20) fail("This road has too many open letter requests. Contact the road captain directly.", 429);
      return {
        ...road,
        letterRequests: [r, ...road.letterRequests],
        activity: log(road, ctx, `${r.requester.company || r.requester.name} requested a Road Status Letter for ${r.propertyAddress}`),
      };
    }
    case "letterRequest.decline": {
      const r = must(road.letterRequests.find((x) => x.id === cmd.requestId), "Letter request");
      return {
        ...road,
        letterRequests: road.letterRequests.map((x) => (x.id === r.id ? { ...x, status: "declined", note: cmd.note } : x)),
        activity: log(road, ctx, `Declined letter request from ${r.requester.company || r.requester.name}`),
      };
    }

    case "reserve.save":
      if (cmd.reserve.items.some((i) => i.lifeYears < 1 || i.cost < 0)) fail("Each item needs a cost and a life of at least 1 year.");
      return { ...road, reserve: cmd.reserve };

    case "bid.save": {
      if (!cmd.bid.title.trim()) fail("Name the job.");
      const isNew = !road.bids.some((b) => b.id === cmd.bid.id);
      return { ...road, bids: replace(road.bids, cmd.bid), activity: isNew ? log(road, ctx, `Asked for bids: ${cmd.bid.title}`) : road.activity };
    }
    case "bid.quote": {
      const b = must(road.bids.find((x) => x.id === cmd.bidId), "Bid");
      if (cmd.quote.amount <= 0) fail("Quote amount must be more than $0.");
      if (!cmd.quote.vendorName.trim()) fail("Who is the quote from?");
      return {
        ...road,
        bids: road.bids.map((x) => (x.id === b.id ? { ...x, quotes: replace(x.quotes, cmd.quote) } : x)),
        activity: log(road, ctx, `Quote from ${cmd.quote.vendorName}: ${money(cmd.quote.amount)} for ${b.title}`),
      };
    }
    case "bid.removeQuote":
      return { ...road, bids: road.bids.map((x) => (x.id === cmd.bidId ? { ...x, quotes: x.quotes.filter((q) => q.id !== cmd.quoteId) } : x)) };
    case "bid.award": {
      const b = must(road.bids.find((x) => x.id === cmd.bidId), "Bid");
      const q = must(b.quotes.find((x) => x.id === cmd.quoteId), "Quote");
      return {
        ...road,
        bids: road.bids.map((x) => (x.id === b.id ? { ...x, status: "awarded", awardedQuoteId: q.id, voteId: cmd.voteId ?? x.voteId } : x)),
        activity: log(road, ctx, `Picked ${q.vendorName} (${money(q.amount)}) for ${b.title}`),
      };
    }
    case "bid.remove":
      return { ...road, bids: road.bids.filter((x) => x.id !== cmd.bidId) };

    case "plan.create": {
      const p = cmd.plan;
      if (p.installments.length < 2) fail("A payment plan needs at least 2 payments.");
      if (road.plans.some((x) => x.homeId === p.homeId && x.requestId === p.requestId && x.status === "active")) {
        fail("This home already has an active plan for this request.", 409);
      }
      const total = p.installments.reduce((a, i) => a + i.amount, 0);
      return {
        ...road,
        plans: [p, ...road.plans],
        activity: log(road, ctx, `Set up a ${p.installments.length}-payment plan for ${homeName(road, p.homeId)} (${money(total)})`),
      };
    }
    case "plan.cancel":
      return { ...road, plans: road.plans.map((p) => (p.id === cmd.planId ? { ...p, status: "cancelled" } : p)) };

    case "notice.create": {
      const n = cmd.notice;
      const label = { friendly: "friendly reminder", formal: "formal notice", final: "final notice" }[n.kind];
      return { ...road, notices: [n, ...road.notices], activity: log(road, ctx, `Sent a ${label} to ${homeName(road, n.homeId)}`) };
    }
    default:
      return fail(`Unknown change: ${(cmd as { type?: unknown }).type}`);
  }
}

function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const k of keys) if (obj && Object.prototype.hasOwnProperty.call(obj, k) && obj[k] !== undefined) out[k] = obj[k];
  return out;
}

export const COMMAND_TYPES = new Set<string>([
  "road.update", "road.split", "road.settings", "road.budget", "road.plan",
  "account.connect", "account.disconnect", "account.opening",
  "home.add", "home.update", "home.remove", "home.contact", "captain.handoff",
  "request.create", "request.sent", "request.close", "request.reopen", "request.delete", "message.log",
  "payment.record", "payment.void",
  "expense.create", "expense.approve", "expense.reject", "expense.pay", "expense.delete",
  "contractor.save", "contractor.remove", "work.save", "work.remove",
  "vote.create", "vote.cast", "vote.close", "doc.add", "doc.remove",
  "agreement.terms", "agreement.purchase", "agreement.step", "agreement.sign",
  "letter.create", "letterRequest.create", "letterRequest.decline",
  "reserve.save", "bid.save", "bid.quote", "bid.removeQuote", "bid.award", "bid.remove",
  "plan.create", "plan.cancel", "notice.create",
] satisfies CommandType[]);

export function isCommand(value: unknown): value is Command {
  return !!value && typeof value === "object" && COMMAND_TYPES.has((value as { type?: string }).type ?? "");
}

export function thresholdCount(threshold: Vote["threshold"], eligible: number): number {
  if (threshold === "unanimous") return eligible;
  if (threshold === "two-thirds") return Math.ceil((eligible * 2) / 3);
  return Math.floor(eligible / 2) + 1;
}

export function votePasses(v: Vote, eligible: number): boolean {
  const yes = v.ballots.filter((b) => b.choice === "yes").length;
  return yes >= thresholdCount(v.threshold, eligible);
}

export function applyAll(road: Road, cmds: Command[], ctx: Ctx): Road {
  return cmds.reduce((r, c) => applyCommand(r, c, ctx), road);
}

/** Commands a neighbor's link may send, and the checks that keep them to their own home. */
export function assertNeighborCommand(road: Road, homeId: string, cmd: Command): void {
  switch (cmd.type) {
    case "payment.record": {
      const p = cmd.payment;
      if (p.homeId !== homeId) fail("You can only pay for your own home.", 403);
      if (p.method !== "ach" && p.method !== "card") fail("Pay by bank or card from this page.", 403);
      if (p.recordedBy !== "neighbor") fail("Not allowed.", 403);
      if (p.requestId) {
        const r = must(road.requests.find((x) => x.id === p.requestId), "Request");
        if (!r.lines.some((l) => l.homeId === homeId)) fail("That request isn't for your home.", 403);
      }
      if (p.amount > 5_000_000) fail("That amount is too large for an online payment.");
      return;
    }
    case "vote.cast":
      if (cmd.ballot.homeId !== homeId || cmd.ballot.via !== "link") fail("You can only vote for your own home.", 403);
      return;
    case "agreement.sign":
      if (cmd.signature.homeId !== homeId || cmd.signature.via !== "link") fail("You can only sign for your own home.", 403);
      return;
    case "home.contact":
      if (cmd.homeId !== homeId) fail("You can only change your own contact settings.", 403);
      return;
    default:
      fail("Not allowed from a neighbor link.", 403);
  }
}
