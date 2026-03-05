import {
  checkOllamaAndGetModels,
  generateOllamaResponse,
  generateOllamaStreamingResponse,
} from "./background/ollama.js";
import {
  analyzeSentenceStudy,
  hydrateSentenceStudyTranslations,
} from "./background/sentenceStudy.js";
import {
  compareExtensionVersions,
  createDefaultUpdateState,
  readUpdateFeed,
  UPDATE_CHECK_ALARM_NAME,
  UPDATE_CHECK_PERIOD_MINUTES,
  UPDATE_MANIFEST_URL,
  UPDATE_STATE_KEY,
} from "./shared/update.js";
import {
  normalizeAutoTranslateMode,
  getMiniMaxApiKeyLabel,
  normalizeHoverTranslateScope,
  normalizePageTranslateBatchSize,
  resolveMiniMaxApiKey,
  normalizeTranslateProvider,
} from "./shared/settings.js";
import {
  PROVIDER_OLLAMA,
  PROVIDER_MINIMAX,
  DEFAULT_TRANSLATE_PROVIDER,
  DEFAULT_OLLAMA_URL,
  DEFAULT_OLLAMA_MODEL,
  DEFAULT_MINIMAX_API_URL,
  DEFAULT_MINIMAX_API_KEY,
  DEFAULT_MINIMAX_API_KEY_CN,
  DEFAULT_MINIMAX_API_KEY_GLOBAL,
  DEFAULT_MINIMAX_REGION,
  DEFAULT_MINIMAX_MODEL,
  DEFAULT_TRANSLATE_TARGET_LANG,
  DEFAULT_PAGE_TRANSLATE_CONCURRENCY,
  DEFAULT_PAGE_TRANSLATE_BATCH_SIZE,
  DEFAULT_LEARNING_MODE_ENABLED,
  DEFAULT_APP_ENABLED,
  TRANSLATE_RESULT_KEY,
} from "./shared/constants.js";
import { getOllamaErrorMessage } from "./shared/ollama-errors.js";
import {
  generateMiniMaxCompletion,
  generateMiniMaxStreamingCompletion,
  normalizeMiniMaxBaseUrl,
} from "./shared/minimax-api.js";

const LOG_PREFIX = "[Ollama 翻译]";
const MENU_TRANSLATE_SELECTION = "ollama-translate";
const MENU_TRANSLATE_PAGE = "ollama-translate-page";
const MENU_OPEN_OPTIONS = "ollama-open-options";
const MENU_AUTO_MODE_PARENT = "ollama-auto-translate-mode";
const MENU_AUTO_MODE_OFF = "ollama-auto-translate-mode-off";
const MENU_AUTO_MODE_SELECTION = "ollama-auto-translate-mode-selection";
const MENU_AUTO_MODE_HOVER = "ollama-auto-translate-mode-hover";
const MENU_HOVER_SCOPE_PARENT = "ollama-hover-translate-scope";
const MENU_HOVER_SCOPE_WORD = "ollama-hover-translate-scope-word";
const MENU_HOVER_SCOPE_PARAGRAPH = "ollama-hover-translate-scope-paragraph";
const THINK_BLOCK_RE = /<think\b[^>]*>([\s\S]*?)<\/think>/gi;
const THINK_OPEN_TAG_RE = /<think\b[^>]*>/i;
const THINK_ANY_TAG_RE = /<\/?think\b[^>]*>/i;
const RATE_LIMIT_ERROR_RE = /(?:\b429\b|rate[ -]?limit|too many requests|usage limit|quota)/i;
const MIN_THINK_PREVIEW_MS = 320;

