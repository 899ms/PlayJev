import { describe, expect, it } from "vitest";
import { buildDraftMessages } from "./prompts";

const base = {
  description: "triage support tickets",
  answers: [{ question: "q?", selected: ["a"] }],
  locale: "en" as const,
  includeCurrent: false,
};

describe("draft scope follows the user", () => {
  it("system prompt defers scope to the user description", () => {
    const [system] = buildDraftMessages(base);
    expect(system.content).toContain("emit what they asked for, no more, no less");
    expect(system.content).not.toContain("at most 4 questions");
    expect(system.content).not.toContain("NEVER emit more than");
  });

  it("keeps type guidance without hard bans", () => {
    const [system] = buildDraftMessages(base);
    expect(system.content).toContain("the user's description wins on conflict");
    expect(system.content).not.toContain("never emit the same judgment twice");
  });
});
