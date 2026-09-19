import type { ChoiceQuestion, JevProject, ScoreQuestion } from "../types/project";
import { collectPaths } from "../statetree/parse";
import { textOfState, estimateRequestTokens, BUDGET_STATE_PLUS_LONGEST, BUDGET_TOTAL } from "../tokens/estimate";

export type IssueLevel = "error" | "warning" | "info";

export interface Issue {
  level: IssueLevel;
  /** Stable code, used by tests. */
  code: string;
  /** i18n key under lint.* — resolved by the UI layer. */
  messageKey: string;
  params?: Record<string, string | number>;
  questionId?: string;
}

export interface LintContext {
  /** Error text when the JSON source buffer failed to parse. */
  stateJsonError?: string | null;
  /** Raw JSON source buffer — scanned for duplicate keys that JSON.parse would silently drop. */
  stateJsonText?: string;
}

/**
 * Validation grounded in docs/jev:
 * - hard rules from api.md (422-class mistakes),
 * - best-practice warnings from primitives*.md,
 * - hints from primitives.md / models.md.
 */
export function lintProject(project: JevProject, ctx?: LintContext): Issue[] {
  const issues: Issue[] = [];
  const push = (i: Issue) => issues.push(i);

  // --- project level -------------------------------------------------------
  // Note: state may be empty — asking questions only is valid (matches the official playground).
  if (ctx?.stateJsonError) {
    push({ level: "error", code: "state_json_invalid", messageKey: "lint.stateJsonInvalid", params: { error: ctx.stateJsonError } });
  }
  if (!project.model || project.model.trim() === "") {
    push({ level: "error", code: "model_empty", messageKey: "lint.modelEmpty" });
  }
  if (project.questions.length === 0) {
    push({ level: "error", code: "no_questions", messageKey: "lint.noQuestions" });
  }

  // --- token budgets (docs/jev/models.md) ----------------------------------
  if (project.state != null && (typeof project.state !== "string" || project.state.trim() !== "")) {
    const report = estimateRequestTokens(project);
    if (report.totalTokens > BUDGET_TOTAL) {
      push({
        level: "error",
        code: "token_over_total",
        messageKey: "lint.tokenOverTotal",
        params: { used: report.totalTokens, budget: BUDGET_TOTAL },
      });
    } else if (report.bindingUsed > BUDGET_STATE_PLUS_LONGEST) {
      push({
        level: "error",
        code: "token_over_state",
        messageKey: "lint.tokenOverState",
        params: { used: report.bindingUsed, budget: BUDGET_STATE_PLUS_LONGEST },
      });
    } else if (report.totalTokens > BUDGET_TOTAL * 0.8 || report.bindingUsed > BUDGET_STATE_PLUS_LONGEST * 0.8) {
      push({ level: "info", code: "token_near_budget", messageKey: "lint.tokenNearBudget" });
    }
  }

  // --- questions ------------------------------------------------------------
  const seenIds = new Map<string, number>();
  for (const q of project.questions) seenIds.set(q.id, (seenIds.get(q.id) ?? 0) + 1);

  for (const q of project.questions) {
    const ctxQ = { questionId: q.id };

    if (!q.id || q.id.trim() === "") {
      push({ level: "error", code: "id_empty", messageKey: "lint.idEmpty", ...ctxQ });
    } else if ((seenIds.get(q.id) ?? 0) > 1) {
      push({ level: "error", code: "id_duplicate", messageKey: "lint.idDuplicate", params: { id: q.id }, ...ctxQ });
    }

    const instructionsText = typeof q.instructions === "string" ? q.instructions.trim() : "";
    if (q.instructions == null || (typeof q.instructions === "string" && instructionsText === "")) {
      push({ level: "error", code: "instructions_empty", messageKey: "lint.instructionsEmpty", ...ctxQ });
    } else if (typeof q.instructions === "string" && instructionsText.length < 10) {
      // docs/jev/primitives.md Tip: the id is not sent to the model; write the full question.
      push({ level: "warning", code: "instructions_short", messageKey: "lint.instructionsShort", ...ctxQ });
    }

    if (q.type === "choice") {
      lintChoice(q as ChoiceQuestion, push);
    } else if (q.type === "score") {
      lintScore(q as ScoreQuestion, push);
    }
  }

  // --- cross checks: backtick paths against the state tree ------------------
  const statePaths = new Set(collectPaths(project.state));
  for (const q of project.questions) {
    if (typeof q.instructions !== "string") continue;
    for (const path of extractBacktickPaths(q.instructions)) {
      if (!statePaths.has(path) && !path.startsWith("extracted_value") && !isLocalRef(path)) {
        push({
          level: "warning",
          code: "path_not_found",
          messageKey: "lint.pathNotFound",
          params: { path },
          questionId: q.id,
        });
      }
    }
  }

  // --- strict state schema conformance (docs/jev/concepts/state.md) ----------
  if (project.state != null && typeof project.state !== "string") {
    collectStateKeyIssues(project.state, push);
  }
  if (ctx?.stateJsonText) {
    for (const key of findDuplicateJsonKeys(ctx.stateJsonText)) {
      push({
        level: "error",
        code: "state_duplicate_key",
        messageKey: "lint.stateDuplicateKey",
        params: { key },
      });
    }
  }

  // --- CJK hint (docs/jev/models.md language support) -----------------------
  if (containsCjk(textOfState(project.state))) {
    push({ level: "info", code: "cjk_state", messageKey: "lint.cjkState" });
  }

  return issues;
}

