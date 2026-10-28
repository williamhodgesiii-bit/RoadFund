import "server-only";

import Anthropic from "@anthropic-ai/sdk";

export const aiEnabled = Boolean(process.env.ANTHROPIC_API_KEY);

const MODEL = "claude-opus-5-5";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  client ??= new Anthropic();
  return client;
}

type Content = Anthropic.Beta.BetaContentBlockParam[];

export class AIRefusal extends Error {}

async function run(opts: {
  system: string;
  content: Content;
  effort: "low" | "medium";
  maxTokens: number;
  schema?: Record<string, unknown>;
}): Promise<string> {
  const response = await getClient().beta.messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: opts.system,
    output_config: {
      effort: opts.effort,
      ...(opts.schema ? { format: { type: "json_schema" as const, schema: opts.schema } } : {}),
    },
    messages: [{ role: "user", content: opts.content }],
  });
  if (response.stop_reason === "refusal") throw new AIRefusal("The assistant couldn't help with that request.");
  const text = response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  if (!text) throw new Error("Empty response");
  return text;
}

const VOICE =
  "Write like a practical, friendly neighbor in a rural area. Plain words, short sentences. No jargon, no exclamation-heavy cheer, no emojis, no em dashes. Never invent facts, amounts, dates or links that weren't given.";

export async function askAgreement(input: { question: string; agreement: string }): Promise<{ answer: string; sections: string[]; needsAttorney: boolean }> {
  const out = await run({
    system: `You answer questions about one private road maintenance agreement for the neighbors who signed it. Answer only from the agreement text provided. Quote the exact words that support the answer. If the agreement doesn't settle the question, say so plainly and set needsAttorney to true. Never give legal advice beyond what the text says. ${VOICE}`,
    content: [
      { type: "document", source: { type: "text", media_type: "text/plain", data: input.agreement }, title: "Road maintenance agreement" },
      { type: "text", text: `Question: ${input.question}` },
    ],
    effort: "low",
    maxTokens: 3000,
    schema: {
      type: "object",
      properties: {
        answer: { type: "string", description: "Two to five plain sentences, including a short exact quote." },
        sections: { type: "array", items: { type: "string" }, description: "Section titles relied on, e.g. '4. Budgets and decisions'." },
        needsAttorney: { type: "boolean" },
      },
      required: ["answer", "sections", "needsAttorney"],
      additionalProperties: false,
    },
  });
  return JSON.parse(out);
}

export type DocMime = "image/jpeg" | "image/png" | "image/webp" | "application/pdf";

function fileBlock(mime: DocMime, data: string): Anthropic.Beta.BetaContentBlockParam {
  return mime === "application/pdf"
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
    : { type: "image", source: { type: "base64", media_type: mime, data } };
}

export async function readInvoice(input: { mime: DocMime; data: string }) {
  const out = await run({
    system: "You read contractor invoices for a private road group. Extract the fields exactly as printed. Amounts in US dollars as numbers. Use an empty string or 0 when a field isn't shown.",
    content: [fileBlock(input.mime, input.data), { type: "text", text: "Extract the invoice fields." }],
    effort: "low",
    maxTokens: 2000,
    schema: {
      type: "object",
      properties: {
        vendor: { type: "string" },
        total: { type: "number" },
        date: { type: "string", description: "YYYY-MM-DD or empty" },
        description: { type: "string", description: "One short line of what the work was." },
        category: { type: "string", enum: ["plowing", "grading", "gravel", "culverts", "ditches", "trees", "paving", "insurance", "legal", "other"] },
      },
      required: ["vendor", "total", "date", "description", "category"],
      additionalProperties: false,
    },
  });
  return JSON.parse(out) as { vendor: string; total: number; date: string; description: string; category: string };
}
