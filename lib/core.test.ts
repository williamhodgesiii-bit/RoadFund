import { test } from "node:test";
import assert from "node:assert/strict";
import { allocate, parseMoney } from "./money.ts";
import { computeShares, type SplitHome } from "./split.ts";
import { computeCharge } from "./fees.ts";
import { applyCommand, assertNeighborCommand, buildPayment, CommandError, type Ctx } from "./commands.ts";
import { buildDemoRoad, DEMO_CAPTAIN_INDEX } from "./seed.ts";
import { accountSummary, currentRequest, ledger, nextActions, requestProgress, voteState } from "./selectors.ts";
import { createRoad, newHome } from "./factory.ts";
import { neighborView } from "./neighbor.ts";
import { buildAgreement, searchAgreement } from "./agreement.ts";
import { buildSnapshot } from "./letter.ts";
import { locateOnPath, pathLengthFt, pointAlong } from "./geo.ts";

const homes = (spec: [number, number?, boolean?][]): SplitHome[] =>
  spec.map(([d, f, vacant], i) => ({ id: `h${i}`, label: `Lot ${i + 1}`, distanceFt: d, frontageFt: f ?? null, customPct: null, vacant: !!vacant }));

test("allocate always sums to the total", () => {
  for (const total of [0, 1, 99, 100, 300_000, 307_999]) {
    for (const w of [[1, 1, 1], [1, 2, 3, 4], [0.5, 1, 1, 1, 1, 1, 1, 1, 1], [0, 0, 0]]) {
      const parts = allocate(total, w);
      assert.equal(parts.reduce((a, b) => a + b, 0), total, `total ${total} weights ${w}`);
    }
  }
  assert.deepEqual(allocate(100, [1, 1, 1]), [34, 33, 33]);
});

test("parseMoney handles common input", () => {
  assert.equal(parseMoney("$1,200"), 120_000);
  assert.equal(parseMoney("1200.5"), 120_050);
  assert.equal(parseMoney("abc"), null);
  assert.equal(parseMoney(""), null);
});

test("equal split with a half-share vacant lot", () => {
  const r = computeShares(85_000, homes([[100], [200], [300, undefined, true]]).map((h) => ({ ...h })), { method: "equal", vacantWeight: 0.5, basePct: 0 });
  assert.ok(r.ok);
  assert.deepEqual(r.lines.map((l) => l.amount), [34_000, 34_000, 17_000]);
});

test("segment split: nobody pays for road they don't drive", () => {
  // Stretch 0-100 shared by 3, 100-200 by 2, 200-300 by 1. Costs per foot equal.
  const r = computeShares(300_00, homes([[100], [200], [300]]), { method: "segment", vacantWeight: 1, basePct: 0 });
  assert.ok(r.ok);
  const [a, b, c] = r.lines.map((l) => l.amount);
  // home a: 100/3; b: 100/3 + 100/2; c: 100/3 + 100/2 + 100 → ratio 2 : 5 : 11 (x/6)
  assert.equal(a + b + c, 300_00);
  assert.ok(Math.abs(a / 300_00 - 2 / 18) < 0.001);
  assert.ok(Math.abs(c / 300_00 - 11 / 18) < 0.001);
  assert.equal(r.stretches.length, 3);
  assert.deepEqual(r.stretches[1].homeIds, ["h1", "h2"]);
});

test("base share blends an even split with the method", () => {
  const r = computeShares(300_00, homes([[100], [200], [300]]), { method: "segment", vacantWeight: 1, basePct: 50 });
  assert.ok(r.ok);
  assert.equal(r.lines.reduce((a, l) => a + l.amount, 0), 300_00);
  // Base: 5,000 each. Use part 15,000 in ratio 2:5:11.
  assert.equal(r.lines[0].amount, 5_000 + Math.round((15_000 * 2) / 18));
  assert.match(r.lines[0].reason, /^Base share \$50\.00/);
  assert.ok(Math.abs(r.lines.reduce((a, l) => a + l.pct, 0) - 100) < 1e-9);
});

