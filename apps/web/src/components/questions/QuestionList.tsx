import { ListChecks, CircleCheck, Gauge } from "lucide-react";
import type { QuestionTab, QuestionType } from "@playjev/core";
import { useProject, useT, useActions } from "@/hooks";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QuestionCard } from "./QuestionCard";
import { cn } from "@/lib/utils";

const ADD_BUTTONS: { type: QuestionType; icon: typeof ListChecks; iconClass: string; labelKey: string }[] = [
  { type: "choice", icon: ListChecks, iconClass: "text-indigo-500", labelKey: "questions.addChoice" },
  { type: "score", icon: Gauge, iconClass: "text-amber-500", labelKey: "questions.addScore" },
  { type: "noul", icon: CircleCheck, iconClass: "text-emerald-500", labelKey: "questions.addNoul" },
];

/**
 * Questions section: builder (visual cards) ⇄ questions-JSON editing.
 * Adding questions uses always-visible type buttons (works with mouse and touch;
 * a dropdown menu misbehaves on mobile / inside overflow containers).
 */
export function QuestionSection({ className }: { className?: string }) {
  const t = useT();
  const questionTab = useProject((s) => s.view.questionTab);
  const actions = useActions();

  return (
    <section className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-1">
        <h2 className="text-sm font-semibold text-zinc-800">{t("questions.title")}</h2>
        <div className="flex flex-wrap items-center gap-1.5">
          {ADD_BUTTONS.map(({ type, icon: Icon, iconClass, labelKey }) => (
            <Button key={type} size="sm" variant="outline" onClick={() => actions.addQuestion(type)}>
              <Icon size={14} className={iconClass} /> {t(labelKey)}
            </Button>
          ))}
          <Tabs
            value={questionTab}
            onValueChange={(id) => actions.setQuestionTab(id as QuestionTab)}
          >
            <TabsList>
              <TabsTrigger value="builder">{t("question.tabBuilder")}</TabsTrigger>
              <TabsTrigger value="json">{t("question.tabJson")}</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>
      {questionTab === "builder" ? <QuestionList /> : <QuestionJsonMode />}
    </section>
  );
}

function QuestionJsonMode() {
  const t = useT();
  const questionJsonText = useProject((s) => s.view.questionJsonText);
  const questionJsonValid = useProject((s) => s.view.questionJsonValid);
  const questionJsonError = useProject((s) => s.view.questionJsonError);
  const actions = useActions();

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <Textarea
        className={cn(
          "min-h-56 flex-1 resize-none font-mono text-[13px] leading-relaxed",
          !questionJsonValid && "border-red-400 focus:border-red-500 focus:ring-red-400"
        )}
        spellCheck={false}
        value={questionJsonText}
        onChange={(e) => actions.setQuestionJsonText(e.target.value)}
      />
      <p className={cn("text-xs", questionJsonValid ? "text-zinc-400" : "text-red-600")}>
        {questionJsonValid ? t("question.jsonHint") : t("question.jsonInvalid", { error: questionJsonError ?? "" })}
      </p>
    </div>
  );
}

/** The question cards themselves (builder tab body). */
export function QuestionList() {
  const t = useT();
  const questions = useProject((s) => s.project.questions);

  if (questions.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-zinc-200 p-6 text-center text-sm text-zinc-400">
        {t("questions.empty")}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {questions.map((q, index) => (
        <QuestionCard key={q.id} question={q} index={index} total={questions.length} />
      ))}
    </div>
  );
}
