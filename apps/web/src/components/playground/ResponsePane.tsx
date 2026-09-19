import { useState } from "react";
import { Send, X } from "lucide-react";
import { toast } from "sonner";
import {
  evaluate,
  errorKeyForStatus,
  extractServerMessage,
  JevApiError,
  JEV_PROXY_PATH,
  serializeRequest,
  type JevResponse,
} from "@playjev/core";
import { projectStore, useProject, useSettings, useT } from "@/hooks";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/field";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChoiceAnswerCard } from "./ChoiceAnswerCard";
import { NoulAnswerCard } from "./NoulAnswerCard";
import { ScoreAnswerCard } from "./ScoreAnswerCard";
import { cn } from "@/lib/utils";

type SendPhase = { status: "idle" } | { status: "loading" } | { status: "error"; message: string };

type ResultTab = "cards" | "json";

/**
 * Right column: send the request and show the result either as visual answer
 * cards or as raw response JSON — never bare JSON by default. The last run is
 * kept in the store so it persists and can be saved with the project.
 */
export function ResponsePane({ className }: { className?: string }) {
  const t = useT();
  const project = useProject((s) => s.project);
  const jev = useSettings((s) => s.jev);
  const lastRun = useProject((s) => s.lastRun);
  const [tab, setTab] = useState<ResultTab>("cards");
  const [phase, setPhase] = useState<SendPhase>({ status: "idle" });

  const sendRequest = async () => {
    if (!jev.apiKey) {
      setPhase({
        status: "error",
        message: t("error.missingKey"),
      });
      return;
    }
    const request = { ...serializeRequest(project), model: jev.model };
    setPhase({ status: "loading" });
    const started = performance.now();
    try {
      const response = await evaluate(
        { endpoint: JEV_PROXY_PATH, apiKey: jev.apiKey, baseUrl: jev.baseUrl },
        request,
        {
          onRetry: (attempt, delayMs) =>
            toast.message(t("response.sending"), {
              description: t("response.retrying", { attempt, ms: Math.round(delayMs) }),
            }),
        }
      );
      const elapsedMs = Math.round(performance.now() - started);
      projectStore.getState().setLastRun({ request, response, elapsedMs });
      setPhase({ status: "idle" });
      toast.success(t("toast.sent"));
    } catch (err) {
      setPhase({ status: "error", message: humanizeError(err, t) });
    }
  };

  return (
    <section className={cn("flex flex-col overflow-hidden", className)}>
      <header className="flex flex-wrap items-center gap-2 border-b border-zinc-200 px-3 py-2">
        <h2 className="text-sm font-semibold text-zinc-800">{t("result.title")}</h2>
        <Tabs value={tab} onValueChange={(v) => setTab(v as ResultTab)}>
          <TabsList>
            <TabsTrigger value="cards">{t("result.tabCards")}</TabsTrigger>
            <TabsTrigger value="json">{t("result.tabJson")}</TabsTrigger>
          </TabsList>
        </Tabs>
        {lastRun && (
          <span className="hidden text-xs text-zinc-400 xl:inline">
            {t("response.elapsed", { ms: lastRun.elapsedMs })} ·{" "}
            {t("response.usage", {
              input: lastRun.response.usage?.input_tokens ?? "—",
              output: lastRun.response.usage?.output_tokens ?? "—",
            })}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <Button size="sm" onClick={sendRequest} disabled={phase.status === "loading"}>
            <Send size={13} /> {phase.status === "loading" ? t("response.sending") : t("response.send")}
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {phase.status === "error" && (
          <div className="mx-auto mt-6 max-w-xl rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-red-700">
              <X size={15} /> {t("response.errorTitle")}
            </div>
            <p className="mt-1 text-sm text-red-600">{phase.message}</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={sendRequest}>
              {t("common.retry")}
            </Button>
          </div>
        )}
        {phase.status === "loading" && (
          <div className="flex h-full items-center justify-center text-sm text-zinc-400">{t("response.sending")}</div>
        )}
        {phase.status === "idle" && !lastRun && (
          <div className="flex h-full flex-col items-center justify-center gap-1.5 text-center">
            <p className="text-sm text-zinc-400">{t("response.empty")}</p>
          </div>
        )}
        {phase.status === "idle" && lastRun && tab === "json" && (
          <pre className="whitespace-pre-wrap break-all font-mono text-xs leading-relaxed text-zinc-700">
            {JSON.stringify(lastRun.response, null, 2)}
          </pre>
        )}
        {phase.status === "idle" && lastRun && tab === "cards" && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
              <Badge tone="zinc">
                {t("response.model")}: {lastRun.response.model}
              </Badge>
              <Badge tone="zinc">
                {t("response.usage", {
                  input: lastRun.response.usage?.input_tokens ?? "—",
                  output: lastRun.response.usage?.output_tokens ?? "—",
                })}
              </Badge>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {Object.keys(lastRun.request.questions).map((id) => {
                const answer = lastRun.response.answers[id];
                if (!answer) return null;
                if (answer.type === "choice") return <ChoiceAnswerCard key={id} id={id} answer={answer} />;
                if (answer.type === "score") return <ScoreAnswerCard key={id} id={id} answer={answer} />;
                return <NoulAnswerCard key={id} id={id} answer={answer} />;
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function humanizeError(err: unknown, t: (key: string, params?: Record<string, string | number>) => string): string {
  if (err instanceof JevApiError) {
    return t(errorKeyForStatus(err.status), { message: extractServerMessage(err.body) });
  }
  if (err instanceof TypeError) return t("error.network");
  return err instanceof Error ? err.message : String(err);
}
