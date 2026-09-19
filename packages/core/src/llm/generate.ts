import { z } from "zod";
import type { JevProject } from "../types/project";
import { DEFAULT_MODEL } from "../types/project";
import type { LlmApiSettings } from "../store/settingsStore";
import { chatComplete, extractJsonBlock, LlmError } from "./client";
import type { LlmClientConfig } from "./client";
import { buildClarifyMessages, buildDraftMessages, buildRepairUserMessage } from "./prompts";

export interface ClarifyQuestion {
  question: string;
  options: { label: string; description?: string }[];
  multiSelect: boolean;
}

const clarifySchema = z.object({
  questions: z
    .array(
      z.object({
        question: z.string().min(1),
        options: z
          .array(z.object({ label: z.string().min(1), description: z.string().optional() }))
          .min(2)
          .max(8),
        multiSelect: z.boolean().optional().default(false),
      })
    )
    .min(1)
    .max(6),
});

const draftSchema = z.object({
  name: z.string().optional(),
  state: z.union([z.string(), z.record(z.string(), z.unknown()), z.array(z.unknown())]),
  questions: z.record(
    z.string(),
    z.union([
      z.object({ type: z.literal("choice"), instructions: z.string(), criteria: z.record(z.string(), z.string()) }),
      z.object({ type: z.literal("score"), instructions: z.string(), criteria: z.array(z.string()).min(2).max(10) }),
      z.object({
        type: z.literal("noul"),
        instructions: z.string(),
        criteria: z.object({ true: z.string().optional(), false: z.string().optional() }).optional(),
      }),
    ])
  ),
});

export interface GenerateContext {
  settings: LlmApiSettings;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}

function clientConfig(settings: LlmApiSettings): LlmClientConfig {
  if (settings.useProxy) {
    const origin = settings.proxyOrigin?.trim() ? settings.proxyOrigin.replace(/\/+$/, "") : "";
    return { ...settings, baseUrl: `${origin}/api/llm` };
  }
  return settings;
}

export async function generateClarify(
  ctx: GenerateContext,
  input: { description: string; locale: "zh-CN" | "zh-TW" | "en" | "ja"; includeCurrent: boolean; currentProjectJson?: string }
): Promise<ClarifyQuestion[]> {
  const cfg = clientConfig(ctx.settings);
  if (!cfg.apiKey && !ctx.settings.useProxy) {
    throw new LlmError("LLM API Key 未配置，请在设置中填写 API Key 或开启本地代理。");
  }
  const messages = buildClarifyMessages(input);
  let reply = await chatComplete(cfg, messages, { fetchImpl: ctx.fetchImpl, signal: ctx.signal });
  let parsed = safeParseClarify(reply);
  if (!parsed.ok) {
    // one automatic retry with the error fed back (plan behavior)
    reply = await chatComplete(
      cfg,
      [...messages, { role: "assistant", content: reply }, { role: "user", content: buildRepairUserMessage(parsed.error) }],
      { fetchImpl: ctx.fetchImpl, signal: ctx.signal }
    );
    parsed = safeParseClarify(reply);
    if (!parsed.ok) throw new LlmError(parsed.error);
  }
  const spec = clarifySchema.parse(parsed.value);
  return spec.questions.map((q) => ({ question: q.question, options: q.options, multiSelect: q.multiSelect ?? false }));
}

function safeParseClarify(reply: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: extractJsonBlock(reply) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function generateDraft(
  ctx: GenerateContext,
  input: {
    description: string;
    answers: { question: string; selected: string[] }[];
    locale: "zh-CN" | "zh-TW" | "en" | "ja";
    includeCurrent: boolean;
    currentProjectJson?: string;
  }
): Promise<JevProject> {
  const cfg = clientConfig(ctx.settings);
  if (!cfg.apiKey && !ctx.settings.useProxy) {
    throw new LlmError("LLM API Key 未配置，请在设置中填写 API Key 或开启本地代理。");
  }
  const messages = buildDraftMessages(input);
  let reply = await chatComplete(cfg, messages, { fetchImpl: ctx.fetchImpl, signal: ctx.signal, temperature: 0.4 });
  let parsed = safeParseDraft(reply);
  if (!parsed.ok) {
    reply = await chatComplete(
      cfg,
      [...messages, { role: "assistant", content: reply }, { role: "user", content: buildRepairUserMessage(parsed.error) }],
      { fetchImpl: ctx.fetchImpl, signal: ctx.signal, temperature: 0.4 }
    );
    parsed = safeParseDraft(reply);
    if (!parsed.ok) throw new LlmError(parsed.error);
  }
  const draft = draftSchema.parse(parsed.value);
  return draftToProject(draft);
}

function safeParseDraft(reply: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: extractJsonBlock(reply) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function draftToProject(draft: z.infer<typeof draftSchema>): JevProject {
  const questions: JevProject["questions"] = [];
  for (const [id, q] of Object.entries(draft.questions)) {
    if (q.type === "choice") {
      questions.push({
        id,
        type: "choice",
        instructions: q.instructions,
        criteria: { kind: "choice", options: Object.entries(q.criteria).map(([key, description]) => ({ key, description })) },
      });
    } else if (q.type === "score") {
      questions.push({ id, type: "score", instructions: q.instructions, criteria: { kind: "score", levels: q.criteria } });
    } else {
      questions.push({
        id,
        type: "noul",
        instructions: q.instructions,
        criteria: { kind: "noul", trueDesc: q.criteria?.true, falseDesc: q.criteria?.false },
      });
    }
  }
  return {
    version: 1,
    name: draft.name ?? "ai-draft",
    model: DEFAULT_MODEL,
    state: draft.state as JevProject["state"],
    questions,
  };
}
