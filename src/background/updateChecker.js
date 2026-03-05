/**
 * 扩展更新检查相关工具函数
 * 从 background.js 中提取
 */

import { createDefaultUpdateState, readUpdateFeed, compareExtensionVersions, UPDATE_STATE_KEY } from "../shared/update.js";

const UPDATE_CHECK_ALARM = "extension-update-check";
const UPDATE_CHECK_INTERVAL_MINUTES = 360; // 6 小时
const UPDATE_MANIFEST_URL = "https://raw.githubusercontent.com/likunyan/ollama-translate/main/latest.json";

/**
 * 持久化更新状态
 */
export async function persistUpdateState(partialState) {
  const currentVersion = chrome.runtime.getManifest().version;
  const stored = await chrome.storage.local.get(UPDATE_STATE_KEY);
  const previousState =
    stored?.[UPDATE_STATE_KEY] || createDefaultUpdateState(currentVersion);
  const nextState = {
    ...previousState,
    ...partialState,
    currentVersion,
  };
  await chrome.storage.local.set({ [UPDATE_STATE_KEY]: nextState });
  return nextState;
}

/**
 * 读取存储的更新状态
 */
export async function readStoredUpdateState() {
  const stored = await chrome.storage.local.get(UPDATE_STATE_KEY);
  const currentVersion = chrome.runtime.getManifest().version;
  return stored?.[UPDATE_STATE_KEY] || createDefaultUpdateState(currentVersion);
}

/**
 * 更新扩展图标徽章
 */
export async function updateActionBadge(updateState) {
  if (!chrome.action?.setBadgeText || !chrome.action?.setBadgeBackgroundColor) {
    return;
  }

  if (updateState.status === "available") {
    await chrome.action.setBadgeText({ text: "NEW" });
    await chrome.action.setBadgeBackgroundColor({ color: "#EA4335" });
  } else {
    await chrome.action.setBadgeText({ text: "" });
  }
}

/**
 * 确保更新检查定时器存在
 */
export async function ensureUpdateCheckAlarm() {
  const existing = await chrome.alarms.get(UPDATE_CHECK_ALARM);
  if (!existing) {
    await chrome.alarms.create(UPDATE_CHECK_ALARM, {
      delayInMinutes: 1,
      periodInMinutes: UPDATE_CHECK_INTERVAL_MINUTES,
    });
  }
}

/**
 * 检查扩展更新
 * @param {Object} options - 配置选项
 * @param {boolean} options.silent - 是否静默检查（不更新徽章）
 * @returns {Promise<Object>} 更新状态
 */
export async function checkForExtensionUpdate(options = {}) {
  const { silent = false } = options;
  const currentVersion = chrome.runtime.getManifest().version;

  try {
    const manifestUrl = `${UPDATE_MANIFEST_URL}?t=${Date.now()}`;
    const response = await fetch(manifestUrl, {
      method: "GET",
      cache: "no-cache",
      headers: {
        "Cache-Control": "no-cache",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = readUpdateFeed(await response.json());
    const comparison = compareExtensionVersions(
      currentVersion,
      payload.version,
    );

    if (comparison === "outdated") {
      const nextState = await persistUpdateState({
        status: "available",
        latestVersion: payload.version,
        updateUrl: payload.url,
        lastChecked: Date.now(),
      });
      if (!silent) {
        await updateActionBadge(nextState);
      }
      return nextState;
    } else {
      return await persistUpdateState({
        status: "up-to-date",
        lastChecked: Date.now(),
      });
    }
  } catch (error) {
    console.error("Update check failed:", error);
    return await persistUpdateState({
      status: "error",
      lastChecked: Date.now(),
    });
  }
}
