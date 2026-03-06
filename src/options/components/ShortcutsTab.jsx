import { useState } from "react";
import { ShortcutsList } from "./ShortcutsList.jsx";
import { SHORTCUTS_URL } from "../../shared/constants.js";
import { tabsCreate } from "../lib/chrome.js";

export function ShortcutsTab({ shortcuts }) {
  const [showShortcutsHint, setShowShortcutsHint] = useState(false);

  async function openShortcutsPage() {
    try {
      await tabsCreate(SHORTCUTS_URL);
      setShowShortcutsHint(false);
    } catch (_) {
      setShowShortcutsHint(true);
    }
  }

  return (
    <>
      <div className="card shortcuts-card">
        <h2>快捷键</h2>
        <p className="shortcuts-desc">
          选中页面文字后，可使用快捷键直接翻译（需在浏览器中先绑定按键）。
        </p>

        <ShortcutsList
          commands={shortcuts}
          supportsCommands={!!chrome.commands?.getAll}
        />
        <div className="shortcuts-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={openShortcutsPage}
          >
            打开浏览器快捷键设置
          </button>
          {showShortcutsHint ? (
            <span className="hint shortcuts-open-hint">
              若无法自动打开，请手动打开：扩展程序 → 键盘快捷方式（Chrome
              地址栏输入 <code>{SHORTCUTS_URL}</code>）
            </span>
          ) : null}
        </div>
      </div>
      <p className="shortcuts-hint">
        使用方式：选中文字后按快捷键；或将鼠标悬停在单词上按快捷键；或右键
        「Ollama 翻译选中内容」
      </p>
    </>
  );
}
