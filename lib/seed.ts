// Demo road built by replaying real commands through the reducer, with dates
// relative to today so the demo always looks current. Names, phone numbers
// (555-01xx) and email domains (.example) are fictional.

import { applyCommand, buildPayment, type Command, type Ctx } from "./commands.ts";
import { addDays, isoDate, yearOf } from "./dates.ts";
import { createRoad, newHome } from "./factory.ts";
import { pathLengthFt, pointAlong } from "./geo.ts";
import { uid } from "./ids.ts";
import { buildSnapshot, LETTER_FEE } from "./letter.ts";
import { computeShares } from "./split.ts";
import type { BudgetLine, Contractor, DuesRequest, Expense, Home, LatLng, Road, Vote, WorkEntry } from "./types.ts";
import { letterCode } from "./ids.ts";

const PATH: LatLng[] = [
  { lat: 44.8542, lng: -85.7952 },
  { lat: 44.85465, lng: -85.793 },
  { lat: 44.8556, lng: -85.7912 },
  { lat: 44.856, lng: -85.7888 },
  { lat: 44.8569, lng: -85.7874 },
];

const HOMES: { label: string; address: string; owners: string; d: number; f: number; vacant?: boolean; phone: string; email: string; sms: boolean }[] = [
  { label: "Lot 1", address: "120 Birch Hollow Ln", owners: "Tom & Linda Becker", d: 250, f: 210, phone: "(231) 555-0110", email: "beckers@example.com", sms: true },
  { label: "Lot 2", address: "155 Birch Hollow Ln", owners: "Marcus Webb", d: 480, f: 240, phone: "(231) 555-0111", email: "mwebb@example.com", sms: true },
  { label: "Lot 3", address: "190 Birch Hollow Ln", owners: "Priya & Dev Natarajan", d: 700, f: 260, phone: "(231) 555-0112", email: "natarajan.home@example.com", sms: false },
  { label: "Lot 4", address: "215 Birch Hollow Ln", owners: "Carol Jensen", d: 940, f: 230, phone: "(231) 555-0113", email: "carol.jensen@example.com", sms: true },
  { label: "Lot 5", address: "260 Birch Hollow Ln", owners: "Hank & Sue Morrow", d: 1180, f: 250, phone: "(231) 555-0114", email: "", sms: true },
  { label: "Lot 6", address: "301 Birch Hollow Ln", owners: "Jamal Carter", d: 1420, f: 220, phone: "(231) 555-0115", email: "jcarter@example.com", sms: true },
  { label: "Lot 7", address: "335 Birch Hollow Ln", owners: "Erik & Anna Lindqvist", d: 1650, f: 270, phone: "(231) 555-0116", email: "lindqvist@example.com", sms: true },
  { label: "Lot 8", address: "Vacant lot (parcel 45-007-210-008)", owners: "Gordon Pike", d: 1880, f: 300, vacant: true, phone: "", email: "gpike@example.com", sms: false },
  { label: "Lot 9", address: "410 Birch Hollow Ln", owners: "Beth & Ray Okafor", d: 2150, f: 280, phone: "(231) 555-0118", email: "okafor.family@example.com", sms: true },
];

export const DEMO_CAPTAIN_INDEX = 3;