function normalizeDisplayText(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitThinkingFromText(text) {
  const raw = String(text || "");
  if (!raw) return { translation: "", thinking: "" };

  const thinkParts = [];
  let stripped = raw.replace(THINK_BLOCK_RE, (_, inner = "") => {
    const cleaned = normalizeDisplayText(inner);
    if (cleaned) thinkParts.push(cleaned);
    return "\n";
  });

  const danglingMatch = THINK_OPEN_TAG_RE.exec(stripped);
  if (danglingMatch) {
    const dangling = normalizeDisplayText(
      stripped.slice(danglingMatch.index).replace(THINK_OPEN_TAG_RE, ""),
    );
    if (dangling) thinkParts.push(dangling);
    stripped = stripped.slice(0, danglingMatch.index);
  }

  return {
    translation: normalizeDisplayText(stripped),
    thinking: normalizeDisplayText(thinkParts.join("\n\n")),
  };
}

function mergeThinking(...segments) {
  const uniqueSegments = [];
  segments.forEach((segment) => {
    const value = normalizeDisplayText(segment);
    if (!value) return;
    if (uniqueSegments.includes(value)) return;
    uniqueSegments.push(value);
  });

  return uniqueSegments.join("\n\n");
}

function buildTranslatePrompt(text, targetLang) {
  return `Translate the following text to ${targetLang}. Only output the translation, no explanation or extra text.\n\n${text}`;
}

function buildPageBatchTranslatePrompt(texts, targetLang) {
  return [
    `Translate each item in the JSON array to ${targetLang}.`,
    "Rules:",
    "1. Keep the same order and item count.",
    "2. Return ONLY a valid JSON array of strings.",
    "3. Do not include markdown, comments, or extra fields.",
    "4. Preserve placeholders, numbers, and URLs.",
    "",
    "Input JSON:",
    JSON.stringify(texts),
  ].join("\n");
}

function extractDisplayTranslation(rawText) {
  const raw = String(rawText ?? "");
  if (!raw.trim()) return "";

  const parsed = splitThinkingFromText(raw);
  const cleaned = normalizeDisplayText(parsed.translation);
  if (cleaned) return cleaned;

  if (THINK_ANY_TAG_RE.test(raw)) {
    // 包含 think 标签但无有效译文时，宁可返回空，避免把思考内容写回页面
    return "";
  }

  return normalizeDisplayText(raw);
}

function normalizeBatchTranslationItem(item) {
  if (typeof item === "string") {
    return extractDisplayTranslation(item);
  }
  if (item && typeof item === "object") {
    const text = String(
      item.translation || item.translated || item.text || "",
    ).trim();
    if (!text) return "";
    return extractDisplayTranslation(text);
  }
  return "";
}

function extractFirstJsonArrayString(rawText) {
  const source = String(rawText || "");
  if (!source) return "";

  let inString = false;
  let escaped = false;
  let depth = 0;
  let start = -1;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "[") {
      if (depth === 0) start = i;
      depth += 1;
      continue;
    }

    if (char === "]" && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        return source.slice(start, i + 1);
      }
    }
  }

  return "";
}

function isRateLimitError(errorMessage) {
  return RATE_LIMIT_ERROR_RE.test(String(errorMessage || ""));
}

function parsePageBatchTranslations(rawText, expectedCount) {
  const raw = String(rawText || "").trim();
  if (!raw || expectedCount <= 0) return [];

  const strippedFence = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const jsonCandidates = [
    raw,
    strippedFence,
    extractFirstJsonArrayString(raw),
    extractFirstJsonArrayString(strippedFence),
  ].filter(Boolean);

  for (const candidate of jsonCandidates) {
    if (!candidate) continue;
    try {
      const payload = JSON.parse(candidate);
      const list = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.translations)
          ? payload.translations
          : [];
      if (!Array.isArray(list) || list.length === 0) continue;

      const normalized = list
        .slice(0, expectedCount)
        .map(normalizeBatchTranslationItem);
      if (normalized.length === expectedCount && normalized.every(Boolean)) {
        return normalized;
      }
    } catch (_) {}
  }

  return [];
}

async function sendTranslatePending(tabId, payload) {
  if (!tabId) return;
  await chrome.tabs
    .sendMessage(tabId, {
      action: "showTranslatePending",
      ...payload,
    })
    .catch(() => {});
}

function buildPendingTranslatePayload({
  text,
  targetLang,
  model,
  learningModeEnabled,
  requestId,
  triggerSource,
  translation = null,
  thinking = null,
  sentenceStudyThinking = null,
  sentenceStudyPending = false,
}) {
  return {
    original: text,
    targetLang,
    model,
    learningModeEnabled,
    requestId,
    triggerSource,
    translation,
    thinking,
    sentenceStudyThinking,
    sentenceStudyPending,
  };
}

async function sendTranslateResult(
  tabId,
  payload,
  action = "showTranslateResult",
) {
  if (!tabId) return;
  await chrome.tabs
    .sendMessage(tabId, {
      action,
      ...payload,
    })
    .catch(() => {});
}

async function persistTranslateResult(result) {
  await chrome.storage.local.set({
    [TRANSLATE_RESULT_KEY]: result,
  });
}

async function readMenuSettings() {
  const stored = await chrome.storage.sync.get({
    ollamaAutoTranslateMode: "off",
    ollamaAutoTranslateSelection: false,
    ollamaHoverTranslateScope: "word",
    ollamaAppEnabled: DEFAULT_APP_ENABLED,
  });

  return {
    autoTranslateMode: normalizeAutoTranslateMode(
      stored.ollamaAutoTranslateMode,
      stored.ollamaAutoTranslateSelection,
    ),
    hoverTranslateScope: normalizeHoverTranslateScope(
      stored.ollamaHoverTranslateScope,
    ),
    appEnabled: stored.ollamaAppEnabled,
  };
}

