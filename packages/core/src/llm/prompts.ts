import type { LlmMessage } from "./client";
import type { Locale } from "../i18n/core";

/**
 * Two-step generation, mirroring a plan-style flow:
 * 1) clarify — the model asks 2–4 multiple-choice questions,
 * 2) draft — the model emits a full Jev request body as JSON.
 * System prompts embed the Jev schema and authoring best practices distilled
 * from docs/jev (atomic questions, choice/score/noul rules).
 */

export interface ClarifyInput {
  description: string;
  locale: Locale;
  includeCurrent: boolean;
  currentProjectJson?: string;
}

export function buildClarifyMessages(input: ClarifyInput): LlmMessage[] {
  const languageName =
    input.locale === "zh-CN"
      ? "Simplified Chinese (简体中文)"
      : input.locale === "zh-TW"
        ? "Traditional Chinese (繁體中文)"
        : input.locale === "ja"
          ? "Japanese (日本語)"
          : input.locale === "de"
            ? "German (Deutsch)"
            : input.locale === "fr"
              ? "French (Français)"
              : "English";
  const system = `You help a developer design inputs for the TypeSafe "Jev" System One API.
The user will describe what they want to evaluate. Before producing anything, ask 2 to 4 short
multiple-choice clarifying questions that materially change the design of the questions
(e.g. which categories, how many score levels, yes/no vs multi-way, what the state will contain).
All human-readable text you output MUST be written in ${languageName}.

Reply with ONLY a JSON object, no prose, in this exact shape:
{
  "questions": [
    {
      "question": "clarifying question text",
      "options": [ { "label": "short option", "description": "one sentence why/what it implies" } ],
      "multiSelect": false
    }
  ]
}
Rules: 2-4 questions; 2-4 options each; multiSelect true only when several answers can combine.`;

  const userParts = [`What I want to build: ${input.description}`];
  if (input.includeCurrent && input.currentProjectJson) {
    userParts.push(`Here is the current draft project to iterate on:\n${input.currentProjectJson}`);
  }
  return [
    { role: "system", content: system },
    { role: "user", content: userParts.join("\n\n") },
  ];
}

export interface DraftInput {
  description: string;
  /** The user's picked options, in the clarify questions' order. */
  answers: { question: string; selected: string[] }[];
  locale: Locale;
  includeCurrent: boolean;
  currentProjectJson?: string;
}

const BEST_PRACTICES = `Authoring rules (from the TypeSafe docs):
- Ask atomic questions: one snap judgment each. Split complex judgments into several questions and let code combine them.
- "choice": criteria is an object mapping option key -> description (string). Both keys and descriptions are sent to the model. Add an "other" escape hatch when the list may not cover every input. Use null only via omitting the description (keep descriptions as strings here).
- "score": criteria is an ordered array of 2-10 level descriptions, low to high. Describe situations, not degrees; never bare numbers ("0","1","2" are useless); the model never sees level numbers or neighbors.
- "noul": a yes/no question returning P(yes). Phrase it so a high value means "yes". Optional criteria { "true": "...", "false": "..." }.
- instructions: complete, specific questions. Reference state fields with backticked dot paths, e.g. \`ticket.messages[0].text\`.
- state: a plain string, or an object/array with named fields. Prefer an object when several parts matter.
- Use 2-8 questions; prefer questions your code can act on directly.`;

export function buildDraftMessages(input: DraftInput): LlmMessage[] {
  const languageName =
    input.locale === "zh-CN"
      ? "Simplified Chinese (简体中文)"
      : input.locale === "zh-TW"
        ? "Traditional Chinese (繁體中文)"
        : input.locale === "ja"
          ? "Japanese (日本語)"
          : input.locale === "de"
            ? "German (Deutsch)"
            : input.locale === "fr"
              ? "French (Français)"
              : "English";
  const system = `You design Jev (TypeSafe System One) request bodies and return them as JSON.
${BEST_PRACTICES}
All human-readable text (state, instructions, criteria, name) MUST be written in ${languageName}.
The state you produce is an EXAMPLE for the user to replace with real data.

Reply with ONLY a JSON object in this exact shape:
{
  "name": "short project name",
  "state": "string, or a JSON object with named fields",
  "questions": {
    "question_id": {
      "type": "choice" | "score" | "noul",
      "instructions": "the question to judge",
      "criteria": { "option_key": "description" }   // choice
    }
    // score -> "criteria": ["level 0", "level 1", ...]
    // noul  -> "criteria": { "true": "...", "false": "..." }  (optional; omit criteria entirely if not needed)
  }
}
No prose, no markdown fences, JSON only.`;

  const qa = input.answers
    .map((a) => `Q: ${a.question}\nA: ${a.selected.join("; ") || "(no selection)"}`)
    .join("\n\n");
  const userParts = [`What I want to build: ${input.description}`, `My answers:\n${qa}`];
  if (input.includeCurrent && input.currentProjectJson) {
    userParts.push(`Here is the current draft project to iterate on:\n${input.currentProjectJson}`);
  }
  return [
    { role: "system", content: system },
    { role: "user", content: userParts.join("\n\n") },
  ];
}

/** Follow-up asking the model to fix invalid JSON (used for one automatic retry). */
export function buildRepairUserMessage(errorText: string): string {
  return `Your previous reply was not valid JSON for the required shape. Error: ${errorText}
Reply again with ONLY the corrected JSON object. No prose, no markdown fences.`;
}
