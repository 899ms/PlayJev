import { FilePlus2, Settings, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createEmptyProject, TEMPLATES } from "@playjev/core";
import { projectStore, useProject, useSettings, useT } from "@/hooks";

type MobileListItem =
  | { kind: "template"; id: string; name: string; desc: string }
  | { kind: "saved"; id: string; name: string; desc: string; hasRun: boolean };

/**
 * Mobile list page: unified project and template list.
 * Tap any item to open in the editor; the top-left back arrow returns here.
 */
export function MobileProjectList({
  onOpenProject,
  onOpenSettings,
}: {
  onOpenProject: () => void;
  onOpenSettings: () => void;
}) {
  const t = useT();
  const locale = useSettings((s) => s.locale);
  const templateNameOverrides = useProject((s) => s.templateNameOverrides);
  const hiddenTemplateIds = useProject((s) => s.hiddenTemplateIds);
  const saved = useProject((s) => s.saved);

  const openBlank = () => {
    projectStore.getState().loadProject(createEmptyProject());
    toast.success(t("toast.newProject"));
    onOpenProject();
  };

  const templates = TEMPLATES.filter((tpl) => !hiddenTemplateIds.includes(tpl.id));

  const items: MobileListItem[] = [
    ...templates.map((tpl) => ({
      kind: "template" as const,
      id: tpl.id,
      name: templateNameOverrides[tpl.id] ?? t(tpl.nameKey),
      desc: t(tpl.descriptionKey),
    })),
    ...saved.map((entry) => ({
      kind: "saved" as const,
      id: entry.id,
      name: entry.name,
      desc: new Date(entry.savedAt).toLocaleDateString(),
      hasRun: Boolean(entry.run),
    })),
  ];

  const openItem = (item: MobileListItem) => {
    if (item.kind === "template") {
      const tpl = TEMPLATES.find((x) => x.id === item.id)!;
      projectStore.getState().loadProject(tpl.build(locale));
      toast.success(t("toast.templateLoaded"));
    } else {
      projectStore.getState().loadSaved(item.id);
      toast.success(t("toast.savedLoaded", { name: item.name }));
    }
    onOpenProject();
  };

  const removeItem = (item: MobileListItem) => {
    if (item.kind === "template") {
      projectStore.getState().hideTemplate(item.id);
      toast.success(t("toast.templateDeleted", { name: item.name }));
    } else {
      projectStore.getState().deleteSaved(item.id);
      toast.success(t("toast.savedDeleted", { name: item.name }));
    }
  };

  return (
    <div className="flex h-full w-full min-w-0 flex-1 flex-col overflow-hidden bg-zinc-100">
      {/* list header */}
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-3 py-2">
        <span className="text-base font-bold tracking-tight text-indigo-600">{t("app.title")}</span>
        <button
          type="button"
          title={t("topbar.settings")}
          onClick={onOpenSettings}
          className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
        >
          <Settings size={17} />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <button
          type="button"
          onClick={openBlank}
          className="mb-4 flex w-full items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-left text-sm font-medium text-indigo-700 hover:bg-indigo-100"
        >
          <FilePlus2 size={16} /> {t("template.newProject")}
        </button>

        <div className="mb-2 px-1 text-xs font-semibold text-zinc-400">{t("storage.menu")}</div>
        {items.length === 0 ? (
          <div className="px-1 text-xs text-zinc-400">{t("storage.empty")}</div>
        ) : (
          <div className="flex flex-col gap-2">
            {items.map((item) => (
              <div key={item.kind + item.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => openItem(item)}
                  className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-left hover:border-indigo-300"
                >
                  <span className="flex items-center gap-1.5">
                    <span className="block truncate text-sm font-medium text-zinc-800">
                      {item.name}
                      {"hasRun" in item && item.hasRun ? <span className="ml-1 text-emerald-500">✓</span> : null}
                    </span>
                  </span>
                  {item.desc ? <span className="mt-0.5 block truncate text-xs text-zinc-400">{item.desc}</span> : null}
                </button>
                <button
                  type="button"
                  title={t("question.delete")}
                  onClick={() => removeItem(item)}
                  className="rounded p-2 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