async function createContextMenus() {
  const { autoTranslateMode, hoverTranslateScope } = await readMenuSettings();

  await chrome.contextMenus.removeAll();

  chrome.contextMenus.create({
    id: MENU_TRANSLATE_SELECTION,
    title: "Ollama 翻译选中内容",
    contexts: ["selection"],
  });

  chrome.contextMenus.create({
    id: MENU_TRANSLATE_PAGE,
    title: "Ollama 翻译整个网页（可视区域优先）",
    contexts: ["page"],
  });

  chrome.contextMenus.create({
    id: MENU_OPEN_OPTIONS,
    title: "打开设置",
    contexts: ["action"],
  });

  chrome.contextMenus.create({
    id: MENU_AUTO_MODE_PARENT,
    title: "自动翻译模式",
    contexts: ["action"],
  });

  chrome.contextMenus.create({
    id: MENU_AUTO_MODE_OFF,
    parentId: MENU_AUTO_MODE_PARENT,
    title: "关闭自动翻译",
    type: "radio",
    checked: autoTranslateMode === "off",
    contexts: ["action"],
  });

  chrome.contextMenus.create({
    id: MENU_AUTO_MODE_SELECTION,
    parentId: MENU_AUTO_MODE_PARENT,
    title: "双击 / 三击后翻译",
    type: "radio",
    checked: autoTranslateMode === "selection",
    contexts: ["action"],
  });

  chrome.contextMenus.create({
    id: MENU_AUTO_MODE_HOVER,
    parentId: MENU_AUTO_MODE_PARENT,
    title: "悬停自动翻译",
    type: "radio",
    checked: autoTranslateMode === "hover",
    contexts: ["action"],
  });

  chrome.contextMenus.create({
    id: MENU_HOVER_SCOPE_PARENT,
    title: "悬停取词范围",
    contexts: ["action"],
  });

  chrome.contextMenus.create({
    id: MENU_HOVER_SCOPE_WORD,
    parentId: MENU_HOVER_SCOPE_PARENT,
    title: "只翻译单词",
    type: "radio",
    checked: hoverTranslateScope === "word",
    contexts: ["action"],
  });

  chrome.contextMenus.create({
    id: MENU_HOVER_SCOPE_PARAGRAPH,
    parentId: MENU_HOVER_SCOPE_PARENT,
    title: "翻译整段话",
    type: "radio",
    checked: hoverTranslateScope === "paragraph",
    contexts: ["action"],
  });
}

async function persistUpdateState(partialState) {
  const currentVersion = chrome.runtime.getManifest().version;
  const nextState = {
    ...createDefaultUpdateState(currentVersion),
    ...partialState,
    currentVersion,
  };

  await chrome.storage.local.set({
    [UPDATE_STATE_KEY]: nextState,
  });
  await updateActionBadge(nextState);

  return nextState;
}

async function readStoredUpdateState() {
  const stored = await chrome.storage.local.get(UPDATE_STATE_KEY);
  return {
    ...createDefaultUpdateState(chrome.runtime.getManifest().version),
    ...(stored[UPDATE_STATE_KEY] || {}),
  };
}

async function updateActionBadge(updateState) {
  if (!chrome.action?.setBadgeText) return;

  if (updateState.status === "available") {
    await chrome.action.setBadgeText({ text: "UP" }).catch(() => {});
    await chrome.action
      .setBadgeBackgroundColor({ color: "#dc2626" })
      .catch(() => {});
    await chrome.action
      .setTitle({
        title:
          `Ollama 翻译快捷面板\n发现新版本 ${updateState.latestVersion || ""}`.trim(),
      })
      .catch(() => {});
    return;
  }

  await chrome.action.setBadgeText({ text: "" }).catch(() => {});
  await chrome.action
    .setTitle({
      title: "Ollama 翻译快捷面板",
    })
    .catch(() => {});
}

async function ensureUpdateCheckAlarm() {
  if (!chrome.alarms) return;

  await chrome.alarms.clear(UPDATE_CHECK_ALARM_NAME);

  if (!UPDATE_MANIFEST_URL) {
    return;
  }

  await chrome.alarms.create(UPDATE_CHECK_ALARM_NAME, {
    delayInMinutes: 1,
    periodInMinutes: UPDATE_CHECK_PERIOD_MINUTES,
  });
}

