import { describe, expect, it } from "vitest";
import type { JevProject } from "../types/project";
import { serializeRequest } from "./serialize";
import { importProject } from "./import";
import { TEMPLATES } from "../templates";

const triage: JevProject = {
  version: 1,
  name: "triage",
  model: "jev-latest",
  state: "Help! My payouts have been failing for 3 days.",
  questions: [
    {
      id: "department",
      type: "choice",
      instructions: "Which team should handle this?",
      criteria: {
        kind: "choice",
        options: [
          { key: "billing", description: "Payments" },
          { key: "sales", description: null },
        ],
      },
    },
    {
      id: "frustration",
      type: "score",
      instructions: "How frustrated is the customer?",
      criteria: { kind: "score", levels: ["Calm", "Frustrated", "Very angry"] },
    },
    {
      id: "is_urgent",
      type: "noul",
      instructions: "Does this convey urgency?",
      criteria: { kind: "noul", trueDesc: "Explicitly time-sensitive", falseDesc: "No urgency" },
    },
    {
      id: "is_bug",
      type: "noul",
      instructions: "Is this a bug report?",
      criteria: { kind: "noul" },
    },
  ],
};

describe("serializeRequest", () => {
  it("converts the ordered question list into the API map, preserving order", () => {
    const req = serializeRequest(triage);
    expect(Object.keys(req.questions)).toEqual(["department", "frustration", "is_urgent", "is_bug"]);
    expect(req.model).toBe("jev-latest");
    expect(req.state).toBe(triage.state);
  });

  it("serializes choice criteria as a map with null for empty descriptions", () => {
    const req = serializeRequest(triage);
    const choice = req.questions["department"]!;
    if (choice.type !== "choice") throw new Error("wrong type");
    expect(choice.criteria).toEqual({ billing: "Payments", sales: null });
  });

  it("serializes score criteria as an ordered array", () => {
    const req = serializeRequest(triage);
    const score = req.questions["frustration"]!;
    if (score.type !== "score") throw new Error("wrong type");
    expect(score.criteria).toEqual(["Calm", "Frustrated", "Very angry"]);
  });

  it("omits noul criteria when neither side is described", () => {
    const req = serializeRequest(triage);
    const withCriteria = req.questions["is_urgent"]!;
    const without = req.questions["is_bug"]!;
    if (withCriteria.type !== "noul" || without.type !== "noul") throw new Error("wrong type");
    expect(withCriteria.criteria).toEqual({ true: "Explicitly time-sensitive", false: "No urgency" });
    expect("criteria" in without).toBe(false);
  });

  it("round-trips every seed template through import -> serialize", () => {
    for (const t of TEMPLATES) {
      const p = t.build("en");
      const imported = importProject(serializeRequest(p));
      expect(imported.ok).toBe(true);
      if (!imported.ok) continue;
      const again = serializeRequest(imported.project);
      expect(JSON.parse(JSON.stringify(again))).toEqual(JSON.parse(JSON.stringify(serializeRequest(p))));
    }
  });
});
