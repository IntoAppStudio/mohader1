/**
 * Lovable AI Gateway access. Server-only.
 * Every prompt is source-bound: the model may only use the supplied blocks and
 * must cite the block ids it used, so unsupported output can be rejected.
 */

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

export class AiUnavailableError extends Error {}

function stripFence(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1]! : trimmed;
  const start = body.search(/[[{]/);
  if (start < 0) return body;
  const end = Math.max(body.lastIndexOf("}"), body.lastIndexOf("]"));
  return body.slice(start, end + 1);
}

export async function aiJson<T>(system: string, user: string): Promise<T> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new AiUnavailableError("LOVABLE_API_KEY is not configured");

  const response = await fetch(GATEWAY, {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (response.status === 429) throw new AiUnavailableError("RATE_LIMIT");
  if (response.status === 402) throw new AiUnavailableError("CREDITS_REQUIRED");
  if (!response.ok) {
    const detail = await response.text();
    console.error("[ai] gateway error", response.status, detail.slice(0, 500));
    throw new AiUnavailableError("GATEWAY_ERROR");
  }

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new AiUnavailableError("EMPTY_RESPONSE");

  try {
    return JSON.parse(stripFence(content)) as T;
  } catch {
    console.error("[ai] unparsable response", content.slice(0, 500));
    throw new AiUnavailableError("UNPARSABLE_RESPONSE");
  }
}

export const SOURCE_BOUND_SYSTEM = [
  "You build study material strictly from the supplied source blocks of one single course.",
  "Absolute rules:",
  "1. Use ONLY the supplied blocks. Never add outside knowledge, examples, or definitions.",
  "2. Every generated item must list the block ids (integers) it is derived from in a `refs` array. Items without refs are invalid.",
  "3. Preserve the terminology, notation and solution methods exactly as written in the source. Do not substitute an alternative method.",
  "4. Keep the language of the source material.",
  "5. Answer with raw JSON only, no prose, no markdown fences.",
].join("\n");
