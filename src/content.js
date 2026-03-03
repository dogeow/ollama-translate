/**
 * 滑词翻译 content script 入口：选区/悬停显示「翻译」按钮，点击后展示 tips 小窗
 * 逻辑已拆到 content/* 各模块，本文件仅做胶水与消息监听。
 */
import { BUTTON_ID, STYLE_ID, TIP_ID } from "./content/constants.js";
import {
  getCurrentElementAndText,
  getHoverTranslateTarget,
  getSelectionText,
  getSelectionRect,
  getElementFullText,
} from "./content/selection.js";
import {
  showButton,
  hideButton,
  getButtonElement,
  getButtonOrSelectionText,
} from "./content/button.js";
import { showTip, hideTip } from "./content/tip.js";
import { showShortcutHint } from "./content/shortcutHint.js";

const CONTENT_STATE_KEY = "__OLLAMA_TRANSLATE_CONTENT_STATE__";
const LOG_PREFIX = "[Ollama 翻译-Content]";

function logDebug(...args) {
  console.log(LOG_PREFIX, ...args);
}

function sendMessageSafe(msg, callback) {
  try {
    chrome.runtime.sendMessage(msg, callback);
  } catch (e) {
    logDebug("sendMessage 失败:", e.message, "msg:", msg.action);
    if (e.message && e.message.includes("Extension context invalidated")) {
      logDebug("检测到 Extension context 失效，需要刷新页面以重新连接扩展");
    }
    if (callback) {
      callback();
    }
  }
}

