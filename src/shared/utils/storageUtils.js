/**
 * Chrome Storage 操作的通用工具函数
 * 提供统一的错误处理和数据规范化
 */

/**
 * 从 chrome.storage.sync 读取数据
 * @param {Object} defaults - 默认值对象
 * @returns {Promise<Object>} 读取的数据
 */
export function readSyncStorage(defaults = {}) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(defaults, (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(result);
      }
    });
  });
}

/**
 * 写入数据到 chrome.storage.sync
 * @param {Object} data - 要写入的数据
 * @returns {Promise<void>}
 */
export function writeSyncStorage(data) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set(data, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

/**
 * 从 chrome.storage.local 读取数据
 * @param {Object} defaults - 默认值对象
 * @returns {Promise<Object>} 读取的数据
 */
export function readLocalStorage(defaults = {}) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(defaults, (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(result);
      }
    });
  });
}

/**
 * 写入数据到 chrome.storage.local
 * @param {Object} data - 要写入的数据
 * @returns {Promise<void>}
 */
export function writeLocalStorage(data) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(data, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

/**
 * 监听 storage 变化
 * @param {Function} callback - 回调函数 (changes, areaName) => void
 * @returns {Function} 移除监听器的函数
 */
export function onStorageChanged(callback) {
  chrome.storage.onChanged.addListener(callback);
  return () => chrome.storage.onChanged.removeListener(callback);
}

/**
 * 安全地读取存储值，提供类型转换
 * @param {string} key - 键名
 * @param {*} defaultValue - 默认值
 * @param {Function} normalizer - 规范化函数
 * @returns {Promise<*>} 规范化后的值
 */
export async function readNormalizedValue(key, defaultValue, normalizer = (v) => v) {
  try {
    const result = await readSyncStorage({ [key]: defaultValue });
    return normalizer(result[key]);
  } catch (error) {
    console.error(`Failed to read ${key} from storage:`, error);
    return normalizer(defaultValue);
  }
}
