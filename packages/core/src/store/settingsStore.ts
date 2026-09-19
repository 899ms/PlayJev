import { createStore } from "zustand/vanilla";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Locale } from "../i18n/core";
import type { KeyValueStorage } from "../platform/types";

export interface JevApiSettings {
  apiKey: string;
  /** Model sent with every request; selected in Settings (docs/jev/models.md). */
  model: string;
}

export type LlmProtocol = "openai" | "response" | "anthropic";

export interface LlmApiSettings {
  protocol: LlmProtocol;
  /** Real provider base URL. Never called directly — always via same-origin /api/llm. */
  baseUrl: string;
  apiKey: string;
  model: string;
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

/** Same-origin reverse proxy mounted by every host (Vite dev plugin, npm start,
 * nginx/docker, Cloudflare worker/functions). Bypasses TypeSafe browser CORS. */
export const JEV_PROXY_PATH = "/api/jev/systemone";
export const LLM_PROXY_PATH = "/api/llm";

export const DEFAULT_JEV_UPSTREAM = "https://api.typesafe.ai/v1/systemone";
/** docs/jev/confidence.md example thresholds. */
export const DEFAULT_CONFIDENCE_HIGH = 0.9;
export const DEFAULT_CONFIDENCE_LOW = 0.5;

export const DEFAULT_JEV_SETTINGS: JevApiSettings = {
  apiKey: "",
  model: "jev-latest",
};

export const DEFAULT_LLM_SETTINGS: LlmApiSettings = {
  protocol: "openai",
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4o-mini",
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
        // v1 carried endpoint/useProxy/proxyOrigin/mockMode — drop them, keep key/model/baseUrl.
        migrate: (restored: unknown) => {
          const s = (restored ?? {}) as Record<string, unknown>;
          const oldJev = (s.jev ?? {}) as Record<string, unknown>;
          const oldLlm = (s.llm ?? {}) as Record<string, unknown>;
          return {
            locale: (s.locale as SettingsState["locale"]) ?? "zh-CN",
            jev: {
              apiKey: (oldJev.apiKey as string) ?? "",
              model: (oldJev.model as string) ?? DEFAULT_JEV_SETTINGS.model,
            },
            llm: {
              protocol: (oldLlm.protocol as LlmApiSettings["protocol"]) ?? DEFAULT_LLM_SETTINGS.protocol,
              baseUrl: (oldLlm.baseUrl as string) ?? DEFAULT_LLM_SETTINGS.baseUrl,
              apiKey: (oldLlm.apiKey as string) ?? "",
              model: (oldLlm.model as string) ?? DEFAULT_LLM_SETTINGS.model,
            },
            confidence: (s.confidence as SettingsState["confidence"]) ?? {
              high: DEFAULT_CONFIDENCE_HIGH,
              low: DEFAULT_CONFIDENCE_LOW,
            },
            sidebarCollapsed: (s.sidebarCollapsed as boolean) ?? false,
            oobeCompleted: (s.oobeCompleted as boolean) ?? false,
          } as SettingsState;
        },
        version: 2,
      }
    )
  );
}
