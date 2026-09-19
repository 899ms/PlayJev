import { useEffect, useRef, useState } from "react";
import { FilePlus2, FolderOpen, PanelLeftClose, PanelLeftOpen, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { createEmptyProject, TEMPLATES } from "@playjev/core";
import { projectStore, useProject, useSettings, useT } from "@/hooks";
import { cn } from "@/lib/utils";

type ListItem =
  | { kind: "blank" }
  | { kind: "template"; id: string; name: string; desc: string }
  | { kind: "saved"; id: string; name: string; desc: string; hasRun: boolean };

/**
 * Collapsible left sidebar: one unified list of preset templates (examples —
 * deletable and renamable) and user-saved builds. Right-click an entry for
 * rename / delete.
 */
export function AppSidebar({
  mobile = false,
  onClose,
}: {
  /** Drawer mode (narrow screens): full width, close button, items close the drawer on load. */
  mobile?: boolean;
  onClose?: () => void;
}) {
  const t = useT();
  const locale = useSettings((s) => s.locale);
  const collapsedPref = useSettings((s) => s.sidebarCollapsed);
  const setCollapsed = useSettings((s) => s.setSidebarCollapsed);
  const collapsed = collapsedPref && !mobile;
  const finish = () => onClose?.();
  const templateNameOverrides = useProject((s) => s.templateNameOverrides);
  const hiddenTemplateIds = useProject((s) => s.hiddenTemplateIds);
  const saved = useProject((s) => s.saved);

  const [menu, setMenu] = useState<{ x: number; y: number; item: ListItem } | null>(null);
  const [renaming, setRenaming] = useState<{ kind: "template" | "saved"; id: string } | null>(null);
  const [renameText, setRenameText] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menu]);

  const items: ListItem[] = [
    { kind: "blank" },
    ...TEMPLATES.filter((tpl) => !hiddenTemplateIds.includes(tpl.id)).map<ListItem>((tpl) => ({
      kind: "template",
      id: tpl.id,
      name: templateNameOverrides[tpl.id] || t(tpl.nameKey),
      desc: t(tpl.descriptionKey),
    })),
    ...saved.map<ListItem>((e) => ({
      kind: "saved",
      id: e.id,
      name: e.name,
      desc: new Date(e.savedAt).toLocaleString(),
      hasRun: Boolean(e.run),
    })),
  ];

  const openMenu = (e: React.MouseEvent, item: ListItem) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY, item });
  };

  const startRename = (item: ListItem) => {
    if (item.kind === "blank") return;
    setRenaming({ kind: item.kind, id: item.id });
    setRenameText(item.name);
    setMenu(null);
  };

  const commitRename = () => {
    if (!renaming) return;
    const name = renameText.trim();
    if (name !== "") {
      if (renaming.kind === "template") projectStore.getState().setTemplateNameOverride(renaming.id, name);
      else projectStore.getState().renameSaved(renaming.id, name);
    }
    setRenaming(null);
  };

  const deleteItem = (item: ListItem) => {
    if (item.kind === "blank") return;
    if (item.kind === "template") {
      projectStore.getState().hideTemplate(item.id);
      toast.success(t("toast.savedDeleted", { name: item.name }));
    } else {
      projectStore.getState().deleteSaved(item.id);
      toast.success(t("toast.savedDeleted", { name: item.name }));
    }
    setMenu(null);
  };

  const load = (item: ListItem) => {
    const store = projectStore.getState();
    if (item.kind === "blank") {
      store.loadProject(createEmptyProject());
      toast.success(t("toast.newProject"));
    } else if (item.kind === "template") {
      const tpl = TEMPLATES.find((x) => x.id === item.id)!;
      store.loadProject(tpl.build(locale));
      toast.success(t("toast.templateLoaded"));
    } else {
      store.loadSaved(item.id);
      toast.success(t("toast.savedLoaded", { name: item.name }));
    }
    if (mobile) finish();
  };

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col overflow-hidden border-r border-zinc-200 bg-white transition-all",
        collapsed ? "w-12" : "w-60"
      )}
    >
      <div className="flex items-center justify-between px-2 py-2">
        {!collapsed && <span className="px-1 text-xs font-semibold text-zinc-400">{t("app.title")}</span>}
        {mobile ? (
          <button
            type="button"
            title={t("common.close")}
            onClick={() => onClose?.()}
            className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          >
            <X size={16} />
          </button>
        ) : (
          <button
            type="button"
            title={collapsed ? t("sidebar.expand") : t("sidebar.collapse")}
            onClick={() => setCollapsed(!collapsed)}
            className={cn("rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700", collapsed && "mx-auto")}
          >
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        )}
      </div>

      {collapsed ? (
        <div className="flex flex-col items-center gap-1 py-1">
          <button
            type="button"
            title={t("storage.menu")}
            onClick={() => setCollapsed(false)}
            className="rounded p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
          >
            <FilePlus2 size={17} />
          </button>
        </div>
      ) : (
        <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pb-3">
          <div className="px-2 pb-1 text-xs font-semibold text-zinc-400">{t("storage.menu")}</div>
          {items.length === 0 && <div className="px-2 py-1 text-xs text-zinc-400">{t("storage.empty")}</div>}
          {items.map((item) => {
            const isRenaming =
              renaming !== null &&
              ((item.kind === "template" && renaming.kind === "template" && item.id === renaming.id) ||
                (item.kind === "saved" && renaming.kind === "saved" && item.id === renaming.id));
            const name = item.kind === "blank" ? t("template.newEmpty") : item.name;
            const desc = item.kind === "blank" ? "" : item.desc;
            const hasRun = item.kind === "saved" ? item.hasRun : false;
            const icon = item.kind === "blank" ? FilePlus2 : item.kind === "saved" ? FolderOpen : undefined;
            const Icon = icon;
            return (
              <div key={item.kind + (item.kind === "blank" ? "" : item.id)} className="group relative flex items-center">
                {isRenaming ? (
                  <input
                    autoFocus
                    className="w-full rounded-md border border-indigo-400 px-2 py-1.5 text-sm focus:outline-none"
                    value={renameText}
                    onChange={(e) => setRenameText(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename();
                      if (e.key === "Escape") setRenaming(null);
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => load(item)}
                    onContextMenu={(e) => openMenu(e, item)}
                    title={desc || undefined}
                    className="min-w-0 flex-1 rounded-md px-2 py-1.5 text-left text-sm text-zinc-700 hover:bg-indigo-50 hover:text-indigo-700"
                  >
                    <span className="flex items-center gap-1.5">
                      {Icon && <Icon size={13} className="shrink-0 text-zinc-400" />}
                      <span className="block truncate">{name}</span>
                      {hasRun && <span className="shrink-0 text-emerald-500">✓</span>}
                    </span>
                    {desc && <span className="block truncate text-[11px] text-zinc-400">{desc}</span>}
                  </button>
                )}
              </div>
            );
          })}
        </nav>
      )}

      {menu && (
        <div
          ref={menuRef}
          className="fixed z-50 min-w-36 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-lg"
          style={{ left: menu.x, top: menu.y }}
        >
          {menu.item.kind !== "blank" && (
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-100"
              onClick={() => startRename(menu.item)}
            >
              <Pencil size={13} /> {t("common.rename")}
            </button>
          )}
          {menu.item.kind !== "blank" && (
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50"
              onClick={() => deleteItem(menu.item)}
            >
              <Trash2 size={13} /> {t("question.delete")}
            </button>
          )}
        </div>
      )}
    </aside>
  );
}
