export function storageSyncGet(defaults) {
  return new Promise((resolve) => {
    chrome.storage.sync.get(defaults, (value) => resolve(value));
  });
}

export function storageSyncSet(value) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set(value, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
}

export function storageLocalGet(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (value) => resolve(value[key] || {}));
  });
}

export function runtimeSendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (value) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(value);
    });
  });
}

export function commandsGetAll() {
  return new Promise((resolve) => {
    if (!chrome.commands?.getAll) {
      resolve([]);
      return;
    }
    chrome.commands.getAll((commands) => resolve(commands || []));
  });
}

export function tabsCreate(url) {
  return new Promise((resolve, reject) => {
    try {
      chrome.tabs.create({ url }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      });
    } catch (error) {
      reject(error);
    }
  });
}
