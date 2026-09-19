import { describe, expect, it } from "vitest";
import { lintProject, extractBacktickPaths } from "./rules";
import { TEMPLATES } from "../templates";
import type { JevProject } from "../types/project";
import { DEFAULT_MODEL } from "../types/project";

function baseProject(): JevProject {
  return {
    version: 1,
    name: "t",
    model: DEFAULT_MODEL,
    state: { ticket: { messages: [{ text: "hello" }] } },
    questions: [],
  };
}

function withQuestion(q: JevProject["questions"][number]): JevProject {
  const p = baseProject();
  p.questions = [q];
  return p;
}

describe("lintProject", () => {
  it("errors on missing model and no questions", () => {
    const issues = lintProject({ version: 1, name: "", model: "", state: "", questions: [] });
    const codes = issues.filter((i) => i.level === "error").map((i) => i.code);
    expect(codes).toContain("model_empty");
    expect(codes).toContain("no_questions");
  });

  it("allows empty state (questions-only is valid, matches the official playground)", () => {
    const p = baseProject();
    p.state = "";
    p.questions = [{ id: "n", type: "noul", instructions: "Is this urgent enough?", criteria: { kind: "noul" } }];
    expect(lintProject(p).some((i) => i.code === "state_empty")).toBe(false);
    expect(lintProject(p).every((i) => i.level !== "error")).toBe(true);
  });

  it("errors on duplicate question ids", () => {
    const p = baseProject();
    p.questions = [
      { id: "x", type: "noul", instructions: "Is this urgent enough?", criteria: { kind: "noul" } },
      { id: "x", type: "noul", instructions: "Is this a bug report?", criteria: { kind: "noul" } },
    ];
    expect(lintProject(p).some((i) => i.code === "id_duplicate")).toBe(true);
  });

  it("errors on score with fewer than 2 levels", () => {
    const issues = lintProject(
      withQuestion({ id: "s", type: "score", instructions: "How severe?", criteria: { kind: "score", levels: ["only"] } })
    );
    expect(issues.some((i) => i.code === "score_too_few")).toBe(true);
  });

  it("errors on score with more than 10 levels", () => {
    const issues = lintProject(
      withQuestion({
        id: "s",
        type: "score",
        instructions: "How severe?",
        criteria: { kind: "score", levels: Array.from({ length: 11 }, (_, i) => `level ${i}`) },
      })
    );
    expect(issues.some((i) => i.code === "score_too_many")).toBe(true);
  });

  it("warns on a pure-numeric score level (model never sees numbers)", () => {
    const issues = lintProject(
      withQuestion({ id: "s", type: "score", instructions: "How severe?", criteria: { kind: "score", levels: ["0", "1", "2"] } })
    );
    expect(issues.filter((i) => i.code === "score_level_numeric")).toHaveLength(3);
  });

  it("errors on empty choice options", () => {
    const issues = lintProject(
      withQuestion({ id: "c", type: "choice", instructions: "Which team?", criteria: { kind: "choice", options: [] } })
    );
    expect(issues.some((i) => i.code === "choice_empty")).toBe(true);
  });

  it("errors on duplicate choice keys", () => {
    const issues = lintProject(
      withQuestion({
        id: "c",
        type: "choice",
        instructions: "Which team?",
        criteria: {
          kind: "choice",
          options: [
            { key: "a", description: "" },
            { key: "a", description: "" },
          ],
        },
      })
    );
    expect(issues.some((i) => i.code === "choice_key_duplicate")).toBe(true);
  });

  it("hints at adding an `other` escape hatch for 3+ options", () => {
    const issues = lintProject(
      withQuestion({
        id: "c",
        type: "choice",
        instructions: "Which team?",
        criteria: {
          kind: "choice",
          options: [
            { key: "a", description: "" },
            { key: "b", description: "" },
            { key: "c", description: "" },
          ],
        },
      })
    );
    expect(issues.some((i) => i.code === "choice_no_other")).toBe(true);
  });

  it("warns when a backtick path does not exist in the state", () => {
    const issues = lintProject(
      withQuestion({
        id: "n",
        type: "noul",
        instructions: "Does `ticket.messages[0].text` request a refund? Does `order.charges` exist?",
        criteria: { kind: "noul" },
      })
    );
    const missing = issues.filter((i) => i.code === "path_not_found");
    expect(missing).toHaveLength(1);
    expect(missing[0]!.params?.path).toBe("order.charges");
  });

  it("does not flag local refs like `extracted_value` in structured instructions", () => {
    const issues = lintProject(
      withQuestion({
        id: "n",
        type: "noul",
        instructions: "Does `extracted_value` match the `field` in the text?",
        criteria: { kind: "noul" },
      })
    );
    expect(issues.some((i) => i.code === "path_not_found")).toBe(false);
  });

  it("reports the JSON parse error passed through the context", () => {
    const issues = lintProject(baseProject(), { stateJsonError: "Unexpected token }" });
    expect(issues.some((i) => i.code === "state_json_invalid")).toBe(true);
  });

  it("hints about CJK accuracy", () => {
    const p = baseProject();
    p.state = "这张发票的金额是多少?";
    p.questions = [{ id: "n", type: "noul", instructions: "Does the invoice mention a total?", criteria: { kind: "noul" } }];
    expect(lintProject(p).some((i) => i.code === "cjk_state")).toBe(true);
  });

  it("errors on whitespace-only state field names", () => {
    const p = baseProject();
    p.state = { " ": 1, ok: 2 };
    p.questions = [{ id: "n", type: "noul", instructions: "Is this urgent enough?", criteria: { kind: "noul" } }];
    expect(lintProject(p).some((i) => i.code === "state_empty_key")).toBe(true);
  });

  it("flags duplicate keys in the raw JSON source (JSON.parse would drop them silently)", () => {
    const p = baseProject();
    const dupJson = '{"a": 1, "a": 2}';
    p.state = { a: 2 }; // what JSON.parse keeps
    p.questions = [{ id: "n", type: "noul", instructions: "Is this urgent enough?", criteria: { kind: "noul" } }];
    const issues = lintProject(p, { stateJsonText: dupJson });
    expect(issues.some((i) => i.code === "state_duplicate_key" && i.params?.key === "a")).toBe(true);
  });

  it("is clean for the ticket-triage template", () => {
    const issues = lintProject(TEMPLATES[0]!.build("en"));
    expect(issues.filter((i) => i.level === "error")).toHaveLength(0);
  });
});

describe("extractBacktickPaths", () => {
  it("finds all backticked refs", () => {
    expect(extractBacktickPaths("Compare `a.b[0]` with `c` now")).toEqual(["a.b[0]", "c"]);
  });
});
