// Messages to neighbors. People are warned not to tap links in unexpected
// texts, so every message says who it's from (the captain by full name, and
// the road), states the amount, what it's for and the date, and gives a way to
// check without the link. No exclamation marks, no urgency, no legal threats
// in a text: late notices go out as dated letters instead (noticeLetter).
// Templates use {tokens} so one edited template fills in per neighbor.

import { fmtDate } from "./dates.ts";
import { money } from "./money.ts";
import type { Home, Road } from "./types.ts";

export const SMS_FOOTER = "Reply STOP to stop texts.";

export type TemplateKind = "intro" | "dues" | "reminder" | "vote" | "sign" | "friendly" | "letterSent";

export const TOKEN_TEMPLATES: Record<TemplateKind, string> = {
  intro:
    "Hi {first}, this is {captainFull} on {road}. The road now keeps its bills, payments and votes on Road Fund, so everyone sees the same numbers. Your page shows what you owe and why: {link} {verify}",
  dues: "Hi {first}, this is {captainFull} on {road}. Your share of {title} is {amount}, due {due}. It pays for {budget}. See how it was split and pay here: {link} {verify}",
  reminder: "Hi {first}, this is {captainFull} on {road}. A reminder that your share of {title}, {amount}, is due {due}. Your page: {link} If you already paid or mailed a check, please ignore this.",
  vote: "Hi {first}, this is {captainFull} on {road}. Please vote by {deadline} on this question: {question} Vote here: {link} {verify}",
  sign: "Hi {first}, this is {captainFull} on {road}. The road agreement is ready to sign. It says who pays for what and how we decide on work. Read the short summary and sign here: {link} {verify}",
  friendly:
    "Hi {first}, this is {captainFull} on {road}. Our records show {amount} still open for {title}, which was due {due}. If it slipped by, your page has the details: {link} If money is tight, call me and we can set up a payment plan. {verify}",
  letterSent: "Hi {first}, this is {captainFull} on {road}. I mailed you a letter about your share of {title}. Please look for it. {verify}",
};

export const TEMPLATE_SUBJECT: Record<TemplateKind, string> = {
  intro: "{road} is now using Road Fund",
  dues: "{road}: your share of {title} is {amount}",
  reminder: "{road}: {amount} due {due}",
  vote: "{road}: please vote by {deadline}",
  sign: "{road}: the road agreement is ready to sign",
  friendly: "{road}: your share is still open",
  letterSent: "{road}: I mailed you a letter",
};

export function firstName(name?: string): string {
  if (!name) return "neighbor";
  const n = name.trim().split(/\s|&/)[0];
  return n || "neighbor";
}

/** "Not sure? Call me at (231) 555-0113, or leave a check at 215 Birch Hollow Ln." */
export function verifyLine(captain: Pick<Home, "phone" | "address"> | null): string {
  const phone = captain?.phone.trim();
  const address = captain?.address.trim();
  if (phone && address) return `Not sure about this? Call me at ${phone}, or leave a check at ${address}.`;
  if (phone) return `Not sure about this? Call me at ${phone}.`;
  if (address) return `Not sure about this? You can leave a check at ${address} instead.`;
  return "Not sure about this? Ask me before you pay.";
}

/** The values every message to this home can use. `link` is the neighbor's own page. */
export function baseValues(road: Road, home: Home, link: string): Record<string, string> {
  const cap = road.homes.find((h) => h.id === road.captainHomeId) ?? null;
  const capName = cap ? (cap.owners.split(" & ")[0] || cap.label).trim() : "your road captain";
  return {
    // Greet by name only when we have one; "Hi Lot" reads like a mistake.
    first: firstName(home.owners),
    road: road.name,
    captain: firstName(capName),
    captainFull: capName,
    verify: verifyLine(cap),
    link,
  };
}

export function fillTokens(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => values[k] ?? m).replace(/\s{2,}/g, " ").trim();
}

export function budgetSummary(labels: string[]): string {
  const clean = labels.filter(Boolean).map((l) => l.replace(/\s*\(.*\)$/, "").toLowerCase());
  if (clean.length <= 1) return clean.join("");
  return `${clean.slice(0, -1).join(", ")} and ${clean.at(-1)}`;
}

export function smsLength(text: string): { chars: number; segments: number } {
  const chars = text.length;
  return { chars, segments: chars <= 160 ? 1 : Math.ceil(chars / 153) };
}

// ---------- Late notices: dated letters, mailed or emailed ----------

export interface NoticeInput {
  kind: "formal" | "final";
  date: Date;
  road: Road;
  home: Home;
  amount: number;
  title: string;
  dueDate: string;
  link: string;
  /** Date an earlier formal notice went out, for the final notice. */
  formalSentOn?: string | null;
}

/** Plain, dated letter text. The captain prints and mails it (certified mail for the final one). */
export function noticeLetter(n: NoticeInput): { subject: string; body: string } {
  const { road, home } = n;
  const cap = road.homes.find((h) => h.id === road.captainHomeId) ?? null;
  const capName = cap ? cap.owners.split(" & ")[0] || cap.label : "The road captain";
  const a = road.agreement;
  const inForce = a.step === "recorded" || (a.step !== "draft" && a.signatures.filter((s) => s.version === a.version).length === road.homes.length);
  const agreementLine = inForce
    ? `Under our road maintenance agreement, a late fee of ${money(a.terms.lateFee)} applies after ${a.terms.graceDays} days.`
    : "";
  const payee = road.settings.checkPayee?.trim() || cap?.owners || road.name;
  const pay = `You can pay online at ${n.link}, or by check made out to ${payee}${cap?.address ? `, mailed or dropped off at ${cap.address}` : " and given to me"}.`;
  const call = cap?.phone ? `If you think this is a mistake, or you need to pay over time, please call me at ${cap.phone}. We can set up a payment plan.` : "If you think this is a mistake, or you need to pay over time, please let me know. We can set up a payment plan.";
  const dated = n.date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const to = `${home.owners || home.label}\n${home.address || home.label}`;
  const sign = `Sincerely,\n\n${capName}\nRoad captain, ${road.name}`;

  if (n.kind === "formal") {
    return {
      subject: `Letter about unpaid road dues: ${road.name}`,
      body: [
        dated,
        to,
        `Dear ${home.owners || "neighbor"},`,
        `Our road records show ${money(n.amount)} unpaid for ${n.title}, which was due ${fmtDate(n.dueDate)}.`,
        `Every home on ${road.name} shares the cost of keeping the road open and safe. ${agreementLine}`.trim(),
        `Please pay within 14 days of the date of this letter. ${pay}`,
        call,
        sign,
      ].join("\n\n"),
    };
  }
  return {
    subject: `Final letter about unpaid road dues: ${road.name}`,
    body: [
      dated,
      to,
      `Dear ${home.owners || "neighbor"},`,
      `This is a final letter about ${money(n.amount)} unpaid for ${n.title}, which was due ${fmtDate(n.dueDate)}.${n.formalSentOn ? ` I wrote to you about it on ${fmtDate(n.formalSentOn)}.` : ""}`,
      `If it isn't paid, or a payment plan isn't set up, within 10 days of the date of this letter, the road may file a claim in small claims court to collect it${inForce ? ", plus the costs our road agreement allows" : ""}. I would much rather settle it between neighbors.`,
      pay,
      call,
      sign,
    ].join("\n\n"),
  };
}
