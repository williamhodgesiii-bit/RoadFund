# Road Fund

Dues, records and closing letters for private roads with 3 to 30 homes. Built from the *Road Fund Build Research Report* (October 2026).

- **Captains** set up a road in about 10 minutes, split costs fairly (equal, by frontage, by distance, or by use with a base share), send each neighbor a pay link, pay contractors from the road's account, log work with photos, run votes, draft and track a lender-ready maintenance agreement, and issue Road Status Letters for closings.
- **Neighbors** open a link (no app, no password), see what they owe and why, pay by bank or card, vote, sign the agreement, and see where the money went.
- **Title companies and lenders** request a letter with the road code and verify any letter by its code.

## Deploy on Vercel

1. Import this repository in Vercel. The Next.js preset is detected; no settings to change.
2. Deploy. With no environment variables the app is fully usable: roads are saved in the browser that created them and payments are simulated.
3. **Cloud storage** (neighbor links that open on any phone): in the Vercel project, **Storage → Create → Upstash Redis** and connect it. Vercel adds `KV_REST_API_URL` and `KV_REST_API_TOKEN`; redeploy.
4. Each of these turns on by adding its keys (all listed in `.env.example`) and redeploying:

| Feature | Variables | What changes |
| --- | --- | --- |
| Real payments | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Each road connects its own Stripe Express account. Neighbors pay through Stripe Checkout by bank (instant verification) or card, as destination charges: the money lands in the road's account and Road Fund keeps the $1 fee plus processing. Plans are yearly subscriptions; the agreement package and the $75 letter fee are one-time payments. Declining a paid letter request refunds it. |
| Email | `RESEND_API_KEY`, `EMAIL_FROM` | Receipts, captain alerts for payments and letter requests, letters emailed to title companies, captain sign-in links, and sending notices from the send sheet. |
| Texts | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` or `TWILIO_MESSAGING_SERVICE_SID` | Texts to neighbors who opted in from their own page, a confirmation text when they do, STOP/START handled at `/api/sms/inbound`. |
| Daily job | `CRON_SECRET` | `vercel.json` runs `/api/cron/daily` each morning: reminders 3 days before and 7 and 21 days after the due date to homes that still owe, snow alerts to the captain and plow driver, and nudges for letter requests waiting more than 2 days. Each send is recorded so a retry never repeats it. |
| AI help | `ANTHROPIC_API_KEY` | Reading invoices and deeds, rewriting messages, comparing quotes, answering questions about the agreement. |

`/api/status` reports what is on, and Settings in the app shows it. The demo road always stays simulated, even with Stripe on.

**Stripe setup:** turn on Connect (Express) in the Stripe dashboard, then add one webhook endpoint at `https://YOUR-SITE/api/stripe/webhook` that listens to events on your account and on connected accounts: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `account.updated`, `customer.subscription.updated`, `customer.subscription.deleted`. Set `NEXT_PUBLIC_SITE_URL` so return links and webhook origins match your domain. For the billing portal (receipts, card, cancel), configure it once under Settings → Billing → Customer portal.

## Try it

Open `/demo`. You become Carol Jensen, captain of Birch Hollow Lane: nine homes, a year and a half of dues, bills, votes, bids and an agreement in progress. The welcome card lists six things to try. Use **See neighbor view** (eye icon) or Neighbors → *Open their page* to act as any neighbor.

## What is simulated without keys

Without Stripe keys: bank connections, payments, plan upgrades and the $75/$249 purchases (fees and settlement times use Stripe's published rates). Without email or texting keys: Road Fund sends nothing itself, and the send sheet's Text and Email buttons open the captain's own Messages or email app with the message filled in. Each screen says which mode it is in.

The agreement steps never simulate anyone: the captain records their own attorney's review, the notary appointment and the county recording. The agreement package is a concierge service; orders are emailed to `SUPPORT_EMAIL`.

## Develop

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # domain tests (Node's built-in runner, Node 22.18+)
npm run lint
npm run typecheck
npm run build
```

## How it is built

- **Next.js 16 (App Router), React 19, Tailwind CSS 4, TypeScript.** Leaflet with OpenStreetMap and Esri imagery for the road map; National Weather Service API for snow alerts; Nominatim for address search.
- **One JSON document per road** (`lib/types.ts`). Roads are small, so a single document keeps sync, export, backup and audit simple.
- **Every change is a command** run through one reducer (`lib/commands.ts`). The browser runs it for instant feedback and for browser-mode storage; the server runs the same reducer for cloud storage, with optimistic concurrency (compare-and-set in Redis). Payments are idempotent by id, and every command writes to the road's activity log.
- **Access by link.** Captains hold a secret key (stored hashed on the server); each neighbor link carries its own token and can only pay, vote, sign or update its own contact settings. Amounts, fees and timestamps from neighbor links are rebuilt server-side (`lib/neighbor-actions.ts`). Neighbor views never include other neighbors' contact details.
- **Money is integer cents.** Shares use largest-remainder rounding so they always add up to the total exactly (`lib/split.ts`).
- **Derived status.** "Clearing", "late", vote outcomes and the next action are computed from timestamps when read (`lib/selectors.ts`). The only background work is the daily job, which sends messages and never changes balances.
- **Side effects after saving.** Emails, texts and refunds run after a change is saved (`lib/server/effects.ts`, via Next's `after()`), are idempotent by id, and never undo a saved change if they fail.
- **Webhooks are the source of truth for money.** Stripe Checkout returns and webhooks both call the same idempotent recorders (`lib/server/stripe.ts`). With Stripe on, neighbor links can't record a payment directly and captains can't set plans or bank details by hand.

```
app/(site)       public pages: landing, calculator, pricing, closing, guide, verify
app/start        setup wizard
app/app          captain app: Home, Money, Road, Votes & Papers, Neighbors, Settings
app/n/[road]/[token]  neighbor page
app/api          roads, neighbor links, Stripe, letters, sending, sign-in, cron, files, AI, weather
lib/             domain logic shared by browser and server (tested in lib/core.test.ts)
components/      UI
```

## Before going live

- Stripe: complete the platform profile, set Connect branding, and decide who covers negative balances on connected accounts (disputes, ACH returns).
- Texting: register the brand and campaign for 10DLC with Twilio. Opt-in is captured on the neighbor's own page with the required disclosures, and a confirmation text goes out on opt-in.
- Email: verify the sending domain in Resend (SPF, DKIM) so receipts don't land in spam.
- Attorney-reviewed agreement templates for each launch state, and partners for the agreement package.
- Files over 750 KB: move uploads to Vercel Blob.
- Parcel data (e.g. Regrid) to pull lots and owners during setup.

Road Fund is not a law firm. Agreement drafts are for review by a licensed attorney in the road's state.
