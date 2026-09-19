import { useMemo } from "react";
import type { ChoiceAnswer } from "@playjev/core";
import { useT } from "@/hooks";
import { Badge } from "@/components/ui/field";
import { CardShell, ConfidenceBadge, DebugDetails, ProbBar } from "./shared";

/**
 * Choice: winning option highlighted, every option as a probability bar
 * sorted descending — docs/jev/primitives/choice.md response shape.
 */
export function ChoiceAnswerCard({ id, answer }: { id: string; answer: ChoiceAnswer }) {
  const t = useT();
  const sorted = useMemo(
    () => Object.entries(answer.probabilities).sort((a, b) => b[1] - a[1]),
    [answer.probabilities]
  );

  return (
    <CardShell
      id={id}
      accent="bg-indigo-500"
      right={<Badge tone="indigo">{t("question.type.choice")}</Badge>}
    // confidence badge sits under the winner for stronger visual hierarchy
    >
      <div className="flex items-baseline gap-2">
        <span className="text-[11px] uppercase tracking-wide text-zinc-400">{t("choice.winner")}</span>
        <span className="text-xl font-bold text-indigo-700">{answer.choice}</span>
        <span className="ml-auto">
          <ConfidenceBadge confidence={answer.confidence} />
        </span>
      </div>

      <div className="mt-3 flex flex-col gap-1.5">
        <span className="text-[11px] uppercase tracking-wide text-zinc-400">{t("choice.probabilities")}</span>
        {sorted.map(([key, prob]) => {
          const isWinner = key === answer.choice;
          return (
            <div key={key} className="flex items-center gap-2">
              <span
                className={`w-28 shrink-0 truncate font-mono text-xs ${isWinner ? "font-bold text-emerald-700" : "text-zinc-600"}`}
                title={key}
              >
                {key}
              </span>
              <ProbBar ratio={prob} tone={isWinner ? "emerald" : "indigo"} />
              <span className="w-11 shrink-0 text-right text-xs tabular-nums text-zinc-500">
                {(prob * 100).toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>
      <DebugDetails data={answer} />
    </CardShell>
  );
}
