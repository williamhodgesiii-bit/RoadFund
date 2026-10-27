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

export async function writeMessage(input: {
  kind: string;
  tone: "friendly" | "firm";
  draft: string;
  facts: Record<string, string>;
  channel: "text" | "email" | "print";
}): Promise<string> {
  const limits = { text: "Keep it under 300 characters.", email: "Keep it under 120 words.", print: "Keep it under 180 words." };
  return run({
    system: `You help a volunteer road captain write messages to neighbors who share a private road. ${VOICE} ${limits[input.channel]} Keep every amount, date and link from the draft exactly as written. Return only the message text.`,
    content: [
      {
        type: "text",
        text: `Message type: ${input.kind}\nTone: ${input.tone}\nChannel: ${input.channel}\nFacts:\n${Object.entries(input.facts)
          .map(([k, v]) => `- ${k}: ${v}`)
          .join("\n")}\n\nCurrent draft:\n${input.draft}\n\nRewrite the draft in the captain's voice.`,
      },
    ],
    effort: "low",
    maxTokens: 2000,
  });
}

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

export async function compareQuotes(input: {
  job: string;
  scope: string;
  quotes: { vendor: string; amount: string; scope: string; warranty: string; startBy: string }[];
}): Promise<{ summary: string; rows: { vendor: string; matchesScope: string; watchOut: string }[] }> {
  const out = await run({
    system: `You line up contractor quotes for a road captain so they can compare them. Point out differences in scope, materials, warranty and timing, and anything missing compared with the job scope. Do not pick a winner or recommend accepting a bid; the captain and neighbors decide. ${VOICE}`,
    content: [
      {
        type: "text",
        text: `Job: ${input.job}\nScope asked for: ${input.scope}\n\nQuotes:\n${input.quotes
          .map((q, i) => `${i + 1}. ${q.vendor}: ${q.amount}. Scope: ${q.scope}. Warranty: ${q.warranty || "not stated"}. Can start by: ${q.startBy || "not stated"}.`)
          .join("\n")}`,
      },
    ],
    effort: "medium",
    maxTokens: 4000,
    schema: {
      type: "object",
      properties: {
        summary: { type: "string", description: "Three to five sentences on how the quotes differ. No recommendation." },
        rows: {
          type: "array",
          items: {
            type: "object",
            properties: {
              vendor: { type: "string" },
              matchesScope: { type: "string", description: "Short: does it match the scope asked for, and what differs." },
              watchOut: { type: "string", description: "Short: anything to ask the contractor about, or 'Nothing noted'." },
            },
            required: ["vendor", "matchesScope", "watchOut"],
            additionalProperties: false,
          },
        },
      },
      required: ["summary", "rows"],
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

export async function readDeed(input: { mime: DocMime; data: string }) {
  const out = await run({
    system: `You read deeds, easements and plats for a private road group. Pull out what the document says about the road and access. Quote source text exactly. Flag conflicts or missing pieces a lender would care about (no maintenance terms, no cost shares, not recorded, unclear legal description). Never decide legal questions; an attorney confirms. ${VOICE}`,
    content: [fileBlock(input.mime, input.data), { type: "text", text: "Read this document and extract the road and access details." }],
    effort: "medium",
    maxTokens: 6000,
    schema: {
      type: "object",
      properties: {
        documentType: { type: "string" },
        recording: { type: "string", description: "Book/page, instrument number or recording date if shown, else empty." },
        roadDescription: { type: "string" },
        owners: { type: "array", items: { type: "string" } },
        findings: {
          type: "array",
          items: {
            type: "object",
            properties: { label: { type: "string" }, quote: { type: "string" } },
            required: ["label", "quote"],
            additionalProperties: false,
          },
        },
        gaps: { type: "array", items: { type: "string" }, description: "Missing pieces or conflicts to raise with the attorney." },
      },
      required: ["documentType", "recording", "roadDescription", "owners", "findings", "gaps"],
      additionalProperties: false,
    },
  });
  return JSON.parse(out) as {
    documentType: string;
    recording: string;
    roadDescription: string;
    owners: string[];
    findings: { label: string; quote: string }[];
    gaps: string[];
  };
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

export async function readDamage(input: { mime: DocMime; data: string; note: string }) {
  const out = await run({
    system: `You look at photos of damage on a private gravel or paved road and describe it for a repair list. Give sizes only as rough ranges and say they are estimates. ${VOICE}`,
    content: [fileBlock(input.mime, input.data), { type: "text", text: `Neighbor's note: ${input.note || "none"}. Describe the damage.` }],
    effort: "low",
    maxTokens: 2000,
    schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short label, e.g. 'Pothole cluster' or 'Washout at road edge'." },
        severity: { type: "string", enum: ["minor", "moderate", "severe"] },
        sizeEstimate: { type: "string", description: "Rough range, e.g. 'about 2 to 3 ft across, 3 to 5 in deep'." },
        description: { type: "string", description: "Two sentences: what it is and what usually fixes it." },
      },
      required: ["title", "severity", "sizeEstimate", "description"],
      additionalProperties: false,
    },
  });
  return JSON.parse(out) as { title: string; severity: "minor" | "moderate" | "severe"; sizeEstimate: string; description: string };
}

export async function writeMinutes(input: { roadName: string; date: string; notes: string }) {
  return run({
    system: `You turn a road captain's rough notes from the annual road meeting into short minutes. Sections: Present, Decisions (with vote counts if given), Money, Next steps. Use only what's in the notes. Mark anything unclear with [check]. ${VOICE}`,
    content: [{ type: "text", text: `Road: ${input.roadName}\nMeeting date: ${input.date}\n\nNotes:\n${input.notes}` }],
    effort: "low",
    maxTokens: 4000,
  });
}
