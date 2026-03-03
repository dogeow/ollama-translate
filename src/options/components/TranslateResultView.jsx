import { useState } from "react";
import { TARGET_LANG_LABELS } from "../lib/constants.js";

export function TranslateResultView({ result, onBack }) {
  const [copyLabel, setCopyLabel] = useState("复制译文");
  const targetLabel =
    TARGET_LANG_LABELS[result?.targetLang || "Chinese"] ||
    result?.targetLang ||
    "中文";

  async function copyTranslation() {
    if (!result?.translation) return;
    try {
      await navigator.clipboard.writeText(result.translation);
      setCopyLabel("已复制");
    } catch (_) {
      setCopyLabel("复制失败");
    }
    window.setTimeout(() => {
      setCopyLabel("复制译文");
    }, 1500);
  }

  return (
    <div className="translate-result">
      <h1>翻译结果</h1>
      <p className="translate-result-hint">翻译为：{targetLabel}</p>
      {result?.error ? <div className="error">{result.error}</div> : null}
      <div className="section">
        <label>原文</label>
        <div className="text-block">{result?.original || ""}</div>
      </div>
      <div className="section">
        <label>译文</label>
        <div className="text-block">{result?.translation || "（无译文）"}</div>
      </div>
      <button type="button" className="btn btn-secondary" onClick={copyTranslation}>
        {copyLabel}
      </button>
      <button type="button" className="link" onClick={onBack}>
        ← 返回设置
      </button>
    </div>
  );
}
