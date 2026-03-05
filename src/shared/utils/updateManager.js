/**
 * Extension update management utilities
 */

import {
  createDefaultUpdateState,
  readUpdateFeed,
  compareExtensionVersions,
  UPDATE_CHECK_ALARM_NAME,
  UPDATE_CHECK_PERIOD_MINUTES,
  UPDATE_MANIFEST_URL,
  UPDATE_STATE_KEY,
} from "../update.js";

// Re-export for use in background.js
export { UPDATE_CHECK_ALARM_NAME };

/**
 * Persist update state to local storage and update badge
 * @param {object} partialState - Partial update state
 * @returns {Promise<object>} Complete update state
 */
export async function persistUpdateState(partialState) {
  const currentVersion = chrome.runtime.getManifest().version;
  const nextState = {
    ...createDefaultUpdateState(currentVersion),
    ...partialState,
    currentVersion,
  };

  await chrome.storage.local.set({
    [UPDATE_STATE_KEY]: nextState,
  });
  await updateActionBadge(nextState);

  return nextState;
}

/**
 * Read stored update state from local storage
 * @returns {Promise<object>} Update state
 */
export async function readStoredUpdateState() {
  const stored = await chrome.storage.local.get(UPDATE_STATE_KEY);
  return {
    ...createDefaultUpdateState(chrome.runtime.getManifest().version),
    ...(stored[UPDATE_STATE_KEY] || {}),
  };
}

/**
 * Update extension action badge based on update status
 * @param {object} updateState - Update state
 * @returns {Promise<void>}
 */
export async function updateActionBadge(updateState) {
  if (!chrome.action?.setBadgeText) return;

  if (updateState.status === "available") {
    await chrome.action.setBadgeText({ text: "UP" }).catch(() => {});
    await chrome.action
      .setBadgeBackgroundColor({ color: "#dc2626" })
      .catch(() => {});
    await chrome.action
      .setTitle({
        title:
          `Ollama 翻译快捷面板\n发现新版本 ${updateState.latestVersion || ""}`.trim(),
      })
      .catch(() => {});
    return;
  }

  await chrome.action.setBadgeText({ text: "" }).catch(() => {});
  await chrome.action
    .setTitle({
      title: "Ollama 翻译快捷面板",
    })
    .catch(() => {});
}

/**
 * Ensure update check alarm is set up
 * @returns {Promise<void>}
 */
export async function ensureUpdateCheckAlarm() {
  if (!chrome.alarms) return;

  await chrome.alarms.clear(UPDATE_CHECK_ALARM_NAME);

  if (!UPDATE_MANIFEST_URL) {
    return;
  }

  await chrome.alarms.create(UPDATE_CHECK_ALARM_NAME, {
    delayInMinutes: 1,
    periodInMinutes: UPDATE_CHECK_PERIOD_MINUTES,
  });
}

/**
 * Check for extension updates
 * @param {object} options - Check options
 * @param {boolean} options.markChecking - Whether to mark as checking
 * @returns {Promise<object>} Update state
 */
export async function checkForExtensionUpdate(options = {}) {
  const { markChecking = false } = options;
  const currentVersion = chrome.runtime.getManifest().version;
  const manifestUrl = UPDATE_MANIFEST_URL;

  if (!manifestUrl) {
    return persistUpdateState({
      status: "error",
      manifestUrl,
      checkedAt: 0,
      latestVersion: "",
      updateUrl: "",
      notes: "",
      error: "",
    });
  }

  if (markChecking) {
    await persistUpdateState({
      status: "checking",
      manifestUrl,
      checkedAt: Date.now(),
      latestVersion: "",
      updateUrl: "",
      notes: "",
      error: "",
    });
  }

  try {
    const response = await fetch(manifestUrl, {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = readUpdateFeed(await response.json());
    const comparison = compareExtensionVersions(
      payload.version,
      currentVersion,
    );

    return persistUpdateState({
      status: comparison > 0 ? "available" : "up-to-date",
      manifestUrl,
      latestVersion: payload.version,
      updateUrl: payload.updateUrl,
      notes: payload.notes,
      checkedAt: Date.now(),
      error: "",
    });
  } catch (error) {
    return persistUpdateState({
      status: "error",
      manifestUrl,
      latestVersion: "",
      updateUrl: "",
      notes: "",
      checkedAt: Date.now(),
      error: error.message || String(error),
    });
  }
}
