import type { ChoiceOption, EntryValue, JevProject, QuestionDef } from "../types/project";
import type { JevRequest, QuestionPayload } from "../types/api";

/**
 * Convert the ordered question list into the API's question map.
 * JSON.stringify preserves string-key insertion order, so the UI's
 * question order is what the API map shows. (docs/jev/api.md)
 */
export function serializeRequest(project: JevProject): JevRequest {
  const questions: Record<string, QuestionPayload> = {};
  for (const q of project.questions) {
    questions[q.id] = serializeQuestion(q);
  }
  return { state: project.state, model: project.model, questions };
}

export function serializeQuestion(q: QuestionDef): QuestionPayload {
  if (q.type === "choice") {
    const options = (q.criteria as { kind: "choice"; options: ChoiceOption[] }).options;
    const criteria: Record<string, EntryValue> = {};
    for (const opt of options) {
      criteria[opt.key] = opt.description ?? null;
    }
    return { type: "choice", instructions: q.instructions, criteria };
  }
  if (q.type === "score") {
    const levels = (q.criteria as { kind: "score"; levels: EntryValue[] }).levels;
    const criteria = levels.map((level) => level ?? null);
    return { type: "score", instructions: q.instructions, criteria };
  }
  // noul: omit criteria entirely when neither side is described (docs/jev/api.md)
  const noul = q.criteria as { trueDesc?: EntryValue; falseDesc?: EntryValue };
  const criteria: { true?: EntryValue; false?: EntryValue } = {};
  if (noul.trueDesc != null) criteria.true = noul.trueDesc;
  if (noul.falseDesc != null) criteria.false = noul.falseDesc;
  return Object.keys(criteria).length > 0
    ? { type: "noul", instructions: q.instructions, criteria }
    : { type: "noul", instructions: q.instructions };
}

/** Compact JSON of one serialized question, used for token estimation. */
export function questionJson(q: QuestionDef): string {
  return JSON.stringify(serializeQuestion(q));
}
