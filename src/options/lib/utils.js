import {
  DEFAULT_OLLAMA_MODEL,
  DEFAULT_OLLAMA_URL,
  DEFAULT_TRANSLATE_TARGET_LANG,
  ORIGINS_PLATFORM_CONTENT,
} from "./constants.js";

// 从共享模块导入
import { formatModelSize } from "../../shared/model-utils.js";
import {
  normalizeAutoTranslateMode,
  normalizeHoverTranslateScope,
  normalizeHoverTranslateDelayMs,
} from "../../shared/settings.js";
import { generateCompletion } from "../../shared/ollama-api.js";

// 重新导出
export { formatModelSize };
export { normalizeAutoTranslateMode, normalizeHoverTranslateScope, normalizeHoverTranslateDelayMs };
export { generateCompletion as runGenerateRequest };

export function getSettingsSnapshot(settings) {
  const url = (settings.ollamaUrl.trim() || DEFAULT_OLLAMA_URL).replace(/\/$/, "");
  const base = url.startsWith("http") ? url : `http://${url}`;
  return {
    ollamaUrl: base,
    ollamaModel: settings.ollamaModel.trim() || DEFAULT_OLLAMA_MODEL,
    ollamaTranslateTargetLang:
      settings.ollamaTranslateTargetLang || DEFAULT_TRANSLATE_TARGET_LANG,
    ollamaAutoTranslateMode: normalizeAutoTranslateMode(
      settings.ollamaAutoTranslateMode,
    ),
    ollamaAutoTranslateSelection:
      normalizeAutoTranslateMode(settings.ollamaAutoTranslateMode) ===
      "selection",
    ollamaHoverTranslateScope: normalizeHoverTranslateScope(
      settings.ollamaHoverTranslateScope,
    ),
    ollamaHoverTranslateDelayMs: normalizeHoverTranslateDelayMs(
      settings.ollamaHoverTranslateDelayMs,
    ),
    ollamaLearningModeEnabled: !!settings.ollamaLearningModeEnabled,
  };
}

export function getConfig(settings) {
  const snapshot = getSettingsSnapshot(settings);
  return {
    base: snapshot.ollamaUrl,
    model: snapshot.ollamaModel,
  };
}

export function getStoredSettingsShape(stored) {
  return {
    ollamaUrl: stored.ollamaUrl || DEFAULT_OLLAMA_URL,
    ollamaModel: stored.ollamaModel || DEFAULT_OLLAMA_MODEL,
    ollamaTranslateTargetLang:
      stored.ollamaTranslateTargetLang || DEFAULT_TRANSLATE_TARGET_LANG,
    ollamaAutoTranslateMode: normalizeAutoTranslateMode(
      stored.ollamaAutoTranslateMode,
      stored.ollamaAutoTranslateSelection,
    ),
    ollamaHoverTranslateScope: normalizeHoverTranslateScope(
      stored.ollamaHoverTranslateScope,
    ),
    ollamaHoverTranslateDelayMs: String(
      normalizeHoverTranslateDelayMs(stored.ollamaHoverTranslateDelayMs),
    ),
    ollamaLearningModeEnabled: !!stored.ollamaLearningModeEnabled,
  };
}

export function detectPlatform() {
  const userAgent = navigator.userAgent.toLowerCase();
  const platform =
    navigator.userAgentData?.platform?.toLowerCase() ||
    (navigator.platform || "").toLowerCase();

  if (/win/.test(platform) || /win/.test(userAgent)) return "win";
  if (/linux/.test(platform) || /linux/.test(userAgent)) return "linux";
  return "macos";
}

export function getOrderedOriginsPlatforms() {
  const current = detectPlatform();
  return [
    current,
    ...Object.keys(ORIGINS_PLATFORM_CONTENT).filter((key) => key !== current),
  ];
}

export function formatShortcut(shortcut) {
  if (!shortcut) return "";
  return shortcut
    .replace(/^Alt\+/i, "Alt+")
    .replace(/^Ctrl\+/i, "Ctrl+")
    .replace(/^Command\+/i, "⌘+")
    .replace(/^MacCtrl\+/i, "Ctrl+");
}
