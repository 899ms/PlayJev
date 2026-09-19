import type { EntryValue } from "../types/project";
import type { PathSeg } from "./ops";

/**
 * Read-only state tree view + path utilities for browsing and copying.
 * Path format follows docs/jev/primitives.md: `ticket.messages[0].text`.
 */

export type TreeNodeKind = "string" | "number" | "boolean" | "object" | "array" | "null";

export interface TreeNode {
  /** Display key: object key, array index as string, or "root". */
  key: string;
  /** Segments for edit operations (object keys and array indices). */
  segments: PathSeg[];
  /** Path usable inside backticks in instructions. */
  path: string;
  kind: TreeNodeKind;
  /** Short single-line preview of leaf values (truncated — never use for editing). */
  preview: string;
  /** The actual leaf value; undefined for containers. */
  value?: string | number | boolean | null;
  children: TreeNode[];
}

export function formatSegPath(segs: PathSeg[]): string {
  let path = "";
  for (const seg of segs) {
    if (typeof seg === "number") path += `[${seg}]`;
    else path += path ? `.${seg}` : seg;
  }
  return path;
}

export function buildTree(state: string | EntryValue): TreeNode[] {
  if (typeof state === "string" || state == null) return [];
  return buildLevel(state, "root", [], "");
}

function buildLevel(value: unknown, key: string, segs: PathSeg[], path: string): TreeNode[] {
  if (value === null || typeof value !== "object") {
    return [
      {
        key,
        segments: segs,
        path,
        kind: leafKind(value),
        preview: previewOf(value),
        value: value as string | number | boolean | null,
        children: [],
      },
    ];
  }
  if (Array.isArray(value)) {
    const children = value.flatMap((item, i) =>
      buildLevel(item, String(i), [...segs, i], path ? `${path}[${i}]` : `[${i}]`)
    );
    return [{ key: key || "root", segments: segs, path, kind: "array", preview: `${value.length}`, children }];
  }
  const entries = Object.entries(value as Record<string, unknown>);
  const children = entries.flatMap(([k, v]) => buildLevel(v, k, [...segs, k], path ? `${path}.${k}` : k));
  return [{ key: key || "root", segments: segs, path, kind: "object", preview: `${entries.length}`, children }];
}

function leafKind(value: unknown): TreeNodeKind {
  if (value === null) return "null";
  if (typeof value === "string") return "string";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  return "null";
}

function previewOf(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") {
    const t = value.replace(/\s+/g, " ").trim();
    return t.length > 60 ? `${t.slice(0, 60)}…` : t;
  }
  return String(value);
}

/** All referenceable paths (branches included — questions may name an object). */
export function collectPaths(state: string | EntryValue): string[] {
  const paths: string[] = [];
  const walk = (nodes: TreeNode[]) => {
    for (const node of nodes) {
      if (node.path) paths.push(node.path);
      walk(node.children);
    }
  };
  walk(buildTree(state));
  return paths;
}

/** Wrap a copied path in the backticks the docs require in instructions. */
export function formatBacktickPath(path: string): string {
  return `\`${path}\``;
}
