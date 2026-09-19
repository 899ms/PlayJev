export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmClientConfig {
  protocol: "openai" | "response" | "anthropic";
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
  let res: Response;

  if (cfg.protocol === "anthropic") {
    res = await doFetch(`${base}/messages`, {
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
    });
  } else if (cfg.protocol === "response") {
    const url = base.endsWith("/responses") ? base : `${base}/responses`;
    // Responses API shape: system prompt goes to top-level `instructions`,
    // conversation goes to `input` (no `system` role there), and sampling
    // params are omitted (reasoning models reject `temperature`).
    const instructions = messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n");
    const input = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role, content: m.content }));
    res = await doFetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: cfg.model,
        ...(instructions ? { instructions } : {}),
        input,
        max_output_tokens: opts?.maxTokens ?? 4096,
      }),
      signal: opts?.signal,
    });
  } else {
    const url = base.endsWith("/chat/completions") ? base : `${base}/chat/completions`;
    res = await doFetch(url, {
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
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new LlmError(text ? `HTTP ${res.status}: ${text.slice(0, 300)}` : `HTTP ${res.status}`, res.status);
  }

  const json = (await res.json()) as unknown;
  return extractText(json);
}

function collectContentTexts(content: unknown): string[] {
  if (!Array.isArray(content)) return [];
  const out: string[] = [];
  for (const part of content as Array<Record<string, unknown>>) {
    // { type: "text", text } (Anthropic / Responses output) and
    // { type: "output_text", text } (Responses nested message content)
    if (
      (part?.type === "text" || part?.type === "output_text") &&
      typeof part?.text === "string"
    ) {
      out.push(part.text);
    }
  }
  return out;
}

function extractText(json: unknown): string {
  const rec = json as Record<string, unknown>;
  // 1. Direct output_text (OpenAI Responses API)
  if (typeof rec?.output_text === "string" && rec.output_text.trim() !== "") {
    return rec.output_text;
  }
  // 2. OpenAI Chat: choices[0].message.content (string or content-part array).
  // Also tolerates legacy choices[0].text and data.choices wrappers from
  // OpenAI-compatible third-party providers.
  const choiceLists = [rec?.choices, (rec?.data as Record<string, unknown> | undefined)?.choices];
  for (const list of choiceLists) {
    if (!Array.isArray(list)) continue;
    const first = list[0] as Record<string, unknown> | undefined;
    const message = first?.message as Record<string, unknown> | undefined;
    if (typeof message?.content === "string" && message.content !== "") return message.content;
    const nested = collectContentTexts(message?.content);
    if (nested.length > 0) return nested.join("");
    // reasoning models sometimes put the answer in reasoning_content
    if (typeof message?.reasoning_content === "string" && message.reasoning_content.trim() !== "") {
      const fallback = collectContentTexts((first as Record<string, unknown>)?.content);
      if (fallback.length === 0) return message.reasoning_content;
    }
    if (typeof first?.text === "string" && (first.text as string) !== "") {
      return first.text as string;
    }
  }
  // 3. OpenAI Responses API nested output: output[].content[].text|output_text.
  // Reasoning summaries (type summary/output_text without message wrapper) count too.
  const output = rec?.output as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(output)) {
    const textParts: string[] = [];
    for (const item of output) {
      textParts.push(...collectContentTexts(item?.content));
      if (typeof item?.text === "string" && (item.text as string) !== "") {
        textParts.push(item.text as string);
      }
    }
    if (textParts.length > 0) return textParts.join("");
  }
  // 4. Anthropic: content[].text
  const anthropic = collectContentTexts(rec?.content);
  if (anthropic.length > 0) return anthropic.join("");
  // 5. Common custom wrapper / proxy fields: response, result, text, message, output
  for (const key of ["response", "result", "text", "message", "output"] as const) {
    if (typeof rec?.[key] === "string" && (rec[key] as string).trim() !== "") {
      return rec[key] as string;
    }
  }

  // 6. Give up — but include a truncated dump of the top-level keys and a
  // body preview so the user can report / adapt instead of guessing blind.
  const keys = rec && typeof rec === "object" ? Object.keys(rec).join(",") : typeof json;
  let preview = "";
  try {
    preview = JSON.stringify(json)?.slice(0, 300) ?? "";
  } catch {
    preview = String(json).slice(0, 300);
  }
  throw new LlmError(`Unrecognized LLM response shape (keys: ${keys}): ${preview}`);
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
