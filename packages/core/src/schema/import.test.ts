import { describe, expect, it } from "vitest";
import { importProject } from "./import";

const RAW_BODY = {
  state: "Help! My payouts have been failing for 3 days.",
  model: "jev-latest",
  questions: {
    is_urgent: { type: "noul", instructions: "Does this convey urgency?" },
    department: {
      type: "choice",
      instructions: "Which team should handle this?",
      criteria: { billing: "Payments", tone: null },
    },
    frustration: { type: "score", instructions: "How frustrated?", criteria: ["Calm", "Frustrated"] },
  },
};

const PROJECT_FILE = {
  version: 1,
  name: "my-project",
  model: "jev-latest",
  state: "hello",
  questions: [
    {
      id: "q1",
      type: "noul",
      instructions: "Is this urgent?",
      criteria: { kind: "noul", trueDesc: "yes side", falseDesc: "no side" },
    },
  ],
};

describe("importProject", () => {
  it("accepts an PlayJev project file", () => {
    const result = importProject(PROJECT_FILE);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.project.name).toBe("my-project");
      expect(result.project.questions).toHaveLength(1);
      expect(result.project.questions[0]!.criteria).toEqual({
        kind: "noul",
        trueDesc: "yes side",
        falseDesc: "no side",
      });
    }
  });

  it("accepts a raw API request body and converts the question map to a list", () => {
    const result = importProject(RAW_BODY);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.project.questions.map((q) => q.id)).toEqual(["is_urgent", "department", "frustration"]);
    const choice = result.project.questions.find((q) => q.id === "department")!;
    expect(choice.criteria).toEqual({
      kind: "choice",
      options: [
        { key: "billing", description: "Payments" },
        { key: "tone", description: null },
      ],
    });
  });

  it("defaults model and name for raw bodies without them", () => {
    const result = importProject({ state: "x", questions: {} });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.project.model).toBe("jev-latest");
      expect(result.project.name).toBe("imported");
    }
  });

  it("rejects garbage with a readable error", () => {
    const result = importProject({ foo: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(typeof result.error).toBe("string");
  });

  it("rejects a score body with fewer than 2 levels", () => {
    const result = importProject({
      state: "x",
      model: "jev-latest",
      questions: { s: { type: "score", instructions: "?", criteria: ["only"] } },
    });
    expect(result.ok).toBe(false);
  });
});
