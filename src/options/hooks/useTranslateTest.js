import { useState } from "react";
import { DEFAULT_TRANSLATE_TARGET_LANG } from "../../shared/constants.js";
import { getConfig, runGenerateRequest } from "../lib/utils.js";

/**
 * 管理翻译测试面板状态的 hook
 */
export function useTranslateTest({ settingsRef, setConnectionStatus, setOriginsModalOpen }) {
  const [testInput, setTestInput] = useState("");
  const [testSourceLang, setTestSourceLang] = useState("auto");
  const [testTargetLang, setTestTargetLang] = useState(DEFAULT_TRANSLATE_TARGET_LANG);
  const [detectLangResult, setDetectLangResult] = useState({ text: "", isError: false });
  const [testTranslateHint, setTestTranslateHint] = useState({ text: "", isError: false });
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

  async function probeOrigin(base) {
    const probe = await fetch(`${base}/api/__probe_origin__`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    return probe.status !== 403;
  }

  async function runDetectLanguage() {
    const text = testInput.trim();
    if (!text) {
      setDetectLangResult({ text: "请先输入要识别的文本", isError: true });
      return;
    }

    const { base, model } = getConfig(settingsRef.current);
    if (!model) {
      setDetectLangResult({ text: "请先选择模型", isError: true });
      return;
    }

    setDetectLangResult({ text: "识别中…", isError: false });

    try {
      const probeOk = await probeOrigin(base);
      if (!probeOk) {
        setDetectLangResult({ text: "", isError: false });
        show403();
        return;
      }

      const prompt =
        "Identify the language of the following text. Reply with only one word: the language name in English (e.g. Chinese, English, Japanese, French, German, Spanish, Korean). No other text.\n\n" +
        text;
      const language = await runGenerateRequest(base, model, prompt);
      setDetectLangResult({
        text: language ? `识别为：${language.replace(/\.$/, "")}` : "未能识别",
        isError: false,
      });
    } catch (error) {
      setDetectLangResult({
        text:
          (error.message || String(error)) === "Failed to fetch"
            ? "Ollama 连接失败"
            : error.message || String(error),
        isError: true,
      });
      setOriginsModalOpen(true);
    }
  }

  async function runTranslateTest() {
    const text = testInput.trim();
    if (!text) {
      setTestTranslateHint({ text: "请先输入要翻译的文本", isError: true });
      setTestTranslateResult({ text: "", tone: "empty" });
      return;
    }

    const { base, model } = getConfig(settingsRef.current);
    if (!model) {
      setTestTranslateHint({ text: "请先选择模型", isError: true });
      setTestTranslateResult({ text: "", tone: "empty" });
      return;
    }

    setTestTranslateHint({ text: "", isError: false });
    setTestTranslateResult({ text: "翻译中…", tone: "normal" });

    try {
      const probeOk = await probeOrigin(base);
      if (!probeOk) {
        setTestTranslateResult({ text: "", tone: "empty" });
        show403();
        return;
      }

      const prompt =
        testSourceLang === "auto"
          ? `Translate the following text to ${testTargetLang}. Detect the source language automatically. Only output the translation, no explanation or extra text.\n\n${text}`
          : `Translate the following text from ${testSourceLang} to ${testTargetLang}. Only output the translation, no explanation or extra text.\n\n${text}`;
      const translation = await runGenerateRequest(base, model, prompt);
      setTestTranslateResult({
        text: translation || "（模型未返回内容）",
        tone: "normal",
      });
    } catch (error) {
      setTestTranslateResult({
        text:
          (error.message || String(error)) === "Failed to fetch"
            ? "Ollama 连接失败"
            : error.message || String(error),
        tone: "error",
      });
      setOriginsModalOpen(true);
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
