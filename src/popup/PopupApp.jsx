import { useEffect, useRef, useState } from "react";
import { createDefaultUpdateState, UPDATE_STATE_KEY } from "../shared/update.js";
import {
  DEFAULT_TRANSLATE_PROVIDER,
  TRANSLATE_PROVIDER_OPTIONS,
  DEFAULT_AUTO_TRANSLATE_MODE,
  DEFAULT_HOVER_TRANSLATE_SCOPE,
} from "../options/lib/constants.js";
import {
  normalizeTranslateProvider,
  normalizeAutoTranslateMode,
  normalizeHoverTranslateScope,
} from "../shared/settings.js";

const AUTO_MODE_OPTIONS = [
  {
    value: "off",
    title: "关闭自动翻译",
    hint: "只保留右键、快捷键和手动触发。",
  },
  {
    value: "selection",
    title: "双击 / 三击",
    hint: "双击单词或三击整段后立即翻译。",
  },
  {
    value: "hover",
    title: "悬停取词",
    hint: "鼠标停留在文本上时自动触发翻译。",
  },
];

const HOVER_SCOPE_OPTIONS = [
  {
    value: "word",
    title: "只翻译单词",
    hint: "更轻量，适合看英文文章。",
  },
  {
    value: "paragraph",
    title: "翻译整段话",
    hint: "适合整段阅读和快速理解上下文。",
  },
];

