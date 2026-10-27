import "server-only";

import { applyAll, CommandError, type Command, type Ctx } from "../commands.ts";
import { roadCode, secretToken } from "../ids.ts";
import type { Road } from "../types.ts";
import { kv, kvCompareAndSet, kvGetJSON } from "./kv.ts";

export const K = {
  road: (id: string) => `rf:road:${id}`,
  rev: (id: string) => `rf:rev:${id}`,
  /** Set of SHA-256 hashes of captain keys, one per signed-in device. */
  keys: (id: string) => `rf:keys:${id}`,
  /** Legacy single captain key hash (roads created before multi-device keys). */
  legacyAuth: (id: string) => `rf:auth:${id}`,
  code: (code: string) => `rf:code:${code}`,
  letter: (code: string) => `rf:letter:${code}`,
  file: (id: string) => `rf:file:${id}`,
  allRoads: () => "rf:roads:all",
  captain: (email: string) => `rf:captain:${email.trim().toLowerCase()}`,
  stripeAccount: (acct: string) => `rf:acct:${acct}`,
};

export async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

const MAX_DOC_BYTES = 900_000;

function serialize(road: Road): string {
  const json = JSON.stringify(road);
  if (json.length > MAX_DOC_BYTES) throw new CommandError("This road's record is too large to save. Remove old photos or documents.", 413);
  return json;
}

export function captainEmail(road: Road): string | null {
  const email = road.homes.find((h) => h.id === road.captainHomeId)?.email.trim().toLowerCase();
  return email && email.includes("@") ? email : null;
}

/** Keeps lookup keys in step with the road: captain email, Stripe account, letter codes. */
async function syncIndexes(id: string, before: Road | null, after: Road | null): Promise<void> {
  const oldEmail = before ? captainEmail(before) : null;
  const newEmail = after ? captainEmail(after) : null;
  if (oldEmail && oldEmail !== newEmail) await kv("SREM", K.captain(oldEmail), id);
  if (newEmail && newEmail !== oldEmail) await kv("SADD", K.captain(newEmail), id);

  const oldAcct = before?.account.stripeAccountId ?? null;
  const newAcct = after?.account.stripeAccountId ?? null;
  if (oldAcct && oldAcct !== newAcct) await kv("DEL", K.stripeAccount(oldAcct));
  if (newAcct && newAcct !== oldAcct) await kv("SET", K.stripeAccount(newAcct), id);

  if (after) {
    const known = new Set(before?.letters.map((l) => l.code) ?? []);
    // SETNX: an imported copy must never take over verification of another road's letters.
    for (const l of after.letters) if (!known.has(l.code)) await kv("SETNX", K.letter(l.code), id);
  }
}

export async function createRoad(road: Road): Promise<{ road: Road; captainKey: string }> {
  if (!/^road_[a-z0-9]{12}$/.test(road.id)) throw new CommandError("Invalid road id.");
  const created = await kv<number>("SETNX", K.rev(road.id), "1");
  if (created !== 1) throw new CommandError("A road with this id already exists.", 409);

  // Make sure the public road code is unique.
  let code = road.code;
  for (let i = 0; i < 5; i++) {
    const ok = await kv<number>("SETNX", K.code(code), road.id);
    if (ok === 1) break;
    code = roadCode();
    if (i === 4) throw new CommandError("Couldn't reserve a road code. Try again.", 503);
  }
  // A new road never inherits a Stripe account from an imported backup.
  const final: Road = { ...road, code, account: { ...road.account, stripeAccountId: null, status: road.account.stripeAccountId ? "none" : road.account.status } };
  const captainKey = await issueCaptainKey(road.id);
  await kv("SET", K.road(road.id), serialize(final));
  await kv("SADD", K.allRoads(), road.id);
  await syncIndexes(road.id, null, final);
  return { road: final, captainKey };
}

/** A new secret for one device. Only its hash is stored. */
export async function issueCaptainKey(roadId: string): Promise<string> {
  const key = secretToken();
  await kv("SADD", K.keys(roadId), await sha256(key));
  return key;
}

export async function revokeCaptainKey(roadId: string, key: string): Promise<void> {
  await kv("SREM", K.keys(roadId), await sha256(key));
}

export async function loadRoad(id: string): Promise<{ road: Road; rev: number } | null> {
  const [raw, rev] = await kv<[string | null, string | null]>("MGET", K.road(id), K.rev(id));
  if (!raw) return null;
  return { road: JSON.parse(raw) as Road, rev: Number(rev ?? 1) };
}

export async function checkCaptain(id: string, key: string | null): Promise<boolean> {
  if (!key || key.length < 16) return false;
  const hash = await sha256(key);
  if ((await kv<number>("SISMEMBER", K.keys(id), hash)) === 1) return true;
  const legacy = await kv<string | null>("GET", K.legacyAuth(id));
  return !!legacy && legacy === hash;
}

/**
 * Applies commands with optimistic concurrency: read, apply, write only if no
 * one else wrote in between; otherwise retry on the fresh copy.
 */
export async function mutate(id: string, build: (road: Road) => { commands: Command[]; ctx: Ctx }): Promise<Road> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const current = await loadRoad(id);
    if (!current) throw new CommandError("Road not found.", 404);
    const { commands, ctx } = build(current.road);
    const next = applyAll(current.road, commands, ctx);
    if (next === current.road) return next;
    const ok = await kvCompareAndSet(K.road(id), K.rev(id), current.rev, serialize(next));
    if (ok) {
      await syncIndexes(id, current.road, next);
      return next;
    }
    await new Promise((r) => setTimeout(r, 40 * (attempt + 1) + Math.random() * 40));
  }
  throw new CommandError("Someone else is updating this road right now. Try again.", 409);
}

export async function deleteRoad(id: string, road: Road): Promise<void> {
  await syncIndexes(id, road, null);
  await kv("DEL", K.road(id), K.rev(id), K.keys(id), K.legacyAuth(id), K.code(road.code), ...road.letters.map((l) => K.letter(l.code)));
  await kv("SREM", K.allRoads(), id);
}

export async function allRoadIds(): Promise<string[]> {
  return (await kv<string[]>("SMEMBERS", K.allRoads())) ?? [];
}

export async function roadIdsForCaptain(email: string): Promise<string[]> {
  return (await kv<string[]>("SMEMBERS", K.captain(email))) ?? [];
}

export async function roadIdByStripeAccount(acct: string): Promise<string | null> {
  return kv<string | null>("GET", K.stripeAccount(acct));
}

export async function roadIdByCode(code: string): Promise<string | null> {
  return kv<string | null>("GET", K.code(code));
}

export async function roadIdByLetter(code: string): Promise<string | null> {
  return kv<string | null>("GET", K.letter(code));
}

/** One-time markers (e.g. "reminder sent") so scheduled jobs never repeat themselves. */
export async function once(key: string, ttlSeconds: number): Promise<boolean> {
  return (await kv<string | null>("SET", `rf:once:${key}`, "1", "NX", "EX", ttlSeconds)) === "OK";
}

export interface StoredFile {
  roadId: string;
  mime: string;
  data: string;
}

export async function putFile(id: string, file: StoredFile): Promise<void> {
  await kv("SET", K.file(id), JSON.stringify(file));
}

export async function getFile(id: string): Promise<StoredFile | null> {
  return kvGetJSON<StoredFile>(K.file(id));
}