test("frontage split reports missing data instead of guessing", () => {
  const r = computeShares(10_000, homes([[100, 50], [200]]), { method: "frontage", vacantWeight: 1, basePct: 0 });
  assert.equal(r.ok, false);
  assert.match(r.problems[0], /Lot 2/);
});

test("custom split must total 100%", () => {
  const h = homes([[1], [2]]).map((x, i) => ({ ...x, customPct: i === 0 ? 60 : 30 }));
  assert.equal(computeShares(10_000, h, { method: "custom", vacantWeight: 1, basePct: 0 }).ok, false);
  h[1].customPct = 40;
  const r = computeShares(10_000, h, { method: "custom", vacantWeight: 1, basePct: 0 });
  assert.deepEqual(r.lines.map((l) => l.amount), [6_000, 4_000]);
});

test("fees: payer covers fees so the road nets the full share", () => {
  const ach = computeCharge(30_000, "ach", true);
  assert.equal(ach.roadNet, 30_000);
  assert.equal(ach.total, ach.share + ach.platformFee + ach.processingFee);
  assert.ok(Math.abs(ach.processingFee - Math.round(ach.total * 0.008)) <= 1);
  const big = computeCharge(2_000_000, "ach", true);
  assert.equal(big.processingFee, 500, "ACH cap is $5");
  const card = computeCharge(30_000, "card", true);
  assert.equal(card.processingFee, Math.round(card.total * 0.029) + 30);
  const absorbed = computeCharge(30_000, "ach", false);
  assert.equal(absorbed.total, 30_000);
  assert.equal(absorbed.roadNet, 30_000 - 100 - 240);
});

test("demo road replays cleanly and stays consistent", () => {
  const now = new Date();
  const road = buildDemoRoad(now);
  assert.equal(road.homes.length, 9);
  const acct = accountSummary(road, now);
  assert.ok(acct.balance > 0, `balance ${acct.balance}`);
  const rows = ledger(road, now);
  assert.equal(rows.at(-1)!.balance, acct.balance, "ledger running balance matches account");
  const req = currentRequest(road)!;
  const prog = requestProgress(road, req, now);
  assert.equal(prog.billed, req.total);
  assert.ok(prog.homesPaid >= 5);
  assert.ok(prog.lines.some((l) => l.status === "processing"), "one ACH payment still settling");
  assert.ok(prog.lines.some((l) => l.status === "plan"));
  const receipts = new Set(road.payments.map((p) => p.receiptNo));
  assert.equal(receipts.size, road.payments.length, "receipt numbers are unique");
  const actions = nextActions(road, now);
  assert.match(actions[0].label, /Road Status Letter/);
  const open = road.votes.find((v) => !v.closedAt)!;
  const vs = voteState(road, open, now);
  assert.equal(vs.status, "open");
  assert.equal(vs.needed, 5);
});

test("neighbor view hides other neighbors' contact details", () => {
  const now = new Date();
  const road = buildDemoRoad(now);
  const me = road.homes[5];
  const view = neighborView(road, me.id, now);
  const json = JSON.stringify(view);
  for (const other of road.homes.filter((h) => h.id !== me.id && h.id !== road.captainHomeId)) {
    if (other.phone) assert.ok(!json.includes(other.phone), `leaked ${other.phone}`);
    if (other.email) assert.ok(!json.includes(other.email), `leaked ${other.email}`);
    assert.ok(!json.includes(other.token), "leaked a link token");
  }
  assert.equal(view.bills.length, 1);
  assert.ok(view.bills[0].line.outstanding > 0);
});

test("neighbor commands are limited to their own home", () => {
  const now = new Date();
  const road = buildDemoRoad(now);
  const mine = road.homes[5].id;
  const other = road.homes[6].id;
  const req = currentRequest(road)!;
  const p = buildPayment(road, { id: "pay_x", homeId: other, requestId: req.id, amount: 100, method: "ach", payerName: "x", recordedBy: "neighbor", paidAt: now.toISOString() });
  assert.throws(() => assertNeighborCommand(road, mine, { type: "payment.record", payment: p }), CommandError);
  assert.throws(() => assertNeighborCommand(road, mine, { type: "road.plan", plan: "roadfund" }), CommandError);
  const ok = { ...p, homeId: mine };
  assert.doesNotThrow(() => assertNeighborCommand(road, mine, { type: "payment.record", payment: ok }));
});

