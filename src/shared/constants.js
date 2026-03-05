/**
 * 全局共享常量
 * 所有模块应从此文件导入，避免重复定义
 */

// 翻译提供商
export const PROVIDER_OLLAMA = "ollama";
export const PROVIDER_MINIMAX = "minimax";
export const DEFAULT_TRANSLATE_PROVIDER = PROVIDER_OLLAMA;

export const TRANSLATE_PROVIDER_OPTIONS = [
  { value: PROVIDER_OLLAMA, label: "Ollama（本地）" },
  { value: PROVIDER_MINIMAX, label: "MiniMax（云端）" },
];

// Ollama 连接配置
export const DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434";
export const DEFAULT_OLLAMA_MODEL = "";

// MiniMax 连接配置
export const DEFAULT_MINIMAX_API_URL = "https://api.minimaxi.com/v1";
export const DEFAULT_MINIMAX_API_KEY = "";
export const DEFAULT_MINIMAX_MODEL = "MiniMax-M2.5-highspeed";
export const MINIMAX_MODEL_OPTIONS = [DEFAULT_MINIMAX_MODEL];

// 翻译配置
export const DEFAULT_TRANSLATE_TARGET_LANG = "Chinese";
export const DEFAULT_AUTO_TRANSLATE_MODE = "off";
export const DEFAULT_HOVER_TRANSLATE_SCOPE = "word";
export const DEFAULT_HOVER_TRANSLATE_DELAY_MS = 200;

// 功能开关
export const DEFAULT_LEARNING_MODE_ENABLED = false;
export const DEFAULT_APP_ENABLED = true;

// 内部配置
export const SELECTION_AUTO_TRANSLATE_DELAY_MS = 220;
export const DEFAULT_TRANSLATE_PENDING_UPDATE_INTERVAL_MS = 80;

// 存储键名
export const TRANSLATE_RESULT_KEY = "ollamaTranslateResult";
export const SHORTCUTS_URL = "chrome://extensions/shortcuts";

export const LANG_OPTIONS = [
  { value: "Chinese", label: "中文" },
  { value: "English", label: "English" },
  { value: "Japanese", label: "日本語" },
  { value: "Korean", label: "한국어" },
  { value: "French", label: "Français" },
  { value: "German", label: "Deutsch" },
  { value: "Spanish", label: "Español" },
];

export const TARGET_LANG_LABELS = Object.fromEntries(
  LANG_OPTIONS.map((option) => [option.value, option.label]),
);
