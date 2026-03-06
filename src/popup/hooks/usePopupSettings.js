import { useCallback, useEffect, useState } from "react";
import { useTemporaryMessage } from "../../shared/hooks/useTemporaryMessage.js";
import {
  DEFAULT_TRANSLATE_PROVIDER,
  DEFAULT_AUTO_TRANSLATE_MODE,
  DEFAULT_HOVER_TRANSLATE_SCOPE,
} from "../../options/lib/constants.js";
import {
  normalizeTranslateProvider,
  normalizeAutoTranslateMode,
  normalizeHoverTranslateScope,
} from "../../shared/settings.js";

/**
 * 管理弹出窗口设置的自定义 Hook
 * 处理设置的读取、更新和同步
 */
export function usePopupSettings() {
  const [provider, setProvider] = useState(DEFAULT_TRANSLATE_PROVIDER);
  const [autoTranslateMode, setAutoTranslateMode] = useState(
    DEFAULT_AUTO_TRANSLATE_MODE,
  );
  const [hoverTranslateScope, setHoverTranslateScope] = useState(
    DEFAULT_HOVER_TRANSLATE_SCOPE,
  );
  const [appEnabled, setAppEnabled] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // 初始加载设置
  useEffect(() => {
    chrome.storage.sync.get(
      {
        ollamaProvider: DEFAULT_TRANSLATE_PROVIDER,
        ollamaAutoTranslateMode: DEFAULT_AUTO_TRANSLATE_MODE,
        ollamaAutoTranslateSelection: false,
        ollamaHoverTranslateScope: DEFAULT_HOVER_TRANSLATE_SCOPE,
        appEnabled: true,
        minimaxRegion: undefined,
      },
      (value) => {
        setProvider(
          normalizeTranslateProvider(value.ollamaProvider, value.minimaxRegion),
        );
        setAutoTranslateMode(
          normalizeAutoTranslateMode(
            value.ollamaAutoTranslateMode,
            value.ollamaAutoTranslateSelection,
          ),
        );
        setHoverTranslateScope(
          normalizeHoverTranslateScope(value.ollamaHoverTranslateScope),
        );
        setAppEnabled(value.appEnabled !== false);
      },
    );
  }, []);

  // 监听存储变化
  useEffect(() => {
    function handleStorageChanged(changes, areaName) {
      if (areaName !== "sync") return;

      if ("appEnabled" in changes) {
        setAppEnabled(changes.appEnabled?.newValue !== false);
      }

      if ("ollamaProvider" in changes) {
        chrome.storage.sync.get(
          {
            ollamaProvider: DEFAULT_TRANSLATE_PROVIDER,
            minimaxRegion: undefined,
          },
          (v) => {
            setProvider(
              normalizeTranslateProvider(v.ollamaProvider, v.minimaxRegion),
            );
          },
        );
      }

      if (
        "ollamaAutoTranslateMode" in changes ||
        "ollamaAutoTranslateSelection" in changes
      ) {
        chrome.storage.sync.get(
          {
            ollamaAutoTranslateMode: DEFAULT_AUTO_TRANSLATE_MODE,
            ollamaAutoTranslateSelection: false,
          },
          (value) => {
            setAutoTranslateMode(
              normalizeAutoTranslateMode(
                value.ollamaAutoTranslateMode,
                value.ollamaAutoTranslateSelection,
              ),
            );
          },
        );
      }

      if ("ollamaHoverTranslateScope" in changes) {
        setHoverTranslateScope(
          normalizeHoverTranslateScope(
            changes.ollamaHoverTranslateScope.newValue,
          ),
        );
      }
    }

    chrome.storage.onChanged.addListener(handleStorageChanged);
    return () => chrome.storage.onChanged.removeListener(handleStorageChanged);
  }, []);

  // 同步设置到存储
  const syncSettings = useCallback((updates) => {
    setIsSaving(true);
    chrome.storage.sync.set(updates, () => {
      setIsSaving(false);
    });
  }, []);

  // 更新提供商
  const updateProvider = useCallback(
    (nextProvider) => {
      const normalized = normalizeTranslateProvider(nextProvider);
      setProvider(normalized);
      syncSettings({ ollamaProvider: normalized });
    },
    [syncSettings],
  );

  // 更新自动翻译模式
  const updateAutoTranslateMode = useCallback(
    (mode) => {
      setAutoTranslateMode(mode);
      syncSettings({ ollamaAutoTranslateMode: mode });
    },
    [syncSettings],
  );

  // 更新悬停范围
  const updateHoverTranslateScope = useCallback(
    (scope) => {
      setHoverTranslateScope(scope);
      syncSettings({ ollamaHoverTranslateScope: scope });
    },
    [syncSettings],
  );

  // 切换应用开关
  const toggleAppEnabled = useCallback(() => {
    setAppEnabled((prevEnabled) => {
      const nextEnabled = !prevEnabled;
      syncSettings({ appEnabled: nextEnabled });
      return nextEnabled;
    });
  }, [syncSettings]);

  return {
    provider,
    autoTranslateMode,
    hoverTranslateScope,
    appEnabled,
    isSaving,
    updateProvider,
    updateAutoTranslateMode,
    updateHoverTranslateScope,
    toggleAppEnabled,
  };
}

/**
 * 管理整页翻译功能的 Hook
 */
export function usePageTranslate(appEnabled) {
  const [isStarting, setIsStarting] = useState(false);
  const { message: status, showMessage: showStatus } =
    useTemporaryMessage(2800);

  const startPageTranslate = useCallback(() => {
    if (isStarting) return;

    if (!appEnabled) {
      showStatus("应用已关闭，请先开启应用。");
      return;
    }

    setIsStarting(true);
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs?.[0]?.id;
      if (!tabId) {
        setIsStarting(false);
        showStatus("未找到当前标签页。");
        return;
      }

      chrome.tabs.sendMessage(
        tabId,
        { action: "startVisualPageTranslate" },
        (response) => {
          setIsStarting(false);
          if (chrome.runtime.lastError) {
            showStatus("当前页面不支持整页翻译。");
            return;
          }
          if (response?.ok) {
            showStatus("已启动：先翻译可视区域，滚动后继续。");
            return;
          }
          showStatus("启动失败，请重试。");
        },
      );
    });
  }, [appEnabled, isStarting, showStatus]);

  return {
    isStarting,
    status,
    startPageTranslate,
  };
}
