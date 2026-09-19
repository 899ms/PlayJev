import type { LlmProtocol } from "../store/settingsStore";

export interface ProviderPreset {
  id: string;
  label: string;
  protocol: LlmProtocol;
  baseUrl: string;
  defaultModel: string;
}

/** OpenAI-compatible covers GLM / DeepSeek / Kimi / Qwen / OpenAI / OpenRouter / Ollama. */
export const PROVIDER_PRESETS: ProviderPreset[] = [
  { id: "custom-openai", label: "自定义 (OpenAI 兼容)", protocol: "openai", baseUrl: "https://api.openai.com/v1", defaultModel: "gpt-4o-mini" },
  { id: "custom-response", label: "自定义 (OpenAI Responses)", protocol: "response", baseUrl: "https://api.openai.com/v1", defaultModel: "gpt-4o-mini" },
  { id: "openai", label: "OpenAI", protocol: "openai", baseUrl: "https://api.openai.com/v1", defaultModel: "gpt-4o-mini" },
  { id: "glm", label: "智谱 GLM", protocol: "openai", baseUrl: "https://open.bigmodel.cn/api/paas/v4", defaultModel: "glm-4.6" },
  { id: "deepseek", label: "DeepSeek", protocol: "openai", baseUrl: "https://api.deepseek.com/v1", defaultModel: "deepseek-chat" },
  { id: "moonshot", label: "Moonshot Kimi", protocol: "openai", baseUrl: "https://api.moonshot.cn/v1", defaultModel: "kimi-k2" },
  { id: "openrouter", label: "OpenRouter", protocol: "openai", baseUrl: "https://openrouter.ai/api/v1", defaultModel: "openai/gpt-4o-mini" },
  { id: "ollama", label: "Ollama (local)", protocol: "openai", baseUrl: "http://localhost:11434/v1", defaultModel: "llama3.1" },
  { id: "anthropic", label: "Anthropic", protocol: "anthropic", baseUrl: "https://api.anthropic.com/v1", defaultModel: "claude-sonnet-4-5" },
];
