"use client";

import type { Recipient } from "@/components/app/send-sheet";
import { budgetSummary } from "../templates";
import { fmtDate } from "../dates";
import { money } from "../money";
import { captainHome, displayName, requestProgress } from "../selectors";
import type { DuesRequest, Home, Road, Vote } from "../types";
import { neighborLink } from "./backend";

function base(road: Road, h: Home, values: Record<string, string>): Recipient {
  const cap = captainHome(road);
  return {
    homeId: h.id,
    name: displayName(h),
    label: h.label,
    address: h.address,
    phone: h.phone,
    email: h.email,
    smsOptIn: h.smsOptIn,
    values: {
      first: (h.owners || h.label).split(/\s|&/)[0] || "neighbor",
      road: road.name,
      captain: cap ? displayName(cap).split(/\s|&/)[0] : "your road captain",
      link: neighborLink(road, h.token),
      ...values,
    },
  };
}

/** Recipients for a dues request. `which` picks everyone or only those who still owe. */
export function duesRecipients(road: Road, request: DuesRequest, now: Date, which: "all" | "unpaid" = "all"): Recipient[] {
  const prog = requestProgress(road, request, now);
  return prog.lines
    .filter((l) => l.due > 0 && (which === "all" || l.outstanding > 0))
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
