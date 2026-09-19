import { useState } from "react";
import { Loader2, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import {
  generateClarify,
  generateDraft,
  serializeRequest,
  type ClarifyQuestion,
  type JevProject,
} from "@playjev/core";
import { projectStore, useSettings, useT } from "@/hooks";
import { Button } from "@/components/ui/button";
import { Badge, Textarea } from "@/components/ui/field";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Step = 1 | 2 | 3;

interface WizardState {
  step: Step;
  description: string;
  includeCurrent: boolean;
  clarify: ClarifyQuestion[];
  selections: string[][];
  draft: JevProject | null;
  busy: boolean;
  error: string | null;
}

const INITIAL: WizardState = {
  step: 1,
  description: "",
  includeCurrent: false,
  clarify: [],
  selections: [],
  draft: null,
  busy: false,
  error: null,
};

export function AIGenerateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const llm = useSettings((s) => s.llm);
  const locale = useSettings((s) => s.locale);
  const [w, setW] = useState<WizardState>(INITIAL);

  const patch = (p: Partial<WizardState>) => setW((s) => ({ ...s, ...p }));

  const reset = () => setW(INITIAL);

  const handleClose = () => {
    if (!w.busy) onClose();
  };

  const runStep1 = async () => {
    patch({ busy: true, error: null });
    try {
      const current = projectStore.getState().project;
      const clarify = await generateClarify(
        { settings: llm },
        {
          description: w.description,
          locale,
          includeCurrent: w.includeCurrent,
          currentProjectJson: w.includeCurrent ? JSON.stringify(serializeRequest(current), null, 2) : undefined,
        }
      );
      patch({ step: 2, clarify, selections: clarify.map(() => []), busy: false });
    } catch (err) {
      patch({ busy: false, error: err instanceof Error ? err.message : String(err) });
    }
  };

  const runStep2 = async () => {
    patch({ busy: true, error: null });
    try {
      const draft = await generateDraft(
        { settings: llm },
        {
          description: w.description,
          answers: w.clarify.map((q, i) => ({ question: q.question, selected: w.selections[i] ?? [] })),
          locale,
          includeCurrent: w.includeCurrent,
          currentProjectJson: w.includeCurrent
            ? JSON.stringify(serializeRequest(projectStore.getState().project), null, 2)
            : undefined,
        }
      );
      patch({ step: 3, draft, busy: false });
    } catch (err) {
      patch({ busy: false, error: err instanceof Error ? err.message : String(err) });
    }
  };

  const apply = () => {
    if (!w.draft) return;
    const store = projectStore.getState();
    const current = store.project;
    const currentHasContent = current.questions.length > 0 || (typeof current.state === "string" ? current.state.trim() !== "" : current.state != null);
    if (currentHasContent && !window.confirm(t("ai.applyReplaceConfirm"))) return;
    store.loadProject(w.draft);
    toast.success(t("toast.aiApplied"));
    onClose();
    reset();
  };

  const toggleOption = (qi: number, label: string, multiSelect: boolean) => {
    setW((s) => {
      const selections = s.selections.map((arr, i) => (i === qi ? [...arr] : arr));
      const arr = selections[qi] ?? [];
      if (multiSelect) {
        selections[qi] = arr.includes(label) ? arr.filter((x) => x !== label) : [...arr, label];
      } else {
        selections[qi] = arr.includes(label) ? [] : [label];
      }
      return { ...s, selections };
    });
  };

  const step2Ready = w.selections.every((s) => s.length > 0);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-3xl">
        <DialogTitle>{t("ai.title")}</DialogTitle>
        {w.busy && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70">
          <div className="flex items-center gap-2 text-sm text-indigo-600">
            <Loader2 size={18} className="animate-spin" /> {t("common.loading")}
          </div>
        </div>
      )}

      {w.step === 1 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-800">
            <Sparkles size={15} className="text-indigo-500" />
            {t("ai.step1Title")}
          </div>
          <p className="text-xs text-zinc-400">{t("ai.step1Hint")}</p>
          <Textarea
            className="min-h-28"
            placeholder={t("ai.step1Placeholder")}
            value={w.description}
            onChange={(e) => patch({ description: e.target.value })}
          />
          <label className="flex items-center gap-2 text-xs text-zinc-600">
            <input
              type="checkbox"
              checked={w.includeCurrent}
              onChange={(e) => patch({ includeCurrent: e.target.checked })}
              className="accent-indigo-600"
            />
            {t("ai.useCurrentProject")}
          </label>
          {llm.mockMode && <p className="text-xs text-amber-600">{t("ai.mockHint")}</p>}
          {w.error && <ErrorBox message={w.error} />}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={reset}>
              {t("common.cancel")}
            </Button>
            <Button size="sm" disabled={w.description.trim() === ""} onClick={runStep1}>
              {t("common.next")}
            </Button>
          </div>
        </div>
      )}

      {w.step === 2 && (
        <div className="flex flex-col gap-4">
          <div>
            <div className="text-sm font-medium text-zinc-800">{t("ai.step2Title")}</div>
            <p className="mt-0.5 text-xs text-zinc-400">{t("ai.step2Hint")}</p>
          </div>
          {w.clarify.map((q, qi) => (
            <div key={qi} className="rounded-lg border border-zinc-200 p-3">
              <div className="mb-2 flex items-start gap-2">
                <span className="text-sm font-medium text-zinc-800">{q.question}</span>
                <Badge tone={q.multiSelect ? "sky" : "zinc"} className="ml-auto shrink-0">
                  {q.multiSelect ? t("ai.multi") : t("ai.single")}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {q.options.map((opt) => {
                  const selected = (w.selections[qi] ?? []).includes(opt.label);
                  return (
                    <button
                      key={opt.label}
                      type="button"
                      title={opt.description}
                      onClick={() => toggleOption(qi, opt.label, q.multiSelect)}
                      className={cn(
                        "rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors",
                        selected
                          ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                          : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50"
                      )}
                    >
                      <span className="block font-medium">{opt.label}</span>
                      {opt.description && <span className="mt-0.5 block text-[11px] text-zinc-400">{opt.description}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {w.error && <ErrorBox message={w.error} />}
          <div className="flex justify-between">
            <Button variant="outline" size="sm" onClick={() => patch({ step: 1, error: null })}>
              {t("common.back")}
            </Button>
            <Button size="sm" disabled={!step2Ready} onClick={runStep2}>
              <Wand2 size={14} /> {t("common.generate")}
            </Button>
          </div>
        </div>
      )}

      {w.step === 3 && w.draft && (
        <div className="flex flex-col gap-3">
          <div className="text-sm font-medium text-zinc-800">{t("ai.step3Title")}</div>
          <p className="text-xs text-zinc-400">{t("ai.step3Hint")}</p>
          <div className="rounded-lg border border-zinc-200">
            <div className="flex items-center gap-2 border-b border-zinc-100 px-3 py-2">
              <span className="text-sm font-semibold text-zinc-800">{w.draft.name || "—"}</span>
              <Badge tone="indigo">{w.draft.model}</Badge>
              <Badge tone="zinc">{t("ai.draftQuestions", { count: w.draft.questions.length })}</Badge>
            </div>
            <div className="max-h-64 overflow-y-auto px-3 py-2">
              <StateSummary draft={w.draft} />
              <div className="mt-2 flex flex-col gap-1.5">
                {w.draft.questions.map((q) => (
                  <div key={q.id} className="flex items-baseline gap-2 text-xs">
                    <Badge tone={q.type === "choice" ? "indigo" : q.type === "score" ? "amber" : "emerald"}>{q.type}</Badge>
                    <span className="font-mono text-zinc-700">{q.id}</span>
                    <span className="truncate text-zinc-500" title={typeof q.instructions === "string" ? q.instructions : ""}>
                      {typeof q.instructions === "string" ? q.instructions : JSON.stringify(q.instructions)}
                    </span>
                    <span className="ml-auto shrink-0 text-zinc-400">
                      {q.type === "choice"
                        ? t("ai.choiceOptions", { count: (q.criteria as { options: unknown[] }).options.length })
                        : q.type === "score"
                          ? t("ai.scoreLevels", { count: (q.criteria as { levels: unknown[] }).levels.length })
                          : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-between">
            <Button variant="outline" size="sm" onClick={() => patch({ step: 2, error: null })}>
              {t("common.back")}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={runStep2}>
                {t("common.regenerate")}
              </Button>
              <Button size="sm" onClick={apply}>
                {t("ai.apply")}
              </Button>
            </div>
          </div>
        </div>
      )}
      </DialogContent>
    </Dialog>
  );
}

function StateSummary({ draft }: { draft: JevProject }) {
  const t = useT();
  if (typeof draft.state === "string") {
    return (
      <p className="rounded bg-zinc-50 p-2 text-xs leading-relaxed text-zinc-600">
        {draft.state.length > 300 ? `${draft.state.slice(0, 300)}…` : draft.state}
      </p>
    );
  }
  const keys = Object.keys(draft.state as Record<string, unknown>);
  return (
    <p className="rounded bg-zinc-50 p-2 text-xs text-zinc-600">
      {t("state.tabJson")}: {keys.join(" · ")}
    </p>
  );
}

function ErrorBox({ message }: { message: string }) {
  const t = useT();
  return (
    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
      {t("ai.errorGenerate", { message })}
    </div>
  );
}
