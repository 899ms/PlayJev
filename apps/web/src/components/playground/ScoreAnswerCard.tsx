import { useMemo } from "react";
import type { EntryValue, ScoreAnswer } from "@playjev/core";
import { useT } from "@/hooks";
import { Badge } from "@/components/ui/field";
import { CardShell, ConfidenceBadge, DebugDetails, ProbBar } from "./shared";

/**
 * Score: weighted score marker on the level scale (can land between levels)
 * plus per-level distribution — docs/jev/primitives/score.md response shape.
 */
export function ScoreAnswerCard({ id, answer }: { id: string; answer: ScoreAnswer }) {
  const t = useT();
  const levels = useMemo(() => {
    const keys = Object.keys(answer.probabilities)
      .map(Number)
      .sort((a, b) => a - b);
    return keys.map((i) => ({ index: i, description: describe(answer.legend?.[String(i)]), prob: answer.probabilities[String(i)] ?? 0 }));
  }, [answer]);

  const top = Math.max(levels.length - 1, 1);
  const markerPct = Math.min(Math.max(answer.score / top, 0), 1) * 100;

  return (
    <CardShell
      id={id}
      accent="bg-amber-500"
      right={<Badge tone="amber">{t("question.type.score")}</Badge>}
    >
      <div className="flex items-baseline gap-2">
        <span className="text-[11px] uppercase tracking-wide text-zinc-400">{t("score.scoreLabel")}</span>
        <span className="text-3xl font-bold tabular-nums text-zinc-900">{answer.score.toFixed(2)}</span>
        <span className="text-xs text-zinc-400">/ {top}</span>
        <span className="ml-auto">
          <ConfidenceBadge confidence={answer.confidence} />
        </span>
      </div>

      {/* scale with ticks and the weighted-score marker */}
      <div className="mt-4 px-1">
        <div className="relative h-2 rounded-full bg-gradient-to-r from-zinc-200 via-zinc-100 to-zinc-300">
          {levels.map((l) => (
            <span
              key={l.index}
              className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 bg-zinc-300"
              style={{ left: `${(l.index / top) * 100}%` }}
              title={`[${l.index}] ${l.description}`}
            />
          ))}
          <div
            className="absolute top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
            style={{ left: `${markerPct}%` }}
          >
            <span className="h-4 w-4 rounded-full border-2 border-amber-500 bg-white shadow" />
          </div>
        </div>
      </div>

      {/* per-level distribution */}
      <div className="mt-3 flex flex-col gap-1.5">
        {levels.map((l) => (
          <div key={l.index} className="flex items-center gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-zinc-100 font-mono text-[10px] text-zinc-500">
              {l.index}
            </span>
            <span className="w-36 shrink-0 truncate text-xs text-zinc-600" title={l.description}>
              {l.description}
            </span>
            <ProbBar ratio={l.prob} tone={l.prob > 0.5 ? "emerald" : "indigo"} />
            <span className="w-11 shrink-0 text-right text-xs tabular-nums text-zinc-500">
              {(l.prob * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
      <DebugDetails data={answer} />
    </CardShell>
  );
}

function describe(v: EntryValue | undefined): string {
  if (v == null) return "—";
  if (typeof v === "string") return v;
  return JSON.stringify(v);
}