async function checkForExtensionUpdate(options = {}) {
  const { markChecking = false } = options;
  const currentVersion = chrome.runtime.getManifest().version;
  const manifestUrl = UPDATE_MANIFEST_URL;

  if (!manifestUrl) {
    return persistUpdateState({
      status: "error",
      manifestUrl,
      checkedAt: 0,
      latestVersion: "",
      updateUrl: "",
      notes: "",
      error: "",
    });
  }

  if (markChecking) {
    await persistUpdateState({
      status: "checking",
      manifestUrl,
      checkedAt: Date.now(),
      latestVersion: "",
      updateUrl: "",
      notes: "",
      error: "",
    });
  }

  try {
    const response = await fetch(manifestUrl, {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = readUpdateFeed(await response.json());
    const comparison = compareExtensionVersions(
      payload.version,
      currentVersion,
    );

    return persistUpdateState({
      status: comparison > 0 ? "available" : "up-to-date",
      manifestUrl,
      latestVersion: payload.version,
      updateUrl: payload.updateUrl,
      notes: payload.notes,
      checkedAt: Date.now(),
      error: "",
    });
  } catch (error) {
    return persistUpdateState({
      status: "error",
      manifestUrl,
      latestVersion: "",
      updateUrl: "",
      notes: "",
      checkedAt: Date.now(),
      error: error.message || String(error),
    });
  }
}

function createTranslateRequestId(requestId) {
  if (requestId) return requestId;
  return `translate:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 构建翻译错误结果
 */
function buildErrorResult({
  original,
  targetLang,
  error,
  model = null,
  models = null,
  needModel = false,
  learningModeEnabled,
  requestId,
  triggerSource,
}) {
  return {
    original,
    translation: null,
    error,
    targetLang,
    model,
    ...(models && { models }),
    needModel,
    learningModeEnabled,
    sentenceStudy: null,
    sentenceStudyThinking: null,
    sentenceStudyPending: false,
    requestId,
    triggerSource,
  };
}

async function runProviderCompletion({
  provider,
  base,
  model,
  apiKey,
  prompt,
}) {
  if (provider === PROVIDER_MINIMAX) {
    return generateMiniMaxCompletion(base, apiKey, model, prompt);
  }
  return generateOllamaResponse(base, model, prompt);
}

function toProviderError(provider, error) {
  if (provider === PROVIDER_MINIMAX) {
    return error?.message || String(error);
  }
  return getOllamaErrorMessage(error, { detailed: true });
}

async function translatePageBatchWithProvider(texts) {
  const settings = await chrome.storage.sync.get({
    ollamaProvider: DEFAULT_TRANSLATE_PROVIDER,
    ollamaUrl: DEFAULT_OLLAMA_URL,
    ollamaModel: DEFAULT_OLLAMA_MODEL,
    minimaxApiUrl: DEFAULT_MINIMAX_API_URL,
    minimaxRegion: DEFAULT_MINIMAX_REGION,
    minimaxApiKey: DEFAULT_MINIMAX_API_KEY,
    minimaxApiKeyCn: DEFAULT_MINIMAX_API_KEY_CN,
    minimaxApiKeyGlobal: DEFAULT_MINIMAX_API_KEY_GLOBAL,
    minimaxModel: DEFAULT_MINIMAX_MODEL,
    ollamaTranslateTargetLang: DEFAULT_TRANSLATE_TARGET_LANG,
    ollamaAppEnabled: DEFAULT_APP_ENABLED,
    ollamaPageTranslateBatchSize: DEFAULT_PAGE_TRANSLATE_BATCH_SIZE,
    ollamaPageTranslateConcurrency: DEFAULT_PAGE_TRANSLATE_CONCURRENCY,
  });

  const maxBatchSize = normalizePageTranslateBatchSize(
    settings.ollamaPageTranslateBatchSize,
  );
  const normalizedTexts = Array.isArray(texts)
    ? texts
        .map((text) => String(text || "").trim())
        .filter(Boolean)
        .slice(0, maxBatchSize)
    : [];
  if (normalizedTexts.length === 0) {
    return { ok: false, error: "empty_texts" };
  }

  if (!settings.ollamaAppEnabled) {
    return { ok: false, disabled: true };
  }

  const provider = normalizeTranslateProvider(settings.ollamaProvider);
  const targetLang =
    settings.ollamaTranslateTargetLang || DEFAULT_TRANSLATE_TARGET_LANG;
  const selectedModel =
    provider === PROVIDER_MINIMAX
      ? settings.minimaxModel || DEFAULT_MINIMAX_MODEL
      : settings.ollamaModel;
  const base =
    provider === PROVIDER_MINIMAX
      ? normalizeMiniMaxBaseUrl(settings.minimaxApiUrl)
      : String(settings.ollamaUrl || DEFAULT_OLLAMA_URL).replace(/\/$/, "");
  const minimaxApiKey = resolveMiniMaxApiKey(settings);
  const apiKey = provider === PROVIDER_MINIMAX ? minimaxApiKey : "";

  if (provider === PROVIDER_OLLAMA && !selectedModel) {
    const check = await checkOllamaAndGetModels(settings.ollamaUrl);
    return {
      ok: false,
      needModel: true,
      models: check.models || [],
      error: check.error
        ? check.error === "403"
          ? "403"
          : "connection"
        : "no_model",
    };
  }

  if (provider === PROVIDER_MINIMAX && !apiKey) {
    return {
      ok: false,
      needModel: false,
      error: `请先填写${getMiniMaxApiKeyLabel(settings)}。`,
    };
  }

  const batchPrompt = buildPageBatchTranslatePrompt(normalizedTexts, targetLang);
  let translations = [];
  let errorMessage = "";

  try {
    const batchRaw = await runProviderCompletion({
      provider,
      base,
      model: selectedModel,
      apiKey,
      prompt: batchPrompt,
    });
    translations = parsePageBatchTranslations(batchRaw, normalizedTexts.length);
  } catch (error) {
    errorMessage = toProviderError(provider, error);
  }

  if (translations.length !== normalizedTexts.length || !translations.every(Boolean)) {
    return {
      ok: false,
      needModel: false,
      rateLimited: isRateLimitError(errorMessage),
      error: errorMessage || "批量翻译结果解析失败。",
    };
  }

  return { ok: true, translations };
}

async function translateWithProvider(text, tabId = null, options = {}) {
  const settings = await chrome.storage.sync.get({
    ollamaProvider: DEFAULT_TRANSLATE_PROVIDER,
    ollamaUrl: DEFAULT_OLLAMA_URL,
    ollamaModel: DEFAULT_OLLAMA_MODEL,
    minimaxApiUrl: DEFAULT_MINIMAX_API_URL,
    minimaxRegion: DEFAULT_MINIMAX_REGION,
    minimaxApiKey: DEFAULT_MINIMAX_API_KEY,
    minimaxApiKeyCn: DEFAULT_MINIMAX_API_KEY_CN,
    minimaxApiKeyGlobal: DEFAULT_MINIMAX_API_KEY_GLOBAL,
    minimaxModel: DEFAULT_MINIMAX_MODEL,
    ollamaTranslateTargetLang: DEFAULT_TRANSLATE_TARGET_LANG,
    ollamaLearningModeEnabled: DEFAULT_LEARNING_MODE_ENABLED,
    ollamaAppEnabled: DEFAULT_APP_ENABLED,
  });

  const {
    showPending = false,
    requestId = undefined,
    triggerSource = undefined,
    persistResult = true,
    learningModeOverride = null,
  } = options;
  const resolvedRequestId = createTranslateRequestId(requestId);
  const provider = normalizeTranslateProvider(settings.ollamaProvider);
  const selectedModel =
    provider === PROVIDER_MINIMAX
      ? settings.minimaxModel || DEFAULT_MINIMAX_MODEL
      : settings.ollamaModel;
  const targetLang =
    settings.ollamaTranslateTargetLang || DEFAULT_TRANSLATE_TARGET_LANG;
  const learningModeEnabled =
    typeof learningModeOverride === "boolean"
      ? learningModeOverride
      : !!settings.ollamaLearningModeEnabled;
  const minimaxApiKey = resolveMiniMaxApiKey(settings);

  if (!settings.ollamaAppEnabled) {
    console.log(
      LOG_PREFIX,
      "应用已禁用，静默忽略翻译请求:",
      text.substring(0, 30),
    );
    return null;
  }

  if (showPending && tabId) {
    await sendTranslatePending(
      tabId,
      buildPendingTranslatePayload({
        text,
        targetLang,
        model: selectedModel || null,
        learningModeEnabled,
        requestId: resolvedRequestId,
        triggerSource,
      }),
    );
  }

  if (provider === PROVIDER_OLLAMA && !selectedModel) {
    const check = await checkOllamaAndGetModels(settings.ollamaUrl);
    const errorResult = buildErrorResult({
      original: text,
      targetLang,
      error: check.error
        ? check.error === "403"
          ? "403"
          : "connection"
        : "no_model",
      models: check.models,
      needModel: true,
      learningModeEnabled,
      requestId: resolvedRequestId,
      triggerSource,
    });
    if (persistResult) {
      await persistTranslateResult(errorResult);
    }
    return errorResult;
  }

  if (provider === PROVIDER_MINIMAX && !minimaxApiKey) {
    const errorResult = buildErrorResult({
      original: text,
      targetLang,
      error: `请先填写${getMiniMaxApiKeyLabel(settings)}。`,
      model: selectedModel || null,
      needModel: false,
      learningModeEnabled,
      requestId: resolvedRequestId,
      triggerSource,
    });
    if (persistResult) {
      await persistTranslateResult(errorResult);
    }
    return errorResult;
  }

  const base =
    provider === PROVIDER_MINIMAX
      ? normalizeMiniMaxBaseUrl(settings.minimaxApiUrl)
      : settings.ollamaUrl.replace(/\/$/, "");
  const prompt = buildTranslatePrompt(text, targetLang);

  let translation = "";
  let thinking = "";
  let error = null;
  let hasSentThinkingPreview = false;
  let latestSentenceStudyThinking = "";
  let firstSentenceStudyThinkingAt = 0;
  let hasFinalTranslateResult = false;
  let latestTranslateResult = null;
  let stopPendingUpdates = false;
  const MIN_SENTENCE_STUDY_THINK_PREVIEW_MS = 260;
  const sentenceStudyApiKey =
    provider === PROVIDER_MINIMAX ? minimaxApiKey : "";
  let sentenceStudyPromise = null;

  async function sendPendingProgress(force = false) {
    if (!showPending || !tabId) return;
    if (stopPendingUpdates) return;

    const now = Date.now();
    if (!force && now - sendPendingProgress.lastUpdateAt < 80) return;

    sendPendingProgress.lastUpdateAt = now;
    await sendTranslatePending(
      tabId,
      buildPendingTranslatePayload({
        text,
        targetLang,
        model: selectedModel,
        learningModeEnabled,
        requestId: resolvedRequestId,
        triggerSource,
        translation: translation || null,
        thinking: thinking || null,
        sentenceStudyThinking: latestSentenceStudyThinking || null,
        sentenceStudyPending: learningModeEnabled,
      }),
    );
    if (String(thinking || "").trim()) {
      hasSentThinkingPreview = true;
    }
  }
  sendPendingProgress.lastUpdateAt = 0;

  const pushSentenceStudyThinking = (thinkingText) => {
    const normalizedThinking = normalizeDisplayText(thinkingText);
    if (!normalizedThinking) return;
    if (normalizedThinking === latestSentenceStudyThinking) return;
    latestSentenceStudyThinking = normalizedThinking;
    if (!firstSentenceStudyThinkingAt) {
      firstSentenceStudyThinkingAt = Date.now();
    }

    if (!hasFinalTranslateResult) {
      void sendPendingProgress();
      return;
    }
    if (!latestTranslateResult?.sentenceStudyPending) return;

    const now = Date.now();
    if (now - pushSentenceStudyThinking.lastUpdateAt < 80) return;
    pushSentenceStudyThinking.lastUpdateAt = now;

    void sendTranslateResult(
      tabId,
      {
        ...latestTranslateResult,
        sentenceStudy: null,
        sentenceStudyThinking: latestSentenceStudyThinking,
        sentenceStudyPending: true,
      },
      "updateSentenceStudy",
    );
  };
  pushSentenceStudyThinking.lastUpdateAt = 0;

  if (learningModeEnabled) {
    sentenceStudyPromise = analyzeSentenceStudy(
      base,
      selectedModel,
      text,
      "",
      {
        provider,
        apiKey: sentenceStudyApiKey,
        onThinkingProgress: pushSentenceStudyThinking,
      },
    ).catch(() => null);
  }

  try {
    if (provider === PROVIDER_MINIMAX) {
      const streamed = await generateMiniMaxStreamingCompletion(
        base,
        minimaxApiKey,
        selectedModel,
        prompt,
        {
          onChunk: (chunk) => {
            const parsed = splitThinkingFromText(chunk.response || "");
            translation = parsed.translation;
            thinking = mergeThinking(chunk.thinking || "", parsed.thinking);
            void sendPendingProgress();
          },
        },
      );
      const parsedMiniMaxFinal = splitThinkingFromText(
        streamed.response || translation,
      );
      translation = parsedMiniMaxFinal.translation;
      thinking = mergeThinking(
        streamed.thinking || thinking,
        parsedMiniMaxFinal.thinking,
      );
      await sendPendingProgress(true);
    } else {
      const streamed = await generateOllamaStreamingResponse(
        base,
        selectedModel,
        prompt,
        {
          onChunk: (chunk) => {
            const parsed = splitThinkingFromText(chunk.response || "");
            translation = parsed.translation;
            thinking = mergeThinking(chunk.thinking || "", parsed.thinking);
            void sendPendingProgress();
          },
        },
      );
      const parsedFinal = splitThinkingFromText(streamed.response || translation);
      translation = parsedFinal.translation;
      thinking = mergeThinking(streamed.thinking || thinking, parsedFinal.thinking);
      await sendPendingProgress(true);
    }
  } catch (e) {
    error =
      provider === PROVIDER_MINIMAX
        ? e.message || String(e)
        : getOllamaErrorMessage(e, { detailed: true });
  }

  const parsedOutput = splitThinkingFromText(translation);
  translation = parsedOutput.translation;
  thinking = mergeThinking(thinking, parsedOutput.thinking);

  if (!error && showPending && tabId && thinking) {
    if (!hasSentThinkingPreview) {
      await sendPendingProgress(true);
    }
    const elapsedSinceLastPending = Date.now() - sendPendingProgress.lastUpdateAt;
    if (elapsedSinceLastPending < MIN_THINK_PREVIEW_MS) {
      await new Promise((resolve) =>
        setTimeout(resolve, MIN_THINK_PREVIEW_MS - elapsedSinceLastPending),
      );
    }
  }

  const result = {
    original: text,
    translation: normalizeDisplayText(translation) || null,
    error,
    targetLang,
    model: selectedModel,
    learningModeEnabled,
    thinking: normalizeDisplayText(thinking) || null,
    sentenceStudy: null,
    sentenceStudyThinking: latestSentenceStudyThinking || null,
    sentenceStudyPending:
      !error && !!translation && learningModeEnabled && !!sentenceStudyPromise,
    requestId: resolvedRequestId,
    triggerSource,
  };

  stopPendingUpdates = true;
  hasFinalTranslateResult = true;
  latestTranslateResult = result;

  if (persistResult) {
    await persistTranslateResult(result);
  }

  if (result.sentenceStudyPending && sentenceStudyPromise) {
    void (async () => {
      const sentenceStudyRaw = await sentenceStudyPromise.catch(() => null);
      const sentenceStudy = sentenceStudyRaw
        ? await hydrateSentenceStudyTranslations(
            sentenceStudyRaw,
            normalizeDisplayText(translation) || "",
          ).catch(() => sentenceStudyRaw)
        : null;

      if (
        latestSentenceStudyThinking &&
        firstSentenceStudyThinkingAt &&
        Date.now() - firstSentenceStudyThinkingAt <
          MIN_SENTENCE_STUDY_THINK_PREVIEW_MS
      ) {
        await new Promise((resolve) =>
          setTimeout(
            resolve,
            MIN_SENTENCE_STUDY_THINK_PREVIEW_MS -
              (Date.now() - firstSentenceStudyThinkingAt),
          ),
        );
      }

      const nextResult = {
        ...result,
        sentenceStudy,
        sentenceStudyThinking:
          normalizeDisplayText(sentenceStudy?.thinking || "") ||
          latestSentenceStudyThinking ||
          null,
        sentenceStudyPending: false,
      };

      latestTranslateResult = nextResult;
      if (persistResult) {
        await persistTranslateResult(nextResult);
      }
      await sendTranslateResult(tabId, nextResult, "updateSentenceStudy");
    })();
  }

  return result;
}

function openResultWindow() {
  const resultUrl = chrome.runtime.getURL("options/index.html#translate");
  chrome.windows.create({
    url: resultUrl,
    type: "popup",
    width: 480,
    height: 360,
  });
}

async function triggerVisualPageTranslate(tabId) {
  if (!tabId) return { ok: false, error: "missing_tab" };

  try {
    const response = await new Promise((resolve) => {
      chrome.tabs.sendMessage(
        tabId,
        { action: "startVisualPageTranslate" },
        (value) => {
          if (chrome.runtime.lastError) {
            resolve({
              ok: false,
              error: chrome.runtime.lastError.message,
            });
            return;
          }
          resolve(value || { ok: true });
        },
      );
    });
    return response;
  } catch (error) {
    return { ok: false, error: error.message || String(error) };
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void createContextMenus();
  void ensureUpdateCheckAlarm();
  void checkForExtensionUpdate();
});

chrome.runtime.onStartup?.addListener(() => {
  void createContextMenus();
  void ensureUpdateCheckAlarm();
  void checkForExtensionUpdate();
});

chrome.alarms?.onAlarm.addListener((alarm) => {
  if (alarm.name !== UPDATE_CHECK_ALARM_NAME) return;
  void checkForExtensionUpdate();
});

chrome.commands.onCommand.addListener(async (command) => {
  console.log(LOG_PREFIX, "command received:", command);
  if (command !== "translate-selection") return;

  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });
  if (!tab?.id) {
    console.warn(LOG_PREFIX, "no active tab id");
    return;
  }
  console.log(LOG_PREFIX, "active tab:", tab.id, tab.url);

  try {
    let text = "";
    const response = await new Promise((resolve) => {
      chrome.tabs.sendMessage(
        tab.id,
        { action: "getTextToTranslate" },
        (value) => {
          if (chrome.runtime.lastError) resolve(null);
          else resolve(value);
        },
      );
    });
    if (response && (response.text || "").trim()) {
      text = response.text.trim();
    }
    if (!text) {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const selection = window.getSelection();
          return selection && selection.toString().trim();
        },
      });
      text = (results[0]?.result || "").trim();
    }
    if (!text) {
      console.log(LOG_PREFIX, "no selection or word under cursor, show hint");
      try {
        await chrome.tabs.sendMessage(tab.id, {
          action: "showShortcutHint",
          message: "请选中文字或将鼠标悬停在单词上",
        });
      } catch (e) {
        console.warn(LOG_PREFIX, "send showShortcutHint failed:", e?.message);
      }
      return;
    }
    console.log(LOG_PREFIX, "text length:", text.length);

    const result = await translateWithProvider(text, tab.id, {
      showPending: true,
    });
    if (!result) {
      // 应用已禁用，静默返回
      return;
    }
    await sendTranslateResult(tab.id, result);
    console.log(LOG_PREFIX, "showTranslateResult sent");
  } catch (e) {
    console.error(LOG_PREFIX, "Hotkey translate error:", e);
  }
});

const AUTO_MODE_MENU_MAP = {
  [MENU_AUTO_MODE_OFF]: { key: "ollamaAutoTranslateMode", value: "off" },
  [MENU_AUTO_MODE_SELECTION]: {
    key: "ollamaAutoTranslateMode",
    value: "selection",
  },
  [MENU_AUTO_MODE_HOVER]: { key: "ollamaAutoTranslateMode", value: "hover" },
  [MENU_HOVER_SCOPE_WORD]: { key: "ollamaHoverTranslateScope", value: "word" },
  [MENU_HOVER_SCOPE_PARAGRAPH]: {
    key: "ollamaHoverTranslateScope",
    value: "paragraph",
  },
};

chrome.contextMenus.onClicked.addListener(async (info, clickedTab) => {
  const menuConfig = AUTO_MODE_MENU_MAP[info.menuItemId];
  if (menuConfig) {
    await chrome.storage.sync.set({ [menuConfig.key]: menuConfig.value });
    void createContextMenus();
    return;
  }

  if (info.menuItemId === MENU_OPEN_OPTIONS) {
    await chrome.runtime.openOptionsPage();
    return;
  }

  const clickedTabId = clickedTab?.id;
  if (info.menuItemId === MENU_TRANSLATE_PAGE) {
    const response = await triggerVisualPageTranslate(clickedTabId);
    if (!response?.ok) {
      console.warn(
        LOG_PREFIX,
        "右键菜单触发整页翻译失败:",
        response?.error || "unknown_error",
      );
    }
    return;
  }

  if (info.menuItemId !== MENU_TRANSLATE_SELECTION || !info.selectionText)
    return;
  const text = info.selectionText.trim();
  let tabId = clickedTabId;
  if (!tabId) {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    tabId = tab?.id;
  }
  try {
    const result = await translateWithProvider(text, tabId, {
      showPending: true,
    });
    if (!result) {
      // 应用已禁用，静默返回
      return;
    }
    if (tabId) {
      try {
        await sendTranslateResult(tabId, result);
        return;
      } catch (_) {}
    }
    openResultWindow();
  } catch (_) {}
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "sync") return;
  if (
    !("ollamaAutoTranslateMode" in changes) &&
    !("ollamaAutoTranslateSelection" in changes) &&
    !("ollamaHoverTranslateScope" in changes) &&
    !("ollamaAppEnabled" in changes)
  ) {
    return;
  }
  void createContextMenus();
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "getExtensionUpdateState") {
    readStoredUpdateState()
      .then((state) => sendResponse({ ok: true, state }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (msg.action === "checkExtensionUpdate") {
    checkForExtensionUpdate({ markChecking: true })
      .then((state) => sendResponse({ ok: true, state }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (msg.action === "translatePageTextBatch" && Array.isArray(msg.texts)) {
    translatePageBatchWithProvider(msg.texts)
      .then((result) => sendResponse(result))
      .catch((error) =>
        sendResponse({
          ok: false,
          error: error.message || String(error),
        }),
      );
    return true;
  }

  if (msg.action === "translatePageTextChunk" && msg.text) {
    const chunkText = String(msg.text).trim();
    if (!chunkText) {
      sendResponse({ ok: false, error: "empty_text" });
      return true;
    }

    translateWithProvider(chunkText, null, {
      showPending: false,
      requestId: msg.requestId,
      triggerSource: msg.triggerSource || "page-visual",
      persistResult: false,
      learningModeOverride: false,
    })
      .then((result) => {
        if (!result) {
          sendResponse({ ok: false, disabled: true });
          return;
        }
        sendResponse({
          ok: !result.error && !!result.translation,
          translation: result.translation || "",
          error: result.error || null,
          rateLimited: isRateLimitError(result.error),
          needModel: !!result.needModel,
        });
      })
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (msg.action !== "translate" || !msg.text) return true;

  const text = String(msg.text).trim();
  const tabId = sender.tab?.id;
  const fromTip = msg.fromTip;
  const requestId = msg.requestId;
  const triggerSource = msg.triggerSource;

  translateWithProvider(text, tabId, {
    showPending: !fromTip,
    requestId,
    triggerSource,
  })
    .then((result) => {
      if (!result) {
        // 应用已禁用，静默返回
        sendResponse({ ok: true, disabled: true });
        return;
      }
      const responsePayload = {
        ok: !result.error && !result.needModel,
        needModel: result.needModel,
        error: result.error,
      };

      if (tabId) {
        sendTranslateResult(tabId, {
          ...result,
          fromTip,
        }).then(
          () => sendResponse(responsePayload),
          () => sendResponse(responsePayload),
        );
      } else {
        openResultWindow();
        sendResponse(responsePayload);
      }
    })
    .catch((error) => sendResponse({ ok: false, error: error.message }));

  return true;
});
