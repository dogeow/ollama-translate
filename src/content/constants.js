/** 滑词翻译 content script 使用的 DOM ID 常量 */

export const BUTTON_ID = "ollama-translate-hover-btn";
export const TIP_ID = "ollama-translate-tip";
export const STYLE_ID = "ollama-translate-hover-styles";
export const SHORTCUT_HINT_ID = "ollama-translate-shortcut-hint";

// TARGET_LANG_LABELS 已迁移至 shared/constants.js
export { TARGET_LANG_LABELS } from "../shared/constants.js";

/** 检查应用是否启用 */
export async function isAppEnabled() {
  try {
    const value = await chrome.storage.sync.get("ollamaAppEnabled");
    return value.ollamaAppEnabled !== false;
  } catch {
    return true;
  }
}
