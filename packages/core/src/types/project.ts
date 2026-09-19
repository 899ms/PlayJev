/**
 * Core value types mirroring the TypeSafe System One API schema.
 * See docs/jev/api.md and docs/jev/primitives/advanced.md (EntryType).
 */

/**
 * Any JSON leaf/branch accepted inside questions (docs/jev/primitives/advanced.md
 * calls this EntryType) and inside object/array state. The docs list
 * string|object|array|null for question fields; numbers/booleans are admitted
 * because object state legitimately carries them (api.md example: amount_usd 49).
 */
export type EntryValue = string | number | boolean | null | EntryValue[] | { [key: string]: EntryValue };

export type QuestionType = "choice" | "score" | "noul";

export interface ChoiceOption {
  /** Option name; sent to the model together with the description. */
  key: string;
  /** Option rubric description; may be null when the key is self-explanatory (docs/jev/primitives/choice.md). */
  description: EntryValue;
}

export type QuestionCriteria =
  | { kind: "choice"; options: ChoiceOption[] }
  | { kind: "score"; levels: EntryValue[] }
  | { kind: "noul"; trueDesc?: EntryValue; falseDesc?: EntryValue };

export interface QuestionDef {
  /** Answer key; never sent to the model (docs/jev/primitives.md). */
  id: string;
  type: QuestionType;
  instructions: EntryValue;
  criteria: QuestionCriteria;
}

export interface JevProject {
  version: 1;
  name: string;
  model: string;
  /** string | object | array — docs/jev/concepts/state.md */
  state: string | EntryValue;
  /** Ordered in the UI; serialized into the API's question map. */
  questions: QuestionDef[];
}

export const DEFAULT_MODEL = "jev-latest";

/** Discriminated views of QuestionDef for per-type logic. */
export type ChoiceQuestion = QuestionDef & { type: "choice"; criteria: { kind: "choice"; options: ChoiceOption[] } };
export type ScoreQuestion = QuestionDef & { type: "score"; criteria: { kind: "score"; levels: EntryValue[] } };
export type NoulQuestion = QuestionDef & { type: "noul"; criteria: { kind: "noul"; trueDesc?: EntryValue; falseDesc?: EntryValue } };
export type TypedQuestion = ChoiceQuestion | ScoreQuestion | NoulQuestion;
