import { useSettings, useT } from "@/hooks";
import { Badge } from "@/components/ui/field";
import { cn } from "@/lib/utils";

/** confidence.md three-range routing badge, thresholds from settings. */
export function ConfidenceBadge({ confidence }: { confidence: number }) {
  const t = useT();
  const { high, low } = useSettings((s) => s.confidence);
  const level = confidence >= high ? "high" : confidence >= low ? "medium" : "low";
  const tone = level === "high" ? "emerald" : level === "medium" ? "amber" : "red";
  return (
    <Badge tone={tone} title={t(`response.confidence.${level}Action`)}>
      {t("response.confidence")} {t(`response.confidence.${level}`)} · {Math.round(confidence * 100)}%
    </Badge>
  );
}

/** Per-card collapsed raw-JSON debug view — never visible by default. */
export function DebugDetails({ data }: { data: unknown }) {
  const t = useT();
  return (
    <details className="mt-2 border-t border-zinc-100 pt-1.5">
      <summary className="cursor-pointer select-none text-[11px] text-zinc-400 hover:text-zinc-600">
        {t("debug.rawJson")}
      </summary>
      <pre className="mt-1 overflow-x-auto rounded bg-zinc-50 p-2 font-mono text-[11px] leading-relaxed text-zinc-600">
        {JSON.stringify(data, null, 2)}
      </pre>
    </details>
  );
}

export function CardShell({
  id,
  accent,
  right,
  children,
  className,
}: {
  id: string;
  accent: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <article className={cn("flex flex-col rounded-lg border border-zinc-200 bg-white p-3 shadow-sm", className)}>
      <header className="mb-2 flex items-center gap-2">
        <span className={cn("h-2 w-2 shrink-0 rounded-full", accent)} />
        <span className="truncate font-mono text-xs font-semibold text-zinc-700">{id}</span>
        <span className="ml-auto">{right}</span>
      </header>
      {children}
    </article>
  );
}

/** Horizontal probability bar used across all card types. */
export function ProbBar({ ratio, tone = "indigo", height = "h-3" }: { ratio: number; tone?: "indigo" | "emerald" | "zinc"; height?: string }) {
  const tones = { indigo: "bg-indigo-400", emerald: "bg-emerald-500", zinc: "bg-zinc-300" };
  return (
    <div className={cn("w-full overflow-hidden rounded-full bg-zinc-100", height)}>
      <div
        className={cn("h-full rounded-full transition-all duration-500", tones[tone])}
        style={{ width: `${Math.max(Math.min(ratio, 1), 0) * 100}%` }}
      />
    </div>
  );
}
