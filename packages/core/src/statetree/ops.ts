import type { EntryValue } from "../types/project";

/**
 * Immutable edit operations on the state value (string | object | array — docs/jev/api.md).
 * Every operation returns a new value and no-ops (returns the input unchanged) when the
 * operation is not applicable, so the editor can never produce a state that violates the
 * API schema: no empty object keys, no duplicate sibling keys, primitives stay primitives.
 */

export type PathSeg = string | number;
export type StateValue = string | EntryValue;
export type NodeKind = "string" | "number" | "boolean" | "null" | "object" | "array";

/** Root-level kinds allowed by the API (docs/jev/concepts/state.md). */
export type RootKind = "string" | "object" | "array";

function isPlainObject(v: unknown): v is Record<string, EntryValue> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

export function getStateAt(state: StateValue, segs: PathSeg[]): unknown {
  let cur: unknown = state;
  for (const seg of segs) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = Array.isArray(cur) ? cur[seg as number] : (cur as Record<string, unknown>)[seg as string];
  }
  return cur;
}

/** Replace the node at `segs` (empty segs replaces the root). No-op when the path does not exist. */
export function setStateAt(state: StateValue, segs: PathSeg[], value: unknown): StateValue {
  if (segs.length === 0) return value as StateValue;
  if (getStateAt(state, segs) === undefined) return state; // validate before cloning anything
  const [head, ...rest] = segs;
  if (Array.isArray(state)) {
    const idx = head as number;
    if (!Number.isInteger(idx) || idx < 0 || idx >= state.length) return state;
    const copy = state.slice();
    copy[idx] = setStateAt(copy[idx] as EntryValue, rest, value);
    return copy;
  }
  if (isPlainObject(state)) {
    const key = head as string;
    if (!(key in state)) return state;
    const copy: Record<string, EntryValue> = { ...state };
    copy[key] = setStateAt(state[key], rest, value);
    return copy;
  }
  return state;
}

/** Rename an object entry in place, preserving key order. Blocked on empty or duplicate names. */
export function renameStateKey(state: StateValue, segs: PathSeg[], newKey: string): StateValue {
  if (segs.length === 0 || newKey.trim() === "" || newKey.includes(".")) return state;
  const parentSegs = segs.slice(0, -1);
  const oldKey = segs[segs.length - 1] as string;
  const parent = getStateAt(state, parentSegs);
  if (!isPlainObject(parent)) return state;
  if (!(oldKey in parent) || (newKey in parent && newKey !== oldKey)) return state;
  const rebuilt: Record<string, EntryValue> = {};
  for (const [k, v] of Object.entries(parent)) rebuilt[k === oldKey ? newKey : k] = v;
  return setStateAt(state, parentSegs, rebuilt);
}

/** Append a child (object: auto unique key; array: at the end). Returns the new state. */
export function addStateChild(state: StateValue, parentSegs: PathSeg[], key?: string): StateValue {
  const parent = getStateAt(state, parentSegs);
  if (isPlainObject(parent)) {
    let name = key && key.trim() !== "" ? key : "";
    if (name === "") {
      let n = parent["field"] === undefined ? 1 : 2;
      name = `field_${n}`;
      while (name in parent) name = `field_${++n}`;
    }
    if (name in parent) return state; // explicit duplicate key → no-op
    const next: Record<string, EntryValue> = { ...parent, [name]: "" };
    return setStateAt(state, parentSegs, next);
  }
  if (Array.isArray(parent)) {
    return setStateAt(state, parentSegs, [...parent, ""]);
  }
  return state;
}

export function removeStateAt(state: StateValue, segs: PathSeg[]): StateValue {
  if (segs.length === 0) return state; // root is not removable
  const parentSegs = segs.slice(0, -1);
  const last = segs[segs.length - 1]!;
  const parent = getStateAt(state, parentSegs);
  if (Array.isArray(parent)) {
    if (!Number.isInteger(last as number) || (last as number) < 0 || (last as number) >= parent.length) return state;
    return setStateAt(state, parentSegs, parent.filter((_, i) => i !== last));
  }
  if (isPlainObject(parent)) {
    if (!((last as string) in parent)) return state;
    const copy: Record<string, EntryValue> = { ...parent };
    delete copy[last as string];
    return setStateAt(state, parentSegs, copy);
  }
  return state;
}

/** Detach the node at `from` (returns [stateWithoutNode, detachedValue]). */
function detachStateAt(state: StateValue, segs: PathSeg[]): [StateValue, unknown] {
  if (segs.length === 0) return [state, state];
  const value = getStateAt(state, segs);
  if (value === undefined) return [state, undefined];
  return [removeStateAt(state, segs), value];
}

