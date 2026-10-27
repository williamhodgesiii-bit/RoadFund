import "server-only";

import { CommandError } from "../commands.ts";
import { kv, kvEnabled } from "./kv.ts";

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

export function errorResponse(err: unknown): Response {
  if (err instanceof CommandError) return json({ error: err.message }, err.status);
  if (err instanceof SyntaxError) return json({ error: "That request wasn't valid." }, 400);
  console.error(err);
  return json({ error: "Something went wrong on our side. Try again in a minute." }, 500);
}

export async function readJSON<T>(req: Request, maxBytes = 1_200_000): Promise<T> {
  const text = await req.text();
  if (text.length > maxBytes) throw new CommandError("That upload is too large.", 413);
  return JSON.parse(text) as T;
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

// Fixed-window rate limit. Shared across server instances when Redis is on;
// per-instance memory otherwise.
const buckets = new Map<string, { count: number; reset: number }>();

export async function rateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  if (kvEnabled) {
    const windowId = Math.floor(Date.now() / windowMs);
    const k = `rf:rl:${key}:${windowId}`;
    try {
      const n = await kv<number>("INCR", k);
      if (n === 1) await kv("EXPIRE", k, Math.ceil(windowMs / 1000) + 1);
      return n <= limit;
    } catch {
      // Fall through to memory if Redis is briefly unavailable.
    }
  }
  return memoryLimit(key, limit, windowMs);
}

function memoryLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    if (buckets.size > 5000) for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
    return true;
  }
  b.count += 1;
  return b.count <= limit;
}

export function limited(): Response {
  return json({ error: "Too many requests. Wait a minute and try again." }, 429);
}
