import "server-only";

import type { Command } from "../commands.ts";
import { fmtDate, fmtDateTime } from "../dates.ts";
import { money } from "../money.ts";
import { captainHome, displayName, requestProgress } from "../selectors.ts";
import type { Home, Road } from "../types.ts";
import { emailEnabled, sendEmail, sendSms, smsEnabled, validEmail } from "./notify.ts";
import { once } from "./store.ts";
import { refundIntent, usesStripe } from "./stripe.ts";

// Messages Road Fund sends on its own after something happens: receipts,
// captain alerts, letters to closing pros. Best effort: a failed email never
// undoes a payment or a saved change.

function live(road: Road): boolean {
  return !road.demo && emailEnabled;
}

function from(road: Road): string {
  return `${road.name} via Road Fund`;
}

function neighborUrl(origin: string, road: Road, home: Home, hash = ""): string {
  return `${origin}/n/${road.id}/${home.token}${hash ? `#${hash}` : ""}`;
}

function wantsEmail(home: Home | undefined | null): home is Home {
  return !!home && validEmail(home.email) && home.emailOptIn !== false;
}

async function safe(label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (err) {
    console.error(`notify: ${label}`, err);
  }
}

const HOW: Record<string, string> = { ach: "from a checking account", card: "by card", check: "by check", cash: "in cash" };
const METHOD: Record<string, string> = { ach: "checking account", card: "card", check: "check", cash: "cash", other: "other" };

/** Receipt to the neighbor, and a heads-up to the captain when the neighbor paid online. */
export async function notifyPayment(road: Road, paymentId: string, origin: string): Promise<void> {
  if (!live(road)) return;
  const p = road.payments.find((x) => x.id === paymentId);
  const home = p && road.homes.find((h) => h.id === p.homeId);
  if (!p || !home || p.status !== "ok") return;
  // Simulated online payments (no Stripe) get no receipt; checks and cash do.
  if (p.recordedBy === "neighbor" && !p.stripeSessionId) return;
  // The return page and the webhook can both report the same payment.
  if (!(await once(`receipt:${p.id}`, 60 * 60 * 24 * 30))) return;
  const request = road.requests.find((r) => r.id === p.requestId);
  const cap = captainHome(road);
  const clearing = p.method === "ach" && p.recordedBy === "neighbor";

  if (wantsEmail(home)) {
    await safe("receipt", () =>
      sendEmail({
        to: home.email,
        fromName: from(road),
        replyTo: cap?.email,
        subject: `Receipt ${p.receiptNo}: ${money(p.amount)} to ${road.name}`,
        text: [
          `Thank you. ${road.name} received ${money(p.amount)} from ${home.label}${request ? ` for ${request.title}` : ""}.`,
          [
            `Receipt: ${p.receiptNo}`,
            `Date: ${fmtDateTime(p.paidAt)}`,
            `Paid by: ${METHOD[p.method] ?? p.method}`,
            p.charged > p.amount ? `Total charged: ${money(p.charged)} (includes ${money(p.charged - p.amount)} in fees)` : null,
          ]
            .filter(Boolean)
            .join("\n"),
          clearing ? `Payments from a checking account take about 4 business days to arrive. Your page shows it as on its way until then.` : null,
          `See your receipt and what the road spends money on:\n${neighborUrl(origin, road, home, `receipt-${p.id}`)}`,
          `Questions? Reply to this email to reach ${cap ? displayName(cap) : "your road captain"}.`,
        ]
          .filter(Boolean)
          .join("\n\n"),
      }),
    );
  }

  if (p.recordedBy === "neighbor" && cap && validEmail(cap.email)) {
    const prog = request ? requestProgress(road, request, new Date()) : null;
    await safe("captain payment alert", () =>
      sendEmail({
        to: cap.email,
        fromName: "Road Fund",
        subject: `${home.label} paid ${money(p.amount)}`,
        text: [
          `${displayName(home)} (${home.label}) paid ${money(p.amount)} ${HOW[p.method] ?? ""}${request ? ` toward ${request.title}` : ""}.`,
          prog ? `${prog.homesPaid} of ${prog.homesBilled} homes paid. ${money(prog.collected + prog.processing)} of ${money(prog.billed)} collected.` : null,
          clearing ? `It's from a checking account, so it arrives in about 4 business days.` : null,
          `${origin}/app/money`,
        ]
          .filter(Boolean)
          .join("\n\n"),
      }),
    );
  }
}

