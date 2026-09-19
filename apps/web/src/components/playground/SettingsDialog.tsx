import { useState } from "react";
import { toast } from "sonner";
import { Download, Upload } from "lucide-react";
import { importProject, LOCALE_LABELS, PROVIDER_PRESETS, serializeRequest, type LlmProtocol, type Locale } from "@playjev/core";
import { projectStore, useSettings, useT } from "@/hooks";
import { Button } from "@/components/ui/button";
import { Input, Label, Badge } from "@/components/ui/field";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { downloadJson, pickJsonFile } from "@/lib/adapters";

type SettingsTab = "general" | "file" | "jev" | "llm";

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const [tab, setTab] = useState<SettingsTab>("jev");

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("settings.title")}</DialogTitle>
        </DialogHeader>
        <Tabs value={tab} onValueChange={(v) => setTab(v as SettingsTab)}>
          <TabsList className="w-fit">
            <TabsTrigger value="general">{t("settings.tabGeneral")}</TabsTrigger>
            <TabsTrigger value="file">{t("settings.tabFile")}</TabsTrigger>
            <TabsTrigger value="jev">{t("settings.tabJev")}</TabsTrigger>
            <TabsTrigger value="llm">{t("settings.tabLlm")}</TabsTrigger>
          </TabsList>
        </Tabs>
        {tab === "general" && <GeneralTab onClose={onClose} />}
        {tab === "file" && <FileTab />}
        {tab === "jev" && <JevTab />}
        {tab === "llm" && <LlmTab />}
        <div className="mt-4 flex justify-end">
          <Button size="sm" variant="outline" onClick={onClose}>
            {t("common.close")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FileTab() {
  const t = useT();
  const jevModel = useSettings((s) => s.jev.model);
  const store = projectStore;

  const onImport = async () => {
    const text = await pickJsonFile();
    if (!text) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      toast.error(t("import.invalid", { error: err instanceof Error ? err.message : String(err) }));
      return;
    }
    const result = importProject(parsed);
    if (result.ok) {
      store.getState().loadProject(result.project);
      toast.success(t("import.success", { name: result.project.name || "—" }));
    } else {
      toast.error(t("import.invalid", { error: result.error }));
    }
  };

  const onExport = () => {
    const project = store.getState().project;
    const filename = `${project.name ? project.name.replace(/[^\w.-]+/g, "_") : "playjev-project"}.json`;
    downloadJson(filename, { ...project, model: jevModel });
    toast.success(t("export.success"));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border border-zinc-200 p-3">
        <div className="mb-1 text-sm font-medium text-zinc-800">{t("settings.import")}</div>
        <p className="mb-2 text-xs text-zinc-400">{t("settings.importHint")}</p>
        <Button size="sm" variant="outline" onClick={onImport}>
          <Upload size={14} /> {t("settings.import")}
        </Button>
      </div>
      <div className="rounded-lg border border-zinc-200 p-3">
        <div className="mb-1 text-sm font-medium text-zinc-800">{t("settings.export")}</div>
        <p className="mb-2 text-xs text-zinc-400">{t("settings.exportHint")}</p>
        <Button size="sm" variant="outline" onClick={onExport}>
          <Download size={14} /> {t("settings.export")}
        </Button>
      </div>
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 py-1.5">
      <Label className="text-zinc-600">{label}</Label>
      {children}
      {hint && <p className="text-xs text-zinc-400">{hint}</p>}
    </div>
  );
}