function initContentScript() {
  const SELECTION_AUTO_TRANSLATE_DELAY_MS = 220;
  const DEFAULT_AUTO_TRANSLATE_MODE = "off";
  const DEFAULT_HOVER_TRANSLATE_SCOPE = "word";
  const DEFAULT_HOVER_TRANSLATE_DELAY_MS = 200;
  const DEFAULT_TRANSLATE_TARGET_LANG = "Chinese";
  const HAN_CHAR_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/u;
  const SIGNIFICANT_CHAR_RE = /[\p{L}\p{N}]/u;

  let lastTipRect = null;
  let lastMouseX = 0;
  let lastMouseY = 0;
  let lastTranslatedElement = null;
  let autoTranslateMode = DEFAULT_AUTO_TRANSLATE_MODE;
  let translateTargetLang = DEFAULT_TRANSLATE_TARGET_LANG;
  let hoverTranslateScope = DEFAULT_HOVER_TRANSLATE_SCOPE;
  let hoverTranslateDelayMs = DEFAULT_HOVER_TRANSLATE_DELAY_MS;
  let selectionAutoTranslateTimerId = null;
  let hoverAutoTranslateTimerId = null;
  let hoverCurrentKey = "";
  let hoverPendingKey = "";
  let hoverInFlightKey = "";
  let hoverLastResolvedKey = "";
  let activeHoverRequestId = "";
  let lastCompletedHoverRequestId = "";
  let hoverRequestSeq = 0;
  let activeTipRequestId = "";

  function normalizeAutoTranslateMode(mode, legacySelection = false) {
    if (mode === "selection" || mode === "hover" || mode === "off") {
      return mode;
    }
    return legacySelection ? "selection" : DEFAULT_AUTO_TRANSLATE_MODE;
  }

  function normalizeHoverTranslateScope(scope) {
    return scope === "paragraph"
      ? "paragraph"
      : DEFAULT_HOVER_TRANSLATE_SCOPE;
  }

  function normalizeHoverTranslateDelayMs(value) {
    if (value === "" || value == null) return DEFAULT_HOVER_TRANSLATE_DELAY_MS;
    const n = Number(value);
    if (!Number.isFinite(n)) return DEFAULT_HOVER_TRANSLATE_DELAY_MS;
    return Math.min(5000, Math.max(0, Math.round(n)));
  }

  function isMostlyChineseText(text) {
    const value = String(text || "").trim();
    if (!value) return false;

    const significantChars = Array.from(value).filter((char) =>
      SIGNIFICANT_CHAR_RE.test(char),
    );
    if (significantChars.length === 0) return false;

    let hanCount = 0;
    for (const char of significantChars) {
      if (HAN_CHAR_RE.test(char)) {
        hanCount += 1;
      }
    }

    if (hanCount === 0) return false;
    if (significantChars.length <= 4 && hanCount === significantChars.length) {
      return true;
    }

    return hanCount / significantChars.length >= 0.6;
  }

  function shouldSkipHoverTranslate(text) {
    if (translateTargetLang !== "Chinese") return false;
    return isMostlyChineseText(text);
  }

  function applyAutoTranslateSettings(cfg) {
    autoTranslateMode = normalizeAutoTranslateMode(
      cfg.ollamaAutoTranslateMode,
      cfg.ollamaAutoTranslateSelection,
    );
    translateTargetLang =
      cfg.ollamaTranslateTargetLang || DEFAULT_TRANSLATE_TARGET_LANG;
    hoverTranslateScope = normalizeHoverTranslateScope(
      cfg.ollamaHoverTranslateScope,
    );
    hoverTranslateDelayMs = normalizeHoverTranslateDelayMs(
      cfg.ollamaHoverTranslateDelayMs,
    );
    if (autoTranslateMode !== "off") hideButton();
    clearSelectionAutoTranslateTimer();
    clearHoverAutoTranslateTimer({ preserveLastResolved: true });
  }

  chrome.storage.sync.get(
    {
      ollamaAutoTranslateMode: DEFAULT_AUTO_TRANSLATE_MODE,
      ollamaAutoTranslateSelection: false,
      ollamaTranslateTargetLang: DEFAULT_TRANSLATE_TARGET_LANG,
      ollamaHoverTranslateScope: DEFAULT_HOVER_TRANSLATE_SCOPE,
      ollamaHoverTranslateDelayMs: DEFAULT_HOVER_TRANSLATE_DELAY_MS,
    },
    applyAutoTranslateSettings,
  );

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    if (
      !("ollamaAutoTranslateMode" in changes) &&
      !("ollamaAutoTranslateSelection" in changes) &&
      !("ollamaTranslateTargetLang" in changes) &&
      !("ollamaHoverTranslateScope" in changes) &&
      !("ollamaHoverTranslateDelayMs" in changes)
    ) {
      return;
    }
    chrome.storage.sync.get(
      {
        ollamaAutoTranslateMode: DEFAULT_AUTO_TRANSLATE_MODE,
        ollamaAutoTranslateSelection: false,
        ollamaTranslateTargetLang: DEFAULT_TRANSLATE_TARGET_LANG,
        ollamaHoverTranslateScope: DEFAULT_HOVER_TRANSLATE_SCOPE,
        ollamaHoverTranslateDelayMs: DEFAULT_HOVER_TRANSLATE_DELAY_MS,
      },
      applyAutoTranslateSettings,
    );
  });

  function clearSelectionAutoTranslateTimer() {
    if (selectionAutoTranslateTimerId !== null) {
      clearTimeout(selectionAutoTranslateTimerId);
      selectionAutoTranslateTimerId = null;
    }
  }

  function clearHoverAutoTranslateTimer({ preserveLastResolved = false } = {}) {
    if (hoverAutoTranslateTimerId !== null) {
      clearTimeout(hoverAutoTranslateTimerId);
      hoverAutoTranslateTimerId = null;
    }
    hoverCurrentKey = "";
    hoverPendingKey = "";
    hoverInFlightKey = "";
    activeHoverRequestId = "";
    if (!preserveLastResolved) {
      hoverLastResolvedKey = "";
    }
  }

  function isExtensionUiTarget(target) {
    return !!(
      target &&
      target.closest &&
      target.closest(`#${BUTTON_ID}, #${TIP_ID}`)
    );
  }

  function onButtonClick(e) {
    e.preventDefault();
    e.stopPropagation();
    const text = getButtonOrSelectionText();
    lastTipRect = getSelectionRect();
    hideButton();
    if (window.getSelection()) window.getSelection().removeAllRanges();
    if (text) {
      sendMessageSafe({ action: "translate", text }, () => {
        if (chrome.runtime.lastError) {
          logDebug("按钮点击翻译失败:", chrome.runtime.lastError.message);
        }
      });
    }
  }

  const btn = getButtonElement();
  if (btn._ollamaClickHandler) {
    btn.removeEventListener("click", btn._ollamaClickHandler);
  }
  btn._ollamaClickHandler = onButtonClick;
  btn.addEventListener("click", onButtonClick);

  function onRuntimeMessage(msg, _sender, sendResponse) {
    if (msg.action === "showTranslatePending") {
      if (msg.triggerSource === "hover" && msg.requestId) {
        if (msg.requestId !== activeHoverRequestId) return;
      }
      activeTipRequestId = msg.requestId || "";
      showTip({ ...msg, pending: true }, lastTipRect);
    } else if (msg.action === "showTranslateResult") {
      console.log(logDebug("收到 showTranslateResult 消息，错误状态:", msg.error));
      if (msg.triggerSource === "hover" && msg.requestId) {
        if (msg.requestId !== activeHoverRequestId) return;
        hoverLastResolvedKey = hoverCurrentKey || hoverLastResolvedKey;
        hoverInFlightKey = "";
        activeHoverRequestId = "";
        lastCompletedHoverRequestId = msg.requestId;
      }
      activeTipRequestId = msg.requestId || activeTipRequestId;
      console.log(logDebug("调用 showTip 显示翻译结果，错误:", msg.error));
      showTip(msg, lastTipRect);
    } else if (msg.action === "updateSentenceStudy") {
      const tip = document.getElementById(TIP_ID);
      if (!tip) return;
      if (msg.requestId && activeTipRequestId && msg.requestId !== activeTipRequestId) {
        return;
      }
      if (msg.triggerSource === "hover" && msg.requestId) {
        if (msg.requestId !== lastCompletedHoverRequestId) return;
      }
      activeTipRequestId = msg.requestId || activeTipRequestId;
      showTip(msg, lastTipRect);
    } else if (msg.action === "showShortcutHint" && msg.message) {
      showShortcutHint(msg.message);
    } else if (msg.action === "getTextToTranslate") {
      const { element: currentElement, text: currentText } =
        getCurrentElementAndText(lastMouseX, lastMouseY);

      if (!currentText && !currentElement) {
        sendResponse({ text: "", source: "" });
        return true;
      }

      let text = "";
      let source = "";

      if (lastTranslatedElement && currentElement === lastTranslatedElement) {
        let parent = lastTranslatedElement.parentElement;
        if (parent === document.documentElement) parent = document.body;
        if (!parent) {
          text = currentText;
          source = "selection";
        } else {
          text = getElementFullText(parent);
          lastTranslatedElement = parent;
          source = "expand";
          const r = parent.getBoundingClientRect();
          lastTipRect = {
            top: r.top,
            bottom: r.bottom,
            left: r.left,
            right: r.right,
            width: r.width,
            height: r.height,
          };
        }
      } else {
        text = currentText;
        lastTranslatedElement = currentElement;
        source = currentElement ? "selection" : "";
        if (text && !getSelectionText()) {
          lastTipRect = {
            bottom: lastMouseY + 4,
            left: lastMouseX,
            top: lastMouseY - 4,
            right: lastMouseX + 4,
            width: 0,
            height: 0,
          };
        }
      }

      if (!text.trim()) {
        sendResponse({ text: "", source: "" });
        return true;
      }

      sendResponse({
        text: text.trim(),
        source: source || "hover",
      });
      return true;
    }
  }
  chrome.runtime.onMessage.addListener(onRuntimeMessage);

  function onSelectionChange() {
    const text = getSelectionText();
    if (!text) {
      hideButton();
      return;
    }
    if (autoTranslateMode !== "off") {
      // 开启任一自动模式时，不显示选区悬浮「翻译」按钮
      hideButton();
      return;
    }
    showButton(text);
  }

  function onMouseUp(e) {
    if (e.button !== 0) return;
    const clickCount = e.detail || 1;
    const clientX = e.clientX;
    const clientY = e.clientY;

    // 保持原有选区变化逻辑（用于非自动模式下的按钮）
    setTimeout(onSelectionChange, 10);

    // 未开启双击/三击自动翻译，或只是单击时，不触发自动请求
    if (autoTranslateMode !== "selection" || clickCount < 2) return;

    // 双击 / 三击：等待一小段时间，避免立即在双击后请求，给第三击留时间
    clearSelectionAutoTranslateTimer();
    selectionAutoTranslateTimerId = window.setTimeout(() => {
      selectionAutoTranslateTimerId = null;
      let text = getSelectionText().trim();
      let anchorRect = getSelectionRect() || lastTipRect;
      let translatedElement = null;

      // 一些页面使用 user-select: none，双击/三击不会形成真实选区。
      if (!text) {
        const fallbackScope = clickCount >= 3 ? "paragraph" : "word";
        const hoverTarget = getHoverTranslateTarget(clientX, clientY, fallbackScope);
        if (!hoverTarget?.text?.trim()) return;
        text = hoverTarget.text.trim();
        anchorRect = hoverTarget.rect || anchorRect;
        translatedElement = hoverTarget.element || null;
      }

      if (!text) return;
      lastTipRect = anchorRect || lastTipRect;
      if (translatedElement) {
        lastTranslatedElement = translatedElement;
      }
      logDebug(`双击/三击触发翻译：text="${text.substring(0, 20)}..."`);
      sendMessageSafe({ action: "translate", text }, () => {
        if (chrome.runtime.lastError) {
          logDebug("双击/三击翻译请求失败:", chrome.runtime.lastError.message);
        }
      });
    }, SELECTION_AUTO_TRANSLATE_DELAY_MS);
  }

  function onScroll() {
    hideButton();
    if (autoTranslateMode === "hover") {
      clearHoverAutoTranslateTimer({ preserveLastResolved: true });
    }
  }

  function onMouseMove(e) {
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;

    if (autoTranslateMode !== "hover") return;
    if (e.buttons !== 0 || getSelectionText() || isExtensionUiTarget(e.target)) {
      clearHoverAutoTranslateTimer({ preserveLastResolved: true });
      return;
    }

    const hoverTarget = getHoverTranslateTarget(
      e.clientX,
      e.clientY,
      hoverTranslateScope,
    );
    const key = hoverTarget?.key || "";
    const hoverText = (hoverTarget?.text || "").trim();
    if (!key || !hoverText) {
      clearHoverAutoTranslateTimer({ preserveLastResolved: true });
      return;
    }

    if (shouldSkipHoverTranslate(hoverText)) {
      if (hoverAutoTranslateTimerId !== null) {
        clearTimeout(hoverAutoTranslateTimerId);
        hoverAutoTranslateTimerId = null;
      }
      if (key !== hoverCurrentKey) {
        hoverCurrentKey = key;
      }
      hoverPendingKey = "";
      hoverInFlightKey = "";
      activeHoverRequestId = "";
      return;
    }

    if (key !== hoverCurrentKey) {
      if (hoverAutoTranslateTimerId !== null) {
        clearTimeout(hoverAutoTranslateTimerId);
        hoverAutoTranslateTimerId = null;
      }
      hoverCurrentKey = key;
      hoverPendingKey = "";
      hoverInFlightKey = "";
      activeHoverRequestId = "";
    }

    if (
      key === hoverPendingKey ||
      key === hoverInFlightKey ||
      key === hoverLastResolvedKey
    ) {
      return;
    }

    hoverPendingKey = key;
    const requestId = `hover:${Date.now()}:${++hoverRequestSeq}`;
    logDebug(`悬停触发：text="${hoverText.substring(0, 20)}...", requestId=${requestId}`);
    hoverAutoTranslateTimerId = window.setTimeout(() => {
      hoverAutoTranslateTimerId = null;
      hoverPendingKey = "";
      if (autoTranslateMode !== "hover" || hoverCurrentKey !== key) {
        logDebug(`悬停已取消：mode=${autoTranslateMode}, currentKey=${hoverCurrentKey}, key=${key}`);
        return;
      }

      hoverInFlightKey = key;
      activeHoverRequestId = requestId;
      lastCompletedHoverRequestId = "";
      lastTranslatedElement = hoverTarget.element || null;
      lastTipRect = hoverTarget.rect || {
        bottom: lastMouseY + 4,
        left: lastMouseX,
        top: lastMouseY - 4,
        right: lastMouseX + 4,
        width: 0,
        height: 0,
      };

      logDebug(`发送悬停翻译请求：${requestId}`);
      const hoverCallback = () => {
        if (chrome.runtime.lastError) {
          if (activeHoverRequestId === requestId) {
            activeHoverRequestId = "";
            hoverInFlightKey = "";
          }
          logDebug(
            "悬停翻译请求失败:",
            chrome.runtime.lastError.message,
          );
        }
      };
      sendMessageSafe(
        {
          action: "translate",
          text: hoverText,
          triggerSource: "hover",
          requestId,
        },
        hoverCallback,
      );
    }, hoverTranslateDelayMs);
  }

  function onSelectionChangedEvent() {
    if (autoTranslateMode === "hover") {
      clearHoverAutoTranslateTimer({ preserveLastResolved: true });
    }
    onSelectionChange();
  }

  document.addEventListener("mouseup", onMouseUp, true);
  document.addEventListener("selectionchange", onSelectionChangedEvent, true);
  document.addEventListener("scroll", onScroll, true);
  document.addEventListener("mousemove", onMouseMove, true);

  return function cleanup() {
    clearSelectionAutoTranslateTimer();
    clearHoverAutoTranslateTimer();
    hideButton();
    hideTip();
    chrome.runtime.onMessage.removeListener(onRuntimeMessage);
    document.removeEventListener("mouseup", onMouseUp, true);
    document.removeEventListener("selectionchange", onSelectionChangedEvent, true);
    document.removeEventListener("scroll", onScroll, true);
    document.removeEventListener("mousemove", onMouseMove, true);
    if (btn._ollamaClickHandler) {
      btn.removeEventListener("click", btn._ollamaClickHandler);
      delete btn._ollamaClickHandler;
    }
    const style = document.getElementById(STYLE_ID);
    if (style) style.remove();
  };
}

export default function main() {
  logDebug("Content script 初始化开始...");
  const prevState = globalThis[CONTENT_STATE_KEY];
  if (prevState && typeof prevState.cleanup === "function") {
    try {
      logDebug("清理旧实例...");
      prevState.cleanup();
    } catch (e) {
      logDebug("清理旧实例失败:", e.message);
    }
  }

  logDebug("初始化新实例...");
  const cleanup = initContentScript();
  globalThis[CONTENT_STATE_KEY] = {
    cleanup,
  };
  logDebug("Content script 初始化完成！");

  return () => {
    try {
      if (typeof cleanup === "function") {
        logDebug("执行 cleanup...");
        cleanup();
      }
    } finally {
      if (globalThis[CONTENT_STATE_KEY]?.cleanup === cleanup) {
        delete globalThis[CONTENT_STATE_KEY];
      }
    }
  };
}
