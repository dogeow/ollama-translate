/**
 * 文本处理和翻译 Prompt 相关工具函数
 * 从 background.js 中提取
 */

/**
 * 规范化显示文本
 * 移除多余空格和换行符
 */
export function normalizeDisplayText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 从 AI 响应中分离思考过程和翻译内容
 * 支持 <think> 标签
 */
export function splitThinkingFromText(text) {
  const THINK_BLOCK_RE = /<think\b[^>]*>([\s\S]*?)<\/think>/gi;
  const THINK_OPEN_TAG_RE = /<think\b[^>]*>/i;
  
  const raw = String(text || "");
  const thinkingParts = [];
  let stripped = raw.replace(THINK_BLOCK_RE, (match, inner) => {
    const cleaned = normalizeDisplayText(inner);
    if (cleaned) thinkingParts.push(cleaned);
    return "";
  });

  const danglingMatch = THINK_OPEN_TAG_RE.exec(stripped);
  if (danglingMatch) {
    const dangling = normalizeDisplayText(
      stripped.slice(danglingMatch.index + danglingMatch[0].length),
    );
    if (dangling) thinkingParts.push(dangling);
    stripped = stripped.slice(0, danglingMatch.index);
  }

  return {
    thinking: thinkingParts.join(" "),
    translation: normalizeDisplayText(stripped),
  };
}

/**
 * 合并多个思考过程片段
 */
export function mergeThinking(...segments) {
  const parts = [];
  for (const segment of segments) {
    const value = normalizeDisplayText(segment);
    if (value) parts.push(value);
  }
  return parts.join(" ");
}

/**
 * 构建翻译 Prompt
 */
export function buildTranslatePrompt(text, targetLang) {
  return `请将以下内容翻译成${targetLang}，直接输出翻译结果：\n\n${text}`;
}

/**
 * 构建批量翻译 Prompt（整页翻译）
 */
export function buildPageBatchTranslatePrompt(texts, targetLang) {
  const numbered = texts.map((t, i) => `${i + 1}. ${t}`).join("\n");
  return `请将以下${texts.length}段内容翻译成${targetLang}。
输出 JSON 数组格式：["翻译1", "翻译2", ...]

原文：
${numbered}`;
}

/**
 * 从 AI 响应中提取翻译结果
 * 自动处理思考标签和空格
 */
export function extractDisplayTranslation(rawText) {
  const raw = String(rawText ?? "");
  if (!raw.trim()) return "";

  const parsed = splitThinkingFromText(raw);
  const cleaned = normalizeDisplayText(parsed.translation);

  return cleaned || normalizeDisplayText(raw);
}

/**
 * 规范化批量翻译项
 */
export function normalizeBatchTranslationItem(item) {
  if (typeof item === "string") {
    return normalizeDisplayText(item);
  }
  if (item && typeof item === "object") {
    const text = String(
      item.translation || item.text || item.result || "",
    ).trim();
    return normalizeDisplayText(text);
  }
  return "";
}

/**
 * 从文本中提取第一个 JSON 数组字符串
 * 支持多种格式，智能识别
 */
export function extractFirstJsonArrayString(rawText) {
  const source = String(rawText || "");

  const arrayMatch = source.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    return arrayMatch[0];
  }

  const jsonBlockMatch = source.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonBlockMatch?.[1]?.trim()) {
    const content = jsonBlockMatch[1].trim();
    const innerMatch = content.match(/\[[\s\S]*\]/);
    if (innerMatch) return innerMatch[0];
    return content;
  }

  const codeBlockMatch = source.match(/```\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch?.[1]?.trim()) {
    const content = codeBlockMatch[1].trim();
    const innerMatch = content.match(/\[[\s\S]*\]/);
    if (innerMatch) return innerMatch[0];
    return content;
  }

  return null;
}

/**
 * 检查是否为限流错误
 */
export function isRateLimitError(errorMessage) {
  const RATE_LIMIT_ERROR_RE = /(?:\b429\b|rate[ -]?limit|too many requests|usage limit|quota)/i;
  return RATE_LIMIT_ERROR_RE.test(String(errorMessage || ""));
}

/**
 * 解析批量翻译结果
 * 返回翻译数组或空数组
 */
export function parsePageBatchTranslations(rawText, expectedCount) {
  const raw = String(rawText || "").trim();
  if (!raw) return [];

  const candidates = [raw];
  const jsonString = extractFirstJsonArrayString(raw);
  if (jsonString && jsonString !== raw) {
    candidates.unshift(jsonString);
  }

  for (const candidate of candidates) {
    try {
      const payload = JSON.parse(candidate);
      const list = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.translations)
          ? payload.translations
          : [];

      const normalized = list.map(normalizeBatchTranslationItem).filter(Boolean);
      if (normalized.length === expectedCount) {
        return normalized;
      }
    } catch {
      // 继续尝试下一个候选
    }
  }

  return [];
}
