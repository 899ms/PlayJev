import { useEffect, useState } from "react";
import { BarChart3, SquarePen } from "lucide-react";
import { Toaster } from "sonner";
import { AppSidebar } from "@/components/sidebar/AppSidebar";
import { MobileProjectList } from "@/components/list/MobileProjectList";
import { TopBar } from "@/components/layout/TopBar";
import { RequestEditorPane } from "@/components/editor/RequestEditorPane";
import { ResponsePane } from "@/components/playground/ResponsePane";
import { SettingsDialog } from "@/components/playground/SettingsDialog";
import { AIGenerateDialog } from "@/components/aigen/AIGenerateDialog";
import { OobeDialog } from "@/components/oobe/OobeDialog";
import { projectStore, useIsDesktop, useProject, useSettings, useT } from "@/hooks";
import { cn } from "@/lib/utils";

type MobilePage = "list" | "editor" | "result";

export default function App() {
  const t = useT();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [mobilePage, setMobilePage] = useState<MobilePage>("list");
  const isDesktop = useIsDesktop();
  const hasRun = useProject((s) => Boolean(s.lastRun));
  const oobeCompleted = useSettings((s) => s.oobeCompleted);

  // The working project, view and last run are persisted to browser storage on
  // every change (zustand persist) — a forgotten 保存 never loses data, and no
  // entry appears in the saved list. 保存 creates explicit named snapshots.

  // undo/redo keyboard shortcuts (skip while typing in inputs)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField =
        target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      const mod = e.ctrlKey || e.metaKey;
      if (!mod || inField) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        projectStore.getState().undo();
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        projectStore.getState().redo();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const openProject = () => setMobilePage("editor");

  return (
    <div className="flex h-full overflow-hidden">
      {isDesktop ? (
        <>
          <AppSidebar />
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <TopBar
              onOpenSettings={() => setSettingsOpen(true)}
              onOpenAI={() => setAiOpen(true)}
              onMobileBack={() => setMobilePage("list")}
            />
            <main className="grid min-h-0 flex-1 grid-cols-2 gap-2 p-2">
              <RequestEditorPane className="min-h-0 overflow-hidden rounded-xl border border-zinc-200 bg-white" />
              <ResponsePane className="min-h-0 overflow-hidden rounded-xl border border-zinc-200 bg-white" />
            </main>
          </div>
        </>
      ) : mobilePage === "list" ? (
        <MobileProjectList
          onOpenProject={openProject}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      ) : (
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <TopBar
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenAI={() => setAiOpen(true)}
            onMobileBack={() => setMobilePage("list")}
          />
          <main className="grid min-h-0 flex-1 grid-cols-1 gap-2 p-2 pb-16">
            <div className={cn("min-h-0 overflow-hidden", mobilePage === "editor" ? "block" : "hidden")}>
              <RequestEditorPane className="h-full rounded-xl border border-zinc-200 bg-white" />
            </div>
            <div className={cn("min-h-0 overflow-hidden", mobilePage === "result" ? "block" : "hidden")}>
              <ResponsePane className="h-full rounded-xl border border-zinc-200 bg-white" />
            </div>
          </main>
        </div>
      )}

      {/* mobile sub-page navigation (inside an opened project) */}
      {isDesktop || mobilePage === "list" ? null : (
        <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-2 border-t border-zinc-200 bg-white">
          <MobileTab
            active={mobilePage === "editor"}
            icon={SquarePen}
            label={t("mobile.build")}
            onClick={() => setMobilePage("editor")}
          />
          <MobileTab
            active={mobilePage === "result"}
            icon={BarChart3}
            label={t("mobile.result")}
            dot={hasRun}
            onClick={() => setMobilePage("result")}
          />
        </nav>
      )}

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <AIGenerateDialog open={aiOpen} onClose={() => setAiOpen(false)} />
      {!oobeCompleted && <OobeDialog />}
      <Toaster richColors position="bottom-right" />
    </div>
  );
}

function MobileTab({
  active,
  icon: Icon,
  label,
  dot,
  onClick,
}: {
  active: boolean;
  icon: typeof SquarePen;
  label: string;
  dot?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-center gap-0.5 py-2 text-[11px]",
        active ? "text-indigo-600" : "text-zinc-400"
      )}
    >
      <Icon size={18} />
      {label}
      {dot && <span className="absolute right-[calc(50%-1.6rem)] top-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />}
      {active && <span className="absolute inset-x-10 top-0 h-0.5 rounded-full bg-indigo-600" />}
    </button>
  );
}
