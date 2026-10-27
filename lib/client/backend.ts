"use client";

// One interface over two storage modes:
//   local — the road lives in this browser (works with zero setup on Vercel)
//   cloud — the road lives in Upstash Redis, so links work on any device

import { applyAll, CommandError, type Command, type Ctx } from "../commands";
import { normalizeCode, uid } from "../ids";
import { publicLetter, type PublicLetter } from "../letter";
import { neighborView, type NeighborView } from "../neighbor";
import { prepareNeighborCommand } from "../neighbor-actions";
import { captainHome, displayName } from "../selectors";
import type { LetterRequest, Requester, Road } from "../types";
import { listRoads, saveEntry, setActiveId, type RoadEntry } from "./registry";

export interface Status {
  cloud: boolean;
  ai: boolean;
  /** Real payments through Stripe: "test" keys move no money, "live" keys do. null: simulated. */
  stripe: "test" | "live" | null;
  email: boolean;
  sms: boolean;
}

export const OFFLINE_STATUS: Status = { cloud: false, ai: false, stripe: null, email: false, sms: false };

let statusPromise: Promise<Status> | null = null;
export function getStatus(): Promise<Status> {
  statusPromise ??= fetch("/api/status")
    .then((r) => (r.ok ? (r.json() as Promise<Status>) : OFFLINE_STATUS))
    .then((s) => ({ ...OFFLINE_STATUS, ...s }))
    .catch(() => OFFLINE_STATUS);
  return statusPromise;
}

/** Real payments apply to cloud roads that aren't the demo. */
export function paysForReal(status: Status, road: Pick<Road, "demo">, entry?: Pick<RoadEntry, "where"> | null): boolean {
  return !!status.stripe && status.cloud && !road.demo && (entry ? entry.where === "cloud" : true);
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function api<T>(url: string, init?: RequestInit & { key?: string | null }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.key ? { "x-road-key": init.key } : {}), ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiError("No connection. Check your signal and try again.", 0);
  }
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new ApiError(body.error ?? `Request failed (${res.status})`, res.status);
  return body;
}

const roadKey = (id: string) => `rf:road:${id}`;

export function readLocalRoad(id: string): Road | null {
  try {
    const raw = localStorage.getItem(roadKey(id));
    return raw ? (JSON.parse(raw) as Road) : null;
  } catch {
    return null;
  }
}

function writeLocalRoad(road: Road) {
  try {
    localStorage.setItem(roadKey(road.id), JSON.stringify(road));
  } catch {
    throw new CommandError("This browser's storage is full. Remove photos or turn on cloud storage.", 507);
  }
}

export function captainCtx(road: Road): Ctx {
  const cap = captainHome(road);
  return { at: new Date().toISOString(), actor: { kind: "captain", homeId: cap?.id ?? null, name: cap ? displayName(cap) : "Road captain" } };
}

/** Saves a brand-new road (from setup or the demo) and makes it the active road. */
export async function createRoad(road: Road, opts: { demo?: boolean } = {}): Promise<{ road: Road; entry: RoadEntry }> {
  const status = await getStatus();
  let entry: RoadEntry;
  let saved = road;
  if (status.cloud) {
    const res = await api<{ road: Road; captainKey: string }>("/api/roads", { method: "POST", body: JSON.stringify({ road }) });
    saved = res.road;
    entry = { id: saved.id, name: saved.name, where: "cloud", key: res.captainKey, addedAt: new Date().toISOString(), demo: !!opts.demo };
  } else {
    writeLocalRoad(road);
    entry = { id: road.id, name: road.name, where: "local", key: null, addedAt: new Date().toISOString(), demo: !!opts.demo };
  }
  saveEntry(entry);
  setActiveId(entry.id);
  return { road: saved, entry };
}

export async function loadRoad(entry: RoadEntry): Promise<Road> {
  if (entry.where === "local") {
    const road = readLocalRoad(entry.id);
    if (!road) throw new ApiError("This road isn't saved in this browser anymore.", 404);
    return road;
  }
  return (await api<{ road: Road }>(`/api/roads/${entry.id}`, { key: entry.key })).road;
}

/** Applies commands. Local: run the reducer here. Cloud: the server runs the same reducer. */
export async function sendCommands(entry: RoadEntry, commands: Command[]): Promise<Road> {
  if (entry.where === "local") {
    const road = readLocalRoad(entry.id);
    if (!road) throw new ApiError("This road isn't saved in this browser anymore.", 404);
    const next = applyAll(road, commands, captainCtx(road));
    writeLocalRoad(next);
    return next;
  }
  return (await api<{ road: Road }>(`/api/roads/${entry.id}`, { method: "POST", key: entry.key, body: JSON.stringify({ commands }) })).road;
}

