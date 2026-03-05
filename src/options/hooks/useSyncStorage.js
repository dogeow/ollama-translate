import { useCallback, useState } from "react";

/**
 * 管理浏览器存储同步的自定义 Hook
 * 简化设置的读写操作
 * 
 * @param {Object} initialState - 初始状态对象
 * @returns {Object} - 包含状态、更新函数和保存状态的工具
 */
export function useSyncStorage(initialState = {}) {
  const [state, setState] = useState(initialState);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  /**
   * 更新并同步状态到 chrome.storage.sync
   */
  const updateAndSync = useCallback((updates) => {
    setState((prevState) => {
      const nextState = { ...prevState, ...updates };
      setIsSaving(true);
      setSaveError(null);

      chrome.storage.sync.set(updates, () => {
        setIsSaving(false);
        if (chrome.runtime.lastError) {
          setSaveError(chrome.runtime.lastError.message);
          console.error("Failed to sync storage:", chrome.runtime.lastError);
        }
      });

      return nextState;
    });
  }, []);

  /**
   * 批量更新状态
   */
  const batchUpdate = useCallback((updater) => {
    setState((prevState) => {
      const updates = typeof updater === "function" ? updater(prevState) : updater;
      return { ...prevState, ...updates };
    });
  }, []);

  /**
   * 重置为初始状态
   */
  const resetState = useCallback(() => {
    setState(initialState);
  }, [initialState]);

  return {
    state,
    setState,
    updateAndSync,
    batchUpdate,
    resetState,
    isSaving,
    saveError,
  };
}
