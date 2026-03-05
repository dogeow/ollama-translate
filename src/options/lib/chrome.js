function wrapChromeCallback(callback) {
  return new Promise((resolve, reject) => {
    try {
      callback((result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(result);
      });
    } catch (error) {
      reject(error);
    }
  });
}

export function storageSyncGet(defaults) {
  return wrapChromeCallback((cb) => chrome.storage.sync.get(defaults, cb));
}

export function storageSyncSet(value) {
  return wrapChromeCallback((cb) => chrome.storage.sync.set(value, cb));
}

export function storageLocalGet(key) {
  return wrapChromeCallback((cb) =>
    chrome.storage.local.get(key, (v) => cb(v[key] || {})),
  );
}

export function runtimeSendMessage(message) {
  return wrapChromeCallback((cb) => chrome.runtime.sendMessage(message, cb));
}

export function commandsGetAll() {
  if (!chrome.commands?.getAll) {
    return Promise.resolve([]);
  }
  return wrapChromeCallback((cb) => chrome.commands.getAll(cb));
}

export function tabsCreate(url) {
  return wrapChromeCallback((cb) => chrome.tabs.create({ url }, cb));
}
