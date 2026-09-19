import { useCallback, useEffect, useState } from "react";
import { useStore } from "zustand";
import {
  createProjectStore,
  createSettingsStore,
  translate,
  en,
  zhCN,
  zhTW,
  ja,
  de,
  fr,
  type Locale,
  type ProjectStore,
  type SettingsState,
} from "@playjev/core";
import { webStorage } from "@/lib/adapters";

/** App-wide singleton stores (web platform adapters injected). */
export const projectStore = createProjectStore(webStorage);
export const settingsStore = createSettingsStore(webStorage);

export function useProject<T>(selector: (s: ProjectStore) => T): T {
  return useStore(projectStore, selector);
}

export function useSettings<T>(selector: (s: SettingsState) => T): T {
  return useStore(settingsStore, selector);
}

const DICTS: Record<Locale, Record<string, string>> = { "zh-CN": zhCN, "zh-TW": zhTW, en, ja, de, fr };

/** Translation hook bound to the current locale. Missing keys render as the key itself. */
export function useT() {
  const locale = useSettings((s) => s.locale);
  return useCallback(
    (key: string, params?: Record<string, string | number>) => translate(DICTS[locale] ?? {}, key, params),
    [locale]
  );
}

/** Stable access to store actions for event handlers. */
export function useActions() {
  return projectStore.getState();
}

/** True when the viewport is desktop-width (≥ lg breakpoint); drives the mobile sub-page layout. */
export function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    () => window.matchMedia("(min-width: 1024px)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return isDesktop;
}