/** A closing pro asked for a letter: tell the captain, confirm to the requester. */
export async function notifyLetterRequest(road: Road, requestId: string, origin: string): Promise<void> {
  if (!live(road)) return;
  const r = road.letterRequests.find((x) => x.id === requestId);
  if (!r || !(await once(`lreq:${r.id}`, 60 * 60 * 24 * 30))) return;
  const cap = captainHome(road);
  const who = r.requester.company ? `${r.requester.name} at ${r.requester.company}` : r.requester.name;
  if (cap && validEmail(cap.email)) {
    await safe("captain letter alert", () =>
      sendEmail({
        to: cap.email,
        fromName: "Road Fund",
        replyTo: r.requester.email,
        subject: `Road Status Letter requested: ${r.propertyAddress}`,
        text: [
          `${who} asked for a Road Status Letter for ${r.propertyAddress}.`,
          r.closingDate ? `Closing date: ${fmtDate(r.closingDate)}. Most closings need the letter a few days before.` : null,
          r.note ? `Their note: ${r.note}` : null,
          `Review and issue it here. It takes about a minute because Road Fund fills it in from your records:\n${origin}/app/papers/letters`,
          `Reply to this email to reach ${r.requester.name} directly.`,
        ]
          .filter(Boolean)
          .join("\n\n"),
      }),
    );
  }
  await safe("requester confirmation", () =>
    sendEmail({
      to: r.requester.email,
      fromName: "Road Fund",
      replyTo: cap?.email,
      subject: `Request received: Road Status Letter for ${r.propertyAddress}`,
      text: [
        `We sent your request to the road captain for ${road.name} (${road.county} County, ${road.state}).`,
        `When the letter is issued, we'll email it to you with a code you can verify at ${origin}/verify.`,
        r.paidIntentId ? `Your letter fee is on file. If the road can't issue the letter, it's refunded in full.` : null,
      ]
        .filter(Boolean)
        .join("\n\n"),
    }),
  );
}

async function sendLetter(road: Road, letterId: string, origin: string) {
  const l = road.letters.find((x) => x.id === letterId);
  if (!l || !validEmail(l.requester.email)) return;
  const cap = captainHome(road);
  await sendEmail({
    to: l.requester.email,
    fromName: from(road),
    replyTo: cap?.email,
    subject: `Road Status Letter ${l.code}: ${l.snapshot.property.address || l.snapshot.property.label}`,
    text: [
      `${road.name} issued Road Status Letter ${l.code} for ${l.snapshot.property.address || l.snapshot.property.label}.`,
      `View, print or save it as a PDF:\n${origin}/verify/${l.code}`,
      `The letter is good through ${fmtDate(l.validUntil)}. Anyone can confirm it's genuine and unchanged by entering the code at ${origin}/verify.`,
      `Questions about the road? Reply to this email to reach ${cap ? displayName(cap) : "the road captain"}.`,
    ].join("\n\n"),
  });
}

/** Runs after a captain's change is saved. */
export async function afterCaptainChange(before: Road, after: Road, commands: Command[], origin: string): Promise<void> {
  for (const c of commands) {
    if (c.type === "letterRequest.decline") {
      const was = before.letterRequests.find((r) => r.id === c.requestId);
      if (!was || was.status !== "new") continue;
      let refunded = false;
      if (was.paidIntentId && usesStripe(after)) {
        await safe("letter refund", async () => {
          await refundIntent(was.paidIntentId!);
          refunded = true;
        });
      }
      if (live(after)) {
        const cap = captainHome(after);
        await safe("decline email", () =>
          sendEmail({
            to: was.requester.email,
            fromName: from(after),
            replyTo: cap?.email,
            subject: `Road Status Letter request for ${was.propertyAddress}`,
            text: [
              `${after.name} can't issue a Road Status Letter for ${was.propertyAddress}.`,
              c.note ? `The road captain wrote: ${c.note}` : null,
              refunded ? `Your letter fee has been refunded. It shows on your card in 5 to 10 days.` : null,
              `Reply to this email to reach the road captain.`,
            ]
              .filter(Boolean)
              .join("\n\n"),
          }),
        );
      }
    }
    if (!live(after)) continue;
    if (c.type === "letter.create" && !before.letters.some((l) => l.id === c.letter.id)) {
      await safe("letter delivery", () => sendLetter(after, c.letter.id, origin));
    }
    if (c.type === "payment.record" && c.payment.recordedBy === "captain" && !before.payments.some((p) => p.id === c.payment.id)) {
      await notifyPayment(after, c.payment.id, origin);
    }
  }
}

