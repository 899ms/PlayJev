import { useState } from "react";
import { ArrowLeft, ArrowRight, Globe } from "lucide-react";
import { LOCALES, LOCALE_LABELS, PROVIDER_PRESETS, type Locale } from "@playjev/core";
import { useSettings, useT } from "@/hooks";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type OobeStep = 1 | 2 | 3;

/**
 * First-launch onboarding wizard:
 * 1. language (language-neutral screen — native labels only, so it works before any
 *    UI language is chosen), 2. Jev API, 3. LLM API. Steps 2/3 are skippable.
 * Language changes apply immediately, so the rest of the wizard renders in the
 * chosen language.
 */
export function OobeDialog() {
  const t = useT();
  const locale = useSettings((s) => s.locale);
  const settings = useSettings((s) => s);
  const [step, setStep] = useState<OobeStep>(1);

  const finish = () => settings.setOobeCompleted(true);

  return (
    <Dialog open onOpenChange={(o) => { if (!o) finish(); }}>
      <DialogContent
        className="max-w-md"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        aria-describedby={undefined}
      >
        <DialogTitle>
          {step === 1 ? (
            <span className="flex items-center gap-2">
              <Globe size={18} className="text-indigo-500" />
              <span className="sr-only">Language / 语言 / 言語</span>
            </span>
          ) : (
            t(step === 2 ? "oobe.stepJev" : "oobe.stepLlm")
          )}
        </DialogTitle>

        {/* step dots */}
        <div className="flex items-center justify-center gap-1.5" aria-hidden>
          {([1, 2, 3] as OobeStep[]).map((n) => (
            <span
              key={n}
              className={cn(
                "h-1.5 w-6 rounded-full transition-colors",
                step === n ? "bg-indigo-500" : step > n ? "bg-indigo-200" : "bg-zinc-200"
              )}
            />
          ))}
        </div>

        {step === 1 && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
              {LOCALES.map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => {
                    settings.setLocale(loc);
                    setStep(2);
                  }}
                  className={cn(
                    "rounded-lg border p-4 text-center text-base font-medium transition-colors",
                    locale === loc
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                      : "border-zinc-200 text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
                  )}
                >
                  {LOCALE_LABELS[loc]}
                </button>
              ))}
            </div>
            <p className="text-center text-xs text-zinc-400">
              简体中文 · 繁體中文 · English · 日本語
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-zinc-500">{t("oobe.apiKeyHint")}</p>
            <div className="flex flex-col gap-1">
              <Label>{t("settings.model")}</Label>
              <Input
                className="font-mono text-xs"
                list="oobe-model-suggestions"
                value={settings.jev.model}
                onChange={(e) => settings.setJev({ model: e.target.value })}
              />
              <datalist id="oobe-model-suggestions">
                <option value="jev-latest" />
                <option value="jev-preview" />
                <option value="jev-1.13.0" />
              </datalist>
            </div>
            <div className="flex flex-col gap-1">
              <Label>{t("settings.apiKey")}</Label>
              <Input
                type="password"
                placeholder="TYPESAFE_API_KEY"
                value={settings.jev.apiKey}
                onChange={(e) => settings.setJev({ apiKey: e.target.value })}
              />
            </div>
            <div className="rounded-lg bg-zinc-50 px-3 py-2 text-xs leading-relaxed text-zinc-500">
              {t("response.mockOn")}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-zinc-500">{t("oobe.stepLlmHint")}</p>
            <div className="flex flex-col gap-1">
              <Label>{t("settings.preset")}</Label>
              <Select
                value=""
                onValueChange={(id) => {
                  const preset = PROVIDER_PRESETS.find((p) => p.id === id);
                  if (preset)
                    settings.setLlm({ protocol: preset.protocol, baseUrl: preset.baseUrl, model: preset.defaultModel });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("settings.presetNone")} />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDER_PRESETS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label>{t("settings.baseUrl")}</Label>
              <Input
                className="font-mono text-xs"
                value={settings.llm.baseUrl}
                onChange={(e) => settings.setLlm({ baseUrl: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label>{t("settings.apiKey")}</Label>
              <Input
                type="password"
                value={settings.llm.apiKey}
                onChange={(e) => settings.setLlm({ apiKey: e.target.value })}
              />
            </div>
          </div>
        )}

        <div className="mt-1 flex items-center justify-between">
          {step > 1 ? (
            <Button size="sm" variant="ghost" onClick={() => setStep((s) => (s - 1) as OobeStep)}>
              <ArrowLeft size={14} /> {t("common.back")}
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={finish}>
              {t("oobe.skip")}
            </Button>
          )}
          {step < 3 ? (
            <Button size="sm" onClick={() => setStep((s) => (s + 1) as OobeStep)}>
              {step === 2 ? t("oobe.skipLater") : t("common.next")} <ArrowRight size={14} />
            </Button>
          ) : (
            <Button size="sm" onClick={finish}>
              {t("oobe.finish")} <ArrowRight size={14} />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