/** Object keys must be non-empty among parsed state; duplicates are reported from the raw JSON text. */
function collectStateKeyIssues(state: unknown, push: (i: Issue) => void): void {
  const walk = (v: unknown) => {
    if (v === null || typeof v !== "object") return;
    if (Array.isArray(v)) {
      v.forEach(walk);
      return;
    }
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (k.trim() === "") {
        push({ level: "error", code: "state_empty_key", messageKey: "lint.stateEmptyKey" });
      }
      walk(val);
    }
  };
  walk(state);
}

/**
 * Heuristic scan of a raw JSON source for duplicate keys — JSON.parse keeps only the
 * last occurrence silently, so this is the only way to surface the problem. Tracks
 * per-object scopes by brace depth; good enough for a lint pass, not a parser.
 */
export function findDuplicateJsonKeys(text: string): string[] {
  const duplicates = new Set<string>();
  // scope stack: each object scope maps keys → count
  type Scope = Map<string, number>;
  const stack: Scope[] = [];
  const keyRe = /"((?:[^"\\]|\\.)*)"\s*:|[{}[\]]/g;
  let match: RegExpExecArray | null;
  while ((match = keyRe.exec(text)) !== null) {
    const token = match[0];
    if (token === "{" || token === "[") {
      if (token === "{") stack.push(new Map());
      continue;
    }
    if (token === "}" || token === "]") {
      if (token === "}") stack.pop();
      continue;
    }
    const key = match[1]!;
    // a key only counts inside an object scope (arrays may contain "str": ... inside nested objects — handled by scope)
    const scope = stack[stack.length - 1];
    if (!scope) continue;
    const count = (scope.get(key) ?? 0) + 1;
    scope.set(key, count);
    if (count > 1) duplicates.add(key);
  }
  return [...duplicates];
}

function lintChoice(q: ChoiceQuestion, push: (i: Issue) => void): void {
  const ctxQ = { questionId: q.id };
  const options = q.criteria.options;
  if (options.length === 0) {
    push({ level: "error", code: "choice_empty", messageKey: "lint.choiceEmpty", ...ctxQ });
    return;
  }
  if (options.length > 255) {
    push({ level: "error", code: "choice_too_many", messageKey: "lint.choiceTooMany", params: { count: options.length }, ...ctxQ });
  }
  const keys = new Map<string, number>();
  for (const o of options) keys.set(o.key, (keys.get(o.key) ?? 0) + 1);
  for (const o of options) {
    if (!o.key || o.key.trim() === "") {
      push({ level: "error", code: "choice_key_empty", messageKey: "lint.choiceKeyEmpty", ...ctxQ });
      break;
    }
  }
  for (const [key, count] of keys) {
    if (key && count > 1) {
      push({ level: "error", code: "choice_key_duplicate", messageKey: "lint.choiceKeyDuplicate", params: { key }, ...ctxQ });
      break;
    }
  }
  // docs/jev/primitives/choice.md: add an `other` escape hatch when the list may not cover everything.
  if (options.length >= 3 && !options.some((o) => /other|none_of_the_above|none of the above|其他|其它/i.test(o.key))) {
    push({ level: "info", code: "choice_no_other", messageKey: "lint.choiceNoOther", ...ctxQ });
  }
}

function lintScore(q: ScoreQuestion, push: (i: Issue) => void): void {
  const ctxQ = { questionId: q.id };
  const levels = q.criteria.levels;
  // docs/jev/primitives/score.md: 2–10 levels.
  if (levels.length < 2) {
    push({ level: "error", code: "score_too_few", messageKey: "lint.scoreTooFew", params: { count: levels.length }, ...ctxQ });
  } else if (levels.length > 10) {
    push({ level: "error", code: "score_too_many", messageKey: "lint.scoreTooMany", params: { count: levels.length }, ...ctxQ });
  }
  for (let i = 0; i < levels.length; i++) {
    const level = levels[i]!;
    const text = typeof level === "string" ? level.trim() : JSON.stringify(level);
    if (text === "" || text === '""') {
      push({ level: "error", code: "score_level_empty", messageKey: "lint.scoreLevelEmpty", params: { index: i }, ...ctxQ });
    } else if (typeof level === "string" && /^\d+(\.\d+)?$/.test(level.trim())) {
      // docs/jev/primitives/score.md: the model never sees level numbers.
      push({ level: "warning", code: "score_level_numeric", messageKey: "lint.scoreLevelNumeric", params: { index: i }, ...ctxQ });
    }
  }
  if (typeof q.instructions === "string" && /\d\s*(到|-|–|—|~|to)\s*\d/i.test(q.instructions)) {
    // "Rate from 0 to 2" gives the model nothing to match against (score.md example).
    push({ level: "warning", code: "score_number_range", messageKey: "lint.scoreNumberRange", ...ctxQ });
  }
}

export function extractBacktickPaths(text: string): string[] {
  const matches = text.match(/`([^`\n]+)`/g) ?? [];
  return matches.map((m) => m.slice(1, -1).trim()).filter((p) => p.length > 0);
}

function isLocalRef(path: string): boolean {
  // structured-instruction style local refs (docs/jev/primitives/advanced.md),
  // e.g. `field` or `extracted_value` defined inside instructions themselves.
  return !path.includes(".") && !path.includes("[");
}

const CJK_RE = /[\u2E80-\u9FFF\uF900-\uFAFF\u3040-\u30FF\uAC00-\uD7AF]/;

export function containsCjk(text: string): boolean {
  return CJK_RE.test(text);
}
