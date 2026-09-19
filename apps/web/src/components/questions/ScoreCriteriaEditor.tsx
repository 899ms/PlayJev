import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import type { ScoreQuestion } from "@playjev/core";
import { SCORE_MAX_LEVELS } from "@playjev/core";
import { useT, useActions } from "@/hooks";
import { Textarea } from "@/components/ui/field";
import { IconBtn } from "./QuestionCard";

export function ScoreCriteriaEditor({ question }: { question: ScoreQuestion }) {
  const t = useT();
  const actions = useActions();
  const levels = question.criteria.levels;

  return (
    <div className="flex flex-col gap-1.5">
      {levels.map((level, i) => (
        <div key={i} className="flex items-start gap-1.5">
          <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded bg-zinc-100 font-mono text-xs text-zinc-500">
            {i}
          </span>
          <Textarea
            className="min-h-8 flex-1 py-1 text-xs"
            rows={1}
            placeholder={t("score.levelPlaceholder", { index: i })}
            value={typeof level === "string" ? level : level == null ? "" : JSON.stringify(level)}
            onChange={(e) => actions.updateScoreLevel(question.id, i, e.target.value)}
          />
          <div className="flex shrink-0 items-center">
            <IconBtn title={t("question.moveUp")} disabled={i === 0} onClick={() => actions.moveScoreLevel(question.id, i, -1)}>
              <ArrowUp size={13} />
            </IconBtn>
            <IconBtn
              title={t("question.moveDown")}
              disabled={i === levels.length - 1}
              onClick={() => actions.moveScoreLevel(question.id, i, 1)}
            >
              <ArrowDown size={13} />
            </IconBtn>
            <IconBtn
              title={t("question.delete")}
              destructive
              disabled={levels.length <= 2}
              onClick={() => actions.removeScoreLevel(question.id, i)}
            >
              <X size={13} />
            </IconBtn>
          </div>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-500 disabled:opacity-40"
          disabled={levels.length >= SCORE_MAX_LEVELS}
          onClick={() => actions.addScoreLevel(question.id)}
        >
          <Plus size={13} /> {t("score.addLevel")}
        </button>
        <span className="text-xs text-zinc-400">{t("score.hint")}</span>
      </div>
    </div>
  );
}
