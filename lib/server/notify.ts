import "server-only";

import type { Home } from "../types.ts";
import { kv, kvEnabled } from "./kv.ts";

// Optional delivery. Email goes through Resend, texts through Twilio. Without
// keys the app still works: captains send from their own phone and email apps.
// *_API_BASE variables point at local mocks for automated tests.

const RESEND_KEY = process.env.RESEND_API_KEY ?? "";
const EMAIL_FROM = process.env.EMAIL_FROM ?? "";
const RESEND_BASE = process.env.RESEND_API_BASE ?? "https://api.resend.com";

const TW_SID = process.env.TWILIO_ACCOUNT_SID ?? "";
const TW_TOKEN = process.env.TWILIO_AUTH_TOKEN ?? "";
const TW_FROM = process.env.TWILIO_FROM ?? "";
const TW_SERVICE = process.env.TWILIO_MESSAGING_SERVICE_SID ?? "";
const TW_BASE = process.env.TWILIO_API_BASE ?? "https://api.twilio.com";

export const emailEnabled = Boolean(RESEND_KEY && EMAIL_FROM);
export const smsEnabled = Boolean(TW_SID && TW_TOKEN && (TW_FROM || TW_SERVICE) && kvEnabled);
export const twilioAuthToken = TW_TOKEN;

export interface Email {
  to: string;
  subject: string;
  text: string;
  replyTo?: string | null;
  /** Shown as the sender name, e.g. "Birch Hollow Lane via Road Fund". */
  fromName?: string;
}

export type SendResult = { ok: true; id: string } | { ok: false; error: string };

export function validEmail(s: string | null | undefined): s is string {
  return !!s && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

/** US numbers only for now: "(231) 555-0142" becomes "+12315550142". */
export function e164(phone: string | null | undefined): string | null {
  const d = (phone ?? "").replace(/\D/g, "");
  if (d.length === 10 && /^[2-9]/.test(d)) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1") && /^[2-9]/.test(d[1])) return `+${d}`;
  return null;
}

function fromHeader(name?: string): string {
  if (!name) return EMAIL_FROM;
  const addr = EMAIL_FROM.match(/<([^>]+)>/)?.[1] ?? EMAIL_FROM;
  return `${name.replace(/["<>\r\n]/g, "").slice(0, 60)} <${addr}>`;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Plain text in, simple readable HTML out: big type, real links, nothing else. */
export function textToHtml(text: string): string {
  const body = text
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px">${esc(p).replace(/\n/g, "<br>").replace(/https?:\/\/[^\s<]+/g, (u) => `<a href="${u}" style="color:#2F5D50;font-weight:bold">${u}</a>`)}</p>`)
    .join("");
  return `<!doctype html><html><body style="margin:0;background:#F7F4EC"><div style="max-width:560px;margin:0 auto;padding:24px;font:18px/1.55 Arial,Helvetica,sans-serif;color:#1E2320">${body}</div></body></html>`;
}

export async function sendEmail(m: Email): Promise<SendResult> {
  if (!emailEnabled) return { ok: false, error: "Email isn't set up." };
  if (!validEmail(m.to)) return { ok: false, error: "No valid email address." };
  try {
    const res = await fetch(`${RESEND_BASE}/emails`, {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: fromHeader(m.fromName),
        to: [m.to.trim()],
        subject: m.subject.slice(0, 200),
        text: m.text,
        html: textToHtml(m.text),
        ...(validEmail(m.replyTo) ? { reply_to: m.replyTo.trim() } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) return { ok: false, error: body.message ?? `Email failed (${res.status})` };
    return { ok: true, id: body.id ?? "" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Email failed" };
  }
}

/** Which channel Road Fund itself can reach a home on, if any. Texts need the neighbor's own opt-in. */
export function serverChannel(home: Home): "text" | "email" | null {
  if (smsEnabled && home.smsOptIn && e164(home.phone)) return "text";
  if (emailEnabled && validEmail(home.email) && home.emailOptIn !== false) return "email";
  return null;
}

// ---------- Texts ----------

const stopKey = (phone: string) => `rf:stop:${phone}`;

/** True if this number replied STOP. Carriers require we honor it everywhere. */
export async function isStopped(phone: string): Promise<boolean> {
  if (!kvEnabled) return false;
  return (await kv<string | null>("GET", stopKey(phone))) !== null;
}

export async function setStopped(phone: string, stopped: boolean): Promise<void> {
  if (stopped) await kv("SET", stopKey(phone), new Date().toISOString());
  else await kv("DEL", stopKey(phone));
}

export async function sendSms(to: string, body: string): Promise<SendResult> {
  if (!smsEnabled) return { ok: false, error: "Texting isn't set up." };
  const phone = e164(to);
  if (!phone) return { ok: false, error: "Not a US mobile number." };
  if (await isStopped(phone)) return { ok: false, error: "This number replied STOP." };
  const form = new URLSearchParams({ To: phone, Body: body });
  if (TW_SERVICE) form.set("MessagingServiceSid", TW_SERVICE);
  else form.set("From", TW_FROM);
  try {
    const res = await fetch(`${TW_BASE}/2010-04-01/Accounts/${TW_SID}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${btoa(`${TW_SID}:${TW_TOKEN}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await res.json().catch(() => ({}))) as { sid?: string; message?: string; code?: number };
    if (!res.ok) {
      // 21610: the recipient already unsubscribed at the carrier level.
      if (data.code === 21610) await setStopped(phone, true);
      return { ok: false, error: data.message ?? `Text failed (${res.status})` };
    }
    return { ok: true, id: data.sid ?? "" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Text failed" };
  }
}

/**
 * Twilio signs each webhook: HMAC-SHA1 over the full URL plus the POST params
 * sorted by name, keyed with the auth token, base64 encoded.
 */
export async function validTwilioSignature(url: string, params: URLSearchParams, signature: string | null): Promise<boolean> {
  if (!TW_TOKEN || !signature) return false;
  const data = url + [...params.keys()].sort().map((k) => k + (params.get(k) ?? "")).join("");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(TW_TOKEN), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data)));
  const expected = btoa(String.fromCharCode(...mac));
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}
