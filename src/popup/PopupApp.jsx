import { useEffect, useState } from "react";
import { createDefaultUpdateState, UPDATE_STATE_KEY } from "../shared/update.js";
import {
  DEFAULT_AUTO_TRANSLATE_MODE,
  DEFAULT_HOVER_TRANSLATE_SCOPE,
} from "../options/lib/constants.js";
import {
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
  const [autoTranslateMode, setAutoTranslateMode] = useState(DEFAULT_AUTO_TRANSLATE_MODE);
  const [hoverTranslateScope, setHoverTranslateScope] = useState(DEFAULT_HOVER_TRANSLATE_SCOPE);
  const [appEnabled, setAppEnabled] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    chrome.storage.local.get(UPDATE_STATE_KEY, (value) => {
      setUpdateState({
        ...createDefaultUpdateState(currentVersion),
        ...(value[UPDATE_STATE_KEY] || {}),
      });
    });

    chrome.storage.sync.get(
      {
        ollamaAutoTranslateMode: DEFAULT_AUTO_TRANSLATE_MODE,
        ollamaAutoTranslateSelection: false,
        ollamaHoverTranslateScope: DEFAULT_HOVER_TRANSLATE_SCOPE,
        ollamaAppEnabled: true,
      },
      (value) => {
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
      <section className="popup-panel">
        <div className="popup-panel__header">
          <div>
            <div className="popup-panel__title">自动翻译模式</div>
            <div className="popup-panel__hint">右键扩展图标也能快速切换。</div>
          </div>
          {isSaving ? <div className="popup-status">已保存中</div> : null}
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
