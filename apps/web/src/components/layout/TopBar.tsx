import { useMemo } from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  FilePlus2,
  Info,
  ArrowLeft,
  Redo2,
  Save,
  Settings,
  Sparkles,
  Undo2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  createEmptyProject,
  estimateRequestTokens,
  lintProject,
  serializeRequest,
  type Issue,
  type IssueLevel,
} from "@playjev/core";
import { Button } from "@/components/ui/button";
import { Badge, Input } from "@/components/ui/field";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { projectStore, useProject, useSettings, useT } from "@/hooks";
import { copyText, formatK } from "@/lib/adapters";

export function TopBar({
  onOpenSettings,
  onOpenAI,
  onMobileBack,
}: {
  onOpenSettings: () => void;
  onOpenAI: () => void;
  /** When set (mobile detail pages) the hamburger becomes a back arrow to the project list. */
  onMobileBack: () => void;
}) {
  const t = useT();
  const project = useProject((s) => s.project);
  const view = useProject((s) => s.view);
  const canUndo = useProject((s) => s.canUndo);
  const canRedo = useProject((s) => s.canRedo);
  const jev = useSettings((s) => s.jev);
  const store = projectStore;

  const issues = useMemo(
    () => lintProject(project, { stateJsonError: view.jsonError, stateJsonText: view.stateMode === "json" ? view.jsonText : undefined }),
    [project, view]
  );
  const errorCount = issues.filter((i) => i.level === "error").length;
  const warningCount = issues.filter((i) => i.level === "warning").length;

  const onCopyRequest = async () => {
    const request = { ...serializeRequest(project), model: jev.model };
    const ok = await copyText(JSON.stringify(request, null, 2));
    if (ok) toast.success(t("toast.copied"));
  };

  return (
    <header className="flex flex-wrap items-center gap-2 border-b border-zinc-200 bg-white px-3 py-2">
      <Button size="sm" variant="ghost" className="lg:hidden" title={t("common.back")} onClick={onMobileBack}>
        <ArrowLeft size={16} />
      </Button>
      <TokenGauge />
      <IssueBadge issues={issues} errorCount={errorCount} warningCount={warningCount} />

      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        <Button
          size="sm"
          variant="outline"
          disabled={!canUndo}
          title={`$<span className="hidden sm:inline">{t("history.undo")}</span> (Ctrl+Z)`}
          onClick={() => store.getState().undo()}
        >
          <Undo2 size={14} /> {t("history.undo")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!canRedo}
          title={`$<span className="hidden sm:inline">{t("history.redo")}</span> (Ctrl+Y)`}
          onClick={() => store.getState().redo()}
        >
          <Redo2 size={14} /> {t("history.redo")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            store.getState().loadProject(createEmptyProject());
            toast.success(t("toast.newProject"));
          }}
        >
          <FilePlus2 size={14} /> <span className="hidden sm:inline">{t("template.newProject")}</span>
        </Button>
        <Button size="sm" onClick={onOpenAI}>
          <Sparkles size={14} /> <span className="hidden sm:inline">{t("topbar.aiGenerate")}</span>
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            store.getState().saveProject();
            toast.success(t("toast.saved"));
          }}
        >
          <Save size={14} /> <span className="hidden sm:inline">{t("storage.save")}</span>
        </Button>
        <Button size="sm" variant="outline" onClick={onCopyRequest}>
          <Copy size={14} /> <span className="hidden sm:inline">{t("topbar.copyRequest")}</span>
        </Button>
        <Button size="sm" variant="ghost" onClick={onOpenSettings} title={t("topbar.settings")}>
          <Settings size={15} />
        </Button>
      </div>
    </header>
  );
}

function TokenGauge() {
  const t = useT();
  const project = useProject((s) => s.project);
  const report = useMemo(() => estimateRequestTokens(project), [project]);
  const ratio = Math.min(report.bindingUsed / report.bindingBudget, 1);
  const over = report.bindingUsed > report.bindingBudget;
  const near = report.bindingUsed > report.bindingBudget * 0.8;
  const barColor = over ? "bg-red-500" : near ? "bg-amber-500" : "bg-emerald-500";

  return (
    <div
      className="hidden w-40 flex-col gap-1 md:flex"
      title={`${t("token.estimateNote")}\n${t("token.stateNote")}: ~${formatK(report.stateTokens + report.longestQuestionTokens)}/32k · ${t("token.totalNote")}: ~${formatK(report.totalTokens)}/64k`}
    >
      <div className="flex items-baseline justify-between text-[11px] text-zinc-500">
        <span>
          {t("token.label", { used: formatK(report.bindingUsed), budget: formatK(report.bindingBudget) })}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${ratio * 100}%` }} />
      </div>
    </div>
  );
}

const LEVEL_ICON: Record<IssueLevel, typeof Info> = { error: XCircle, warning: AlertTriangle, info: Info };
const LEVEL_TONE: Record<IssueLevel, "red" | "amber" | "sky"> = { error: "red", warning: "amber", info: "sky" };

function IssueBadge({ issues, errorCount, warningCount }: { issues: Issue[]; errorCount: number; warningCount: number }) {
  const t = useT();
  const tone = errorCount > 0 ? "red" : warningCount > 0 ? "amber" : "emerald";
  const count = issues.length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="flex items-center" title={t("issues.title")}>
          <Badge tone={tone} className="cursor-pointer gap-1 px-2 py-1">
            {count === 0 ? <Check size={12} /> : <AlertTriangle size={12} />}
            {count === 0 ? "OK" : count}
          </Badge>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-w-md">
        <div className="px-3 py-1 text-xs font-semibold text-zinc-400">{t("issues.title")}</div>
        <div className="max-h-72 overflow-y-auto">
          {issues.length === 0 && <div className="px-3 py-2 text-sm text-zinc-500">{t("issues.empty")}</div>}
          {issues.map((issue, i) => {
            const Icon = LEVEL_ICON[issue.level];
            return (
              <div key={`${issue.code}-${issue.questionId ?? ""}-${i}`} className="flex items-start gap-2 px-3 py-1.5 text-xs">
                <Badge tone={LEVEL_TONE[issue.level]}>{t(`issues.${issue.level}`)}</Badge>
                <span className="text-zinc-700">
                  {t(issue.messageKey, issue.params)}
                  {issue.questionId && <span className="ml-1 font-mono text-zinc-400">[{issue.questionId}]</span>}
                </span>
              </div>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
