/**
 * 设置规范化统一模块
 * 提供设置默认值和规范化函数
 */

/**
 * 默认设置值
 */
export const DEFAULT_SETTINGS = {
  ollamaUrl: "http://127.0.0.1:11434",
  ollamaModel: "",
  translateTargetLang: "Chinese",
  autoTranslateMode: "off",
  hoverTranslateScope: "word",
  hoverTranslateDelayMs: 200,
  learningModeEnabled: false,
};

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
  return scope === "paragraph" ? "paragraph" : DEFAULT_SETTINGS.hoverTranslateScope;
}

/**
 * 规范化悬停翻译延迟时间
 * @param {string|number} value - 延迟毫秒数
 * @returns {number} 规范化后的延迟时间（0-5000ms）
 */
export function normalizeHoverTranslateDelayMs(value) {
  if (value === "" || value == null) return DEFAULT_SETTINGS.hoverTranslateDelayMs;
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
    ollamaUrl: (settings.ollamaUrl || DEFAULT_SETTINGS.ollamaUrl).replace(/\/$/, ""),
    ollamaModel: settings.ollamaModel || DEFAULT_SETTINGS.ollamaModel,
    ollamaTranslateTargetLang:
      settings.ollamaTranslateTargetLang || DEFAULT_SETTINGS.translateTargetLang,
    ollamaAutoTranslateMode: normalizeAutoTranslateMode(
      settings.ollamaAutoTranslateMode,
      settings.ollamaAutoTranslateSelection,
    ),
    ollamaHoverTranslateScope: normalizeHoverTranslateScope(settings.ollamaHoverTranslateScope),
    ollamaHoverTranslateDelayMs: normalizeHoverTranslateDelayMs(settings.ollamaHoverTranslateDelayMs),
    ollamaLearningModeEnabled: !!settings.ollamaLearningModeEnabled,
  };
}
