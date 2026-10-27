import "server-only";

import Stripe from "stripe";
import { buildPayment, CommandError } from "../commands.ts";
import { addDays, isoDate } from "../dates.ts";
import { computeCharge } from "../fees.ts";
import { LETTER_FEE } from "../letter.ts";
import type { Home, Plan, Road } from "../types.ts";
import { kvEnabled } from "./kv.ts";
import { mutate } from "./store.ts";

// Optional. With STRIPE_SECRET_KEY set, roads connect real Stripe accounts and
// neighbors pay through Stripe Checkout. Test keys (sk_test_...) move no money.
const KEY = process.env.STRIPE_SECRET_KEY ?? "";
// Stripe needs cloud storage: webhooks have to find the road on the server.
export const stripeEnabled = Boolean(KEY) && kvEnabled;
export const stripeMode: "live" | "test" | null = !KEY ? null : KEY.startsWith("sk_live_") ? "live" : "test";
export const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";

let client: Stripe | null = null;
export function stripe(): Stripe {
  if (!stripeEnabled) throw new CommandError("Payments aren't connected on this deployment.", 501);
  if (!client) {
    // STRIPE_API_BASE points the SDK at a local mock for automated tests.
    const base = process.env.STRIPE_API_BASE ? new URL(process.env.STRIPE_API_BASE) : null;
    client = new Stripe(KEY, {
      maxNetworkRetries: 2,
      appInfo: { name: "Road Fund" },
      ...(base ? { host: base.hostname, port: base.port, protocol: base.protocol.replace(":", "") as "http" | "https" } : {}),
    });
  }
  return client;
}

/** Stripe handles payments for real roads; demo roads stay simulated. */
export function usesStripe(road: Road): boolean {
  return stripeEnabled && !road.demo;
}

export const PLAN_PRICE: Record<Exclude<Plan, "starter">, number> = { roadfund: 14_900, plus: 24_900 };
export const AGREEMENT_PACKAGE = 24_900;

// ---------- Connect: each road gets its own Express account ----------

export async function ensureAccount(road: Road, captain: Home | null): Promise<string> {
  if (road.account.stripeAccountId) return road.account.stripeAccountId;
  const acct = await stripe().accounts.create({
    type: "express",
    country: "US",
    email: captain?.email || undefined,
    business_type: "non_profit",
    business_profile: {
      name: `${road.name} Road Association`,
      product_description: "Shared maintenance dues for a private road (plowing, grading, gravel).",
      mcc: "8699",
    },
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
      us_bank_account_ach_payments: { requested: true },
    },
    metadata: { roadId: road.id, roadCode: road.code },
  });
  return acct.id;
}

export async function onboardingUrl(accountId: string, origin: string): Promise<string> {
  const link = await stripe().accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${origin}/app/money/account?stripe=refresh`,
    return_url: `${origin}/app/money/account?stripe=return`,
  });
  return link.url;
}

export interface AccountState {
  status: "pending" | "connected";
  bankName: string;
  last4: string;
  due: number;
}

export async function accountState(accountId: string): Promise<AccountState> {
  const a = await stripe().accounts.retrieve(accountId);
  return accountStateFrom(a);
}

export function accountStateFrom(a: Stripe.Account): AccountState {
  const bank = a.external_accounts?.data.find((x) => x.object === "bank_account") as Stripe.BankAccount | undefined;
  return {
    status: a.charges_enabled && a.payouts_enabled ? "connected" : "pending",
    bankName: bank?.bank_name ?? "",
    last4: bank?.last4 ?? "",
    due: a.requirements?.currently_due?.length ?? 0,
  };
}

export async function dashboardUrl(accountId: string): Promise<string> {
  return (await stripe().accounts.createLoginLink(accountId)).url;
}

// ---------- Neighbor dues through Checkout ----------

export async function duesCheckout(input: {
  road: Road;
  home: Home;
  token: string;
  requestId: string;
  requestTitle: string;
  amount: number;
  method: "ach" | "card";
  paymentId: string;
  origin: string;
}): Promise<string> {
  const { road, home } = input;
  const acct = road.account.stripeAccountId;
  if (!acct || road.account.status !== "connected") throw new CommandError("The road's bank account isn't ready for online payments yet. Ask your road captain.", 409);
  const charge = computeCharge(input.amount, input.method, road.settings.payerCoversFees);
  const back = `${input.origin}/n/${road.id}/${input.token}`;
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    payment_method_types: [input.method === "ach" ? "us_bank_account" : "card"],
    ...(input.method === "ach"
      ? { payment_method_options: { us_bank_account: { verification_method: "instant", financial_connections: { permissions: ["payment_method"] } } } }
      : {}),
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: charge.total,
          product_data: {
            name: `${input.requestTitle}: ${home.label}`,
            description: road.settings.payerCoversFees ? `Your share of ${road.name} road costs, plus a $1 Road Fund fee and processing.` : `Your share of ${road.name} road costs.`,
          },
        },
      },
    ],
    payment_intent_data: {
      application_fee_amount: charge.platformFee + charge.processingFee,
      on_behalf_of: acct,
      transfer_data: { destination: acct },
      description: `${road.name}: ${input.requestTitle} (${home.label})`,
      metadata: { kind: "dues", roadId: road.id, homeId: home.id, paymentId: input.paymentId },
    },
    customer_email: home.email || undefined,
    client_reference_id: input.paymentId,
    metadata: {
      kind: "dues",
      roadId: road.id,
      homeId: home.id,
      requestId: input.requestId,
      paymentId: input.paymentId,
      amount: String(input.amount),
      method: input.method,
    },
    success_url: `${back}?paid={CHECKOUT_SESSION_ID}`,
    cancel_url: `${back}#pay-${input.requestId}`,
  });
  if (!session.url) throw new Error("Stripe didn't return a checkout link.");
  return session.url;
}

