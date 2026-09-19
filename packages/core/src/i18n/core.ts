/**
 * Framework-agnostic i18n: dictionaries + translate(). The React layer wraps
 * this with a hook; other platforms call translate() directly.
 */

export type Locale = "zh-CN" | "zh-TW" | "en" | "ja" | "de" | "fr";

export const LOCALES: Locale[] = ["zh-CN", "zh-TW", "en", "ja", "de", "fr"];
export const DEFAULT_LOCALE: Locale = "zh-CN";

/** Native names for the language switcher. */
export const LOCALE_LABELS: Record<Locale, string> = {
  "zh-CN": "简体中文",
  "zh-TW": "繁體中文",
  en: "English",
  ja: "日本語",
  de: "Deutsch",
  fr: "Français",
};

export type Dictionary = Record<string, string>;

export function translate(dict: Dictionary, key: string, params?: Record<string, string | number>): string {
  const template = dict[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : `{${name}}`
  );
}