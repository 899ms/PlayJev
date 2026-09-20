import { useProject, useT } from "@/hooks";
import { StatePane } from "@/components/state/StatePane";
import { QuestionSection } from "@/components/questions/QuestionList";
import { cn } from "@/lib/utils";

/**
 * Left column: request builder containing the State pane (text/tree/JSON)
 * and the Question section (builder/JSON).
 */
export function RequestEditorPane({ className }: { className?: string }) {
  return (
    <section className={cn("flex flex-col overflow-hidden", className)}>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
        <StatePane className="shrink-0 rounded-lg border border-zinc-100 p-3" />
        <QuestionSection className="min-h-64" />
      </div>
    </section>
  );
}
