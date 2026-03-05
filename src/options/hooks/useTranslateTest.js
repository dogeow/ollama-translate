import { useState } from "react";
import {
  DEFAULT_TRANSLATE_TARGET_LANG,
  PROVIDER_MINIMAX,
} from "../../shared/constants.js";
import { isOllama403Error } from "../../shared/ollama-errors.js";
import { getConfig, runGenerateRequest } from "../lib/utils.js";

/**
 * 管理翻译测试面板状态的 hook
 */
export function useTranslateTest({
  settingsRef,
  setConnectionStatus,
  setOriginsModalOpen,
}) {
  const [testInput, setTestInput] = useState("");
  const [testSourceLang, setTestSourceLang] = useState("auto");
  const [testTargetLang, setTestTargetLang] = useState(
    DEFAULT_TRANSLATE_TARGET_LANG,
  );
  const [detectLangResult, setDetectLangResult] = useState({
    text: "",
    isError: false,
  });
  const [testTranslateHint, setTestTranslateHint] = useState({
    text: "",
    isError: false,
  });
  const [testTranslateResult, setTestTranslateResult] = useState({
    text: "",
    tone: "empty",
  });

  function show403() {
    setConnectionStatus({
      kind: "403",
      text: "Ollama 已运行，但拒绝扩展请求（403）",
      showAction: true,
    });
    setOriginsModalOpen(true);
  }

  function formatErrorMessage(error, provider) {
    return (error.message || String(error)) === "Failed to fetch"
      ? provider === PROVIDER_MINIMAX
        ? "MiniMax 连接失败"
        : "Ollama 连接失败"
      : error.message || String(error);
  }

  function getConfigValidationError(config) {
    if (!config.model) {
      return config.provider === PROVIDER_MINIMAX
        ? "请先填写 MiniMax 模型"
        : "请先选择模型";
    }
    if (config.provider === PROVIDER_MINIMAX && !config.apiKey) {
      return "请先填写 MiniMax API Key";
    }
    return "";
  }

  function handleProviderError(config, error) {
    if (config.provider !== PROVIDER_MINIMAX && isOllama403Error(error)) {
      show403();
      return true;
    }
    return false;
  }

  async function runDetectLanguage() {
    const text = testInput.trim();
    if (!text) {
      setDetectLangResult({ text: "请先输入要识别的文本", isError: true });
      return;
    }

    const config = getConfig(settingsRef.current);
    const validationError = getConfigValidationError(config);
    if (validationError) {
      setDetectLangResult({ text: validationError, isError: true });
      return;
    }

    setDetectLangResult({ text: "识别中…", isError: false });

    try {
      const prompt =
        "Identify the language of the following text. Reply with only one word: the language name in English (e.g. Chinese, English, Japanese, French, German, Spanish, Korean). No other text.\n\n" +
        text;
      const language = await runGenerateRequest(config, prompt);
      setDetectLangResult({
        text: language ? `识别为：${language.replace(/\.$/, "")}` : "未能识别",
        isError: false,
      });
    } catch (error) {
      if (handleProviderError(config, error)) {
        setDetectLangResult({ text: "", isError: false });
        return;
      }
      setDetectLangResult({
        text: formatErrorMessage(error, config.provider),
        isError: true,
      });
      if (config.provider !== PROVIDER_MINIMAX) {
        setOriginsModalOpen(true);
      }
    }
  }

  async function runTranslateTest() {
    const text = testInput.trim();
    if (!text) {
      setTestTranslateHint({ text: "请先输入要翻译的文本", isError: true });
      setTestTranslateResult({ text: "", tone: "empty" });
      return;
    }

    const config = getConfig(settingsRef.current);
    const validationError = getConfigValidationError(config);
    if (validationError) {
      setTestTranslateHint({ text: validationError, isError: true });
      setTestTranslateResult({ text: "", tone: "empty" });
      return;
    }

    setTestTranslateHint({ text: "", isError: false });
    setTestTranslateResult({ text: "翻译中…", tone: "normal" });

    try {
      const prompt =
        testSourceLang === "auto"
          ? `Translate the following text to ${testTargetLang}. Detect the source language automatically. Only output the translation, no explanation or extra text.\n\n${text}`
          : `Translate the following text from ${testSourceLang} to ${testTargetLang}. Only output the translation, no explanation or extra text.\n\n${text}`;
      const translation = await runGenerateRequest(config, prompt);
      setTestTranslateResult({
        text: translation || "（模型未返回内容）",
        tone: "normal",
      });
    } catch (error) {
      if (handleProviderError(config, error)) {
        setTestTranslateResult({ text: "", tone: "empty" });
        return;
      }
      setTestTranslateResult({
        text: formatErrorMessage(error, config.provider),
        tone: "error",
      });
      if (config.provider !== PROVIDER_MINIMAX) {
        setOriginsModalOpen(true);
      }
    }
  }

  return {
    testInput,
    setTestInput,
    testSourceLang,
    setTestSourceLang,
    testTargetLang,
    setTestTargetLang,
    detectLangResult,
    testTranslateHint,
    testTranslateResult,
    runDetectLanguage,
    runTranslateTest,
  };
}
