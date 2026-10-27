import Anthropic from "@anthropic-ai/sdk";
import { CommandError } from "@/lib/commands";
import { AIRefusal, aiEnabled, askAgreement, compareQuotes, readDamage, readDeed, readInvoice, writeMessage, writeMinutes, type DocMime } from "@/lib/server/ai";
import { clientIp, errorResponse, json, limited, rateLimit, readJSON } from "@/lib/server/http";

export const maxDuration = 60;

type Body =
  | { task: "message"; kind: string; tone: "friendly" | "firm"; draft: string; facts: Record<string, string>; channel: "text" | "email" | "print" }
  | { task: "ask"; question: string; agreement: string }
  | { task: "quotes"; job: string; scope: string; quotes: { vendor: string; amount: string; scope: string; warranty: string; startBy: string }[] }
  | { task: "deed" | "invoice"; mime: DocMime; data: string }
  | { task: "damage"; mime: DocMime; data: string; note: string }
  | { task: "minutes"; roadName: string; date: string; notes: string };

const MIMES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const cap = (s: unknown, n: number) => String(s ?? "").slice(0, n);

export async function POST(req: Request) {
  try {
    if (!aiEnabled) throw new CommandError("AI is off for this deployment. Add ANTHROPIC_API_KEY to turn it on.", 501);
    if (!rateLimit(`ai:${clientIp(req)}`, 20, 10 * 60_000)) return limited();
    const body = await readJSON<Body>(req, 4_400_000);

    switch (body.task) {
      case "message": {
        const facts = Object.fromEntries(Object.entries(body.facts ?? {}).slice(0, 12).map(([k, v]) => [cap(k, 40), cap(v, 200)]));
        const text = await writeMessage({
          kind: cap(body.kind, 40),
          tone: body.tone === "firm" ? "firm" : "friendly",
          draft: cap(body.draft, 1500),
          facts,
          channel: body.channel === "email" || body.channel === "print" ? body.channel : "text",
        });
        return json({ text });
      }
      case "ask": {
        if (!body.question?.trim()) throw new CommandError("Type a question.");
        return json(await askAgreement({ question: cap(body.question, 400), agreement: cap(body.agreement, 40_000) }));
      }
      case "quotes": {
        const quotes = (body.quotes ?? []).slice(0, 6).map((q) => ({
          vendor: cap(q.vendor, 80),
          amount: cap(q.amount, 30),
          scope: cap(q.scope, 600),
          warranty: cap(q.warranty, 80),
          startBy: cap(q.startBy, 30),
        }));
        if (quotes.length < 2) throw new CommandError("Add at least two quotes to compare.");
        return json(await compareQuotes({ job: cap(body.job, 120), scope: cap(body.scope, 1200), quotes }));
      }
      case "deed":
      case "invoice":
      case "damage": {
        if (!MIMES.has(body.mime)) throw new CommandError("Upload a photo (JPG, PNG, WebP) or a PDF.");
        if (!body.data || body.data.length > 4_300_000) throw new CommandError("Files must be under 3 MB.");
        if (body.task === "deed") return json(await readDeed({ mime: body.mime, data: body.data }));
        if (body.task === "invoice") return json(await readInvoice({ mime: body.mime, data: body.data }));
        return json(await readDamage({ mime: body.mime, data: body.data, note: cap((body as { note?: string }).note, 300) }));
      }
      case "minutes": {
        if (!body.notes?.trim()) throw new CommandError("Paste your meeting notes.");
        return json({ text: await writeMinutes({ roadName: cap(body.roadName, 80), date: cap(body.date, 20), notes: cap(body.notes, 8000) }) });
      }
      default:
        throw new CommandError("Unknown AI task.");
    }
  } catch (err) {
    if (err instanceof AIRefusal) return json({ error: err.message }, 422);
    if (err instanceof Anthropic.RateLimitError) return json({ error: "The AI service is busy. Try again in a minute." }, 429);
    if (err instanceof Anthropic.AuthenticationError) return json({ error: "The AI key on this deployment isn't valid." }, 502);
    if (err instanceof Anthropic.BadRequestError) return json({ error: "The AI service couldn't read that request." }, 400);
    if (err instanceof Anthropic.APIError) return json({ error: "The AI service had a problem. Try again." }, 502);
    return errorResponse(err);
  }
}
