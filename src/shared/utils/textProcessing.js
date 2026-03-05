/**
 * Text processing utilities for translation and content manipulation
 */

const THINK_BLOCK_RE = /<think\b[^>]*>([\s\S]*?)<\/think>/gi;
const THINK_OPEN_TAG_RE = /<think\b[^>]*>/i;
const THINK_ANY_TAG_RE = /<\/?think\b[^>]*>/i;
const RATE_LIMIT_ERROR_RE =
  /(?:\b429\b|rate[ -]?limit|too many requests|usage limit|quota)/i;

/**
 * Normalize text for display by cleaning whitespace and line breaks
 * @param {string} text - Raw text to normalize
 * @returns {string} Normalized text
 */
export function normalizeDisplayText(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Split thinking tags from translation text
 * @param {string} text - Text potentially containing <think> tags
 * @returns {{translation: string, thinking: string}} Separated translation and thinking content
 */
export function splitThinkingFromText(text) {
  const raw = String(text || "");
  if (!raw) return { translation: "", thinking: "" };

  const thinkParts = [];
  let stripped = raw.replace(THINK_BLOCK_RE, (_, inner = "") => {
    const cleaned = normalizeDisplayText(inner);
    if (cleaned) thinkParts.push(cleaned);
    return "\n";
  });

  const danglingMatch = THINK_OPEN_TAG_RE.exec(stripped);
  if (danglingMatch) {
    const dangling = normalizeDisplayText(
      stripped.slice(danglingMatch.index).replace(THINK_OPEN_TAG_RE, ""),
    );
    if (dangling) thinkParts.push(dangling);
    stripped = stripped.slice(0, danglingMatch.index);
  }

  return {
    translation: normalizeDisplayText(stripped),
    thinking: normalizeDisplayText(thinkParts.join("\n\n")),
  };
}

/**
 * Merge multiple thinking segments, removing duplicates
 * @param {...string} segments - Thinking segments to merge
 * @returns {string} Merged and deduplicated thinking content
 */
export function mergeThinking(...segments) {
  const uniqueSegments = [];
  segments.forEach((segment) => {
    const value = normalizeDisplayText(segment);
    if (!value) return;
    if (uniqueSegments.includes(value)) return;
    uniqueSegments.push(value);
  });

  return uniqueSegments.join("\n\n");
}

/**
 * Build a translation prompt for single text
 * @param {string} text - Text to translate
 * @param {string} targetLang - Target language
 * @returns {string} Translation prompt
 */
export function buildTranslatePrompt(text, targetLang) {
  return `Translate the following text to ${targetLang}. Only output the translation, no explanation or extra text.\n\n${text}`;
}

/**
 * Build a translation prompt for batch processing
 * @param {string[]} texts - Array of texts to translate
 * @param {string} targetLang - Target language
 * @returns {string} Batch translation prompt
 */
export function buildPageBatchTranslatePrompt(texts, targetLang) {
  return [
    `Translate each item in the JSON array to ${targetLang}.`,
    "Rules:",
    "1. Keep the same order and item count.",
    "2. Return ONLY a valid JSON array of strings.",
    "3. Do not include markdown, comments, or extra fields.",
    "4. Preserve placeholders, numbers, and URLs.",
    "",
    "Input JSON:",
    JSON.stringify(texts),
  ].join("\n");
}

/**
 * Extract clean translation text, filtering out thinking tags
 * @param {string} rawText - Raw translation text
 * @returns {string} Clean translation text
 */
export function extractDisplayTranslation(rawText) {
  const raw = String(rawText ?? "");
  if (!raw.trim()) return "";

  const parsed = splitThinkingFromText(raw);
  const cleaned = normalizeDisplayText(parsed.translation);
  if (cleaned) return cleaned;

  if (THINK_ANY_TAG_RE.test(raw)) {
    // 包含 think 标签但无有效译文时，宁可返回空，避免把思考内容写回页面
    return "";
  }

  return normalizeDisplayText(raw);
}

/**
 * Normalize a single translation item from batch response
 * @param {string|object} item - Translation item (string or object)
 * @returns {string} Normalized translation
 */
export function normalizeBatchTranslationItem(item) {
  if (typeof item === "string") {
    return extractDisplayTranslation(item);
  }
  if (item && typeof item === "object") {
    const text = String(
      item.translation || item.translated || item.text || "",
    ).trim();
    if (!text) return "";
    return extractDisplayTranslation(text);
  }
  return "";
}

/**
 * Extract the first valid JSON array string from text
 * @param {string} rawText - Text potentially containing JSON array
 * @returns {string} Extracted JSON array string or empty string
 */
export function extractFirstJsonArrayString(rawText) {
  const source = String(rawText || "");
  if (!source) return "";

  let inString = false;
  let escaped = false;
  let depth = 0;
  let start = -1;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "[") {
      if (depth === 0) start = i;
      depth += 1;
      continue;
    }

    if (char === "]" && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        return source.slice(start, i + 1);
      }
    }
  }

  return "";
}

/**
 * Check if an error message indicates a rate limit error
 * @param {string} errorMessage - Error message to check
 * @returns {boolean} True if rate limit error
 */
export function isRateLimitError(errorMessage) {
  return RATE_LIMIT_ERROR_RE.test(String(errorMessage || ""));
}

/**
 * Parse batch translations from AI response
 * @param {string} rawText - Raw AI response text
 * @param {number} expectedCount - Expected number of translations
 * @returns {string[]} Array of parsed translations (empty if parsing fails)
 */
export function parsePageBatchTranslations(rawText, expectedCount) {
  const raw = String(rawText || "").trim();
  if (!raw || expectedCount <= 0) return [];

  const strippedFence = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const jsonCandidates = [
    raw,
    strippedFence,
    extractFirstJsonArrayString(raw),
    extractFirstJsonArrayString(strippedFence),
  ].filter(Boolean);

  for (const candidate of jsonCandidates) {
    if (!candidate) continue;
    try {
      const payload = JSON.parse(candidate);
      const list = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.translations)
          ? payload.translations
          : [];
      if (!Array.isArray(list) || list.length === 0) continue;

      const normalized = list
        .slice(0, expectedCount)
        .map(normalizeBatchTranslationItem);
      if (normalized.length === expectedCount && normalized.every(Boolean)) {
        return normalized;
      }
    } catch (_) {}
  }

  return [];
}
