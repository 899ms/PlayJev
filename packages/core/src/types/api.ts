import type { EntryValue } from "./project";

/** Wire shapes for POST /v1/systemone — docs/jev/api.md */

export interface JevRequest {
  state: string | EntryValue;
  model: string;
  questions: Record<string, QuestionPayload>;
}

export type QuestionPayload =
  | { type: "choice"; instructions: EntryValue; criteria: Record<string, EntryValue> }
  | { type: "score"; instructions: EntryValue; criteria: EntryValue[] }
  | { type: "noul"; instructions: EntryValue; criteria?: { true?: EntryValue; false?: EntryValue } };

export interface ChoiceAnswer {
  type: "choice";
  choice: string;
  probabilities: Record<string, number>;
  confidence: number;
}

export interface ScoreAnswer {
  type: "score";
  score: number;
  legend: Record<string, EntryValue>;
  probabilities: Record<string, number>;
  confidence: number;
}

export interface NoulAnswer {
  type: "noul";
  noul: number;
}

export type Answer = ChoiceAnswer | ScoreAnswer | NoulAnswer;

export interface JevUsage {
  input_tokens?: number;
  output_tokens?: number;
}

export interface JevResponse {
  model: string;
  answers: Record<string, Answer>;
  usage?: JevUsage;
}