/**
 * Records a completed dues checkout on the road. Safe to call more than once
 * (from the return page and from the webhook): the payment id makes it idempotent.
 */
export async function recordDuesSession(session: Stripe.Checkout.Session): Promise<Road | null> {
  const m = session.metadata ?? {};
  if (m.kind !== "dues" || !m.roadId || !m.homeId || !m.paymentId) return null;
  if (session.status !== "complete") return null;
  // Cards are "paid" right away; bank debits complete as "unpaid" while the transfer settles.
  if (session.payment_status !== "paid" && session.payment_status !== "unpaid") return null;
  const method = m.method === "card" ? "card" : "ach";
  const amount = Number(m.amount);
  if (!Number.isInteger(amount) || amount <= 0) return null;
  return mutate(m.roadId, (road) => {
    const at = new Date((session.created ?? Date.now() / 1000) * 1000).toISOString();
    const payment = {
      ...buildPayment(road, {
        id: m.paymentId,
        homeId: m.homeId,
        requestId: m.requestId || null,
        amount,
        method,
        payerName: session.customer_details?.name ?? "",
        recordedBy: "neighbor",
        paidAt: at,
      }),
      stripeSessionId: session.id,
    };
    const home = road.homes.find((h) => h.id === m.homeId);
    return {
      commands: road.payments.some((p) => p.id === m.paymentId) ? [] : [{ type: "payment.record", payment }],
      ctx: { at: new Date().toISOString(), actor: { kind: "neighbor", homeId: m.homeId, name: home?.owners || home?.label || "Neighbor" } },
    };
  });
}

export async function failDuesSession(session: Stripe.Checkout.Session): Promise<void> {
  const m = session.metadata ?? {};
  if (m.kind !== "dues" || !m.roadId || !m.paymentId) return;
  await mutate(m.roadId, (road) => ({
    commands: road.payments.some((p) => p.id === m.paymentId && p.status === "ok")
      ? [{ type: "payment.void", paymentId: m.paymentId, reason: "The bank payment didn't go through. The neighbor still owes this amount." }]
      : [],
    ctx: { at: new Date().toISOString(), actor: { kind: "system", homeId: null, name: "Stripe" } },
  }));
}

// ---------- Road Fund purchases: plans, agreement package ----------

export async function planCheckout(road: Road, plan: Exclude<Plan, "starter">, captain: Home | null, origin: string): Promise<string> {
  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: PLAN_PRICE[plan],
          recurring: { interval: "year" },
          product_data: { name: plan === "plus" ? "Road Fund Plus" : "Road Fund", description: `Yearly plan for ${road.name}` },
        },
      },
    ],
    customer: road.billing?.customerId ?? undefined,
    customer_email: road.billing?.customerId ? undefined : captain?.email || undefined,
    subscription_data: { metadata: { kind: "plan", roadId: road.id, plan } },
    metadata: { kind: "plan", roadId: road.id, plan },
    success_url: `${origin}/app/settings?billing={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/app/settings`,
  });
  if (!session.url) throw new Error("Stripe didn't return a checkout link.");
  return session.url;
}

export async function agreementCheckout(road: Road, captain: Home | null, origin: string): Promise<string> {
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: AGREEMENT_PACKAGE, product_data: { name: "Agreement package", description: `Attorney review booking, e-signatures, notary and recording for ${road.name}. Attorney, notary and county fees are billed separately at cost.` } } }],
    customer: road.billing?.customerId ?? undefined,
    customer_email: road.billing?.customerId ? undefined : captain?.email || undefined,
    metadata: { kind: "agreement", roadId: road.id },
    success_url: `${origin}/app/papers/agreement?billing={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/app/papers/agreement`,
  });
  if (!session.url) throw new Error("Stripe didn't return a checkout link.");
  return session.url;
}

