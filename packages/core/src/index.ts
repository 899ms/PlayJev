// types
export * from "./types/project";
export * from "./types/api";

// schema
export { entryValueSchema } from "./schema/entry";
export { jevProjectSchema, questionDefSchema, parseProjectFile } from "./schema/projectSchema";
export { serializeRequest, serializeQuestion, questionJson } from "./schema/serialize";
export { importProject } from "./schema/import";
export type { ImportResult } from "./schema/import";

// platform
export type { KeyValueStorage, Clipboard } from "./platform/types";

// stores
export {
  createProjectStore,
  createEmptyProject,
  defaultQuestion,
  uniqueId,
  slugifyId,
  viewFromState,
  SCORE_MIN_LEVELS,
  SCORE_MAX_LEVELS,
  CHOICE_MAX_OPTIONS,
} from "./store/projectStore";
export type { ProjectStore, ProjectView, ProjectData, StateMode, QuestionTab, SavedEntry, SavedRun } from "./store/projectStore";
export {
  createSettingsStore,
  DEFAULT_JEV_SETTINGS,
  DEFAULT_LLM_SETTINGS,
  DEFAULT_JEV_UPSTREAM,
  JEV_PROXY_PATH,
  LLM_PROXY_PATH,
  DEFAULT_CONFIDENCE_HIGH,
  DEFAULT_CONFIDENCE_LOW,
} from "./store/settingsStore";
export type { SettingsState, JevApiSettings, LlmApiSettings, LlmProtocol } from "./store/settingsStore";

// lint
export { lintProject, extractBacktickPaths, containsCjk, findDuplicateJsonKeys } from "./lint/rules";
export type { Issue, IssueLevel, LintContext } from "./lint/rules";

// tokens
export {
  estimateTokens,
  estimateRequestTokens,
  entryValueText,
  textOfState,
  BUDGET_TOTAL,
  BUDGET_STATE_PLUS_LONGEST,
} from "./tokens/estimate";
export type { TokenReport } from "./tokens/estimate";

// state tree
export { buildTree, collectPaths, formatBacktickPath, formatSegPath } from "./statetree/parse";
export type { TreeNode, TreeNodeKind } from "./statetree/parse";
export {
  getStateAt,
  setStateAt,
  renameStateKey,
  addStateChild,
  removeStateAt,
  moveStateAt,
  moveStateAcross,
  convertStateAt,
  convertStateRoot,
} from "./statetree/ops";
export type { PathSeg, StateValue, NodeKind, RootKind } from "./statetree/ops";

// templates
export { TEMPLATES, getTemplate } from "./templates/index";
export type { TemplateDef } from "./templates/index";

// i18n
export { translate, LOCALES, DEFAULT_LOCALE, LOCALE_LABELS } from "./i18n/core";
export type { Locale, Dictionary } from "./i18n/core";
export { zhCN } from "./i18n/locales/zh-CN";
export { en } from "./i18n/locales/en";
export { zhTW } from "./i18n/locales/zh-TW";
export { ja } from "./i18n/locales/ja";
export { de } from "./i18n/locales/de";
export { fr } from "./i18n/locales/fr";

// jev client
export { evaluate, defaultBackoffMs, errorKeyForStatus, extractServerMessage, JevApiError } from "./jev/client";
export type { JevClientConfig, EvaluateOptions } from "./jev/client";

// llm
export { PROVIDER_PRESETS } from "./llm/providers";
export type { ProviderPreset } from "./llm/providers";
export { chatComplete, extractJsonBlock, LlmError } from "./llm/client";
export type { LlmMessage, LlmClientConfig, ChatOptions } from "./llm/client";
export { buildClarifyMessages, buildDraftMessages } from "./llm/prompts";
export { generateClarify, generateDraft } from "./llm/generate";
export type { ClarifyQuestion, GenerateContext } from "./llm/generate";
