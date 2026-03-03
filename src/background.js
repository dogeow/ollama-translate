import { checkOllamaAndGetModels, generateOllamaResponse } from "./background/ollama.js";
import { analyzeSentenceStudy } from "./background/sentenceStudy.js";

const DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434";
const DEFAULT_OLLAMA_MODEL = "";
const DEFAULT_TRANSLATE_TARGET_LANG = "Chinese";
const DEFAULT_LEARNING_MODE_ENABLED = false;
const TRANSLATE_RESULT_KEY = "ollamaTranslateResult";
const LOG_PREFIX = "[Ollama 翻译]";

async function sendTranslatePending(tabId, payload) {
  if (!tabId) return;
  await chrome.tabs
    .sendMessage(tabId, {
      action: "showTranslatePending",
      ...payload,
    })
    .catch(() => {});
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
  });
  const {
    showPending = false,
    requestId = undefined,
    triggerSource = undefined,
  } = options;
  const resolvedRequestId = createTranslateRequestId(requestId);

  if (showPending && tabId) {
    await sendTranslatePending(tabId, {
      original: text,
      targetLang: ollamaTranslateTargetLang || DEFAULT_TRANSLATE_TARGET_LANG,
      learningModeEnabled: !!ollamaLearningModeEnabled,
      requestId: resolvedRequestId,
      triggerSource,
    });
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
  let error = null;
  try {
    translation = await generateOllamaResponse(base, ollamaModel, prompt);
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
  chrome.contextMenus.create({
    id: "ollama-translate",
    title: "Ollama 翻译选中内容",
    contexts: ["selection"],
  });
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
  if (info.menuItemId !== "ollama-translate" || !info.selectionText) return;
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

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
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
