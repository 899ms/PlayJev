import { ChevronDown, ChevronUp, Copy, Trash2 } from "lucide-react";
import type { QuestionDef, QuestionType, TypedQuestion } from "@playjev/core";
import { useT, useActions } from "@/hooks";
import { Button } from "@/components/ui/button";
import { Badge, Input, Label, Textarea } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChoiceCriteriaEditor } from "./ChoiceCriteriaEditor";
import { ScoreCriteriaEditor } from "./ScoreCriteriaEditor";
import { NoulCriteriaEditor } from "./NoulCriteriaEditor";
import { cn } from "@/lib/utils";

const TYPE_TONE: Record<QuestionType, "indigo" | "amber" | "emerald"> = {
  choice: "indigo",
  score: "amber",
  noul: "emerald",
};

export function QuestionCard({ question, index, total }: { question: QuestionDef; index: number; total: number }) {
  const t = useT();
  const actions = useActions();
  const q = question as TypedQuestion;

  return (
    <article className="rounded-lg border border-zinc-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center gap-1.5 border-b border-zinc-100 px-3 py-2">
        <Badge tone={TYPE_TONE[q.type]} title={q.type}>
          {t(`question.type.${q.type}`)}
        </Badge>
        <Input
          className="h-7 w-36 font-mono text-xs"
          value={q.id}
          title={t("question.idHint")}
          onChange={(e) => actions.updateQuestion(q.id, { id: e.target.value })}
        />
        <Select
          value={q.type}
          onValueChange={(v) => actions.convertQuestion(q.id, v as QuestionType)}
        >
          <SelectTrigger className="h-7 w-24 px-2 text-xs shadow-none" title={t("question.type")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="choice">{t("question.type.choice")}</SelectItem>
            <SelectItem value="score">{t("question.type.score")}</SelectItem>
            <SelectItem value="noul">{t("question.type.noul")}</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-0.5">
          <IconBtn title={t("question.moveUp")} disabled={index === 0} onClick={() => actions.moveQuestion(q.id, -1)}>
            <ChevronUp size={14} />
          </IconBtn>
          <IconBtn title={t("question.moveDown")} disabled={index === total - 1} onClick={() => actions.moveQuestion(q.id, 1)}>
            <ChevronDown size={14} />
          </IconBtn>
          <IconBtn title={t("question.duplicate")} onClick={() => actions.duplicateQuestion(q.id)}>
            <Copy size={13} />
          </IconBtn>
          <IconBtn title={t("question.delete")} destructive onClick={() => actions.removeQuestion(q.id)}>
            <Trash2 size={13} />
          </IconBtn>
        </div>
      </header>

      <div className="flex flex-col gap-2.5 px-3 py-2.5">
        <div className="flex flex-col gap-1">
          <Label>{t("question.instructionsLabel")}</Label>
          <Textarea
            className="min-h-16 text-[13px]"
            placeholder={t("question.instructionsHint")}
            value={typeof q.instructions === "string" ? q.instructions : JSON.stringify(q.instructions, null, 2)}
            onChange={(e) => actions.updateQuestion(q.id, { instructions: e.target.value })}
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label>{t("question.criteria")}</Label>
          {q.type === "choice" && <ChoiceCriteriaEditor question={q} />}
          {q.type === "score" && <ScoreCriteriaEditor question={q} />}
          {q.type === "noul" && <NoulCriteriaEditor question={q} />}
        </div>
      </div>
    </article>
  );
}

export function IconBtn({
  title,
  onClick,
  disabled,
  destructive,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button
      size="xs"
      variant="ghost"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(destructive && "hover:bg-red-50 hover:text-red-600")}
    >
      {children}
    </Button>
  );
}
