import { z } from "zod";
import type { JevProject } from "../types/project";
import { DEFAULT_MODEL } from "../types/project";
import type { LlmApiSettings } from "../store/settingsStore";
import { chatComplete, extractJsonBlock, LlmError } from "./client";
import type { LlmClientConfig } from "./client";
import { buildClarifyMessages, buildDraftMessages, buildRepairUserMessage } from "./prompts";
import { TEMPLATES } from "../templates";

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
    return { ...settings, baseUrl: `${settings.proxyOrigin.replace(/\/+$/, "")}/api/llm` };
  }
  return settings;
}

export async function generateClarify(
  ctx: GenerateContext,
  input: { description: string; locale: "zh-CN" | "zh-TW" | "en" | "ja"; includeCurrent: boolean; currentProjectJson?: string }
): Promise<ClarifyQuestion[]> {
  if (ctx.settings.mockMode) return mockClarify(input.locale);

  const cfg = clientConfig(ctx.settings);
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
  if (ctx.settings.mockMode) return mockDraft(input.locale);

  const cfg = clientConfig(ctx.settings);
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

// --- mock path (LLM demo mode, mirrors the zh/en doc example) ---------------

function mockClarify(locale: "zh-CN" | "zh-TW" | "en" | "ja"): ClarifyQuestion[] {
  if (locale === "zh-CN") {
    return [
      {
        question: "评估的对象通常是什么内容?",
        options: [
          { label: "客服工单/用户消息", description: "工单、邮件、聊天消息等" },
          { label: "结构化记录", description: "订单、发票、简历等字段化数据" },
          { label: "混合内容", description: "消息+相关记录一起评估" },
        ],
        multiSelect: false,
      },
      {
        question: "需要哪些判断维度?(可多选)",
        options: [
          { label: "分类/路由", description: "把内容分到固定类别" },
          { label: "程度评分", description: "如紧急度、愤怒度、严重度" },
          { label: "是非判断", description: "如是否要求退款、是否紧急" },
        ],
        multiSelect: true,
      },
      {
        question: "分类的类别大概有哪些?",
        options: [
          { label: "账单/技术/销售", description: "常见客服三分法" },
          { label: "退货/物流/账单", description: "电商场景三分法" },
          { label: "我自己提供", description: "生成后我在编辑器里改" },
        ],
        multiSelect: false,
      },
    ];
  }
  return [
    {
      question: "What content will be evaluated?",
      options: [
        { label: "Tickets / user messages", description: "Support tickets, emails, chat messages" },
        { label: "Structured records", description: "Orders, invoices, resumes" },
        { label: "Mixed content", description: "Message plus related records" },
      ],
      multiSelect: false,
    },
    {
      question: "Which judgment dimensions do you need? (multi-select)",
      options: [
        { label: "Classification / routing", description: "Assign content to fixed categories" },
        { label: "Degree scoring", description: "Urgency, frustration, severity…" },
        { label: "Yes/no judgments", description: "Refund requested? Urgent?" },
      ],
      multiSelect: true,
    },
    {
      question: "Roughly which categories?",
      options: [
        { label: "Billing / technical / sales", description: "Common support triage" },
        { label: "Returns / shipping / billing", description: "E-commerce triage" },
        { label: "I'll provide my own", description: "I'll edit them in the builder" },
      ],
      multiSelect: false,
    },
  ];
}

function mockDraft(locale: "zh-CN" | "zh-TW" | "en" | "ja"): JevProject {
  const t = TEMPLATES[0]!.build(locale);
  t.name = locale === "zh-CN" || locale === "zh-TW" ? "AI 草稿" : "AI draft";
  return t;
}
