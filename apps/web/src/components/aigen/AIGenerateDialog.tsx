import { useState } from "react";
import { Copy, Loader2, Sparkles, Wand2, X } from "lucide-react";
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
import { copyText } from "@/lib/adapters";
import { cn } from "@/lib/utils";

type Step = 1 | 2 | 3;

interface WizardState {
  step: Step;
  description: string;
  includeCurrent: boolean;
  clarify: ClarifyQuestion[];
  selections: string[][];
  customInputs: string[];
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
  customInputs: [],
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

  const reset = () => {
    setW(INITIAL);
    onClose();
  };

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
      patch({
        step: 2,
        clarify,
        selections: clarify.map(() => []),
        customInputs: clarify.map(() => ""),
        busy: false,
      });
    } catch (err) {
      patch({ busy: false, error: err instanceof Error ? err.message : String(err) });
    }
  };

  const runStep2 = async () => {
    patch({ busy: true, error: null });
    try {
      const answers = w.clarify.map((q, i) => {
        const picked = [...(w.selections[i] ?? [])];
        const custom = (w.customInputs[i] ?? "").trim();
        if (custom && !picked.includes(custom)) {
          picked.push(custom);
        }
        return { question: q.question, selected: picked };
      });

      const draft = await generateDraft(
        { settings: llm },
        {
          description: w.description,
          answers,
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
    const currentHasContent =
      current.questions.length > 0 ||
      (typeof current.state === "string" ? current.state.trim() !== "" : current.state != null);
    if (currentHasContent && !window.confirm(t("ai.applyReplaceConfirm"))) return;
    store.loadProject(w.draft);
    toast.success(t("toast.aiApplied"));
    reset();
  };

  const copyAgentSchema = async () => {
    if (!w.draft) return;
    const request = {
      ...serializeRequest(w.draft),
      model: w.draft.model || "jev-latest",
    };
    const ok = await copyText(JSON.stringify(request, null, 2));
    if (ok) {
      toast.success(t("toast.schemaCopied"));
    }
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

  const updateCustomInput = (qi: number, val: string) => {
    setW((s) => {
      const customInputs = [...s.customInputs];
      customInputs[qi] = val;
      return { ...s, customInputs };
    });
  };

  const step2Ready =
    w.clarify.length > 0 &&
    w.clarify.every(
      (_, i) => (w.selections[i]?.length ?? 0) > 0 || (w.customInputs[i]?.trim() ?? "") !== ""
    );

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-2xl w-[92vw] max-h-[85vh] flex flex-col overflow-hidden p-0 gap-0">
        {/* Pinned Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4 shrink-0 bg-white">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-indigo-600" />
            <DialogTitle className="text-base font-semibold text-zinc-900">{t("ai.title")}</DialogTitle>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
            {w.step} / 3
          </span>
        </div>

        {w.busy && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/80 backdrop-blur-xs">
            <div className="flex items-center gap-2 text-sm font-medium text-indigo-600">
              <Loader2 size={18} className="animate-spin" /> {t("common.loading")}
            </div>
          </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-6">
          {w.step === 1 && (
            <div className="flex flex-col gap-3">
              <div className="text-sm font-medium text-zinc-800">{t("ai.step1Title")}</div>
              <p className="text-xs text-zinc-400">{t("ai.step1Hint")}</p>
              <Textarea
                className="min-h-32 text-sm leading-relaxed"
                placeholder={t("ai.step1Placeholder")}
                value={w.description}
                onChange={(e) => patch({ description: e.target.value })}
              />
              <label className="flex items-center gap-2 text-xs text-zinc-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={w.includeCurrent}
                  onChange={(e) => patch({ includeCurrent: e.target.checked })}
                  className="accent-indigo-600"
                />
                {t("ai.useCurrentProject")}
              </label>
              {w.error && <ErrorBox message={w.error} />}
            </div>
          )}

          {w.step === 2 && (
            <div className="flex flex-col gap-4">
              <div>
                <div className="text-sm font-medium text-zinc-800">{t("ai.step2Title")}</div>
                <p className="mt-0.5 text-xs text-zinc-400">{t("ai.step2Hint")}</p>
              </div>
              {w.clarify.map((q, qi) => (
                <div key={qi} className="rounded-lg border border-zinc-200 p-3 bg-white shadow-2xs">
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
                              ? "border-indigo-500 bg-indigo-50 text-indigo-700 font-medium"
                              : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50"
                          )}
                        >
                          <span className="block font-medium">{opt.label}</span>
                          {opt.description && (
                            <span className="mt-0.5 block text-[11px] text-zinc-400">{opt.description}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Manual / Custom Input Option */}
                  <div className="mt-2.5 flex items-center gap-2 border-t border-zinc-100 pt-2">
                    <span className="text-[11px] font-medium text-zinc-500 shrink-0">
                      {t("ai.manualInput")}:
                    </span>
                    <input
                      type="text"
                      value={w.customInputs[qi] ?? ""}
                      onChange={(e) => updateCustomInput(qi, e.target.value)}
                      placeholder={t("ai.customInputPlaceholder")}
                      className="h-7 flex-1 rounded-md border border-zinc-200 bg-zinc-50/50 px-2.5 text-xs text-zinc-700 placeholder:text-zinc-400 focus:border-indigo-500 focus:bg-white focus:outline-none transition-colors"
                    />
                    {w.customInputs[qi] ? (
                      <button
                        type="button"
                        onClick={() => updateCustomInput(qi, "")}
                        className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                        title={t("common.clear")}
                      >
                        <X size={12} />
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
              {w.error && <ErrorBox message={w.error} />}
            </div>
          )}

          {w.step === 3 && w.draft && (
            <div className="flex flex-col gap-3">
              <div>
                <div className="text-sm font-medium text-zinc-800">{t("ai.step3Title")}</div>
                <p className="mt-0.5 text-xs text-zinc-400">{t("ai.step3Hint")}</p>
              </div>

              <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden shadow-2xs">
                <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 bg-zinc-50/50 px-3 py-2">
                  <span className="text-sm font-semibold text-zinc-800">{w.draft.name || "—"}</span>
                  <Badge tone="indigo">{w.draft.model}</Badge>
                  <Badge tone="zinc">{t("ai.draftQuestions", { count: w.draft.questions.length })}</Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-auto text-xs h-7 gap-1.5"
                    onClick={copyAgentSchema}
                  >
                    <Copy size={13} /> {t("ai.copyAgentSchema")}
                  </Button>
                </div>
                <div className="p-3 flex flex-col gap-2.5">
                  <StateSummary draft={w.draft} />
                  <div className="flex flex-col gap-2">
                    {w.draft.questions.map((q) => (
                      <div key={q.id} className="rounded-md border border-zinc-100 bg-zinc-50/60 p-2.5 text-xs">
                        <div className="flex items-center gap-2">
                          <Badge
                            tone={q.type === "choice" ? "indigo" : q.type === "score" ? "amber" : "emerald"}
                            className="shrink-0"
                          >
                            {q.type}
                          </Badge>
                          <span className="font-mono font-medium text-zinc-800 shrink-0">{q.id}</span>
                          <span className="ml-auto shrink-0 text-[11px] text-zinc-400">
                            {q.type === "choice"
                              ? t("ai.choiceOptions", { count: (q.criteria as { options: unknown[] }).options.length })
                              : q.type === "score"
                                ? t("ai.scoreLevels", { count: (q.criteria as { levels: unknown[] }).levels.length })
                                : ""}
                          </span>
                        </div>
                        <p className="mt-1.5 text-zinc-600 break-words leading-relaxed">
                          {typeof q.instructions === "string" ? q.instructions : JSON.stringify(q.instructions)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {w.error && <ErrorBox message={w.error} />}
            </div>
          )}
        </div>

        {/* Pinned Footer */}
        <div className="shrink-0 border-t border-zinc-100 px-6 py-3.5 bg-zinc-50/70 flex items-center justify-between">
          {w.step === 1 && (
            <>
              <Button variant="outline" size="sm" onClick={reset}>
                {t("common.cancel")}
              </Button>
              <Button size="sm" disabled={w.description.trim() === ""} onClick={runStep1}>
                {t("common.next")}
              </Button>
            </>
          )}

          {w.step === 2 && (
            <>
              <Button variant="outline" size="sm" onClick={() => patch({ step: 1, error: null })}>
                {t("common.back")}
              </Button>
              <Button size="sm" disabled={!step2Ready} onClick={runStep2}>
                <Wand2 size={14} /> {t("common.generate")}
              </Button>
            </>
          )}

          {w.step === 3 && (
            <>
              <Button variant="outline" size="sm" onClick={() => patch({ step: 2, error: null })}>
                {t("common.back")}
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={copyAgentSchema}>
                  <Copy size={14} /> {t("ai.copyAgentSchema")}
                </Button>
                <Button variant="outline" size="sm" onClick={runStep2}>
                  {t("common.regenerate")}
                </Button>
                <Button size="sm" onClick={apply}>
                  {t("ai.apply")}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StateSummary({ draft }: { draft: JevProject }) {
  const t = useT();
  if (typeof draft.state === "string") {
    if (!draft.state.trim()) {
      return (
        <p className="rounded bg-zinc-50 p-2 text-xs italic text-zinc-400">
          (空状态)
        </p>
      );
    }
    return (
      <p className="rounded bg-zinc-50 p-2 text-xs leading-relaxed text-zinc-600 break-words">
        {draft.state.length > 300 ? `${draft.state.slice(0, 300)}…` : draft.state}
      </p>
    );
  }
  const keys = Object.keys(draft.state as Record<string, unknown>);
  return (
    <p className="rounded bg-zinc-50 p-2 text-xs text-zinc-600 break-words">
      {t("state.tabJson")}: {keys.join(" · ")}
    </p>
  );
}

function ErrorBox({ message }: { message: string }) {
  const t = useT();
  return (
    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 break-words">
      {t("ai.errorGenerate", { message })}
    </div>
  );
}
