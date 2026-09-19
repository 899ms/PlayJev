import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import type { ChoiceQuestion } from "@playjev/core";
import { CHOICE_MAX_OPTIONS } from "@playjev/core";
import { useT, useActions } from "@/hooks";
import { Input, Textarea } from "@/components/ui/field";
import { IconBtn } from "./QuestionCard";

export function ChoiceCriteriaEditor({ question }: { question: ChoiceQuestion }) {
  const t = useT();
  const actions = useActions();
  const options = question.criteria.options;

  return (
    <div className="flex flex-col gap-1.5">
      {options.map((opt, i) => (
        <div key={i} className="flex items-start gap-1.5">
          <Input
            className="h-8 w-32 shrink-0 font-mono text-xs"
            placeholder={t("choice.keyPlaceholder")}
            value={opt.key}
            onChange={(e) => actions.updateChoiceOption(question.id, i, { key: e.target.value })}
          />
          <Textarea
            className="min-h-8 flex-1 py-1 text-xs"
            rows={1}
            placeholder={t("choice.descriptionPlaceholder")}
            value={typeof opt.description === "string" ? opt.description : opt.description == null ? "" : JSON.stringify(opt.description)}
            onChange={(e) => actions.updateChoiceOption(question.id, i, { description: e.target.value })}
          />
          <div className="flex shrink-0 items-center">
            <IconBtn title={t("question.moveUp")} disabled={i === 0} onClick={() => actions.moveChoiceOption(question.id, i, -1)}>
              <ArrowUp size={13} />
            </IconBtn>
            <IconBtn
              title={t("question.moveDown")}
              disabled={i === options.length - 1}
              onClick={() => actions.moveChoiceOption(question.id, i, 1)}
            >
              <ArrowDown size={13} />
            </IconBtn>
            <IconBtn title={t("question.delete")} destructive onClick={() => actions.removeChoiceOption(question.id, i)}>
              <X size={13} />
            </IconBtn>
          </div>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-500 disabled:opacity-40"
          disabled={options.length >= CHOICE_MAX_OPTIONS}
          onClick={() => actions.addChoiceOption(question.id)}
        >
          <Plus size={13} /> {t("choice.addOption")}
        </button>
        <span className="text-xs text-zinc-400">{t("choice.hint")}</span>
      </div>
    </div>
  );
}
