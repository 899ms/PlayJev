import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { NoulQuestion } from "@playjev/core";
import { useT, useActions } from "@/hooks";
import { Input } from "@/components/ui/field";
import { cn } from "@/lib/utils";

function asText(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

export function NoulCriteriaEditor({ question }: { question: NoulQuestion }) {
  const t = useT();
  const actions = useActions();
  const [open, setOpen] = useState(false);
  const hasCriteria = question.criteria.trueDesc != null || question.criteria.falseDesc != null;

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-fit items-center gap-1 text-xs font-medium",
          hasCriteria ? "text-indigo-600" : "text-zinc-500 hover:text-zinc-700"
        )}
      >
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        {t("noul.advanced")}
      </button>
      {open && (
        <div className="flex flex-col gap-1.5 rounded-md bg-zinc-50 p-2">
          <div className="flex items-center gap-2">
            <span className="w-32 shrink-0 text-xs text-emerald-700">{t("noul.trueLabel")}</span>
            <Input
              className="h-7 text-xs"
              value={asText(question.criteria.trueDesc)}
              onChange={(e) => actions.setNoulDesc(question.id, "true", e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="w-32 shrink-0 text-xs text-red-700">{t("noul.falseLabel")}</span>
            <Input
              className="h-7 text-xs"
              value={asText(question.criteria.falseDesc)}
              onChange={(e) => actions.setNoulDesc(question.id, "false", e.target.value)}
            />
          </div>
          <p className="text-xs text-zinc-400">{t("noul.hint")}</p>
        </div>
      )}
    </div>
  );
}
