import "server-only";

// Minimal Upstash Redis REST client. Works with the env vars the Vercel
// Marketplace Upstash integration sets (KV_REST_API_*) or Upstash's own names.

const URL_ = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL ?? "";
const TOKEN = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN ?? "";

export const kvEnabled = Boolean(URL_ && TOKEN);

type Arg = string | number;

export async function kv<T = unknown>(...args: Arg[]): Promise<T> {
  if (!kvEnabled) throw new Error("Cloud storage is not configured");
  const res = await fetch(URL_, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as { result?: T; error?: string };
  if (!res.ok || body.error) throw new Error(`Storage error: ${body.error ?? res.status}`);
  return body.result as T;
}

export async function kvGetJSON<T>(key: string): Promise<T | null> {
  const raw = await kv<string | null>("GET", key);
  return raw ? (JSON.parse(raw) as T) : null;
}

/** Write `value` to `key` only if `revKey` still holds `rev`. Returns false on a conflict. */
const CAS_SCRIPT = `
local cur = redis.call('GET', KEYS[2])
if (cur or '0') ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2])
redis.call('SET', KEYS[2], tostring(tonumber(ARGV[1]) + 1))
return 1`;

export async function kvCompareAndSet(key: string, revKey: string, rev: number, value: string): Promise<boolean> {
  const ok = await kv<number>("EVAL", CAS_SCRIPT, 2, key, revKey, String(rev), value);
  return ok === 1;
}