export async function deleteRoad(entry: RoadEntry): Promise<void> {
  if (entry.where === "local") {
    try {
      localStorage.removeItem(roadKey(entry.id));
    } catch {}
    return;
  }
  await api(`/api/roads/${entry.id}`, { method: "DELETE", key: entry.key });
}

/** Neighbor links check this browser first (local mode), then the cloud. */
export async function neighborLoad(roadId: string, token: string): Promise<{ view: NeighborView; where: "local" | "cloud" }> {
  const local = readLocalRoad(roadId);
  if (local) {
    const home = local.homes.find((h) => h.token === token);
    if (!home) throw new ApiError("This link isn't valid anymore. Ask your road captain for a new one.", 404);
    return { view: neighborView(local, home.id, new Date()), where: "local" };
  }
  const status = await getStatus();
  if (!status.cloud) {
    throw new ApiError(
      "This road is saved in the captain's browser, so its links only open on that device. Turn on cloud storage to share links with neighbors.",
      404,
    );
  }
  const { view } = await api<{ view: NeighborView }>(`/api/n/${roadId}/${token}`);
  return { view, where: "cloud" };
}

export async function neighborSend(roadId: string, token: string, command: Command, where: "local" | "cloud"): Promise<NeighborView> {
  if (where === "local") {
    const road = readLocalRoad(roadId);
    if (!road) throw new ApiError("Road not found.", 404);
    const home = road.homes.find((h) => h.token === token);
    if (!home) throw new ApiError("This link isn't valid anymore.", 404);
    const at = new Date().toISOString();
    const prepared = prepareNeighborCommand(road, home.id, command, at);
    const next = applyAll(road, [prepared], { at, actor: { kind: "neighbor", homeId: home.id, name: displayName(home) } });
    writeLocalRoad(next);
    return neighborView(next, home.id, new Date());
  }
  return (await api<{ view: NeighborView }>(`/api/n/${roadId}/${token}`, { method: "POST", body: JSON.stringify({ command }) })).view;
}

export interface RoadLookup {
  code: string;
  name: string;
  county: string;
  state: string;
  homes: { id: string; label: string; address: string }[];
  where: "local" | "cloud";
  /** The $75 fee is paid by card before the request goes to the captain. */
  payFirst?: boolean;
}

function codeVariants(input: string): string {
  const raw = normalizeCode(input);
  return raw.startsWith("RF") ? `RF-${raw.slice(2)}` : `RF-${raw}`;
}

function localRoads(): Road[] {
  return listRoads()
    .filter((e) => e.where === "local")
    .map((e) => readLocalRoad(e.id))
    .filter((r): r is Road => !!r);
}

export async function lookupRoad(code: string): Promise<RoadLookup | null> {
  const want = codeVariants(code);
  const local = localRoads().find((r) => r.code === want);
  if (local) {
    return { code: local.code, name: local.name, county: local.county, state: local.state, homes: local.homes.map((h) => ({ id: h.id, label: h.label, address: h.address })), where: "local" };
  }
  const { road } = await api<{ road: Omit<RoadLookup, "where"> | null }>(`/api/lookup?code=${encodeURIComponent(want)}`);
  return road ? { ...road, where: "cloud" } : null;
}

/** Returns a checkout link when the letter fee is collected first. */
export async function requestLetter(input: { lookup: RoadLookup; homeId: string | null; propertyAddress: string; closingDate: string | null; note: string; requester: Requester }): Promise<{ url?: string }> {
  if (input.lookup.where === "local") {
    const road = localRoads().find((r) => r.code === input.lookup.code);
    if (!road) throw new ApiError("Road not found.", 404);
    const at = new Date().toISOString();
    const request: LetterRequest = {
      id: uid("lreq"),
      createdAt: at,
      homeId: input.homeId,
      propertyAddress: input.propertyAddress,
      requester: input.requester,
      closingDate: input.closingDate,
      status: "new",
      letterId: null,
      note: input.note,
    };
    writeLocalRoad(applyAll(road, [{ type: "letterRequest.create", request }], { at, actor: { kind: "public", homeId: null, name: input.requester.company || input.requester.name } }));
    return {};
  }
  return api<{ url?: string }>("/api/letter-requests", {
    method: "POST",
    body: JSON.stringify({ code: input.lookup.code, homeId: input.homeId, propertyAddress: input.propertyAddress, closingDate: input.closingDate, note: input.note, requester: input.requester }),
  });
}

