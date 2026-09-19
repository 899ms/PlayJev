import { describe, expect, it } from "vitest";
import {
  addStateChild,
  convertStateAt,
  convertStateRoot,
  getStateAt,
  moveStateAcross,
  moveStateAt,
  removeStateAt,
  renameStateKey,
  setStateAt,
} from "./ops";
import { formatSegPath } from "./parse";

const state = {
  ticket: { messages: [{ from: "customer", text: "I was charged twice." }] },
  order: { charges: [{ amount_usd: 49 }, { amount_usd: 49 }] },
  refund_policy: "Duplicate charges are eligible for a refund.",
};

describe("setStateAt / getStateAt", () => {
  it("replaces a deep leaf immutably", () => {
    const next = setStateAt(state, ["ticket", "messages", 0, "text"], "Refund please.");
    expect(getStateAt(next, ["ticket", "messages", 0, "text"])).toBe("Refund please.");
    expect(getStateAt(state, ["ticket", "messages", 0, "text"])).toBe("I was charged twice.");
  });

  it("replaces the root when segments are empty", () => {
    expect(setStateAt(state, [], "plain")).toBe("plain");
  });

  it("no-ops on invalid paths", () => {
    expect(setStateAt(state, ["nope", "x"], 1)).toBe(state);
    expect(setStateAt(state, ["order", "charges", 9], 1)).toBe(state);
    expect(setStateAt("flat" as unknown as typeof state, ["x"], 1)).toBe("flat");
  });
});

describe("renameStateKey", () => {
  it("renames preserving key order", () => {
    const next = renameStateKey(state, ["order"], "purchase") as typeof state;
    expect(Object.keys(next)).toEqual(["ticket", "purchase", "refund_policy"]);
    expect(getStateAt(next, ["purchase", "charges", 0, "amount_usd"])).toBe(49);
  });

  it("blocks empty and duplicate names", () => {
    expect(renameStateKey(state, ["order"], "")).toBe(state);
    expect(renameStateKey(state, ["order"], "ticket")).toBe(state);
    expect(renameStateKey(state, [], "x")).toBe(state); // root has no key
  });
});

describe("addStateChild", () => {
  it("auto-generates a unique object key", () => {
    let next = addStateChild(state, [], undefined) as typeof state;
    expect(Object.keys(next).at(-1)).toBe("field_1");
    next = addStateChild(next, [], undefined) as typeof state;
    expect(Object.keys(next).at(-1)).toBe("field_2");
  });

  it("uses the provided key but blocks duplicates", () => {
    const next = addStateChild(state, [], "priority") as unknown as Record<string, unknown>;
    expect(next.priority).toBe("");
    expect(addStateChild(state, [], "ticket")).toBe(state);
  });

  it("appends array items", () => {
    const next = addStateChild(state, ["order", "charges"]) as typeof state;
    expect((next.order.charges as unknown[]).length).toBe(3);
  });

  it("no-ops on primitive parents", () => {
    expect(addStateChild(state, ["refund_policy"], "x")).toBe(state);
  });
});

describe("removeStateAt / moveStateAt", () => {
  it("removes array items and object keys", () => {
    const next = removeStateAt(state, ["order", "charges", 1]) as typeof state;
    expect(next.order.charges.length).toBe(1);
    const next2 = removeStateAt(next, ["refund_policy"]) as typeof state;
    expect("refund_policy" in next2).toBe(false);
  });

  it("cannot remove the root", () => {
    expect(removeStateAt(state, [])).toBe(state);
  });

  it("moves array items and object entries", () => {
    const moved = moveStateAt(state, ["order", "charges", 1], -1) as typeof state;
    expect(moved.order.charges[0].amount_usd).toBe(49);
    const reordered = moveStateAt(state, ["order"], -1) as typeof state;
    expect(Object.keys(reordered)).toEqual(["order", "ticket", "refund_policy"]);
  });
});