/**
 * Move a node across hierarchy levels: detach from `from`, then insert into the
 * container at `toParentSegs` at position `toIndex` (clamped to the end).
 * Object targets get an auto-unique key derived from the moved entry (leaf arrays
 * append as values). No-op when paths are invalid or the target sits inside the
 * moved subtree. Returns { state, segs } with the node's new path (for UI focus).
 */
export function moveStateAcross(
  state: StateValue,
  from: PathSeg[],
  toParentSegs: PathSeg[],
  toIndex?: number
): { state: StateValue; segs: PathSeg[] } {
  if (from.length === 0) return { state, segs: from };
  // Target inside (or equal to) the moved subtree → would orphan content.
  if (toParentSegs.length >= from.length && toParentSegs.slice(0, from.length).every((s, i) => s === from[i])) {
    return { state, segs: from };
  }
  const [detached, value] = detachStateAt(state, from);
  if (value === undefined) return { state, segs: from };
  const target = getStateAt(detached, toParentSegs);
  if (Array.isArray(target)) {
    const idx = toIndex === undefined ? target.length : Math.max(0, Math.min(toIndex, target.length));
    const next = target.slice();
    next.splice(idx, 0, value as EntryValue);
    const newState = setStateAt(detached, toParentSegs, next);
    return { state: newState === detached ? state : newState, segs: [...toParentSegs, idx] };
  }
  if (isPlainObject(target)) {
    const fromKey = typeof from[from.length - 1] === "string" ? (from[from.length - 1] as string) : "field";
    let name = fromKey;
    if (name in target) {
      let n = 2;
      name = `${fromKey}_${n}`;
      while (name in target) name = `${fromKey}_${++n}`;
    }
    const entries = Object.entries(target);
    const idx = toIndex === undefined ? entries.length : Math.max(0, Math.min(toIndex, entries.length));
    entries.splice(idx, 0, [name, value as EntryValue]);
    const newState = setStateAt(detached, toParentSegs, Object.fromEntries(entries));
    return { state: newState === detached ? state : newState, segs: [...toParentSegs, name] };
  }
  return { state, segs: from };
}

/** Swap a node with its previous/next sibling within the same parent. */
export function moveStateAt(state: StateValue, segs: PathSeg[], dir: -1 | 1): StateValue {
  if (segs.length === 0) return state;
  const parentSegs = segs.slice(0, -1);
  const last = segs[segs.length - 1]!;
  const parent = getStateAt(state, parentSegs);
  if (Array.isArray(parent)) {
    const idx = last as number;
    const target = idx + dir;
    if (!Number.isInteger(idx) || target < 0 || target >= parent.length) return state;
    const copy = parent.slice();
    [copy[idx], copy[target]] = [copy[target]!, copy[idx]!];
    return setStateAt(state, parentSegs, copy);
  }
  if (isPlainObject(parent)) {
    const key = last as string;
    const entries = Object.entries(parent);
    const idx = entries.findIndex(([k]) => k === key);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= entries.length) return state;
    [entries[idx], entries[target]] = [entries[target]!, entries[idx]!];
    return setStateAt(state, parentSegs, Object.fromEntries(entries));
  }
  return state;
}

/**
 * Change a node's kind. Leaf → container starts empty; container → string is
 * JSON-serialized; string → number parses or falls back to 0.
 */
export function convertStateAt(state: StateValue, segs: PathSeg[], kind: NodeKind): StateValue {
  const cur = getStateAt(state, segs);
  let next: unknown;
  switch (kind) {
    case "string":
      next = cur == null ? "" : typeof cur === "string" ? cur : JSON.stringify(cur);
      break;
    case "number":
      next =
        typeof cur === "number"
          ? cur
          : typeof cur === "string" && cur.trim() !== "" && Number.isFinite(Number(cur))
            ? Number(cur)
            : 0;
      break;
    case "boolean":
      next = typeof cur === "boolean" ? cur : Boolean(cur);
      break;
    case "null":
      next = null;
      break;
    case "object":
      next = {};
      break;
    case "array":
      next = [];
      break;
  }
  return setStateAt(state, segs, next);
}

/** Convert the state root between the three API-allowed shapes, preserving text where sensible. */
export function convertStateRoot(state: StateValue, kind: RootKind): StateValue {
  if (kind === "string") {
    return typeof state === "string" ? state : JSON.stringify(state, null, 2);
  }
  if (typeof state === "string") {
    try {
      const parsed = JSON.parse(state) as unknown;
      if (kind === "object" && isPlainObject(parsed)) return parsed;
      if (kind === "array" && Array.isArray(parsed)) return parsed;
    } catch {
      /* not JSON — wrap below */
    }
    return kind === "array" ? [state] : { text: state };
  }
  if (Array.isArray(state)) {
    return kind === "array" ? state : {};
  }
  return kind === "object" ? state : [];
}
