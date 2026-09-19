import { createStore } from "zustand/vanilla";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Locale } from "../i18n/core";
import type { KeyValueStorage } from "../platform/types";

export interface JevApiSettings {
  apiKey: string;
  endpoint: string;
  /** Model sent with every request; selected in Settings (docs/jev/models.md). */
  model: string;
  useProxy: boolean;
  proxyOrigin: string;
  /** Demo mode: return canned doc responses without calling the API. */
  mockMode: boolean;
}

export type LlmProtocol = "openai" | "response" | "anthropic";

export interface LlmApiSettings {
  protocol: LlmProtocol;
  baseUrl: string;
  apiKey: string;
  model: string;
  useProxy: boolean;
  proxyOrigin: string;
  mockMode: boolean;
}

export interface SettingsState {
  locale: Locale;
  jev: JevApiSettings;
  llm: LlmApiSettings;
  /** confidence.md three-range routing thresholds. */
  confidence: { high: number; low: number };
  /** Left sidebar expanded/collapsed. */
  sidebarCollapsed: boolean;
  /** First-launch onboarding wizard has been finished (or skipped). */
  oobeCompleted: boolean;
  setLocale(locale: Locale): void;
  setJev(patch: Partial<JevApiSettings>): void;
  setLlm(patch: Partial<LlmApiSettings>): void;
  setConfidence(patch: Partial<{ high: number; low: number }>): void;
  setSidebarCollapsed(collapsed: boolean): void;
  setOobeCompleted(done: boolean): void;
}

export const DEFAULT_JEV_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
export const DEFAULT_PROXY_ORIGIN = "http://localhost:8787";
/** docs/jev/confidence.md example thresholds. */
export const DEFAULT_CONFIDENCE_HIGH = 0.9;
export const DEFAULT_CONFIDENCE_LOW = 0.5;

export const DEFAULT_JEV_SETTINGS: JevApiSettings = {
  apiKey: "",
  endpoint: DEFAULT_JEV_ENDPOINT,
  model: "jev-latest",
  useProxy: false,
  proxyOrigin: DEFAULT_PROXY_ORIGIN,
  mockMode: false,
};

export const DEFAULT_LLM_SETTINGS: LlmApiSettings = {
  protocol: "openai",
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4o-mini",
  useProxy: false,
  proxyOrigin: DEFAULT_PROXY_ORIGIN,
  mockMode: false,
};

export function createSettingsStore(storage: KeyValueStorage) {
  return createStore<SettingsState>()(
    persist(
      (set) => ({
        locale: "zh-CN",
        jev: DEFAULT_JEV_SETTINGS,
        llm: DEFAULT_LLM_SETTINGS,
        confidence: { high: DEFAULT_CONFIDENCE_HIGH, low: DEFAULT_CONFIDENCE_LOW },
        sidebarCollapsed: false,
        oobeCompleted: false,
        setLocale: (locale) => set({ locale }),
        setJev: (patch) => set((s) => ({ jev: { ...s.jev, ...patch } })),
        setLlm: (patch) => set((s) => ({ llm: { ...s.llm, ...patch } })),
        setConfidence: (patch) => set((s) => ({ confidence: { ...s.confidence, ...patch } })),
        setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
        setOobeCompleted: (oobeCompleted) => set({ oobeCompleted }),
      }),
      {
        name: "playjev.settings.v1",
        storage: createJSONStorage(() => storage),
      }
    )
  );
}