function GeneralTab({ onClose }: { onClose: () => void }) {
  const t = useT();
  const settings = useSettings((s) => s);
  return (
    <div>
      <Row label={t("settings.language")}>
        <Select value={settings.locale} onValueChange={(v) => settings.setLocale(v as Locale)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(LOCALE_LABELS) as Locale[]).map((loc) => (
              <SelectItem key={loc} value={loc}>
                {LOCALE_LABELS[loc]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Row>
      <div className="mt-2 rounded-lg border border-zinc-200 p-3">
        <div className="text-xs font-semibold text-zinc-700">{t("settings.confidenceThresholds")}</div>
        <p className="mb-2 mt-0.5 text-xs text-zinc-400">{t("settings.thresholdHint")}</p>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-xs text-zinc-600">
            {t("settings.thresholdHigh")}
            <Input
              type="number"
              min={0}
              max={1}
              step={0.05}
              className="h-7 w-20"
              value={settings.confidence.high}
              onChange={(e) => settings.setConfidence({ high: Number(e.target.value) })}
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-zinc-600">
            {t("settings.thresholdLow")}
            <Input
              type="number"
              min={0}
              max={1}
              step={0.05}
              className="h-7 w-20"
              value={settings.confidence.low}
              onChange={(e) => settings.setConfidence({ low: Number(e.target.value) })}
            />
          </label>
        </div>
      </div>
  <div className="mt-2 flex items-center justify-between rounded-lg border border-zinc-200 p-3">
    <div className="min-w-0">
      <div className="text-xs font-semibold text-zinc-700">{t("oobe.title")}</div>
      <p className="text-xs text-zinc-400">{t("oobe.subtitle")}</p>
    </div>
    <Button
      size="sm"
      variant="outline"
      onClick={() => {
        settings.setOobeCompleted(false);
        onClose();
      }}
    >
      {t("oobe.rerun")}
    </Button>
  </div>
    </div>
  );
}

function JevTab() {
  const t = useT();
  const jev = useSettings((s) => s.jev);
  const setJev = useSettings((s) => s.setJev);
  return (
    <div>
      <Row label={t("settings.apiKey")} hint={t("settings.apiKeyRisk")}>
        <Input
          type="password"
          value={jev.apiKey}
          placeholder="TYPESAFE_API_KEY"
          onChange={(e) => setJev({ apiKey: e.target.value })}
        />
      </Row>
      <Row label={t("settings.endpoint")}>
        <Input className="font-mono text-xs" value={jev.endpoint} onChange={(e) => setJev({ endpoint: e.target.value })} />
      </Row>
      <Row label={t("topbar.model")} hint={t("settings.modelHint")}>
        <Input
          className="font-mono text-xs"
          list="jev-model-suggestions"
          value={jev.model}
          onChange={(e) => setJev({ model: e.target.value })}
        />
        <datalist id="jev-model-suggestions">
          <option value="jev-latest" />
          <option value="jev-preview" />
          <option value="jev-1.13.0" />
        </datalist>
      </Row>
      <ProxyRows
        useProxy={jev.useProxy}
        proxyOrigin={jev.proxyOrigin}
        onUseProxy={(v) => setJev({ useProxy: v })}
        onProxyOrigin={(v) => setJev({ proxyOrigin: v })}
      />
    </div>
  );
}

function LlmTab() {
  const t = useT();
  const llm = useSettings((s) => s.llm);
  const setLlm = useSettings((s) => s.setLlm);
  return (
    <div>
      <Row label={t("settings.protocol")}>
        <Select value={llm.protocol} onValueChange={(v) => setLlm({ protocol: v as LlmProtocol })}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="openai">{t("settings.protocol.openai")}</SelectItem>
            <SelectItem value="response">{t("settings.protocol.response")}</SelectItem>
            <SelectItem value="anthropic">{t("settings.protocol.anthropic")}</SelectItem>
          </SelectContent>
        </Select>
      </Row>
      <Row label={t("settings.preset")}>
        <Select value="" onValueChange={(id) => {
          const preset = PROVIDER_PRESETS.find((p) => p.id === id);
          if (preset) setLlm({ protocol: preset.protocol, baseUrl: preset.baseUrl, model: preset.defaultModel });
        }}>
          <SelectTrigger className="w-64">
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
      </Row>
      <Row label={t("settings.apiKey")} hint={t("settings.apiKeyRisk")}>
        <Input type="password" value={llm.apiKey} onChange={(e) => setLlm({ apiKey: e.target.value })} />
      </Row>
      <Row label={t("settings.baseUrl")}>
        <Input className="font-mono text-xs" value={llm.baseUrl} onChange={(e) => setLlm({ baseUrl: e.target.value })} />
      </Row>
      <Row label={t("settings.model")}>
        <Input className="font-mono text-xs" value={llm.model} onChange={(e) => setLlm({ model: e.target.value })} />
      </Row>
      <ProxyRows
        useProxy={llm.useProxy}
        proxyOrigin={llm.proxyOrigin}
        onUseProxy={(v) => setLlm({ useProxy: v })}
        onProxyOrigin={(v) => setLlm({ proxyOrigin: v })}
      />
    </div>
  );
}

function ProxyRows({
  useProxy,
  proxyOrigin,
  onUseProxy,
  onProxyOrigin,
}: {
  useProxy: boolean;
  proxyOrigin: string;
  onUseProxy: (v: boolean) => void;
  onProxyOrigin: (v: string) => void;
}) {
  const t = useT();
  return (
    <Row label={t("settings.useProxy")} hint={t("settings.proxyHint")}>
      <div className="flex items-center gap-3">
        <Switch checked={useProxy} onCheckedChange={onUseProxy} />
        {useProxy && (
          <Input
            className="h-7 w-56 font-mono text-xs"
            value={proxyOrigin}
            onChange={(e) => onProxyOrigin(e.target.value)}
          />
        )}
      </div>
    </Row>
  );
}