export function buildDemoRoad(now: Date = new Date()): Road {
  const at = (daysAgo: number, hour = 10) => {
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    d.setHours(hour, (daysAgo * 7) % 60, 0, 0);
    return d.toISOString();
  };
  const day = (daysAgo: number) => isoDate(new Date(now.getTime() - daysAgo * 86_400_000));
  const lengthFt = Math.round(pathLengthFt(PATH) / 10) * 10;

  const homes: Home[] = HOMES.map((h) =>
    newHome(
      {
        label: h.label,
        address: h.address,
        owners: h.owners,
        phone: h.phone,
        email: h.email,
        smsOptIn: h.sms,
        smsOptInAt: h.sms ? at(400) : null,
        emailOptIn: !!h.email,
        distanceFt: h.d,
        frontageFt: h.f,
        vacant: !!h.vacant,
        position: offsetFromRoad(pointAlong(PATH, h.d)!, h.d),
      },
      at(410),
    ),
  );
  const H = (i: number) => homes[i].id;
  const captainId = H(DEMO_CAPTAIN_INDEX);

  let road = createRoad(
    { name: "Birch Hollow Lane", state: "MI", county: "Leelanau", town: "Cedar", surface: "gravel", lengthFt, homes, captainHomeId: captainId },
    at(410),
  );
  road = { ...road, path: PATH, center: { lat: 44.8555, lng: -85.7913 }, activity: [] };

  const contractors: Contractor[] = [
    { id: uid("ctr"), name: "Kowalski Plowing", trade: "Snow plowing", phone: "(231) 555-0188", email: "kowalskiplow@example.com", w9OnFile: false, isCorporation: false, notes: "Plows after 3 inches. Sands the hill on request." },
    { id: uid("ctr"), name: "Northern Grade & Gravel LLC", trade: "Grading, gravel, excavation", phone: "(231) 555-0190", email: "office@northerngrade.example", w9OnFile: true, isCorporation: false, notes: "" },
    { id: uid("ctr"), name: "Benzie Excavating", trade: "Excavation, culverts", phone: "(231) 555-0191", email: "bids@benzieexc.example", w9OnFile: false, isCorporation: false, notes: "" },
    { id: uid("ctr"), name: "Hilltop Dirtworks", trade: "Excavation", phone: "(231) 555-0192", email: "hilltop@example.com", w9OnFile: false, isCorporation: false, notes: "" },
    { id: uid("ctr"), name: "Cedar Mutual Insurance", trade: "Road liability insurance", phone: "(231) 555-0193", email: "service@cedarmutual.example", w9OnFile: true, isCorporation: true, notes: "" },
  ];
  const [plow, grade, benzie, hilltop, insurer] = contractors.map((c) => c.id);

  const steps: { daysAgo: number; who: "captain" | number; cmd: Command }[] = [];
  const cap = (daysAgo: number, cmd: Command) => steps.push({ daysAgo, who: "captain", cmd });
  const nb = (daysAgo: number, i: number, cmd: Command) => steps.push({ daysAgo, who: i, cmd });

  cap(405, { type: "road.plan", plan: "plus" });
  cap(405, { type: "account.connect", bankName: "Test Bank", last4: "6789" });
  cap(405, { type: "account.opening", amount: 340_000, date: day(405) });
  cap(405, { type: "road.split", split: { method: "segment", vacantWeight: 0.5, basePct: 50 } });
  for (const c of contractors) cap(404, { type: "contractor.save", contractor: c });

  // Last year's dues: everyone paid.
  const lastBudget: BudgetLine[] = [
    { id: uid("bud"), label: "Snow plowing (season)", category: "plowing", amount: 150_000 },
    { id: uid("bud"), label: "Grading", category: "grading", amount: 57_500 },
    { id: uid("bud"), label: "Gravel top-up", category: "gravel", amount: 45_500 },
    { id: uid("bud"), label: "Savings for big repairs", category: "reserve", amount: 35_000 },
  ];
  const lastReq = makeRequest(homes, `${yearOf(at(380))} road dues`, lastBudget, at(380), addDays(day(380), 30));
  cap(380, { type: "request.create", request: lastReq });
  cap(380, { type: "request.sent", requestId: lastReq.id, message: msg(at(380), "dues", "text", homes.map((h) => h.id), "Road dues are ready. Tap your link to see your share and pay.") });
  const lastMethods = ["ach", "ach", "check", "check", "ach", "card", "ach", "check", "ach"] as const;
  lastReq.lines.forEach((l, i) => {
    const d = 376 - i * 3;
    const method = lastMethods[i];
    const p = buildPayment(road, { id: uid("pay"), homeId: l.homeId, requestId: lastReq.id, amount: l.amount, method, payerName: homes[i].owners, recordedBy: method === "check" ? "captain" : "neighbor", paidAt: at(d) });
    steps.push({ daysAgo: d, who: method === "check" ? "captain" : i, cmd: { type: "payment.record", payment: p } });
  });
  cap(345, { type: "request.close", requestId: lastReq.id });

  const bill = (daysAgo: number, contractorId: string, vendor: string, description: string, category: Expense["category"], amount: number, payDays = 3) => {
    const e: Expense = {
      id: uid("exp"),
      contractorId,
      vendorName: vendor,
      description,
      category,
      amount,
      invoiceDate: day(daysAgo),
      createdAt: at(daysAgo),
      status: "awaiting-approval",
      approvedAt: null,
      paidAt: null,
      paidVia: null,
      invoiceFileId: null,
      workEntryId: null,
    };
    cap(daysAgo, { type: "expense.create", expense: e });
    if (payDays >= 0) {
      cap(daysAgo - 1, { type: "expense.approve", expenseId: e.id });
      cap(daysAgo - payDays, { type: "expense.pay", expenseId: e.id, via: "road-account" });
    }
    return e;
  };

  bill(335, plow, "Kowalski Plowing", "Plowing, full season (14 visits)", "plowing", 152_000);
  bill(300, grade, "Northern Grade & Gravel LLC", "Grading and crown", "grading", 57_500);
  bill(292, grade, "Northern Grade & Gravel LLC", "Gravel top-up, 22 tons", "gravel", 45_500);
  bill(240, plow, "Kowalski Plowing", "Plowing (6 visits)", "plowing", 42_000);
  bill(212, plow, "Kowalski Plowing", "Plowing (7 visits)", "plowing", 46_000);
  bill(204, insurer, "Cedar Mutual Insurance", "Road liability policy, $1M per occurrence", "insurance", 42_000);
  bill(190, plow, "Kowalski Plowing", "Plowing (4 visits) and hill sanding", "plowing", 30_000);
  bill(160, grade, "Northern Grade & Gravel LLC", "Grading and crown reshaped", "grading", 60_000);
  bill(151, grade, "Northern Grade & Gravel LLC", "Gravel top-up, 24 tons", "gravel", 48_000);
  bill(121, grade, "Northern Grade & Gravel LLC", "Ditch cleaning, first 900 ft", "ditches", 38_000);
  bill(59, grade, "Northern Grade & Gravel LLC", "Washout repair at the bend after storm", "culverts", 65_000);

  // Work log
  const work = (daysAgo: number, entry: Partial<WorkEntry> & { title: string; description: string }) => {
    const w: WorkEntry = {
      id: uid("wrk"),
      kind: "work",
      date: day(daysAgo),
      contractorId: null,
      cost: null,
      photos: [],
      position: null,
      severity: null,
      status: null,
      createdAt: at(daysAgo),
      ...entry,
    };
    cap(daysAgo, { type: "work.save", entry: w });
  };
  work(160, { title: "Road graded", description: "Full length graded, crown reshaped so water runs to the ditches. Soft spot at Lot 5 filled.", contractorId: grade, cost: 60_000 });
  work(151, { title: "Gravel top-up", description: "24 tons of 22A gravel spread on the hill and the bend.", contractorId: grade, cost: 48_000 });
  work(121, { title: "Ditches cleaned", description: "East and west ditches cleaned for the first 900 ft. Culvert inlet at Lot 2 cleared.", contractorId: grade, cost: 38_000 });
  work(62, { kind: "damage", title: "Washout at the bend", description: "Heavy rain overtopped the east ditch. About 30 ft of road edge washed out, one lane passable.", severity: "severe", status: "fixed", position: pointAlong(PATH, 1300) });
  work(59, { title: "Washout repaired", description: "Rebuilt the road edge with crushed stone and riprap; ditch reshaped.", contractorId: grade, cost: 65_000 });
  work(21, { kind: "damage", title: "Creek culvert rusting through", description: "Bottom of the 18-inch culvert at the creek crossing is rusted through. Water is running under the pipe.", severity: "severe", status: "scheduled", position: pointAlong(PATH, 1560) });
  work(8, { kind: "damage", title: "Potholes near Lot 7 driveway", description: "Cluster of 5 potholes, the largest about 2 ft across and 4 in deep.", severity: "moderate", status: "open", position: pointAlong(PATH, 1650) });

  // Last year's plow contract vote
  const plowVote: Vote = {
    id: uid("vote"),
    kind: "repair",
    question: `Hire Kowalski Plowing for the ${yearOf(at(45))}–${yearOf(at(45)) + 1} winter at $1,650`,
    detail: "Same rate as last year plus $150. Plows after 3 inches, sands the hill.",
    amount: 165_000,
    createdAt: at(52),
    deadline: day(45),
    threshold: "majority",
    ballots: [],
    closedAt: null,
    outcome: null,
    bidId: null,
  };
  cap(52, { type: "vote.create", vote: plowVote });
  [0, 1, 2, 3, 4, 6, 8].forEach((i, k) => nb(51 - k, i, { type: "vote.cast", voteId: plowVote.id, ballot: { homeId: H(i), choice: "yes", at: at(51 - k), via: "link" } }));
  nb(47, 5, { type: "vote.cast", voteId: plowVote.id, ballot: { homeId: H(5), choice: "no", at: at(47), via: "link" } });
  cap(44, { type: "vote.close", voteId: plowVote.id });

  // This year's dues
  const budget: BudgetLine[] = [
    { id: uid("bud"), label: "Snow plowing (season)", category: "plowing", amount: 165_000 },
    { id: uid("bud"), label: "Grading", category: "grading", amount: 60_000 },
    { id: uid("bud"), label: "Gravel top-up", category: "gravel", amount: 48_000 },
    { id: uid("bud"), label: "Savings for big repairs", category: "reserve", amount: 35_000 },
  ];
  cap(26, { type: "road.budget", budget });
  const req = makeRequest(homes, `${yearOf(at(24))} road dues`, budget, at(24), addDays(isoDate(now), 6));
  cap(24, { type: "request.create", request: req });
  cap(24, {
    type: "request.sent",
    requestId: req.id,
    message: msg(at(24), "dues", "text", homes.map((h) => h.id), `${req.title} are ready. This year covers plowing, grading, gravel and savings for big repairs. Tap your link to see your share and pay by bank or card.`),
  });
  const share = (i: number) => req.lines.find((l) => l.homeId === H(i))!.amount;
  const pay = (daysAgo: number, i: number, method: "ach" | "card" | "check", amount = share(i)) => {
    const p = buildPayment(road, { id: uid("pay"), homeId: H(i), requestId: req.id, amount, method, payerName: HOMES[i].owners, recordedBy: method === "check" ? "captain" : "neighbor", paidAt: at(daysAgo, 19) });
    steps.push({ daysAgo, who: method === "check" ? "captain" : i, cmd: { type: "payment.record", payment: p } });
  };
  pay(22, 3, "check");
  pay(21, 0, "ach");
  pay(19, 1, "card");
  pay(16, 2, "ach");
  pay(10, 4, "ach");
  pay(1, 6, "ach");
  const firstHalf = Math.round(share(8) / 2);
  cap(13, {
    type: "plan.create",
    plan: {
      id: uid("plan"),
      homeId: H(8),
      requestId: req.id,
      createdAt: at(13),
      installments: [
        { due: day(12), amount: firstHalf },
        { due: addDays(isoDate(now), 18), amount: share(8) - firstHalf },
      ],
      status: "active",
    },
  });
  pay(12, 8, "card", firstHalf);

  // Culvert bids, then a vote on the winning bid
  const bidId = uid("bid");
  cap(20, {
    type: "bid.save",
    bid: { id: bidId, title: "Replace the creek culvert", scope: "Remove the failed 18-inch culvert at the creek crossing. Install new 18-inch corrugated HDPE pipe, 30 ft, with stone at both ends. Restore road surface.", createdAt: at(20), replyBy: day(9), contractorIds: [grade, benzie, hilltop], quotes: [], status: "open", awardedQuoteId: null, voteId: null },
  });
  const q1 = { id: uid("quo"), contractorId: grade, vendorName: "Northern Grade & Gravel LLC", amount: 110_000, startBy: addDays(isoDate(now), 21), scope: "18-in HDPE, 30 ft, stone ends, surface restored", warranty: "2 years", receivedAt: at(15) };
  const q2 = { id: uid("quo"), contractorId: benzie, vendorName: "Benzie Excavating", amount: 138_000, startBy: addDays(isoDate(now), 35), scope: "18-in HDPE, 30 ft, fieldstone headwalls both ends", warranty: "1 year", receivedAt: at(13) };
  const q3 = { id: uid("quo"), contractorId: hilltop, vendorName: "Hilltop Dirtworks", amount: 95_000, startBy: addDays(isoDate(now), 14), scope: "15-in pipe, 24 ft, no end treatment", warranty: "None stated", receivedAt: at(11) };
  cap(15, { type: "bid.quote", bidId, quote: q1 });
  cap(13, { type: "bid.quote", bidId, quote: q2 });
  cap(11, { type: "bid.quote", bidId, quote: q3 });
  const culvertVote: Vote = {
    id: uid("vote"),
    kind: "repair",
    question: "Replace the creek culvert with Northern Grade & Gravel for $1,100?",
    detail: "Lowest bid that meets the 18-inch spec. Hilltop's $950 bid uses a smaller 15-inch pipe that the county engineer said will back up in spring. Paid from savings and this year's dues.",
    amount: 110_000,
    createdAt: at(4),
    deadline: addDays(isoDate(now), 5),
    threshold: "majority",
    ballots: [],
    closedAt: null,
    outcome: null,
    bidId,
  };
  cap(4, { type: "bid.award", bidId, quoteId: q1.id, voteId: culvertVote.id });
  cap(4, { type: "vote.create", vote: culvertVote });
  cap(4, { type: "message.log", message: msg(at(4), "vote", "text", homes.map((h) => h.id), `Vote by ${culvertVote.deadline}: ${culvertVote.question} Tap your link to vote.`) });
  [0, 1, 3, 2].forEach((i, k) => nb(3 - Math.min(k, 2), i, { type: "vote.cast", voteId: culvertVote.id, ballot: { homeId: H(i), choice: "yes", at: at(3 - Math.min(k, 2), 20), via: "link" } }));
  nb(2, 4, { type: "vote.cast", voteId: culvertVote.id, ballot: { homeId: H(4), choice: "no", at: at(2, 21), via: "link" } });

  // Agreement in signing
  cap(70, { type: "agreement.purchase" });
  cap(69, { type: "agreement.step", step: "review", review: { attorney: "Dana Whitcomb", firm: "Whitcomb Law PLLC (partner attorney)", requestedAt: at(69), approvedAt: null, notes: "" } });
  cap(55, { type: "agreement.step", step: "signing", review: { attorney: "Dana Whitcomb", firm: "Whitcomb Law PLLC (partner attorney)", requestedAt: at(69), approvedAt: at(56), notes: "Approved with lien clause kept. Michigan allows recording a notice of lien for unpaid road assessments when the agreement provides for it." } });
  [3, 0, 1, 2, 4, 8].forEach((i, k) =>
    nb(54 - k * 4, i, { type: "agreement.sign", signature: { homeId: H(i), name: signerName(HOMES[i].owners), at: at(54 - k * 4), via: "link", version: 1 } }),
  );

  // Documents
  const doc = (daysAgo: number, kind: Road["docs"][number]["kind"], title: string, note = "") =>
    cap(daysAgo, { type: "doc.add", doc: { id: uid("doc"), kind, title, fileId: null, fileName: null, mime: null, size: null, addedAt: at(daysAgo), note } });
  doc(404, "plat", "Plat of Birch Hollow Estates (1978)", "Shows the 66-ft road easement and all nine lots.");
  doc(404, "easement", "Access easement, Liber 412 Page 88", "Grants each lot access over the road. No maintenance terms.");
  doc(204, "insurance", `Road liability certificate ${yearOf(at(204))}`, "Cedar Mutual, $1M per occurrence.");
  doc(30, "minutes", "Annual road meeting minutes", "Approved budget, plow contract vote, culvert bids.");

  // Past letter for a refinance, and a new request for a sale
  cap(200, {
    type: "letterRequest.create",
    request: { id: uid("lreq"), createdAt: at(200), homeId: H(1), propertyAddress: HOMES[1].address, requester: { name: "Alicia Brandt", company: "Northshore Mortgage", email: "abrandt@northshoremtg.example", phone: "(231) 555-0170", role: "lender" }, closingDate: day(185), status: "new", letterId: null, note: "Refinance" },
  });
  steps.push({ daysAgo: 199, who: "captain", cmd: { type: "message.log", message: msg(at(199), "letter", "email", [H(1)], "Road Status Letter sent to Northshore Mortgage.") } });

  cap(3, {
    type: "letterRequest.create",
    request: { id: uid("lreq"), createdAt: at(3, 15), homeId: H(5), propertyAddress: HOMES[5].address, requester: { name: "Megan Ortiz", company: "Pine Ridge Title & Escrow", email: "closings@pineridgetitle.example", phone: "(231) 555-0175", role: "title" }, closingDate: addDays(isoDate(now), 18), status: "new", letterId: null, note: "Buyer is using a conventional loan. Lender asked for road maintenance status." },
  });

  cap(9, {
    type: "expense.create",
    expense: { id: uid("exp"), contractorId: plow, vendorName: "Kowalski Plowing", description: "Fall setup: 40 plow stakes and season deposit", category: "plowing", amount: 24_000, invoiceDate: day(9), createdAt: at(9), status: "awaiting-approval", approvedAt: null, paidAt: null, paidVia: null, invoiceFileId: null, workEntryId: null },
  });

  cap(30, { type: "reserve.save", reserve: { setAside: 120_000, yearlyContribution: 35_000, inflationPct: 3, items: reserveItems(yearOf(isoDate(now)), lengthFt) } });
  cap(30, { type: "road.settings", patch: { weather: { enabled: true, snowInches: 3, contractorId: plow } } });

  steps.sort((a, b) => b.daysAgo - a.daysAgo);
  const captainName = HOMES[DEMO_CAPTAIN_INDEX].owners;
  for (const s of steps) {
    const ctx: Ctx = {
      at: at(s.daysAgo, 18),
      actor: s.who === "captain" ? { kind: "captain", homeId: captainId, name: captainName } : { kind: "neighbor", homeId: H(s.who), name: HOMES[s.who].owners },
    };
    if (s.cmd.type === "letterRequest.create") ctx.actor = { kind: "public", homeId: null, name: s.cmd.request.requester.company };
    road = applyCommand(road, s.cmd, ctx);

    // Fulfil the refinance letter right after it was requested.
    if (s.cmd.type === "letterRequest.create" && s.daysAgo === 200) {
      const req = s.cmd.request;
      const snapNow = new Date(at(199));
      road = applyCommand(
        road,
        {
          type: "letter.create",
          letter: {
            id: uid("ltr"),
            code: letterCode(),
            createdAt: at(199),
            validUntil: addDays(day(199), 30),
            homeId: req.homeId!,
            requester: req.requester,
            closingDate: req.closingDate,
            fee: LETTER_FEE,
            paidBy: "seller",
            requestId: req.id,
            snapshot: buildSnapshot(road, req.homeId!, snapNow),
          },
        },
        { at: at(199), actor: { kind: "captain", homeId: captainId, name: captainName } },
      );
    }
  }
  return road;
}

