import {
  checkOllamaAndGetModels,
  generateOllamaStreamingResponse,
} from "./background/ollama.js";
import { analyzeSentenceStudy } from "./background/sentenceStudy.js";
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
  normalizeHoverTranslateScope,
} from "./shared/settings.js";

const DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434";
const DEFAULT_OLLAMA_MODEL = "";
const DEFAULT_TRANSLATE_TARGET_LANG = "Chinese";
const DEFAULT_LEARNING_MODE_ENABLED = false;
const DEFAULT_APP_ENABLED = true;
const TRANSLATE_RESULT_KEY = "ollamaTranslateResult";
const LOG_PREFIX = "[Ollama 翻译]";
const MENU_TRANSLATE_SELECTION = "ollama-translate";
const MENU_AUTO_MODE_PARENT = "ollama-auto-translate-mode";
const MENU_AUTO_MODE_OFF = "ollama-auto-translate-mode-off";
const MENU_AUTO_MODE_SELECTION = "ollama-auto-translate-mode-selection";
const MENU_AUTO_MODE_HOVER = "ollama-auto-translate-mode-hover";
const MENU_HOVER_SCOPE_PARENT = "ollama-hover-translate-scope";
const MENU_HOVER_SCOPE_WORD = "ollama-hover-translate-scope-word";
const MENU_HOVER_SCOPE_PARAGRAPH = "ollama-hover-translate-scope-paragraph";

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
  };
}

