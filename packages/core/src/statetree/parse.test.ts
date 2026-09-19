import { describe, expect, it } from "vitest";
import { buildTree, collectPaths, formatBacktickPath } from "./parse";

const state = {
  ticket: {
    subject: "Duplicate charge",
    messages: [{ from: "customer", text: "I was charged twice." }],
  },
  order: { id: "A-104", charges: [{ amount_usd: 49 }, { amount_usd: 49 }] },
  refund_policy: "Duplicate charges are eligible for a refund.",
};

describe("buildTree / collectPaths", () => {
  it("builds doc-style dot and index paths", () => {
    const paths = collectPaths(state);
    expect(paths).toContain("ticket");
    expect(paths).toContain("ticket.subject");
    expect(paths).toContain("ticket.messages[0]");
    expect(paths).toContain("ticket.messages[0].text");
    expect(paths).toContain("order.charges[1].amount_usd");
    expect(paths).toContain("refund_policy");
  });

  it("classifies node kinds", () => {
    const tree = buildTree(state);
    const root = tree[0]!;
    expect(root.kind).toBe("object");
    const ticket = root.children.find((n) => n.key === "ticket")!;
    const messages = ticket.children.find((n) => n.key === "messages")!;
    expect(messages.kind).toBe("array");
    expect(messages.children[0]!.children.find((n) => n.key === "text")!.kind).toBe("string");
  });

  it("returns an empty list for a plain-string state", () => {
    expect(collectPaths("just text")).toEqual([]);
  });

  it("handles root arrays with bracket paths", () => {
    const paths = collectPaths(["a", { b: 1 }]);
    expect(paths).toContain("[0]");
    expect(paths).toContain("[1].b");
  });

  it("formats backtick paths", () => {
    expect(formatBacktickPath("ticket.messages[0].text")).toBe("`ticket.messages[0].text`");
  });
});
