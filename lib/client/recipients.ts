"use client";

import type { Recipient } from "@/components/app/send-sheet";
import { baseValues, budgetSummary } from "../templates";
import { fmtDate } from "../dates";
import { money } from "../money";
import { checkInMail, displayName, requestProgress } from "../selectors";
import type { DuesRequest, Home, Road, Vote } from "../types";
import { neighborLink } from "./backend";

function base(road: Road, h: Home, values: Record<string, string>): Recipient {
  return {
    homeId: h.id,
    name: displayName(h),
    label: h.label,
    address: h.address,
    phone: h.phone,
    email: h.email,
    smsOptIn: h.smsOptIn,
    emailOptIn: h.emailOptIn !== false,
    values: { ...baseValues(road, h, neighborLink(road, h.token)), ...values },
  };
}

/** Recipients for a dues request. `which` picks everyone or only those who still owe. */
export function duesRecipients(road: Road, request: DuesRequest, now: Date, which: "all" | "unpaid" = "all"): Recipient[] {
  const prog = requestProgress(road, request, now);
  return prog.lines
    .filter((l) => l.due > 0 && (which === "all" || (l.outstanding > 0 && !checkInMail(road, l.home.id, request.id, now))))
    .map((l) =>
      base(road, l.home, {
        amount: money(which === "all" ? l.due : l.outstanding),
        due: fmtDate(request.dueDate),
        title: request.title,
        budget: budgetSummary(request.budget.map((b) => b.label)) || "plowing and upkeep",
        lateFee: money(road.agreement.terms.lateFee),
        graceDays: String(road.agreement.terms.graceDays),
      }),
    );
}

export function voteRecipients(road: Road, vote: Vote): Recipient[] {
  const voted = new Set(vote.ballots.map((b) => b.homeId));
  return road.homes.filter((h) => !voted.has(h.id)).map((h) => base(road, h, { question: vote.question, deadline: fmtDate(vote.deadline) }));
}

export function introRecipients(road: Road): Recipient[] {
  return road.homes.filter((h) => h.id !== road.captainHomeId).map((h) => base(road, h, {}));
}

export function signRecipients(road: Road): Recipient[] {
  const signed = new Set(road.agreement.signatures.filter((s) => s.version === road.agreement.version).map((s) => s.homeId));
  return road.homes.filter((h) => !signed.has(h.id)).map((h) => base(road, h, {}));
}
