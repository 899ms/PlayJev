import { describe, expect, it } from "vitest";
import { buildDraftMessages } from "./prompts";
import { MAX_DRAFT_QUESTIONS } from "./generate";

const base = {
  description: "triage support tickets",
  answers: [{ question: "q?", selected: ["a"] }],
  locale: "en" as const,
  includeCurrent: false,
};

describe("draft question budget", () => {
  it("caps generation at MAX_DRAFT_QUESTIONS", () => {
    expect(MAX_DRAFT_QUESTIONS).toBe(4);
  });

  it("system prompt states the 4-question cap", () => {
    const [system] = buildDraftMessages(base);
    expect(system.content).toContain("at most 4 questions");
  });

  it("system prompt bans fan-out duplicates", () => {
    const [system] = buildDraftMessages(base);
    expect(system.content).toContain("never emit the same judgment twice");
    expect(system.content).toContain("Do NOT invent speculative checks");
  });
});
