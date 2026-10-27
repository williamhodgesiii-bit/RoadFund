import { after } from "next/server";
import type Stripe from "stripe";
import { notifyLetterRequest, notifyPayment, notifyPurchase } from "@/lib/server/effects";
import { json } from "@/lib/server/http";
import { mutate, roadIdByStripeAccount } from "@/lib/server/store";
import { accountStateFrom, endSubscription, failDuesSession, recordDuesSession, recordLetterSession, recordRoadPurchase, stripe, stripeEnabled, syncSubscription, webhookSecret } from "@/lib/server/stripe";

/**
 * Stripe webhooks. Configure one endpoint at /api/stripe/webhook listening to
 * events on your account and on connected accounts:
 * checkout.session.completed, checkout.session.async_payment_succeeded,
 * checkout.session.async_payment_failed, account.updated,
 * customer.subscription.updated, customer.subscription.deleted.
 */
export async function POST(req: Request) {
  if (!stripeEnabled || !webhookSecret) return json({ error: "Webhooks aren't configured." }, 501);
  const payload = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(payload, req.headers.get("stripe-signature") ?? "", webhookSecret);
  } catch {
    return json({ error: "Bad signature" }, 400);
  }
  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const s = event.data.object;
        const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || new URL(req.url).origin;
        if (s.metadata?.kind === "dues") {
          const road = await recordDuesSession(s);
          const paymentId = s.metadata.paymentId;
          if (road && paymentId) after(() => notifyPayment(road, paymentId, origin));
        } else if (s.metadata?.kind === "letter") {
          const done = await recordLetterSession(s);
          if (done) after(() => notifyLetterRequest(done.road, done.requestId, origin));
        } else {
          const road = await recordRoadPurchase(s);
          if (road) after(() => notifyPurchase(road, s.id, s.metadata?.kind ?? "", origin));
        }
        break;
      }
      case "checkout.session.async_payment_failed":
        await failDuesSession(event.data.object);
        break;
      case "account.updated": {
        const a = event.data.object;
        const roadId = await roadIdByStripeAccount(a.id);
        if (roadId) {
          const s = accountStateFrom(a);
          await mutate(roadId, (road) => ({
            commands: road.account.status === s.status && road.account.bankName === s.bankName ? [] : [{ type: "account.stripe", stripeAccountId: a.id, status: s.status, bankName: s.bankName, last4: s.last4 }],
            ctx: { at: new Date().toISOString(), actor: { kind: "system", homeId: null, name: "Stripe" } },
          }));
        }
        break;
      }
      case "customer.subscription.updated":
        await syncSubscription(event.data.object);
        break;
      case "customer.subscription.deleted":
        await endSubscription(event.data.object);
        break;
    }
    return json({ received: true });
  } catch (err) {
    console.error("stripe webhook", event.type, err);
    // A 500 makes Stripe retry later.
    return json({ error: "Handler failed" }, 500);
  }
}
