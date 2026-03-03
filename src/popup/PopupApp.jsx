import { useEffect, useState } from "react";
import { createDefaultUpdateState, UPDATE_STATE_KEY } from "../shared/update.js";

export function PopupApp() {
  const currentVersion = chrome.runtime.getManifest().version;
  const [updateState, setUpdateState] = useState(createDefaultUpdateState(currentVersion));

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
      <h1>Ollama 翻译</h1>
      <p className="desc">选中文字后右键 →「Ollama 翻译选中内容」</p>
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
      <button type="button" className="btn btn-primary" onClick={openOptionsPage}>
        打开设置
      </button>
      <p className="popup-version">当前版本 {currentVersion}</p>
    </div>
  );
}
