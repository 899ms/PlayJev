import type { JevRequest, JevResponse } from "../types/api";
import { estimateTokens } from "../tokens/estimate";

/**
 * Demo-mode responses shaped after the docs examples (quickstart.md),
 * computed from the actual request so every question gets an answer.
 */
export function mockEvaluate(request: JevRequest): JevResponse {
  const answers: JevResponse["answers"] = {};
  const ids = Object.keys(request.questions);
  ids.forEach((id, i) => {
    const q = request.questions[id]!;
    if (q.type === "choice") {
      const keys = Object.keys(q.criteria);
      const winner = keys[i % Math.max(keys.length, 1)] ?? "option_1";
      answers[id] = mockChoice(keys, winner);
    } else if (q.type === "score") {
      const top = Math.max(q.criteria.length - 1, 0);
      const peak = Math.min(1 + (i % 2), top);
      answers[id] = mockScore(q.criteria, peak);
    } else {
      answers[id] = { type: "noul", noul: [0.92, 0.999, 0.53][i % 3]! };
    }
  });

  return {
    model: request.model,
    answers,
    usage: {
      input_tokens: 312 + estimateTokens(JSON.stringify(request)),
      output_tokens: 24 + ids.length * 12,
    },
  };
}

function mockChoice(keys: string[], winner: string) {
  const probabilities: Record<string, number> = {};
  const rest = keys.filter((k) => k !== winner);
  const winnerProb = 0.84;
  const restProb = rest.length > 0 ? (1 - winnerProb) / rest.length : 0;
  probabilities[winner] = winnerProb;
  for (const k of rest) probabilities[k] = Number(restProb.toFixed(3));
  return { type: "choice" as const, choice: winner, probabilities, confidence: 0.596 };
}

function mockScore(levels: readonly unknown[], peak: number) {
  const probabilities: Record<string, number> = {};
  for (let i = 0; i < levels.length; i++) {
    probabilities[String(i)] = i === peak ? 0.7 : Number((0.3 / Math.max(levels.length - 1, 1)).toFixed(3));
  }
  let score = 0;
  for (const [k, p] of Object.entries(probabilities)) score += Number(k) * p;
  return {
    type: "score" as const,
    score: Number(score.toFixed(3)),
    // echo the request's own level descriptions so the demo reads naturally in any language
    legend: Object.fromEntries(levels.map((l, i) => [String(i), typeof l === "string" ? l : JSON.stringify(l) ?? ""])),
    probabilities,
    confidence: 0.842,
  };
}
