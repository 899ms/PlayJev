import type { NoulAnswer } from "@playjev/core";
import { useT } from "@/hooks";
import { Badge } from "@/components/ui/field";
import { CardShell, DebugDetails } from "./shared";
import { cn } from "@/lib/utils";

/**
 * Noul: big P(yes) value over a 0–1 bar with three zones
 * (strong no / uncertain / strong yes) — docs/jev/primitives/noul.md.
 */
export function NoulAnswerCard({ id, answer }: { id: string; answer: NoulAnswer }) {
  const t = useT();
  const value = answer.noul;
  const uncertain = Math.abs(value - 0.5) < 0.15;
  const zoneLabel = uncertain ? t("noul.notSure") : value >= 0.5 ? t("noul.strongYes") : t("noul.strongNo");

  return (
    <CardShell id={id} accent="bg-emerald-500" right={<Badge tone="emerald">{t("question.type.noul")}</Badge>}>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold tabular-nums text-zinc-900">{value.toFixed(2)}</span>
        <span className="text-xs text-zinc-500">{t("noul.value")}</span>
        <span className={cn("ml-auto text-xs font-medium", uncertain ? "text-amber-600" : value >= 0.5 ? "text-emerald-600" : "text-red-600")}>
          {zoneLabel}
        </span>
      </div>

      <div className="relative mt-3 h-3.5 w-full overflow-visible rounded-full bg-gradient-to-r from-red-200 via-amber-200 to-emerald-300">
        <div
          className="absolute -top-1 h-5.5 w-1.5 -translate-x-1/2 rounded-full bg-zinc-900 shadow"
          style={{ left: `${value * 100}%`, height: "1.35rem" }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-zinc-400">
        <span>0</span>
        <span className={cn(uncertain && "font-semibold text-amber-600")}>{t("noul.notSure")}</span>
        <span>1</span>
      </div>

      {uncertain && <p className="mt-1.5 text-xs text-amber-600">{t("noul.uncertain")}</p>}
      <DebugDetails data={answer} />
    </CardShell>
  );
}