function makeRequest(homes: Home[], title: string, budget: BudgetLine[], createdAt: string, dueDate: string): DuesRequest {
  const total = budget.reduce((a, b) => a + b.amount, 0);
  const split = { method: "segment" as const, vacantWeight: 0.5, basePct: 50 };
  const result = computeShares(total, homes, split);
  return {
    id: uid("req"),
    title,
    kind: "annual",
    createdAt,
    dueDate,
    total,
    budget,
    split,
    lines: result.lines.map((l) => ({ homeId: l.homeId, amount: l.amount, reason: l.reason })),
    message: "",
    status: "open",
    sentAt: null,
  };
}

function msg(at: string, kind: Road["messages"][number]["kind"], channel: Road["messages"][number]["channel"], homeIds: string[], body: string) {
  return { id: uid("msg"), at, kind, channel, homeIds, body };
}

function reserveItems(year: number, lengthFt: number) {
  return [
    { id: uid("res"), name: "Reshape crown and ditches", cost: Math.round((lengthFt * 100) / 5000) * 5000, lifeYears: 6, lastDoneYear: year - 2 },
    { id: uid("res"), name: "New gravel (3-inch lift)", cost: Math.round((lengthFt * 300) / 5000) * 5000, lifeYears: 10, lastDoneYear: year - 7 },
    { id: uid("res"), name: "Creek culvert", cost: 110_000, lifeYears: 30, lastDoneYear: year - 31 },
    { id: uid("res"), name: "Ditch cleaning", cost: Math.round((lengthFt * 35) / 5000) * 5000, lifeYears: 3, lastDoneYear: year },
  ];
}

/** "Tom & Linda Becker" -> "Tom Becker" */
function signerName(owners: string): string {
  if (!owners.includes(" & ")) return owners;
  const [first, rest] = owners.split(" & ");
  return `${first} ${rest.split(" ").slice(1).join(" ")}`.trim();
}

/** Puts a house pin a little off the road, alternating sides. */
function offsetFromRoad(p: LatLng, d: number): LatLng {
  const side = Math.round(d / 230) % 2 === 0 ? 1 : -1;
  return { lat: p.lat + side * 0.00045, lng: p.lng - side * 0.0002 };
}
