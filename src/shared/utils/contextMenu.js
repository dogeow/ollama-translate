/**
 * Context menu management for browser extension
 */

import {
  normalizeAutoTranslateMode,
  normalizeHoverTranslateScope,
} from "../settings.js";
import { DEFAULT_APP_ENABLED } from "../constants.js";

// Context menu IDs
export const MENU_TRANSLATE_SELECTION = "ollama-translate";
export const MENU_TRANSLATE_PAGE = "ollama-translate-page";
export const MENU_OPEN_OPTIONS = "ollama-open-options";
export const MENU_AUTO_MODE_PARENT = "ollama-auto-translate-mode";
export const MENU_AUTO_MODE_OFF = "ollama-auto-translate-mode-off";
export const MENU_AUTO_MODE_SELECTION = "ollama-auto-translate-mode-selection";
export const MENU_AUTO_MODE_HOVER = "ollama-auto-translate-mode-hover";
export const MENU_HOVER_SCOPE_PARENT = "ollama-hover-translate-scope";
export const MENU_HOVER_SCOPE_WORD = "ollama-hover-translate-scope-word";
export const MENU_HOVER_SCOPE_PARAGRAPH =
  "ollama-hover-translate-scope-paragraph";

/**
 * Read menu-related settings from Chrome storage
 * @returns {Promise<{autoTranslateMode: string, hoverTranslateScope: string, appEnabled: boolean}>}
 */
export async function readMenuSettings() {
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

/**
 * Create all context menus with current settings
 * @returns {Promise<void>}
 */
export async function createContextMenus() {
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
