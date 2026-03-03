import {
  DEFAULT_AUTO_TRANSLATE_MODE,
  DEFAULT_HOVER_TRANSLATE_DELAY_MS,
  DEFAULT_HOVER_TRANSLATE_SCOPE,
  DEFAULT_OLLAMA_MODEL,
  DEFAULT_OLLAMA_URL,
  DEFAULT_TRANSLATE_TARGET_LANG,
  ORIGINS_PLATFORM_CONTENT,
} from "./constants.js";

export function formatModelSize(bytes) {
  if (bytes == null || bytes === 0) return "";
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(1)} KB`;
  return `${bytes} B`;
}

export function normalizeAutoTranslateMode(mode, legacySelection = false) {
  if (mode === "selection" || mode === "hover" || mode === "off") return mode;
  return legacySelection ? "selection" : DEFAULT_AUTO_TRANSLATE_MODE;
}

export function normalizeHoverTranslateScope(scope) {
  return scope === "paragraph" ? "paragraph" : DEFAULT_HOVER_TRANSLATE_SCOPE;
}

export function normalizeHoverTranslateDelayMs(value) {
  if (value === "" || value == null) return DEFAULT_HOVER_TRANSLATE_DELAY_MS;
  const number = Number(value);
  if (!Number.isFinite(number)) return DEFAULT_HOVER_TRANSLATE_DELAY_MS;
  return Math.min(5000, Math.max(0, Math.round(number)));
}

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

export async function runGenerateRequest(base, model, prompt) {
  const response = await fetch(`${base}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt, stream: false }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }
  const data = await response.json();
  return (data.response || "").trim();
}
