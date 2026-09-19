import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useT, projectStore, useProject, useActions } from "@/hooks";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea, Input } from "@/components/ui/field";
import { buildTree, formatBacktickPath, type TreeNode, type NodeKind, type PathSeg, type StateMode } from "@playjev/core";
import { IconBtn } from "@/components/questions/QuestionCard";
import { copyText } from "@/lib/adapters";
import { cn } from "@/lib/utils";

export function StatePane({ className }: { className?: string }) {
  const t = useT();
  const stateMode = useProject((s) => s.view.stateMode);
  const store = projectStore;

  return (
    <section className={cn("flex flex-col", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-3 py-2">
        <h2 className="text-sm font-semibold text-zinc-800">{t("state.title")}</h2>
        <Tabs value={stateMode} onValueChange={(id) => store.getState().switchStateMode(id as StateMode)}>
          <TabsList>
            <TabsTrigger value="text">{t("state.tabText")}</TabsTrigger>
            <TabsTrigger value="tree">{t("state.tabTree")}</TabsTrigger>
            <TabsTrigger value="json">{t("state.tabJson")}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {stateMode === "text" && <PlainTextMode />}
        {stateMode === "json" && <JsonSourceMode />}
        {stateMode === "tree" && <TreeMode />}
      </div>
    </section>
  );
}

function PlainTextMode() {
  const t = useT();
  const stateText = useProject((s) => s.view.stateText);
  const charCount = stateText.length;
  return (
    <div className="flex h-full flex-col gap-2">
      <Textarea
        className="min-h-48 flex-1 font-mono text-[13px]"
        placeholder={t("state.textPlaceholder")}
        value={stateText}
        onChange={(e) => projectStore.getState().setTextState(e.target.value)}
      />
      <p className="text-xs text-zinc-400">
        {t("state.textHint")} · {t("state.chars", { count: charCount })}
      </p>
    </div>
  );
}

function JsonSourceMode() {
  const t = useT();
  const jsonText = useProject((s) => s.view.jsonText);
  const jsonValid = useProject((s) => s.view.jsonValid);
  const jsonError = useProject((s) => s.view.jsonError);
  return (
    <div className="flex h-full flex-col gap-2">
      <Textarea
        className={cn(
          "min-h-48 flex-1 font-mono text-[13px]",
          !jsonValid && "border-red-400 focus:border-red-500 focus:ring-red-400"
        )}
        placeholder={t("state.jsonPlaceholder")}
        value={jsonText}
        spellCheck={false}
        onChange={(e) => projectStore.getState().setJsonText(e.target.value)}
      />
      <p className={cn("text-xs", jsonValid ? "text-zinc-400" : "text-red-600")}>
        {jsonValid ? t("state.jsonHint") : t("state.jsonInvalid", { error: jsonError ?? "" })}
      </p>
    </div>
  );
}

/**
 * Visual state editor (tree mode). Edits go through core statetree/ops which keep the
 * value inside the API schema (docs/jev/concepts/state.md): object keys stay non-empty
 * and unique, only string/object/array roots are offered.
 */
function TreeMode() {
  const t = useT();
  const state = useProject((s) => s.project.state);
  const actions = useActions();

  if (typeof state === "string") {
    if (state.trim() === "") {
      return (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-zinc-400">{t("state.treeEmpty")}</p>
          <div className="flex gap-2">
            <button type="button" className="text-xs font-medium text-indigo-600 hover:text-indigo-500" onClick={() => actions.convertStateRoot("object")}>
              {t("state.toObject")}
            </button>
            <button type="button" className="text-xs font-medium text-indigo-600 hover:text-indigo-500" onClick={() => actions.convertStateRoot("array")}>
              {t("state.toArray")}
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="flex h-full flex-col gap-2">
        <p className="text-xs text-zinc-400">{t("state.treeTextOnly")}</p>
        <Textarea
          className="min-h-40 flex-1 font-mono text-[13px]"
          value={state}
          onChange={(e) => actions.setStateNodeValue([], e.target.value)}
        />
        <div className="flex gap-3">
          <button type="button" className="text-xs font-medium text-indigo-600 hover:text-indigo-500" onClick={() => actions.convertStateRoot("object")}>
            {t("state.toObject")}
          </button>
          <button type="button" className="text-xs font-medium text-indigo-600 hover:text-indigo-500" onClick={() => actions.convertStateRoot("array")}>
            {t("state.toArray")}
          </button>
        </div>
      </div>
    );
  }

  const root = buildTree(state)[0];
  if (!root) return <p className="text-sm text-zinc-400">{t("state.treeEmpty")}</p>;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-zinc-400">{t("state.treeHint")}</p>
      <div className="font-mono text-[13px]">
        {root.children.map((child, i) => (
          <TreeNodeRow key={child.path} node={child} index={i} parentKind={root.kind as "object" | "array"} depth={0} />
        ))}
      </div>
      <div className="flex gap-3 pt-1">
        {root.kind === "object" ? (
          <AddChildButton segs={[]} kind="object" />
        ) : (
          <AddChildButton segs={[]} kind="array" />
        )}
        <button type="button" className="text-xs font-medium text-zinc-500 hover:text-zinc-700" onClick={() => actions.convertStateRoot("string")}>
          {t("state.toText")}
        </button>
      </div>
    </div>
  );
}

const KINDS: NodeKind[] = ["string", "number", "boolean", "null", "object", "array"];

function AddChildButton({ segs, kind }: { segs: PathSeg[]; kind: "object" | "array" }) {
  const t = useT();
  const actions = useActions();
  return (
    <button type="button" className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-500" onClick={() => actions.addStateChildNode(segs)}>
      <Plus size={13} /> {kind === "object" ? t("state.addField") : t("state.addItem")}
    </button>
  );
}

function TreeNodeRow({
  node,
  index,
  parentKind,
  depth,
}: {
  node: TreeNode;
  index: number;
  parentKind: "object" | "array" | "root";
  depth: number;
}) {
  const t = useT();
  const actions = useActions();
  const isContainer = node.kind === "object" || node.kind === "array";
  const childCount = node.children.length;

  return (
    <div>
      <div
        className="group flex flex-wrap items-center gap-1.5 rounded py-0.5 pr-1 hover:bg-zinc-50"
        style={{ paddingLeft: depth * 14 }}
      >
        {parentKind === "object" ? <KeyEditor node={node} /> : <span className="flex h-6 min-w-6 items-center justify-center rounded bg-zinc-100 px-1 text-xs text-zinc-500">{node.key}</span>}

        <TypeSelect node={node} />

        {!isContainer && <ValueEditor node={node} />}

        {isContainer && (
          <span className="text-xs text-indigo-400">
            {node.kind === "array" ? `[${childCount}]` : `{${childCount}}`}
          </span>
        )}

        <div className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          {node.path && (
            <IconBtn
              title={t("state.copyPath")}
              onClick={async () => {
                if (await copyText(formatBacktickPath(node.path))) toast.success(t("toast.pathCopied", { path: node.path }));
              }}
            >
              <Copy size={12} />
            </IconBtn>
          )}
          <IconBtn title={t("question.moveUp")} disabled={index === 0} onClick={() => actions.moveStateNode(node.segments, -1)}>
            <ArrowUp size={12} />
          </IconBtn>
          <IconBtn title={t("question.moveDown")} onClick={() => actions.moveStateNode(node.segments, 1)}>
            <ArrowDown size={12} />
          </IconBtn>
          <IconBtn title={t("question.delete")} destructive onClick={() => actions.removeStateNode(node.segments)}>
            <Trash2 size={12} />
          </IconBtn>
        </div>
      </div>

      {isContainer && (
        <div>
          {node.children.map((child, i) => (
            <TreeNodeRow
              key={child.path}
              node={child}
              index={i}
              parentKind={node.kind === "object" ? "object" : "array"}
              depth={depth + 1}
            />
          ))}
          {node.kind === "object" && node.children.length === 0 && (
            <div style={{ paddingLeft: (depth + 1) * 14 + 4 }} className="py-0.5">
              <AddChildButton segs={node.segments} kind="object" />
            </div>
          )}
          {node.kind === "array" && node.children.length === 0 && (
            <div style={{ paddingLeft: (depth + 1) * 14 + 4 }} className="py-0.5">
              <AddChildButton segs={node.segments} kind="array" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Object-entry key input: commits only valid names (non-empty, no dot, unique among siblings). */
function KeyEditor({ node }: { node: TreeNode }) {
  const t = useT();
  const actions = useActions();
  const [text, setText] = useState(node.key);

  useEffect(() => {
    setText(node.key);
  }, [node.key]);

  const parentSegs = node.segments.slice(0, -1);
  const invalid = text.trim() === "" || text.includes(".");

  return (
    <Input
      className={cn("h-6 w-32 px-1.5 font-mono text-xs", invalid && "border-red-400")}
      title={invalid ? t("state.keyRequired") : undefined}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        if (!invalid) actions.renameStateNodeKey(node.segments, e.target.value);
      }}
      onBlur={() => setText(node.key)}
    />
  );
}

function TypeSelect({ node }: { node: TreeNode }) {
  const t = useT();
  const actions = useActions();
  return (
    <Select
      value={node.kind}
      onValueChange={(v) => actions.convertStateNodeKind(node.segments, v as NodeKind)}
    >
      <SelectTrigger className="h-6 w-20 px-2 text-[11px] text-zinc-500 shadow-none" title={node.kind}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {KINDS.map((k) => (
          <SelectItem key={k} value={k}>
            {t(`state.kind.${k}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ValueEditor({ node }: { node: TreeNode }) {
  const actions = useActions();
  if (node.kind === "null") {
    return <span className="text-xs italic text-zinc-400">null</span>;
  }
  if (node.kind === "boolean") {
    return (
      <Select
        value={String(node.value)}
        onValueChange={(v) => actions.setStateNodeValue(node.segments, v === "true")}
      >
        <SelectTrigger className="h-6 w-16 px-2 text-xs shadow-none">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="true">true</SelectItem>
          <SelectItem value="false">false</SelectItem>
        </SelectContent>
      </Select>
    );
  }
  if (node.kind === "number") {
    return (
      <Input
        className="h-6 w-36 px-1.5 text-xs"
        type="number"
        value={String(node.value ?? 0)}
        onChange={(e) => {
          const v = e.target.value;
          if (v.trim() !== "" && Number.isFinite(Number(v))) actions.setStateNodeValue(node.segments, Number(v));
        }}
      />
    );
  }
  // string — use the actual value, never the truncated preview
  return (
    <Input
      className="h-6 min-w-40 flex-1 px-1.5 text-xs"
      value={typeof node.value === "string" ? node.value : ""}
      onChange={(e) => actions.setStateNodeValue(node.segments, e.target.value)}
    />
  );
}
