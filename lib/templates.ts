// Message templates. Short enough for a text, plain enough for anyone, and
// they name the amount, the date and the link every time.
// Templates use {tokens} so one edited (or AI-rewritten) template can be
// filled in per neighbor.

import { fmtDate } from "./dates.ts";
import { money } from "./money.ts";
import type { NoticeKind } from "./types.ts";

export const SMS_FOOTER = "Reply STOP to stop texts.";

export type TemplateKind = "intro" | "dues" | "reminder" | "vote" | "sign" | NoticeKind;

export const TOKEN_TEMPLATES: Record<TemplateKind, string> = {
  intro: "Hi {first}, {road} now keeps road dues, bills and votes on Road Fund. This is your page: what you owe and why, where the money goes, and any open votes. No app or password: {link} – {captain}",
  dues: "Hi {first}, {title} for {road} are ready. Your share is {amount}, due {due}. It covers {budget}. See why and pay by bank or card: {link} – {captain}",
  reminder: "Hi {first}, a reminder that your {road} share of {amount} is due {due}. Pay here: {link} Thanks! – {captain}",
  vote: "Hi {first}, please vote by {deadline}: {question} Tap to vote: {link} – {captain}",
  sign: "Hi {first}, the {road} maintenance agreement is ready to sign. Read the plain-English summary and sign here: {link} – {captain}",
  friendly: "Hi {first}, your {road} share of {amount} was due {due} and hasn't come through yet. If it slipped by, you can pay here: {link} If something's going on, reply and we'll work out a plan. – {captain}",
  formal: "Hi {first}, our records show {amount} unpaid for {title}, due {due}. Please pay within 14 days: {link} Under our road agreement a late fee of {lateFee} applies after {graceDays} days. If you think this is wrong, reply with your receipt. – {captain}",
  final: "Hi {first}, this is a final notice. {amount} for {title} has been unpaid since {due}. If it isn't paid or a payment plan set up within 10 days, the road will file in small claims court to collect it, plus fees allowed by our agreement. Pay here: {link} – {captain}",
};

export const TEMPLATE_SUBJECT: Record<TemplateKind, string> = {
  intro: "Your page for {road}",
  dues: "{title} for {road}: your share is {amount}",
  reminder: "Reminder: {road} dues due {due}",
  vote: "Vote by {deadline}: {question}",
  sign: "{road} maintenance agreement ready to sign",
  friendly: "Your {road} share is past due",
  formal: "Notice of unpaid road dues: {road}",
  final: "Final notice of unpaid road dues: {road}",
};

export interface MessageContext {
  roadName: string;
  captainName: string;
  recipientName?: string;
  amount?: number;
  dueDate?: string;
  link?: string;
  title?: string;
  budgetSummary?: string;
  question?: string;
  deadline?: string;
  lateFee?: number;
  graceDays?: number;
}

export function firstName(name?: string): string {
  if (!name) return "neighbor";
  const n = name.trim().split(/\s|&/)[0];
  return n || "neighbor";
}

export function tokenValues(c: MessageContext): Record<string, string> {
  return {
    first: firstName(c.recipientName),
    road: c.roadName,
    captain: firstName(c.captainName),
    amount: c.amount !== undefined ? money(c.amount) : "your share",
    due: c.dueDate ? fmtDate(c.dueDate) : "soon",
    link: c.link ?? "[your link]",
    title: c.title ?? "road dues",
    budget: c.budgetSummary || "plowing and upkeep",
    question: c.question ?? "",
    deadline: c.deadline ? fmtDate(c.deadline) : "the deadline",
    lateFee: c.lateFee !== undefined ? money(c.lateFee) : "$25.00",
    graceDays: String(c.graceDays ?? 30),
  };
}

export function fillTokens(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => values[k] ?? m);
}

export function messageTemplate(kind: TemplateKind, c: MessageContext): string {
  return fillTokens(TOKEN_TEMPLATES[kind], tokenValues(c));
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
