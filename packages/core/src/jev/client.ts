import { z } from "zod";
import type { JevRequest, JevResponse } from "../types/api";

/**
 * Client for POST /v1/systemone (docs/jev/api.md).
 * Retries 429 / 529 with backoff, honoring `retry-after` (api.md #handling-rate-limits).
 */

export class JevApiError extends Error {
  status: number;
  body?: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = "JevApiError";
    this.status = status;
    this.body = body;
  }
}

export interface JevClientConfig {
  /** Same-origin proxy path. The browser never calls TypeSafe directly. */
  endpoint: string;
  /** Sent as `Authorization: Bearer <key>` to the same-origin proxy. */
  apiKey: string;
  /** Real Jev upstream (e.g. custom mirror). Carried to the proxy via the
   * `x-jev-target` header; servers fall back to the official upstream. */
  baseUrl?: string;
}

export interface EvaluateOptions {
  fetchImpl?: typeof fetch;
  maxRetries?: number;
  signal?: AbortSignal;
  onRetry?: (attempt: number, delayMs: number) => void;
}

const answerSchema = z.union([
  z.object({
    type: z.literal("choice"),
    choice: z.string(),
    probabilities: z.record(z.string(), z.number()),
    confidence: z.number(),
  }),
  z.object({
    type: z.literal("score"),
    score: z.number(),
    legend: z.record(z.string(), z.unknown()),
    probabilities: z.record(z.string(), z.number()),
    confidence: z.number(),
  }),
  z.object({ type: z.literal("noul"), noul: z.number() }),
]);

const responseSchema = z.object({
  model: z.string(),
  answers: z.record(z.string(), answerSchema),
  usage: z.object({ input_tokens: z.number().optional(), output_tokens: z.number().optional() }).optional(),
});

const RETRYABLE = new Set([429, 529]);

export function defaultBackoffMs(attempt: number, retryAfterHeader: string | null): number {
  const seconds = retryAfterHeader ? Number.parseFloat(retryAfterHeader) : Number.NaN;
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  return 1000 * Math.pow(2, attempt);
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });

export async function evaluate(
  cfg: JevClientConfig,
  request: JevRequest,
  opts?: EvaluateOptions
): Promise<JevResponse> {
  const doFetch = opts?.fetchImpl ?? fetch;
  const maxRetries = opts?.maxRetries ?? 2;

  let attempt = 0;
  for (;;) {
    const res = await doFetch(cfg.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
        ...(cfg.baseUrl ? { "x-jev-target": cfg.baseUrl } : {}),
      },
      body: JSON.stringify(request),
      signal: opts?.signal,
    });

    if (res.ok) {
      const json: unknown = await res.json();
      const parsed = responseSchema.parse(json);
      return parsed as JevResponse;
    }

    if (RETRYABLE.has(res.status) && attempt < maxRetries) {
      const delay = defaultBackoffMs(attempt, res.headers.get("retry-after"));
      opts?.onRetry?.(attempt + 1, delay);
      await sleep(delay, opts?.signal);
      attempt++;
      continue;
    }

    const bodyText = await res.text().catch(() => "");
    let body: unknown = bodyText || undefined;
    try {
      body = bodyText ? (JSON.parse(bodyText) as unknown) : undefined;
    } catch {
      /* keep raw text */
    }
    throw new JevApiError(res.status, await humanizeError(res.status, body), body);
  }
}

/** Error titles shown in the UI are resolved from keys — see error.http* in locales. */
export function errorKeyForStatus(status: number): string {
  if (status === 401) return "error.http401";
  if (status === 422) return "error.http422";
  if (status === 429) return "error.http429";
  if (status === 529) return "error.http529";
  return "error.httpOther";
}

export function extractServerMessage(body: unknown): string {
  if (typeof body === "string" && body.trim()) return body.slice(0, 300);
  if (body && typeof body === "object") {
    const rec = body as Record<string, unknown>;
    for (const key of ["message", "error", "detail", "details"]) {
      const v = rec[key];
      if (typeof v === "string" && v.trim()) return v.slice(0, 300);
    }
  }
  return "";
}

async function humanizeError(status: number, body: unknown): Promise<string> {
  const message = extractServerMessage(body);
  return message || `HTTP ${status}`;
}