test("payments are idempotent and receipts are numbered", () => {
  const now = new Date();
  let road = buildDemoRoad(now);
  const ctx: Ctx = { at: now.toISOString(), actor: { kind: "neighbor", homeId: road.homes[5].id, name: "Jamal Carter" } };
  const req = currentRequest(road)!;
  const p = buildPayment(road, { id: "pay_same", homeId: road.homes[5].id, requestId: req.id, amount: 5_000, method: "ach", payerName: "Jamal Carter", recordedBy: "neighbor", paidAt: ctx.at });
  road = applyCommand(road, { type: "payment.record", payment: p }, ctx);
  const count = road.payments.length;
  road = applyCommand(road, { type: "payment.record", payment: p }, ctx);
  assert.equal(road.payments.length, count);
  assert.match(road.payments[0].receiptNo, /^\d{4}-\d{4}$/);
});

test("starter plan allows one dues request per year", () => {
  const at = new Date().toISOString();
  const h = [newHome({ label: "A" }), newHome({ label: "B" })];
  let road = createRoad({ name: "Test Rd", state: "NY", county: "Essex", town: "", surface: "gravel", lengthFt: 1000, homes: h, captainHomeId: h[0].id }, at);
  const ctx: Ctx = { at, actor: { kind: "captain", homeId: h[0].id, name: "A" } };
  const mk = (id: string) => ({ type: "request.create" as const, request: { id, title: "Dues", kind: "annual" as const, createdAt: at, dueDate: at.slice(0, 10), total: 200, budget: [], split: road.split, lines: h.map((x) => ({ homeId: x.id, amount: 100, reason: "" })), message: "", status: "open" as const, sentAt: null } });
  road = applyCommand(road, mk("r1"), ctx);
  assert.throws(() => applyCommand(road, mk("r2"), ctx), /free plan/);
});

test("changing agreement terms after signing resets signatures", () => {
  const now = new Date();
  let road = buildDemoRoad(now);
  assert.ok(road.agreement.signatures.length > 0);
  const ctx: Ctx = { at: now.toISOString(), actor: { kind: "captain", homeId: road.captainHomeId, name: "Carol" } };
  road = applyCommand(road, { type: "agreement.terms", terms: { ...road.agreement.terms, lateFee: 5_000 } }, ctx);
  assert.equal(road.agreement.signatures.length, 0);
  assert.equal(road.agreement.version, 2);
  assert.equal(road.agreement.step, "draft");
});

test("agreement draft fills from road data and answers questions", () => {
  const road = buildDemoRoad(new Date());
  const sections = buildAgreement({
    roadName: road.name,
    county: road.county,
    state: road.state,
    lengthFt: road.lengthFt,
    split: road.split,
    terms: road.agreement.terms,
    version: 1,
    homes: road.homes.map((h) => ({ ...h, sharePct: 10 })),
  });
  assert.ok(sections.some((s) => s.id === "land"));
  const hits = searchAgreement(sections, "Can we pave without everyone agreeing?");
  assert.equal(hits[0].section.id, "decisions");
  const late = searchAgreement(sections, "What happens if someone doesn't pay?");
  assert.equal(late[0].section.id, "payments");
});

test("letter snapshot shows the seller's unpaid dues", () => {
  const now = new Date();
  const road = buildDemoRoad(now);
  const seller = road.homes[5];
  const snap = buildSnapshot(road, seller.id, now);
  assert.ok(snap.propertyDues.outstanding > 0);
  assert.equal(snap.agreement.status, "in-progress");
  assert.equal(snap.property.address, seller.address);
});

