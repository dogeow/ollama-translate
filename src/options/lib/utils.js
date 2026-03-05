import {
  PROVIDER_OLLAMA,
  PROVIDER_MINIMAX,
  DEFAULT_TRANSLATE_PROVIDER,
  DEFAULT_OLLAMA_MODEL,
  DEFAULT_OLLAMA_URL,
  DEFAULT_MINIMAX_API_URL,
  DEFAULT_MINIMAX_API_KEY,
  DEFAULT_MINIMAX_MODEL,
  DEFAULT_TRANSLATE_TARGET_LANG,
  ORIGINS_PLATFORM_CONTENT,
} from "./constants.js";

// 从共享模块导入
import { formatModelSize } from "../../shared/model-utils.js";
import {
  normalizeTranslateProvider,
  normalizeMiniMaxApiUrl,
  normalizeAutoTranslateMode,
  normalizeHoverTranslateScope,
  normalizeHoverTranslateDelayMs,
} from "../../shared/settings.js";
import { generateCompletion } from "../../shared/ollama-api.js";
import { generateMiniMaxCompletion } from "../../shared/minimax-api.js";

// 重新导出
export { formatModelSize };
export {
  normalizeAutoTranslateMode,
  normalizeHoverTranslateScope,
  normalizeHoverTranslateDelayMs,
};

export function getSettingsSnapshot(settings) {
  const url = (String(settings.ollamaUrl || "").trim() || DEFAULT_OLLAMA_URL).replace(
    /\/$/,
    "",
  );
  const base = url.startsWith("http") ? url : `http://${url}`;
  const provider = normalizeTranslateProvider(
    settings.ollamaProvider || DEFAULT_TRANSLATE_PROVIDER,
  );

  return {
    ollamaProvider: provider,
    ollamaUrl: base,
    ollamaModel: String(settings.ollamaModel || "").trim() || DEFAULT_OLLAMA_MODEL,
    minimaxApiUrl: normalizeMiniMaxApiUrl(settings.minimaxApiUrl),
    minimaxApiKey: String(
      settings.minimaxApiKey ?? DEFAULT_MINIMAX_API_KEY,
    ).trim(),
    minimaxModel:
      String(settings.minimaxModel || "").trim() || DEFAULT_MINIMAX_MODEL,
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
  if (snapshot.ollamaProvider === PROVIDER_MINIMAX) {
    return {
      provider: PROVIDER_MINIMAX,
      base: snapshot.minimaxApiUrl,
      model: snapshot.minimaxModel,
      apiKey: snapshot.minimaxApiKey,
    };
  }

  return {
    provider: PROVIDER_OLLAMA,
    base: snapshot.ollamaUrl,
    model: snapshot.ollamaModel,
    apiKey: "",
  };
}

export function getStoredSettingsShape(stored) {
  return {
    ollamaProvider: normalizeTranslateProvider(
      stored.ollamaProvider || DEFAULT_TRANSLATE_PROVIDER,
    ),
    ollamaUrl: stored.ollamaUrl || DEFAULT_OLLAMA_URL,
    ollamaModel: stored.ollamaModel || DEFAULT_OLLAMA_MODEL,
    minimaxApiUrl: normalizeMiniMaxApiUrl(
      stored.minimaxApiUrl || DEFAULT_MINIMAX_API_URL,
    ),
    minimaxApiKey: String(
      stored.minimaxApiKey ?? DEFAULT_MINIMAX_API_KEY,
    ).trim(),
    minimaxModel: stored.minimaxModel || DEFAULT_MINIMAX_MODEL,
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

export function runGenerateRequest(config, prompt) {
  if (config.provider === PROVIDER_MINIMAX) {
    return generateMiniMaxCompletion(
      config.base,
      config.apiKey,
      config.model,
      prompt,
    );
  }
  return generateCompletion(config.base, config.model, prompt);
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
