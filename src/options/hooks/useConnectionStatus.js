import { useCallback, useRef, useState } from "react";
import { getConfig } from "../lib/utils.js";

/**
 * 管理 Ollama 连接状态的 hook
 * 处理连接检测、模型列表获取和 403 错误弹窗
 */
export function useConnectionStatus({ settingsRef, updateSettings, persistSettings }) {
  const [connectionStatus, setConnectionStatus] = useState({
    kind: "pending",
    text: "检测中…",
    showAction: false,
  });
  const [models, setModels] = useState([]);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [originsModalOpen, setOriginsModalOpen] = useState(false);
  const [testConnectionResult, setTestConnectionResult] = useState({
    text: "",
    tone: "",
    showAction: false,
  });
  const connectionRequestIdRef = useRef(0);

  function handle403(preserveTestMessage) {
    setConnectionStatus({
      kind: "403",
      text: "Ollama 已运行，但拒绝扩展请求（403）",
      showAction: true,
    });
    setModels([]);
    if (!preserveTestMessage) {
      setTestConnectionResult({
        text: "Ollama 已运行，但拒绝扩展请求（403）",
        tone: "err",
        showAction: true,
      });
    }
  }

  const updateConnectionStatus = useCallback(
    async (nextSettings, options = {}) => {
      const { skipModalOnError = false, preserveTestMessage = false } = options;
      const requestId = ++connectionRequestIdRef.current;
      setConnectionStatus({
        kind: "pending",
        text: "检测中…",
        showAction: false,
      });
      setModelDropdownOpen(false);

      const { base } = getConfig(nextSettings);

      try {
        const tagsResponse = await fetch(`${base}/api/tags`, { method: "GET" });
        if (requestId !== connectionRequestIdRef.current) return;

        if (tagsResponse.status === 403) {
          handle403(preserveTestMessage);
          if (!skipModalOnError) setOriginsModalOpen(true);
          return;
        }

        if (!tagsResponse.ok) {
          throw new Error(`HTTP ${tagsResponse.status}`);
        }

        const tagsData = await tagsResponse.json();
        const nextModels = tagsData.models || [];
        const probeResponse = await fetch(`${base}/api/__probe_origin__`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });

        if (requestId !== connectionRequestIdRef.current) return;

        if (probeResponse.status === 403) {
          handle403(preserveTestMessage);
          if (!skipModalOnError) setOriginsModalOpen(true);
          return;
        }

        setConnectionStatus({
          kind: "ok",
          text: "Ollama 已运行",
          showAction: false,
        });
        setModels(nextModels);
        setOriginsModalOpen(false);

        if (!preserveTestMessage) {
          setTestConnectionResult({
            text:
              nextModels.length > 0
                ? `连接成功，已拉取 ${nextModels.length} 个模型`
                : "连接成功，但未找到已拉取的模型",
            tone: "ok",
            showAction: false,
          });
        }

        const currentModel = nextSettings.ollamaModel;
        const names = nextModels.map((model) => model.name);
        const selectedModel = names.includes(currentModel) ? currentModel : names[0] || "";

        if (selectedModel !== currentModel) {
          const correctedSettings = {
            ...settingsRef.current,
            ollamaModel: selectedModel,
          };
          settingsRef.current = correctedSettings;
          updateSettings(
            () => correctedSettings,
            "none",
          );
          await persistSettings(correctedSettings, { silent: true });
        }
      } catch (error) {
        if (requestId !== connectionRequestIdRef.current) return;
        setConnectionStatus({
          kind: "err",
          text: "Ollama 未连接",
          showAction: true,
        });
        setModels([]);
        if (!preserveTestMessage) {
          setTestConnectionResult({
            text:
              (error.message || String(error)) === "Failed to fetch"
                ? "Ollama 连接失败"
                : error.message || String(error),
            tone: "err",
            showAction: true,
          });
        }
        if (!skipModalOnError) setOriginsModalOpen(true);
      }
    },
    [settingsRef, updateSettings, persistSettings],
  );

  return {
    connectionStatus,
    setConnectionStatus,
    models,
    modelDropdownOpen,
    setModelDropdownOpen,
    originsModalOpen,
    setOriginsModalOpen,
    testConnectionResult,
    updateConnectionStatus,
  };
}
