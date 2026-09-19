export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmClientConfig {
  protocol: "openai" | "anthropic";
  baseUrl: string;
  apiKey: string;
  model: string;
}

export class LlmError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "LlmError";
    this.status = status;
  }
}

export interface ChatOptions {
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  temperature?: number;
  maxTokens?: number;
}

export async function chatComplete(cfg: LlmClientConfig, messages: LlmMessage[], opts?: ChatOptions): Promise<string> {
  const doFetch = opts?.fetchImpl ?? fetch;
  const base = cfg.baseUrl.replace(/\/+$/, "");
  const res =
    cfg.protocol === "anthropic"
      ? await doFetch(`${base}/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": cfg.apiKey,
            "anthropic-version": "2023-06-01",
            // required for direct browser calls
            "anthropic-dangerous-direct-browser-access": "true",
          },
          body: JSON.stringify({
            model: cfg.model,
            max_tokens: opts?.maxTokens ?? 4096,
            temperature: opts?.temperature ?? 0.7,
            system: messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n") || undefined,
            messages: messages
              .filter((m) => m.role !== "system")
              .map((m) => ({ role: m.role, content: m.content })),
          }),
          signal: opts?.signal,
        })
      : await doFetch(`${base}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
          },
          body: JSON.stringify({
            model: cfg.model,
            messages,
            temperature: opts?.temperature ?? 0.7,
            max_tokens: opts?.maxTokens ?? 4096,
          }),
          signal: opts?.signal,
        });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new LlmError(text ? `HTTP ${res.status}: ${text.slice(0, 300)}` : `HTTP ${res.status}`, res.status);
  }

  const json = (await res.json()) as unknown;
  return extractText(json);
}

function extractText(json: unknown): string {
  const rec = json as Record<string, unknown>;
  // OpenAI: choices[0].message.content
  const choices = rec?.choices as Array<Record<string, unknown>> | undefined;
  const message = choices?.[0]?.message as Record<string, unknown> | undefined;
  if (typeof message?.content === "string") return message.content;
  // Anthropic: content[].text
  const content = rec?.content as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(content)) {
    return content
      .filter((part) => part?.type === "text" && typeof part.text === "string")
      .map((part) => part.text)
      .join("");
  }
  throw new LlmError("Unrecognized LLM response shape");
}

/**
 * Pull the first JSON object out of an LLM reply: direct parse → fenced block →
 * outermost braces substring.
 */
export function extractJsonBlock(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    /* fall through */
  }
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1]!.trim());
    } catch {
      /* fall through */
    }
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1)); // throws with a clear SyntaxError
  }
  throw new SyntaxError("No JSON object found in the reply");
}