test("geo: points along the road locate back to the same distance", () => {
  const path = [
    { lat: 44.8542, lng: -85.7952 },
    { lat: 44.85465, lng: -85.793 },
    { lat: 44.8556, lng: -85.7912 },
  ];
  const len = pathLengthFt(path);
  assert.ok(len > 1000 && len < 1400, `length ${len}`);
  const p = pointAlong(path, 800)!;
  const loc = locateOnPath(path, p)!;
  assert.ok(Math.abs(loc.alongFt - 800) < 2, `along ${loc.alongFt}`);
  assert.ok(loc.offsetFt < 1);
});

test("captain index points at the captain", () => {
  const road = buildDemoRoad(new Date());
  assert.equal(road.captainHomeId, road.homes[DEMO_CAPTAIN_INDEX].id);
});

test("old saved roads load in the current shape", async () => {
  const { normalizeRoad } = await import("./migrate.ts");
  const old = { ...buildDemoRoad(new Date()), plan: "plus", bids: [{ id: "bid_1" }], settings: { ...buildDemoRoad(new Date()).settings, weather: { enabled: true } }, reserve: { setAside: 5000, items: [] } } as unknown as Parameters<typeof normalizeRoad>[0];
  const r = normalizeRoad(old) as unknown as Record<string, unknown>;
  assert.equal(r.plan, "roadfund");
  assert.equal("bids" in r, false);
  assert.equal("weather" in (r.settings as object), false);
  assert.deepEqual(r.reserve, { setAside: 5000 });
});

test("a project bill needs a passed vote and links back to it", () => {
  const now = new Date();
  let road = buildDemoRoad(now);
  const open = road.votes.find((v) => !v.closedAt)!;
  const ctx: Ctx = { at: now.toISOString(), actor: { kind: "captain", homeId: road.captainHomeId, name: "Captain" } };
  const bill = (voteId: string) => ({
    type: "request.create" as const,
    request: { id: `req_${voteId}`, title: "Culvert", kind: "special" as const, createdAt: now.toISOString(), dueDate: now.toISOString().slice(0, 10), total: 900, budget: [], split: road.split, lines: road.homes.map((h) => ({ homeId: h.id, amount: 100, reason: "" })), message: "", status: "open" as const, sentAt: null, voteId },
  });
  assert.throws(() => applyCommand(road, bill(open.id), ctx), /after the vote passes/);
  const passed = road.votes.find((v) => v.outcome === "passed")!;
  road = applyCommand(road, bill(passed.id), ctx);
  assert.equal(road.votes.find((v) => v.id === passed.id)!.requestId, `req_${passed.id}`);
});

test("a check in the mail stops reminders until the check is recorded", async () => {
  const { checkInMail } = await import("./selectors.ts");
  const { prepareNeighborCommand } = await import("./neighbor-actions.ts");
  const now = new Date();
  let road = buildDemoRoad(now);
  const req = currentRequest(road)!;
  const line = requestProgress(road, req, now).lines.find((l) => l.outstanding > 0 && !l.plan)!;
  const at = now.toISOString();
  const cmd = prepareNeighborCommand(road, line.home.id, { type: "check.mailed", note: { id: "chk_1", homeId: line.home.id, requestId: req.id, amount: 1, at: "2000-01-01T00:00:00Z" } }, at);
  road = applyCommand(road, cmd, { at, actor: { kind: "neighbor", homeId: line.home.id, name: "N" } });
  const note = checkInMail(road, line.home.id, req.id, now)!;
  assert.equal(note.amount, line.outstanding, "the server sets the amount");
  assert.equal(note.at, at, "and the time");
  const pay = buildPayment(road, { id: "pay_chk", homeId: line.home.id, requestId: req.id, amount: line.outstanding, method: "check", payerName: "N", recordedBy: "captain", paidAt: at });
  road = applyCommand(road, { type: "payment.record", payment: pay }, { at, actor: { kind: "captain", homeId: road.captainHomeId, name: "C" } });
  assert.equal(checkInMail(road, line.home.id, req.id, now), null);
});
