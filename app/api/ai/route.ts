import Anthropic from "@anthropic-ai/sdk";
import { CommandError } from "@/lib/commands";
import { AIRefusal, aiEnabled, askAgreement, readInvoice, type DocMime } from "@/lib/server/ai";
import { clientIp, errorResponse, json, limited, rateLimit, readJSON } from "@/lib/server/http";

export const maxDuration = 60;

// Two quiet helpers: read a contractor's bill, and answer a question about the agreement.
type Body = { task: "ask"; question: string; agreement: string } | { task: "invoice"; mime: DocMime; data: string };

const MIMES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const cap = (s: unknown, n: number) => String(s ?? "").slice(0, n);

export async function POST(req: Request) {
  try {
    if (!aiEnabled) throw new CommandError("Reading bills automatically is off on this site. Type the details in instead.", 501);
    if (!(await rateLimit(`ai:${clientIp(req)}`, 20, 10 * 60_000))) return limited();
    const body = await readJSON<Body>(req, 4_400_000);

    switch (body.task) {
      case "ask": {
        if (!body.question?.trim()) throw new CommandError("Type a question.");
        return json(await askAgreement({ question: cap(body.question, 400), agreement: cap(body.agreement, 40_000) }));
      }
      case "invoice": {
        if (!MIMES.has(body.mime)) throw new CommandError("Upload a photo (JPG, PNG, WebP) or a PDF.");
        if (!body.data || body.data.length > 4_300_000) throw new CommandError("Files must be under 3 MB.");
        return json(await readInvoice({ mime: body.mime, data: body.data }));
      }
      default:
        throw new CommandError("Unknown request.");
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