/** Runs after a neighbor's change is saved: confirm text sign-ups, tell the captain about votes and signatures that finish something. */
export async function afterNeighborChange(before: Road, after: Road, homeId: string, cmd: Command, origin: string): Promise<void> {
  if (after.demo) return;
  const was = before.homes.find((h) => h.id === homeId);
  const home = after.homes.find((h) => h.id === homeId);
  if (!was || !home) return;
  // Carriers expect a confirmation text right after someone opts in.
  if (cmd.type === "home.contact" && home.smsOptIn && (!was.smsOptIn || was.phone !== home.phone) && smsEnabled) {
    await safe("opt-in confirmation", () =>
      sendSms(home.phone, `Road Fund: you'll get texts about ${after.name} dues, votes and road work. Up to 6 texts a month. Msg & data rates may apply. Reply HELP for help, STOP to stop.`),
    );
  }
  if (!live(after)) return;
  const cap = captainHome(after);
  if (!cap || !validEmail(cap.email) || cap.id === homeId) return;
  if (cmd.type === "agreement.sign") {
    const v = after.agreement.version;
    const signed = after.agreement.signatures.filter((s) => s.version === v).length;
    if (signed === after.homes.length && before.agreement.signatures.filter((s) => s.version === v).length < signed) {
      await safe("all signed", () =>
        sendEmail({
          to: cap.email,
          fromName: "Road Fund",
          subject: `Every home signed the ${after.name} agreement`,
          text: `All ${signed} homes signed version ${v} of the road maintenance agreement. Next: have it notarized and recorded with ${after.county} County so it binds future owners.\n\n${origin}/app/papers/agreement`,
        }),
      );
    }
  }
}

/** A plan or agreement package was bought: thank the captain, and tell Road Fund staff about packages to fulfill. */
export async function notifyPurchase(road: Road, sessionId: string, kind: string, origin: string): Promise<void> {
  if (!live(road) || !(await once(`purchase:${sessionId}`, 60 * 60 * 24 * 90))) return;
  const cap = captainHome(road);
  const support = process.env.SUPPORT_EMAIL;
  if (kind === "agreement") {
    if (validEmail(support)) {
      await safe("package ops", () =>
        sendEmail({
          to: support,
          fromName: "Road Fund",
          replyTo: cap?.email,
          subject: `Agreement package: ${road.name} (${road.county} County, ${road.state})`,
          text: [
            `${road.name} bought the agreement package.`,
            `Captain: ${cap ? `${displayName(cap)}, ${cap.email || "no email"}, ${cap.phone || "no phone"}` : "not set"}`,
            `${road.homes.length} homes · agreement step: ${road.agreement.step} · road code ${road.code}`,
            `Book the attorney review and notary within one business day.`,
          ].join("\n"),
        }),
      );
    }
    if (cap && validEmail(cap.email)) {
      await safe("package receipt", () =>
        sendEmail({
          to: cap.email,
          fromName: "Road Fund",
          replyTo: validEmail(support) ? support : null,
          subject: "Your agreement package",
          text: `Thanks for adding the agreement package for ${road.name}. We'll email you within one business day to book a ${road.state} attorney to review the draft and set up the notary. Attorney, notary and county fees are billed at cost, and we'll tell you each one before it's charged.\n\n${origin}/app/papers/agreement`,
        }),
      );
    }
  } else if (kind === "plan" && cap && validEmail(cap.email)) {
    await safe("plan receipt", () =>
      sendEmail({
        to: cap.email,
        fromName: "Road Fund",
        subject: `${road.name} is on the Road Fund plan`,
        text: `Thank you. ${road.name} can now send as many bills as it needs, mail late notices, set up payment plans, pay contractors and hold votes. Stripe emails you the receipt. To see receipts, change the card or cancel, go to Settings.\n\n${origin}/app/settings`,
      }),
    );
  }
}