export async function verifyLetter(code: string): Promise<PublicLetter | null> {
  const raw = normalizeCode(code);
  if (raw.length !== 8) return null;
  const formatted = `${raw.slice(0, 4)}-${raw.slice(4)}`;
  for (const road of localRoads()) {
    const l = road.letters.find((x) => x.code === formatted);
    if (l) return publicLetter(l);
  }
  const status = await getStatus();
  if (!status.cloud) return null;
  const { letter } = await api<{ letter: PublicLetter | null }>(`/api/verify/${formatted}`);
  return letter;
}

export interface AIResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export async function ai<T>(body: Record<string, unknown>): Promise<AIResult<T>> {
  try {
    const data = await api<T>("/api/ai", { method: "POST", body: JSON.stringify(body) });
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "AI request failed" };
  }
}

export function neighborLink(road: Pick<Road, "id">, token: string): string {
  return `${window.location.origin}/n/${road.id}/${token}`;
}

export function captainLink(entry: RoadEntry): string | null {
  if (entry.where !== "cloud" || !entry.key) return null;
  return `${window.location.origin}/app/join#road=${entry.id}&key=${entry.key}`;
}

export async function confirmLetterPayment(sessionId: string): Promise<{ ok: boolean; roadName?: string; email?: string }> {
  return api("/api/letter-requests/confirm", { method: "POST", body: JSON.stringify({ sessionId }) });
}

// ---------- Stripe (captain) ----------

export type StripeAction =
  | { action: "connect" | "refresh" | "dashboard" | "agreement" | "portal" }
  | { action: "plan"; plan: "roadfund" | "plus" }
  | { action: "confirm"; sessionId: string };

export async function stripeAction(entry: RoadEntry, body: StripeAction): Promise<{ url?: string; road?: Road; due?: number; paid?: boolean }> {
  return api(`/api/roads/${entry.id}/stripe`, { method: "POST", key: entry.key, body: JSON.stringify(body) });
}

// ---------- Stripe (neighbor) ----------

export async function startCheckout(roadId: string, token: string, input: { requestId: string; amount: number; method: "ach" | "card" }): Promise<string> {
  const { url } = await api<{ url: string }>(`/api/n/${roadId}/${token}/checkout`, { method: "POST", body: JSON.stringify({ action: "start", ...input }) });
  return url;
}

export async function confirmCheckout(roadId: string, token: string, sessionId: string): Promise<{ view: NeighborView; paymentId: string | null; complete: boolean }> {
  return api(`/api/n/${roadId}/${token}/checkout`, { method: "POST", body: JSON.stringify({ action: "confirm", sessionId }) });
}

// ---------- Sending from Road Fund ----------

export interface SendOutcome {
  homeId: string;
  channel: "text" | "email" | null;
  ok: boolean;
  error?: string;
}

export async function sendFromServer(
  entry: RoadEntry,
  input: { kind: string; logKind: string; template: string; recipients: { homeId: string; values: Record<string, string> }[] },
): Promise<{ results: SendOutcome[]; road: Road }> {
  return api(`/api/roads/${entry.id}/send`, { method: "POST", key: entry.key, body: JSON.stringify(input) });
}

// ---------- Captain sign-in ----------

export async function requestSignIn(email: string): Promise<void> {
  await api("/api/signin", { method: "POST", body: JSON.stringify({ email }) });
}

/** Trades the emailed link for captain keys and adds those roads to this device. */
export async function finishSignIn(token: string): Promise<RoadEntry[]> {
  const { roads } = await api<{ roads: { id: string; name: string; key: string }[] }>("/api/signin/verify", { method: "POST", body: JSON.stringify({ token }) });
  const entries = roads.map((r) => ({ id: r.id, name: r.name, where: "cloud" as const, key: r.key, addedAt: new Date().toISOString(), demo: false }));
  entries.forEach(saveEntry);
  if (entries[0]) setActiveId(entries[0].id);
  return entries;
}

/** Stops this device's captain key from working. */
export async function signOut(entry: RoadEntry): Promise<void> {
  if (entry.where !== "cloud" || !entry.key) return;
  await api(`/api/roads/${entry.id}`, { method: "PATCH", key: entry.key });
}
