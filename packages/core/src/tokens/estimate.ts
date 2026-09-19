import type { EntryValue, JevProject } from "../types/project";
import { questionJson } from "../schema/serialize";

/**
 * Budgets from docs/jev/models.md (Jev 1.13):
 * 64k tokens per request; 32k tokens for the state plus the longest question.
 */
export const BUDGET_TOTAL = 64_000;
export const BUDGET_STATE_PLUS_LONGEST = 32_000;

const CJK_RE = /[\u2E80-\u9FFF\uF900-\uFAFF\u3040-\u30FF\uAC00-\uD7AF\u3000-\u303F\uFF00-\uFFEF]/;

/**
 * Heuristic estimate, clearly labelled as such in the UI: CJK ≈ 1 token/char,
 * other text ≈ 4 chars/token. Real usage comes back in `usage.input_tokens`.
 */
export function estimateTokens(text: string): number {
  let cjk = 0;
  let other = 0;
  for (const ch of text) {
    if (CJK_RE.test(ch)) cjk++;
    else other++;
  }
  return cjk + Math.ceil(other / 4);
}

/** Flatten any EntryValue to text for estimation purposes. */
export function entryValueText(value: EntryValue): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(entryValueText).join(" ");
  return Object.entries(value)
    .map(([k, v]) => `${k} ${entryValueText(v)}`)
    .join(" ");
}

export function textOfState(state: string | EntryValue): string {
  return typeof state === "string" ? state : entryValueText(state as EntryValue);
}

export interface TokenReport {
  stateTokens: number;
  longestQuestionTokens: number;
  totalTokens: number;
  /** The tighter of the two budget constraints (docs/jev/models.md). */
  bindingBudget: number;
  bindingUsed: number;
  bindingKind: "state_plus_longest" | "total";
}

export function estimateRequestTokens(project: JevProject): TokenReport {
  const stateTokens = estimateTokens(textOfState(project.state));
  let longestQuestionTokens = 0;
  let totalTokens = stateTokens;
  for (const q of project.questions) {
    const t = estimateTokens(questionJson(q));
    if (t > longestQuestionTokens) longestQuestionTokens = t;
    totalTokens += t;
  }
  const statePlusLongest = stateTokens + longestQuestionTokens;
  const ratioState = statePlusLongest / BUDGET_STATE_PLUS_LONGEST;
  const ratioTotal = totalTokens / BUDGET_TOTAL;
  return ratioState >= ratioTotal
    ? {
        stateTokens,
        longestQuestionTokens,
        totalTokens,
        bindingBudget: BUDGET_STATE_PLUS_LONGEST,
        bindingUsed: statePlusLongest,
        bindingKind: "state_plus_longest",
      }
    : {
        stateTokens,
        longestQuestionTokens,
        totalTokens,
        bindingBudget: BUDGET_TOTAL,
        bindingUsed: totalTokens,
        bindingKind: "total",
      };
}
