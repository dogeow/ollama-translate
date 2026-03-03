import { useEffect, useMemo, useState } from "react";
import { TARGET_LANG_LABELS } from "../constants.js";
import { formatModelSize } from "../format.js";

function getModelName(model) {
  return typeof model === "string" ? model : model?.name || "";
}

function getModelDisplay(model) {
  const name = getModelName(model);
  if (!name) return "";
  const size =
    typeof model === "object" && model?.size != null ? formatModelSize(model.size) : "";
  return size ? `${name} (${size})` : name;
}

function getErrorMessage(error) {
  if (error === "403") {
    return "Ollama 拒绝了扩展的请求（403）。请在终端设置 OLLAMA_ORIGINS 环境变量后重启 Ollama。";
  }
  return "无法连接 Ollama。请确认本机已启动 Ollama（终端运行 ollama serve）。";
}

function SentenceStudyPlaceholder() {
  return (
    <div className="ollama-tip-section ollama-tip-grammar-section">
      <div className="ollama-tip-label">句型学习</div>
      <div className="ollama-tip-loading">分析中...</div>
      <div className="ollama-tip-placeholder ollama-tip-placeholder--title"></div>
      <div className="ollama-tip-placeholder"></div>
      <div className="ollama-tip-placeholder"></div>
    </div>
  );
}

function SentenceStudySection({ sentenceStudy }) {
  if (!sentenceStudy || !Array.isArray(sentenceStudy.parts) || sentenceStudy.parts.length === 0) {
    return null;
  }

  return (
    <div className="ollama-tip-section ollama-tip-grammar-section">
      <div className="ollama-tip-label">句型学习</div>
      <div className="ollama-tip-grammar-pattern">
        主句结构：{sentenceStudy.pattern || "句型分析"}
      </div>
      <div className="ollama-tip-grammar-parts">
        {sentenceStudy.parts.map((part, index) => (
          <div key={`${part.text}-${index}`} className="ollama-tip-grammar-part">
            <div className="ollama-tip-grammar-text">{part.text}</div>
            {part.translation ? (
              <div className="ollama-tip-grammar-translation">{part.translation}</div>
            ) : null}
            <div className="ollama-tip-grammar-line"></div>
            <div className="ollama-tip-grammar-role">{part.label}</div>
            {part.note ? <div className="ollama-tip-grammar-note">{part.note}</div> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function NeedModelSection({ result, onTranslateWithModel }) {
  const firstModel = useMemo(
    () => getModelName(result.models?.[0]),
    [result.models],
  );
  const [selectedModel, setSelectedModel] = useState(firstModel);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setSelectedModel(firstModel);
    setIsSubmitting(false);
  }, [firstModel, result.original]);

  async function handleTranslate() {
    if (!selectedModel || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onTranslateWithModel(selectedModel);
    } catch (_) {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <div className="ollama-tip-section">
        <div className="ollama-tip-label">请选择模型</div>
        <select
          className="ollama-tip-model-select"
          value={selectedModel}
          onChange={(event) => setSelectedModel(event.target.value)}
        >
          {(result.models || []).map((model) => {
            const name = getModelName(model);
            if (!name) return null;
            return (
              <option key={name} value={name}>
                {getModelDisplay(model)}
              </option>
            );
          })}
        </select>
      </div>
      <div className="ollama-tip-section">
        <div className="ollama-tip-label">原文</div>
        <div className="ollama-tip-text">{result.original || ""}</div>
      </div>
      <button
        type="button"
        className="ollama-tip-translate-btn"
        disabled={!selectedModel || isSubmitting}
        onClick={() => void handleTranslate()}
      >
        {isSubmitting ? "翻译中..." : "翻译"}
      </button>
    </>
  );
}

export function TipView({ result, onClose, onTranslateWithModel }) {
  const [copyLabel, setCopyLabel] = useState("复制译文");
  const targetLabel =
    (result.targetLang && TARGET_LANG_LABELS[result.targetLang]) ||
    result.targetLang ||
    "中文";
  const modelLabel = result.model ? `模型：${result.model}` : "";

  useEffect(() => {
    setCopyLabel("复制译文");
  }, [result.translation, result.requestId]);

  async function handleCopy() {
    if (!result.translation) return;
    try {
      await navigator.clipboard.writeText(result.translation);
      setCopyLabel("已复制");
      window.setTimeout(() => setCopyLabel("复制译文"), 1200);
    } catch (_) {}
  }

  let body = null;

  if (result.pending) {
    body = (
      <>
        {modelLabel ? <div className="ollama-tip-model">{modelLabel}</div> : null}
        <div className="ollama-tip-section">
          <div className="ollama-tip-label">原文</div>
          <div className="ollama-tip-text">{result.original || ""}</div>
        </div>
        <div className="ollama-tip-section">
          <div className="ollama-tip-label">译文</div>
          <div className="ollama-tip-loading">翻译中...</div>
          <div className="ollama-tip-placeholder"></div>
          <div className="ollama-tip-placeholder ollama-tip-placeholder--short"></div>
        </div>
        {result.learningModeEnabled ? <SentenceStudyPlaceholder /> : null}
      </>
    );
  } else if (result.needModel && Array.isArray(result.models) && result.models.length > 0) {
    body = <NeedModelSection result={result} onTranslateWithModel={onTranslateWithModel} />;
  } else if (result.needModel && result.error) {
    body = (
      <>
        <div className="ollama-tip-section">
          <div className="ollama-tip-error">{getErrorMessage(result.error)}</div>
        </div>
        <div className="ollama-tip-section">
          <div className="ollama-tip-label">原文</div>
          <div className="ollama-tip-text">{result.original || ""}</div>
        </div>
      </>
    );
  } else {
    const shouldShowSentenceStudy =
      !result.error && result.translation && result.learningModeEnabled;

    body = (
      <>
        {modelLabel ? <div className="ollama-tip-model">{modelLabel}</div> : null}
        {result.error ? (
          <div className="ollama-tip-section">
            <div className="ollama-tip-error">{result.error}</div>
          </div>
        ) : null}
        <div className="ollama-tip-section">
          <div className="ollama-tip-label">原文</div>
          <div className="ollama-tip-text">{result.original || ""}</div>
        </div>
        <div className="ollama-tip-section">
          <div className="ollama-tip-label">译文</div>
          <div className="ollama-tip-text">
            {result.error ? "—" : result.translation || "（无译文）"}
          </div>
        </div>
        {shouldShowSentenceStudy ? (
          result.sentenceStudyPending ? (
            <SentenceStudyPlaceholder />
          ) : result.sentenceStudy ? (
            <SentenceStudySection sentenceStudy={result.sentenceStudy} />
          ) : (
            <div className="ollama-tip-section ollama-tip-grammar-section">
              <div className="ollama-tip-label">句型学习</div>
              <div className="ollama-tip-grammar-empty">
                句型学习未生成，可重试一次或更换模型。
              </div>
            </div>
          )
        ) : null}
        {!result.error && result.translation ? (
          <button type="button" className="ollama-tip-copy" onClick={() => void handleCopy()}>
            {copyLabel}
          </button>
        ) : null}
      </>
    );
  }

  return (
    <>
      <div className="ollama-tip-header">
        <span className="ollama-tip-title">翻译为：{targetLabel}</span>
        <button type="button" className="ollama-tip-close" aria-label="关闭" onClick={onClose}>
          ×
        </button>
      </div>
      {body}
    </>
  );
}
