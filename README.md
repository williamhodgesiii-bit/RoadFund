# Road Fund

Dues, records and closing letters for private roads with 3 to 30 homes. Built from the *Road Fund Build Research Report* (October 2026).

- **Captains** set up a road in about 10 minutes, split costs fairly (equal, by frontage, by distance, or by use with a base share), send each neighbor a pay link, pay contractors from the road's account, log work with photos, run votes, draft and track a lender-ready maintenance agreement, and issue Road Status Letters for closings.
- **Neighbors** open a link (no app, no password), see what they owe and why, pay by bank or card, vote, sign the agreement, and see where the money went.
- **Title companies and lenders** request a letter with the road code and verify any letter by its code.

## Deploy on Vercel

1. Import this repository in Vercel. The Next.js preset is detected; no settings to change.
2. Deploy. With no environment variables the app is fully usable: roads are saved in the browser that created them.
3. Optional, for neighbor links that work on other phones: in the Vercel project, **Storage → Create → Upstash Redis** (Marketplace) and connect it. Vercel adds `KV_REST_API_URL` and `KV_REST_API_TOKEN`; redeploy.
4. Optional, for AI features: add `ANTHROPIC_API_KEY` and redeploy.

`/api/status` reports which of the two are on. Settings in the app shows it too.

## Try it

Open `/demo`. You become Carol Jensen, captain of Birch Hollow Lane: nine homes, a year and a half of dues, bills, votes, bids and an agreement in progress. The welcome card lists six things to try. Use **See neighbor view** (eye icon) or Neighbors → *Open their page* to act as any neighbor.

## What is simulated in this build

Stripe Connect accounts and payouts, bank and card payments (fees and settlement times are computed with Stripe's published rates), automatic texts, attorney review, remote notary, county recording, plan upgrades and the $75/$249 purchases. Message buttons open the captain's own Messages or email app with the text filled in, so those really send.

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
- **Derived status, no background jobs.** "Clearing", "late", vote outcomes and the next action are computed from timestamps when read (`lib/selectors.ts`).

```
app/(site)       public pages: landing, calculator, pricing, closing, guide, verify
app/start        setup wizard
app/app          captain app: Home, Money, Road, Votes & Papers, Neighbors, Settings
app/n/[road]/[token]  neighbor page
app/api          roads, neighbor links, letters, files, AI, weather, geocode
lib/             domain logic shared by browser and server (tested in lib/core.test.ts)
components/      UI
```

## Before real money moves

- Stripe Connect (Express accounts per road, Financial Connections for ACH, webhooks for settlement and returns).
- A 10DLC-registered texting provider with STOP/HELP handling; opt-in is already captured from the neighbor's own page.
- E-signature, remote online notary and e-recording partners; attorney-reviewed templates for each launch state.
- Two-step login for captains instead of key-only links; Redis-backed rate limiting; Vercel Blob for files over 750 KB.
- Regrid parcel data to pull lots and owners during setup.

Road Fund is not a law firm. Agreement drafts are for review by a licensed attorney in the road's state.
