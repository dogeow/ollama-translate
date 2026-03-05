/**
 * 设置规范化统一模块
 * 提供设置默认值和规范化函数
 * 所有模块应从此处导入规范化函数，确保逻辑一致
 */

import {
  PROVIDER_OLLAMA,
  PROVIDER_MINIMAX,
  DEFAULT_TRANSLATE_PROVIDER,
  DEFAULT_OLLAMA_URL,
  DEFAULT_OLLAMA_MODEL,
  DEFAULT_MINIMAX_API_URL,
  DEFAULT_MINIMAX_API_KEY,
  DEFAULT_MINIMAX_MODEL,
  DEFAULT_TRANSLATE_TARGET_LANG,
  DEFAULT_AUTO_TRANSLATE_MODE,
  DEFAULT_HOVER_TRANSLATE_SCOPE,
  DEFAULT_HOVER_TRANSLATE_DELAY_MS,
  DEFAULT_LEARNING_MODE_ENABLED,
} from "./constants.js";

/**
 * 默认设置值
 */
export const DEFAULT_SETTINGS = {
  provider: DEFAULT_TRANSLATE_PROVIDER,
  ollamaUrl: DEFAULT_OLLAMA_URL,
  ollamaModel: DEFAULT_OLLAMA_MODEL,
  minimaxApiUrl: DEFAULT_MINIMAX_API_URL,
  minimaxApiKey: DEFAULT_MINIMAX_API_KEY,
  minimaxModel: DEFAULT_MINIMAX_MODEL,
  translateTargetLang: DEFAULT_TRANSLATE_TARGET_LANG,
  autoTranslateMode: DEFAULT_AUTO_TRANSLATE_MODE,
  hoverTranslateScope: DEFAULT_HOVER_TRANSLATE_SCOPE,
  hoverTranslateDelayMs: DEFAULT_HOVER_TRANSLATE_DELAY_MS,
  learningModeEnabled: DEFAULT_LEARNING_MODE_ENABLED,
};

/**
 * 规范化翻译提供商
 * @param {string} provider - 提供商
 * @returns {string} 规范化后的提供商：'ollama' | 'minimax'
 */
export function normalizeTranslateProvider(provider) {
  return provider === PROVIDER_MINIMAX ? PROVIDER_MINIMAX : PROVIDER_OLLAMA;
}

/**
 * 规范化 MiniMax API 地址
 * @param {string} value - API 地址
 * @returns {string}
 */
export function normalizeMiniMaxApiUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return DEFAULT_SETTINGS.minimaxApiUrl;
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withProtocol.replace(/\/$/, "");
}

/**
 * 规范化自动翻译模式
 * @param {string} mode - 翻译模式
 * @param {boolean} legacySelection - 兼容旧版 selection 设置
 * @returns {string} 规范化后的模式：'selection' | 'hover' | 'off'
 */
export function normalizeAutoTranslateMode(mode, legacySelection = false) {
  if (mode === "selection" || mode === "hover" || mode === "off") return mode;
  return legacySelection ? "selection" : DEFAULT_SETTINGS.autoTranslateMode;
}

/**
 * 规范化悬停翻译范围
 * @param {string} scope - 翻译范围
 * @returns {string} 规范化后的范围：'word' | 'paragraph'
 */
export function normalizeHoverTranslateScope(scope) {
  return scope === "paragraph"
    ? "paragraph"
    : DEFAULT_SETTINGS.hoverTranslateScope;
}

/**
 * 规范化悬停翻译延迟时间
 * @param {string|number} value - 延迟毫秒数
 * @returns {number} 规范化后的延迟时间（0-5000ms）
 */
export function normalizeHoverTranslateDelayMs(value) {
  if (value === "" || value == null)
    return DEFAULT_SETTINGS.hoverTranslateDelayMs;
  const number = Number(value);
  if (!Number.isFinite(number)) return DEFAULT_SETTINGS.hoverTranslateDelayMs;
  return Math.min(5000, Math.max(0, Math.round(number)));
}

/**
 * 规范化所有设置
 * @param {object} settings - 原始设置对象
 * @returns {object} 规范化后的设置对象
 */
export function normalizeAllSettings(settings) {
  return {
    ollamaProvider: normalizeTranslateProvider(settings.ollamaProvider),
    ollamaUrl: (settings.ollamaUrl || DEFAULT_SETTINGS.ollamaUrl).replace(
      /\/$/,
      "",
    ),
    ollamaModel: settings.ollamaModel || DEFAULT_SETTINGS.ollamaModel,
    minimaxApiUrl: normalizeMiniMaxApiUrl(settings.minimaxApiUrl),
    minimaxApiKey: String(
      settings.minimaxApiKey ?? DEFAULT_SETTINGS.minimaxApiKey,
    ).trim(),
    minimaxModel: settings.minimaxModel || DEFAULT_SETTINGS.minimaxModel,
    ollamaTranslateTargetLang:
      settings.ollamaTranslateTargetLang ||
      DEFAULT_SETTINGS.translateTargetLang,
    ollamaAutoTranslateMode: normalizeAutoTranslateMode(
      settings.ollamaAutoTranslateMode,
      settings.ollamaAutoTranslateSelection,
    ),
    ollamaHoverTranslateScope: normalizeHoverTranslateScope(
      settings.ollamaHoverTranslateScope,
    ),
    ollamaHoverTranslateDelayMs: normalizeHoverTranslateDelayMs(
      settings.ollamaHoverTranslateDelayMs,
    ),
    ollamaLearningModeEnabled: !!settings.ollamaLearningModeEnabled,
  };
}
