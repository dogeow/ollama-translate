import { useEffect, useState } from "react";
import { createDefaultUpdateState, UPDATE_STATE_KEY } from "../shared/update.js";
import { TRANSLATE_PROVIDER_OPTIONS } from "../options/lib/constants.js";
import {
  AppToggle,
  UpdateBanner,
  Panel,
  ChoiceGrid,
} from "./components/PopupComponents.jsx";
import {
  usePopupSettings,
  usePageTranslate,
} from "./hooks/usePopupSettings.js";

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
  
  // 使用自定义 hooks 管理状态
  const popupSettings = usePopupSettings();
  const pageTranslate = usePageTranslate(popupSettings.appEnabled);

  // 加载更新状态
  useEffect(() => {
    chrome.storage.local.get(UPDATE_STATE_KEY, (value) => {
      setUpdateState({
        ...createDefaultUpdateState(currentVersion),
        ...(value[UPDATE_STATE_KEY] || {}),
      });
    });
  }, [currentVersion]);

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

  return (
    <div className="popup">
      <div className="popup-hero">
        <div className="popup-hero__top">
          <div className="popup-hero__title-group">
            <h1>Ollama 翻译</h1>
            <AppToggle
              enabled={popupSettings.appEnabled}
              onToggle={popupSettings.toggleAppEnabled}
            />
          </div>
          <button type="button" className="btn btn-secondary btn-inline" onClick={openOptionsPage}>
            打开设置
          </button>
        </div>
        <div className="popup-hero__eyebrow">快捷面板</div>
        <p className="desc">在这里快速切换自动翻译模式，不用再进设置页。</p>
      </div>
      {updateState.status === "available" && (
        <UpdateBanner
          latestVersion={updateState.latestVersion}
          currentVersion={currentVersion}
          onOpenUpdate={openUpdatePage}
        />
      )}
      <Panel
        title="整页翻译"
        hint="可视区域优先，滚动到哪翻译到哪。"
        isSubtle
      >
        <button
          type="button"
          className="btn btn-primary popup-page-translate-btn"
          onClick={pageTranslate.startPageTranslate}
          disabled={!popupSettings.appEnabled || pageTranslate.isStarting}
        >
          {pageTranslate.isStarting ? "启动中..." : "开始整页翻译"}
        </button>
        {pageTranslate.status && (
          <div className="popup-page-translate-status">{pageTranslate.status}</div>
        )}
      </Panel>
      <Panel
        title="API 厂家"
        hint="翻译请求将发送到选中的厂家。"
        isSubtle
        showStatus={popupSettings.isSaving}
      >
        <select
          className="popup-provider-select"
          value={popupSettings.provider}
          onChange={(e) => popupSettings.updateProvider(e.target.value)}
        >
          {TRANSLATE_PROVIDER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </Panel>
      <Panel
        title="自动翻译模式"
        hint="右键扩展图标也能快速切换。"
      >
        <ChoiceGrid
          options={AUTO_MODE_OPTIONS}
          value={popupSettings.autoTranslateMode}
          onChange={popupSettings.updateAutoTranslateMode}
        />
      </Panel>
      {popupSettings.autoTranslateMode === "hover" && (
        <Panel
          title="悬停取词范围"
          hint="决定 hover 自动翻译时发送给 Ollama 的文本范围。"
          isSubtle
        >
          <ChoiceGrid
            options={HOVER_SCOPE_OPTIONS}
            value={popupSettings.hoverTranslateScope}
            onChange={popupSettings.updateHoverTranslateScope}
            isCompact
          />
        </Panel>
      )}
      <p className="popup-version">当前版本 {currentVersion}</p>
    </div>
  );
}