async function sendTranslateResult(tabId, payload, action = "showTranslateResult") {
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
    hoverTranslateScope: normalizeHoverTranslateScope(stored.ollamaHoverTranslateScope),
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
        title: `Ollama 翻译设置\n发现新版本 ${updateState.latestVersion || ""}`.trim(),
      })
      .catch(() => {});
    return;
  }

  await chrome.action.setBadgeText({ text: "" }).catch(() => {});
  await chrome.action
    .setTitle({
      title: "Ollama 翻译设置",
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
    const comparison = compareExtensionVersions(payload.version, currentVersion);

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

async function continueSentenceStudy({
  tabId,
  base,
  model,
  original,
  translation,
  result,
}) {
  let sentenceStudy = null;

  try {
    sentenceStudy = await analyzeSentenceStudy(base, model, original, translation);
  } catch (_) {
    sentenceStudy = null;
  }

  const nextResult = {
    ...result,
    sentenceStudy,
    sentenceStudyPending: false,
  };

  await persistTranslateResult(nextResult);
  await sendTranslateResult(tabId, nextResult, "updateSentenceStudy");
}

async function translateWithOllama(text, tabId = null, options = {}) {
  const {
    ollamaUrl = DEFAULT_OLLAMA_URL,
    ollamaModel = DEFAULT_OLLAMA_MODEL,
    ollamaTranslateTargetLang = DEFAULT_TRANSLATE_TARGET_LANG,
    ollamaLearningModeEnabled = DEFAULT_LEARNING_MODE_ENABLED,
  } = await chrome.storage.sync.get({
    ollamaUrl: DEFAULT_OLLAMA_URL,
    ollamaModel: DEFAULT_OLLAMA_MODEL,
    ollamaTranslateTargetLang: DEFAULT_TRANSLATE_TARGET_LANG,
    ollamaLearningModeEnabled: DEFAULT_LEARNING_MODE_ENABLED,
    ollamaAppEnabled: DEFAULT_APP_ENABLED,
  });
  const {
    showPending = false,
    requestId = undefined,
    triggerSource = undefined,
  } = options;
  const resolvedRequestId = createTranslateRequestId(requestId);

  if (!ollamaAppEnabled) {
    const errorResult = {
      original: text,
      translation: null,
      error: "app_disabled",
      targetLang: ollamaTranslateTargetLang || DEFAULT_TRANSLATE_TARGET_LANG,
      model: ollamaModel,
      learningModeEnabled: !!ollamaLearningModeEnabled,
      sentenceStudy: null,
      sentenceStudyPending: false,
      requestId: resolvedRequestId,
      triggerSource,
    };
    await persistTranslateResult(errorResult);
    return errorResult;
  }

  if (showPending && tabId) {
    await sendTranslatePending(
      tabId,
      buildPendingTranslatePayload({
        text,
        targetLang: ollamaTranslateTargetLang || DEFAULT_TRANSLATE_TARGET_LANG,
        model: ollamaModel || null,
        learningModeEnabled: !!ollamaLearningModeEnabled,
        requestId: resolvedRequestId,
        triggerSource,
      }),
    );
  }

  if (!ollamaModel) {
    const check = await checkOllamaAndGetModels(ollamaUrl);
    if (check.error) {
      const errorResult = {
        original: text,
        translation: null,
        error: check.error === "403" ? "403" : "connection",
        targetLang: ollamaTranslateTargetLang || DEFAULT_TRANSLATE_TARGET_LANG,
        model: null,
        needModel: true,
        learningModeEnabled: !!ollamaLearningModeEnabled,
        sentenceStudy: null,
        sentenceStudyPending: false,
        requestId: resolvedRequestId,
        triggerSource,
      };
      await persistTranslateResult(errorResult);
      return errorResult;
    }

    const errorResult = {
      original: text,
      translation: null,
      error: "no_model",
      targetLang: ollamaTranslateTargetLang || DEFAULT_TRANSLATE_TARGET_LANG,
      model: null,
      models: check.models,
      needModel: true,
      learningModeEnabled: !!ollamaLearningModeEnabled,
      sentenceStudy: null,
      sentenceStudyPending: false,
      requestId: resolvedRequestId,
      triggerSource,
    };
    await persistTranslateResult(errorResult);
    return errorResult;
  }

  const base = ollamaUrl.replace(/\/$/, "");
  const targetLang = ollamaTranslateTargetLang || DEFAULT_TRANSLATE_TARGET_LANG;
  const prompt = `Translate the following text to ${targetLang}. Only output the translation, no explanation or extra text.\n\n${text}`;

  let translation = "";
  let thinking = "";
  let error = null;
  let lastPendingUpdateAt = 0;

  async function sendPendingProgress(force = false) {
    if (!showPending || !tabId) return;

    const now = Date.now();
    if (!force && now - lastPendingUpdateAt < 80) return;

    lastPendingUpdateAt = now;
    await sendTranslatePending(
      tabId,
      buildPendingTranslatePayload({
        text,
        targetLang,
        model: ollamaModel,
        learningModeEnabled: !!ollamaLearningModeEnabled,
        requestId: resolvedRequestId,
        triggerSource,
        translation: translation || null,
        thinking: thinking || null,
      }),
    );
  }

  try {
    const streamed = await generateOllamaStreamingResponse(base, ollamaModel, prompt, {
      onChunk: (chunk) => {
        translation = chunk.response || "";
        thinking = chunk.thinking || "";
        void sendPendingProgress();
      },
    });
    translation = streamed.response || translation;
    thinking = streamed.thinking || thinking;
    await sendPendingProgress(true);
  } catch (e) {
    error = e.message || String(e);
    if (e.name === "TypeError" && (e.message || "").includes("fetch")) {
      error =
        "无法连接 Ollama。请确认本机已安装并启动 Ollama（终端运行 ollama serve），且扩展设置中地址为 http://127.0.0.1:11434";
    }
  }

  const result = {
    original: text,
    translation: translation || null,
    error,
    targetLang,
    model: ollamaModel,
    learningModeEnabled: !!ollamaLearningModeEnabled,
    thinking: thinking || null,
    sentenceStudy: null,
    sentenceStudyPending: !error && !!translation && !!ollamaLearningModeEnabled,
    requestId: resolvedRequestId,
    triggerSource,
  };

  await persistTranslateResult(result);

  if (result.sentenceStudyPending) {
    void continueSentenceStudy({
      tabId,
      base,
      model: ollamaModel,
      original: text,
      translation,
      result,
    });
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

    const result = await translateWithOllama(text, tab.id, {
      showPending: true,
    });
    await sendTranslateResult(tab.id, result);
    console.log(LOG_PREFIX, "showTranslateResult sent");
  } catch (e) {
    console.error(LOG_PREFIX, "Hotkey translate error:", e);
  }
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId === MENU_AUTO_MODE_OFF) {
    await chrome.storage.sync.set({ ollamaAutoTranslateMode: "off" });
    void createContextMenus();
    return;
  }

  if (info.menuItemId === MENU_AUTO_MODE_SELECTION) {
    await chrome.storage.sync.set({ ollamaAutoTranslateMode: "selection" });
    void createContextMenus();
    return;
  }

  if (info.menuItemId === MENU_AUTO_MODE_HOVER) {
    await chrome.storage.sync.set({ ollamaAutoTranslateMode: "hover" });
    void createContextMenus();
    return;
  }

  if (info.menuItemId === MENU_HOVER_SCOPE_WORD) {
    await chrome.storage.sync.set({ ollamaHoverTranslateScope: "word" });
    void createContextMenus();
    return;
  }

  if (info.menuItemId === MENU_HOVER_SCOPE_PARAGRAPH) {
    await chrome.storage.sync.set({ ollamaHoverTranslateScope: "paragraph" });
    void createContextMenus();
    return;
  }

  if (info.menuItemId !== MENU_TRANSLATE_SELECTION || !info.selectionText) return;
  const text = info.selectionText.trim();
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });
  const tabId = tab?.id;
  try {
    const result = await translateWithOllama(text, tabId, {
      showPending: true,
    });
    if (tabId) {
      try {
        await sendTranslateResult(tabId, result);
        return;
      } catch (_) {}
    }
    openResultWindow();
  } catch (_) {
    openResultWindow();
  }
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

  if (msg.action !== "translate" || !msg.text) return true;

  const text = String(msg.text).trim();
  const tabId = sender.tab?.id;
  const fromTip = msg.fromTip;
  const requestId = msg.requestId;
  const triggerSource = msg.triggerSource;

  translateWithOllama(text, tabId, {
    showPending: !fromTip,
    requestId,
    triggerSource,
  })
    .then((result) => {
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
