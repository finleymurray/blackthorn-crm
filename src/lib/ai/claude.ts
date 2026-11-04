import "server-only";

/**
 * Optional Claude integration. Everything here degrades to "off" when
 * ANTHROPIC_API_KEY is not set, and the UI hides the AI buttons entirely.
 * The Messages API is called directly with fetch so no SDK is needed.
 */
export function aiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5";

interface MessagesResponse {
  content: Array<{ type: string; text?: string }>;
}

export async function askClaude(system: string, user: string, maxTokens = 800): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("AI assist is not configured");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AI request failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as MessagesResponse;
  return data.content
    .filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("\n")
    .trim();
}

/** Pulls a JSON object out of a model reply that may be wrapped in prose or code fences. */
export function extractJson<T>(text: string): T | null {
  const m = /\{[\s\S]*\}/.exec(text);
  if (!m) return null;
  try {
    return JSON.parse(m[0]) as T;
  } catch {
    return null;
  }
}