describe("moveStateAcross", () => {
  it("moves a leaf into another object with a unique key", () => {
    const { state: next, segs } = moveStateAcross(state, ["refund_policy"], ["ticket"]);
    const typed = next as typeof state;
    expect("refund_policy" in typed).toBe(false);
    expect(getStateAt(next, ["ticket", "refund_policy"])).toBe(state.refund_policy);
    expect(segs).toEqual(["ticket", "refund_policy"]);
    expect(getStateAt(state, ["refund_policy"])).toBe(state.refund_policy); // immutable
  });

  it("keeps the key when moving within the same parent", () => {
    const { state: next, segs } = moveStateAcross(
      state,
      ["ticket", "messages", 0, "text"],
      ["ticket", "messages", 0],
      0
    );
    const msg = getStateAt(next, ["ticket", "messages", 0]) as Record<string, unknown>;
    expect(Object.keys(msg)).toEqual(["text", "from"]);
    expect(segs).toEqual(["ticket", "messages", 0, "text"]);
  });

  it("suffixes the key on cross-parent collision", () => {
    // "order" moved into ticket.messages[0] as { order: <text> } would collide
    // with nothing; instead move "ticket" (object) into the message which
    // already has "text" — use a leaf that collides: move refund_policy text
    // into a target that already has that key name.
    const base = { a: { x: 1 }, b: { x: 2 } };
    const { state: next, segs } = moveStateAcross(base, ["a", "x"], ["b"]);
    expect(getStateAt(next, ["b", "x_2"])).toBe(1);
    expect(getStateAt(next, ["a"])).toEqual({});
    expect(segs).toEqual(["b", "x_2"]);
  });

  it("inserts into arrays at the given index", () => {
    const { state: next, segs } = moveStateAcross(state, ["refund_policy"], ["order", "charges"], 0);
    const typed = next as typeof state;
    expect(typed.order.charges[0]).toBe(state.refund_policy);
    expect(typed.order.charges.length).toBe(3);
    expect(segs).toEqual(["order", "charges", 0]);
  });

  it("no-ops into its own subtree, onto primitives, or for the root", () => {
    expect(moveStateAcross(state, ["ticket"], ["ticket", "messages"]).state).toBe(state);
    expect(moveStateAcross(state, ["ticket"], ["refund_policy"]).state).toBe(state);
    expect(moveStateAcross(state, [], ["order"]).state).toBe(state);
    expect(moveStateAcross(state, ["nope"], ["order"]).state).toBe(state);
  });
});

describe("convertStateAt / convertStateRoot", () => {
  it("converts leaf kinds with sensible fallbacks", () => {
    expect(getStateAt(convertStateAt(state, ["order"], "string"), ["order"])).toBe(
      JSON.stringify(state.order)
    );
    const withStr = convertStateAt(state, ["order", "charges", 0, "amount_usd"], "string");
    expect(getStateAt(withStr, ["order", "charges", 0, "amount_usd"])).toBe("49");
    // sibling leaves are untouched
    expect(getStateAt(withStr, ["order", "charges", 1])).toEqual({ amount_usd: 49 });
  });

  it("leaf → container starts empty", () => {
    const next = convertStateAt(state, ["refund_policy"], "object") as typeof state;
    expect(next.refund_policy).toEqual({});
  });

  it("converts the root between the three API shapes", () => {
    expect(convertStateRoot(state, "string")).toBe(JSON.stringify(state, null, 2));
    expect(convertStateRoot("hello", "array")).toEqual(["hello"]);
    expect(convertStateRoot('{"text":"hi"}', "object")).toEqual({ text: "hi" });
    expect(convertStateRoot([1, 2], "array")).toEqual([1, 2]);
    expect(convertStateRoot({ a: 1 }, "array")).toEqual([]);
  });

  it("formats segment paths doc-style", () => {
    expect(formatSegPath(["ticket", "messages", 0, "text"])).toBe("ticket.messages[0].text");
    expect(formatSegPath([0, "b"])).toBe("[0].b");
  });
});
