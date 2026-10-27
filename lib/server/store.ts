import "server-only";

import { applyAll, CommandError, type Command, type Ctx } from "../commands.ts";
import { roadCode, secretToken } from "../ids.ts";
import type { Road } from "../types.ts";
import { kv, kvCompareAndSet, kvGetJSON } from "./kv.ts";

const K = {
  road: (id: string) => `rf:road:${id}`,
  rev: (id: string) => `rf:rev:${id}`,
  auth: (id: string) => `rf:auth:${id}`,
  code: (code: string) => `rf:code:${code}`,
  letter: (code: string) => `rf:letter:${code}`,
  file: (id: string) => `rf:file:${id}`,
};

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

const MAX_DOC_BYTES = 900_000;

function serialize(road: Road): string {
  const json = JSON.stringify(road);
  if (json.length > MAX_DOC_BYTES) throw new CommandError("This road's record is too large to save. Remove old photos or documents.", 413);
  return json;
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
  const final = { ...road, code };
  const captainKey = secretToken();
  await kv("SET", K.auth(road.id), await sha256(captainKey));
  await kv("SET", K.road(road.id), serialize(final));
  // SETNX: an imported copy must never take over verification of the original road's letters.
  for (const l of final.letters) await kv("SETNX", K.letter(l.code), road.id);
  return { road: final, captainKey };
}

export async function loadRoad(id: string): Promise<{ road: Road; rev: number } | null> {
  const [raw, rev] = await kv<[string | null, string | null]>("MGET", K.road(id), K.rev(id));
  if (!raw) return null;
  return { road: JSON.parse(raw) as Road, rev: Number(rev ?? 1) };
}

export async function checkCaptain(id: string, key: string | null): Promise<boolean> {
  if (!key) return false;
  const stored = await kv<string | null>("GET", K.auth(id));
  return !!stored && stored === (await sha256(key));
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
      const before = new Set(current.road.letters.map((l) => l.code));
      for (const l of next.letters) if (!before.has(l.code)) await kv("SET", K.letter(l.code), id);
      return next;
    }
    await new Promise((r) => setTimeout(r, 40 * (attempt + 1)));
  }
  throw new CommandError("Someone else is updating this road right now. Try again.", 409);
}

export async function deleteRoad(id: string, road: Road): Promise<void> {
  await kv("DEL", K.road(id), K.rev(id), K.auth(id), K.code(road.code), ...road.letters.map((l) => K.letter(l.code)));
}

export async function roadIdByCode(code: string): Promise<string | null> {
  return kv<string | null>("GET", K.code(code));
}

export async function roadIdByLetter(code: string): Promise<string | null> {
  return kv<string | null>("GET", K.letter(code));
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