export function PopupApp() {
  const currentVersion = chrome.runtime.getManifest().version;
  const [updateState, setUpdateState] = useState(createDefaultUpdateState(currentVersion));
  const [provider, setProvider] = useState(DEFAULT_TRANSLATE_PROVIDER);
  const [autoTranslateMode, setAutoTranslateMode] = useState(DEFAULT_AUTO_TRANSLATE_MODE);
  const [hoverTranslateScope, setHoverTranslateScope] = useState(DEFAULT_HOVER_TRANSLATE_SCOPE);
  const [appEnabled, setAppEnabled] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPageTranslateStarting, setIsPageTranslateStarting] = useState(false);
  const [pageTranslateStatus, setPageTranslateStatus] = useState("");
  const pageTranslateStatusTimerRef = useRef(null);

  useEffect(() => {
    chrome.storage.local.get(UPDATE_STATE_KEY, (value) => {
      setUpdateState({
        ...createDefaultUpdateState(currentVersion),
        ...(value[UPDATE_STATE_KEY] || {}),
      });
    });

    chrome.storage.sync.get(
      {
        ollamaProvider: DEFAULT_TRANSLATE_PROVIDER,
        ollamaAutoTranslateMode: DEFAULT_AUTO_TRANSLATE_MODE,
        ollamaAutoTranslateSelection: false,
        ollamaHoverTranslateScope: DEFAULT_HOVER_TRANSLATE_SCOPE,
        ollamaAppEnabled: true,
      },
      (value) => {
        setProvider(normalizeTranslateProvider(value.ollamaProvider));
        setAutoTranslateMode(
          normalizeAutoTranslateMode(
            value.ollamaAutoTranslateMode,
            value.ollamaAutoTranslateSelection,
          ),
        );
        setHoverTranslateScope(
          normalizeHoverTranslateScope(value.ollamaHoverTranslateScope),
        );
        setAppEnabled(value.ollamaAppEnabled !== false);
      },
    );
  }, [currentVersion]);

  useEffect(() => {
    function handleStorageChanged(changes, areaName) {
      if (areaName !== "sync") return;

      if ("ollamaAppEnabled" in changes) {
        setAppEnabled(changes.ollamaAppEnabled.newValue !== false);
      }

      if ("ollamaProvider" in changes) {
        setProvider(normalizeTranslateProvider(changes.ollamaProvider.newValue));
      }

      if ("ollamaAutoTranslateMode" in changes || "ollamaAutoTranslateSelection" in changes) {
        chrome.storage.sync.get(
          {
            ollamaAutoTranslateMode: DEFAULT_AUTO_TRANSLATE_MODE,
            ollamaAutoTranslateSelection: false,
          },
          (value) => {
            setAutoTranslateMode(
              normalizeAutoTranslateMode(
                value.ollamaAutoTranslateMode,
                value.ollamaAutoTranslateSelection,
              ),
            );
          },
        );
      }

      if ("ollamaHoverTranslateScope" in changes) {
        setHoverTranslateScope(
          normalizeHoverTranslateScope(changes.ollamaHoverTranslateScope.newValue),
        );
      }
    }

    chrome.storage.onChanged.addListener(handleStorageChanged);
    return () => chrome.storage.onChanged.removeListener(handleStorageChanged);
  }, []);

  useEffect(
    () => () => {
      if (pageTranslateStatusTimerRef.current) {
        clearTimeout(pageTranslateStatusTimerRef.current);
        pageTranslateStatusTimerRef.current = null;
      }
    },
    [],
  );

  function showPageTranslateStatus(message) {
    setPageTranslateStatus(message);
    if (pageTranslateStatusTimerRef.current) {
      clearTimeout(pageTranslateStatusTimerRef.current);
    }
    pageTranslateStatusTimerRef.current = window.setTimeout(() => {
      setPageTranslateStatus("");
      pageTranslateStatusTimerRef.current = null;
    }, 2800);
  }

  function openOptionsPage() {
    chrome.tabs.create({
      url: chrome.runtime.getURL("options/index.html"),
    });
    window.close();
  }

  function openUpdatePage() {
    if (!updateState.updateUrl) return;
    chrome.tabs.create({
      url: updateState.updateUrl,
    });
    window.close();
  }

  function updateSyncSettings(patch) {
    setIsSaving(true);
    chrome.storage.sync.set(patch, () => {
      setIsSaving(false);
    });
  }

  function handleAutoModeChange(mode) {
    setAutoTranslateMode(mode);
    updateSyncSettings({ ollamaAutoTranslateMode: mode });
  }

  function handleProviderChange(nextProvider) {
    const normalized = normalizeTranslateProvider(nextProvider);
    setProvider(normalized);
    updateSyncSettings({ ollamaProvider: normalized });
  }

  function handleHoverScopeChange(scope) {
    setHoverTranslateScope(scope);
    updateSyncSettings({ ollamaHoverTranslateScope: scope });
  }

  function handleAppToggle() {
    setAppEnabled((prev) => {
      const next = !prev;
      updateSyncSettings({ ollamaAppEnabled: next });
      return next;
    });
  }

  function handleStartPageTranslate() {
    if (isPageTranslateStarting) return;
    if (!appEnabled) {
      showPageTranslateStatus("应用已关闭，请先开启应用。");
      return;
    }

    setIsPageTranslateStarting(true);
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs?.[0]?.id;
      if (!tabId) {
        setIsPageTranslateStarting(false);
        showPageTranslateStatus("未找到当前标签页。");
        return;
      }

      chrome.tabs.sendMessage(
        tabId,
        { action: "startVisualPageTranslate" },
        (response) => {
          setIsPageTranslateStarting(false);
          if (chrome.runtime.lastError) {
            showPageTranslateStatus("当前页面不支持整页翻译。");
            return;
          }
          if (response?.ok) {
            showPageTranslateStatus("已启动：先翻译可视区域，滚动后继续。");
            return;
          }
          showPageTranslateStatus("启动失败，请重试。");
        },
      );
    });
  }

  return (
    <div className="popup">
      <div className="popup-hero">
        <div className="popup-hero__top">
          <div className="popup-hero__title-group">
            <h1>Ollama 翻译</h1>
            <button
              type="button"
              className={`popup-app-toggle${appEnabled ? " is-active" : ""}`}
              onClick={handleAppToggle}
              aria-pressed={appEnabled}
              aria-label={appEnabled ? "关闭应用" : "开启应用"}
              title={appEnabled ? "关闭应用" : "开启应用"}
            >
              <span className="popup-app-toggle__track" aria-hidden="true">
                <span className="popup-app-toggle__thumb" />
              </span>
              <span className="popup-app-toggle__text">{appEnabled ? "已开启" : "已关闭"}</span>
            </button>
          </div>
          <button type="button" className="btn btn-secondary btn-inline" onClick={openOptionsPage}>
            打开设置
          </button>
        </div>
        <div className="popup-hero__eyebrow">快捷面板</div>
        <p className="desc">在这里快速切换自动翻译模式，不用再进设置页。</p>
      </div>
      {updateState.status === "available" ? (
        <div className="popup-update-banner">
          <div className="popup-update-banner__title">
            发现新版本 {updateState.latestVersion}
          </div>
          <div className="popup-update-banner__text">
            需要手动下载安装，当前版本 {currentVersion}
          </div>
          <button type="button" className="btn btn-secondary" onClick={openUpdatePage}>
            打开更新页面
          </button>
        </div>
      ) : null}
      <section className="popup-panel popup-panel--subtle">
        <div className="popup-panel__header">
          <div>
            <div className="popup-panel__title">整页翻译</div>
            <div className="popup-panel__hint">可视区域优先，滚动到哪翻译到哪。</div>
          </div>
        </div>
        <button
          type="button"
          className="btn btn-primary popup-page-translate-btn"
          onClick={handleStartPageTranslate}
          disabled={!appEnabled || isPageTranslateStarting}
        >
          {isPageTranslateStarting ? "启动中..." : "开始整页翻译"}
        </button>
        {pageTranslateStatus ? (
          <div className="popup-page-translate-status">{pageTranslateStatus}</div>
        ) : null}
      </section>
      <section className="popup-panel popup-panel--subtle">
        <div className="popup-panel__header">
          <div>
            <div className="popup-panel__title">API 厂家</div>
            <div className="popup-panel__hint">翻译请求将发送到选中的厂家。</div>
          </div>
          {isSaving ? <div className="popup-status">已保存中</div> : null}
        </div>
        <select
          className="popup-provider-select"
          value={provider}
          onChange={(event) => handleProviderChange(event.target.value)}
        >
          {TRANSLATE_PROVIDER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </section>
      <section className="popup-panel">
        <div className="popup-panel__header">
          <div>
            <div className="popup-panel__title">自动翻译模式</div>
            <div className="popup-panel__hint">右键扩展图标也能快速切换。</div>
          </div>
        </div>
        <div className="popup-choice-grid">
          {AUTO_MODE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`popup-choice-card${
                autoTranslateMode === option.value ? " is-active" : ""
              }`}
              onClick={() => handleAutoModeChange(option.value)}
            >
              <div className="popup-choice-card__title">{option.title}</div>
              <div className="popup-choice-card__hint">{option.hint}</div>
            </button>
          ))}
        </div>
      </section>
      {autoTranslateMode === "hover" ? (
        <section className="popup-panel popup-panel--subtle">
          <div className="popup-panel__header">
            <div>
              <div className="popup-panel__title">悬停取词范围</div>
              <div className="popup-panel__hint">决定 hover 自动翻译时发送给 Ollama 的文本范围。</div>
            </div>
          </div>
          <div className="popup-choice-grid popup-choice-grid--compact">
            {HOVER_SCOPE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`popup-choice-card popup-choice-card--compact${
                  hoverTranslateScope === option.value ? " is-active" : ""
                }`}
                onClick={() => handleHoverScopeChange(option.value)}
              >
                <div className="popup-choice-card__title">{option.title}</div>
                <div className="popup-choice-card__hint">{option.hint}</div>
              </button>
            ))}
          </div>
        </section>
      ) : null}
      <p className="popup-version">当前版本 {currentVersion}</p>
    </div>
  );
}
