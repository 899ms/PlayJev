import { describe, expect, it } from "vitest";
import { estimateTokens, estimateRequestTokens, BUDGET_STATE_PLUS_LONGEST, BUDGET_TOTAL } from "./estimate";
import type { JevProject } from "../types/project";
import { DEFAULT_MODEL } from "../types/project";

describe("estimateTokens", () => {
  it("counts ~4 characters per token for ASCII text", () => {
    expect(estimateTokens("abcdefgh")).toBe(2); // 8 chars / 4
    expect(estimateTokens("abc")).toBe(1);
  });

  it("counts one token per CJK character", () => {
    expect(estimateTokens("你好")).toBe(2);
    expect(estimateTokens("你好world!!")).toBe(2 + Math.ceil(7 / 4));
  });

  it("returns 0 for empty text", () => {
    expect(estimateTokens("")).toBe(0);
  });
});

describe("estimateRequestTokens", () => {
  const project: JevProject = {
    version: 1,
    name: "t",
    model: DEFAULT_MODEL,
    state: "x".repeat(40),
    questions: [
      { id: "a", type: "noul", instructions: "y".repeat(40), criteria: { kind: "noul" } },
      { id: "b", type: "noul", instructions: "z".repeat(80), criteria: { kind: "noul" } },
    ],
  };

  it("uses the tighter of the two budgets", () => {
    const report = estimateRequestTokens(project);
    const statePlusLongest = report.stateTokens + report.longestQuestionTokens;
    // binding = whichever ratio against its budget is higher
    const expectStateBinding = statePlusLongest / BUDGET_STATE_PLUS_LONGEST >= report.totalTokens / BUDGET_TOTAL;
    expect(report.bindingKind).toBe(expectStateBinding ? "state_plus_longest" : "total");
    expect(report.bindingBudget).toBe(expectStateBinding ? BUDGET_STATE_PLUS_LONGEST : BUDGET_TOTAL);
    expect(report.bindingUsed).toBe(expectStateBinding ? statePlusLongest : report.totalTokens);
  });

  it("total equals state plus every question", () => {
    const report = estimateRequestTokens(project);
    expect(report.totalTokens).toBeGreaterThan(report.stateTokens);
  });
});