/** Applies a completed plan or agreement purchase. Idempotent. */
export async function recordRoadPurchase(session: Stripe.Checkout.Session): Promise<Road | null> {
  const m = session.metadata ?? {};
  if (!m.roadId || session.status !== "complete") return null;
  const at = new Date().toISOString();
  const actor = { kind: "system" as const, homeId: null, name: "Stripe" };
  if (m.kind === "plan" && (m.plan === "roadfund" || m.plan === "plus")) {
    const plan = m.plan;
    return mutate(m.roadId, (road) => ({
      commands:
        road.billing?.subscriptionId === session.subscription && road.plan === plan
          ? []
          : [
              {
                type: "road.billing",
                plan,
                billing: {
                  customerId: typeof session.customer === "string" ? session.customer : session.customer?.id ?? null,
                  subscriptionId: typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null,
                  paidThrough: addDays(isoDate(), 365),
                },
              },
            ],
      ctx: { at, actor },
    }));
  }
  if (m.kind === "agreement" && session.payment_status === "paid") {
    return mutate(m.roadId, (road) => ({ commands: road.agreement.packagePurchasedAt ? [] : [{ type: "agreement.purchase" }], ctx: { at, actor } }));
  }
  return null;
}

export async function billingPortalUrl(customerId: string, origin: string): Promise<string> {
  const s = await stripe().billingPortal.sessions.create({ customer: customerId, return_url: `${origin}/app/settings` });
  return s.url;
}

/** Subscription ended or lapsed: drop back to the free plan. */
export async function endSubscription(sub: Stripe.Subscription): Promise<void> {
  const roadId = sub.metadata?.roadId;
  if (!roadId) return;
  await mutate(roadId, (road) => ({
    commands: road.billing?.subscriptionId === sub.id && road.plan !== "starter" ? [{ type: "road.billing", plan: "starter", billing: { ...road.billing!, subscriptionId: null, paidThrough: null } }] : [],
    ctx: { at: new Date().toISOString(), actor: { kind: "system", homeId: null, name: "Stripe" } },
  }));
}

// ---------- Road Status Letter fee, paid by the requester ----------

export async function letterCheckout(input: { roadId: string; roadCode: string; origin: string; requester: { name: string; email: string; company: string }; fields: Record<string, string> }): Promise<string> {
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: LETTER_FEE, product_data: { name: "Road Status Letter", description: `Requested for ${input.fields.propertyAddress}. Refunded if the road can't issue it.` } } }],
    customer_email: input.requester.email,
    metadata: { kind: "letter", roadId: input.roadId, roadCode: input.roadCode, ...input.fields },
    success_url: `${input.origin}/closing?paid={CHECKOUT_SESSION_ID}#request`,
    cancel_url: `${input.origin}/closing#request`,
  });
  if (!session.url) throw new Error("Stripe didn't return a checkout link.");
  return session.url;
}

export async function refundIntent(paymentIntentId: string): Promise<void> {
  await stripe().refunds.create({ payment_intent: paymentIntentId, reason: "requested_by_customer" });
}

export async function retrieveSession(id: string): Promise<Stripe.Checkout.Session> {
  if (!/^cs_[A-Za-z0-9_]+$/.test(id)) throw new CommandError("That payment reference isn't valid.");
  return stripe().checkout.sessions.retrieve(id);
}

export type { Stripe };

/** Creates the title company's letter request once its $75 payment completes. Idempotent. */
export async function recordLetterSession(session: Stripe.Checkout.Session): Promise<{ road: Road; requestId: string } | null> {
  const m = session.metadata ?? {};
  if (m.kind !== "letter" || !m.roadId || session.status !== "complete" || session.payment_status !== "paid") return null;
  const id = `lreq_${session.id.replace(/^cs_(test_|live_)?/, "").slice(0, 24).toLowerCase()}`;
  const intent = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;
  const road = await mutate(m.roadId, (road) => ({
    commands: road.letterRequests.some((r) => r.id === id)
      ? []
      : [
          {
            type: "letterRequest.create",
            request: {
              id,
              createdAt: new Date().toISOString(),
              homeId: road.homes.some((h) => h.id === m.homeId) ? m.homeId : null,
              propertyAddress: m.propertyAddress ?? "",
              requester: {
                name: m.requesterName ?? "",
                company: m.requesterCompany ?? "",
                email: m.requesterEmail ?? session.customer_details?.email ?? "",
                phone: m.requesterPhone ?? "",
                role: (["title", "lender", "attorney", "agent", "seller", "buyer", "other"].includes(m.role ?? "") ? m.role : "other") as "title",
              },
              closingDate: /^\d{4}-\d{2}-\d{2}$/.test(m.closingDate ?? "") ? m.closingDate! : null,
              status: "new",
              letterId: null,
              note: `${m.note ? `${m.note} · ` : ""}$75 letter fee paid`,
              paidIntentId: intent,
            },
          },
        ],
    ctx: { at: new Date().toISOString(), actor: { kind: "public", homeId: null, name: m.requesterCompany || m.requesterName || "Requester" } },
  }));
  return { road, requestId: id };
}
