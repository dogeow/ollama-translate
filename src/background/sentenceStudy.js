import { generateOllamaResponse } from "./ollama.js";

const SENTENCE_STUDY_MAX_TEXT_LENGTH = 1200;
const SENTENCE_PART_LABELS = new Set([
  "主语",
  "系动词",
  "谓语",
  "宾语",
  "表语",
  "状语",
  "从句",
  "定语",
  "主句",
  "补足成分",
  "助动词",
  "动词",
  "成分",
]);

function normalizeInlineWhitespace(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizePartTranslation(text) {
  return String(text || "")
    .trim()
    .replace(/^["'“”‘’\s]+|["'“”‘’\s]+$/g, "")
    .replace(/^(中文|释义|翻译)[:：]\s*/u, "")
    .replace(/^[\-\d.)\s]+/, "")
    .replace(/[。；;]+$/u, "")
    .trim()
    .slice(0, 40);
}

function hasLatinLetters(text) {
  return /[A-Za-z]/.test(String(text || ""));
}

function hasKana(text) {
  return /[\u3040-\u30ff\u31f0-\u31ff]/.test(String(text || ""));
}

function getFirstSentence(text) {
  const normalized = String(text || "").trim();
  if (!normalized) return "";
  const match = normalized.match(/^.*?[.!?](?=\s|$)/);
  return (match ? match[0] : normalized).trim();
}

function extractJsonObject(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;

  const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1].trim() : raw;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return candidate.slice(start, end + 1);
}

function normalizeSentenceStudy(data) {
  if (!data || typeof data !== "object") return null;

  const pattern = String(data.pattern || "").trim().slice(0, 80);
  const parts = [];

  if (Array.isArray(data.parts)) {
    data.parts.slice(0, 6).forEach((part) => {
      const text = String(part?.text || "")
        .trim()
        .slice(0, 120);
      if (!text) return;
      const previousLabel = getLastPart(parts)?.label || "";
      const rawLabel = String(part?.label || "")
        .trim()
        .slice(0, 40);
      const label = SENTENCE_PART_LABELS.has(rawLabel)
        ? rawLabel
        : inferPartLabel(text, previousLabel);
      parts.push({
        text,
        translation: String(part?.translation || "")
          .trim()
          .slice(0, 120),
        label,
        note: String(part?.note || "")
          .trim()
          .slice(0, 80),
      });
    });
  }

  if (!pattern || parts.length === 0) return null;

  return {
    pattern,
    parts,
  };
}

function getLastPart(parts) {
  return parts.length > 0 ? parts[parts.length - 1] : null;
}

function joinPartTexts(parts) {
  return parts
    .map((part) => String(part?.text || "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+([,.;:?!])/g, "$1")
    .trim();
}

function inferSentencePattern(parts) {
  const labels = parts
    .map((part) => String(part.label || "").trim())
    .filter(Boolean);
  return labels.join("+") || "句型分析";
}

function normalizeSentencePattern(pattern, parts) {
  const raw = String(pattern || "").trim();
  if (!raw) return inferSentencePattern(parts);
  if (raw.length > 40) return inferSentencePattern(parts);
  if (/[A-Za-z]{3,}/.test(raw)) return inferSentencePattern(parts);
  if (hasKana(raw)) return inferSentencePattern(parts);
  return raw;
}

function inferPartLabel(text, previousLabel = "") {
  const trimmed = String(text || "").trim();
  const firstWord = trimmed
    .replace(/^[^A-Za-z]+/, "")
    .split(/\s+/)[0]
    ?.toLowerCase();
  if (!trimmed) return "成分";
  if (/^(am|is|are|was|were|be|been|being)$/i.test(trimmed)) return "系动词";
  if (
    /^(do|does|did|have|has|had|can|could|will|would|should|may|might|must)$/i.test(
      trimmed,
    )
  ) {
    return "助动词";
  }
  if (!previousLabel) return "主语";
  if (previousLabel === "主语") return "谓语";
  if (previousLabel === "系动词") return "表语";
  if (
    [
      "for",
      "to",
      "without",
      "with",
      "in",
      "on",
      "at",
      "by",
      "from",
      "as",
      "if",
      "when",
      "while",
      "because",
      "after",
      "before",
      "during",
      "through",
      "into",
      "about",
      "over",
      "under",
    ].includes(firstWord)
  ) {
    return "状语";
  }
  return "补足成分";
}

function mergeLeadingSubjectPhrase(parts) {
  if (!Array.isArray(parts) || parts.length < 2) return parts || [];
  const verbLabels = new Set(["系动词", "谓语", "助动词", "动词"]);
  const boundaryLabels = new Set(["状语", "从句", "表语", "宾语"]);
  const firstVerbIndex = parts.findIndex((part) =>
    verbLabels.has(String(part.label || "").trim()),
  );
  if (firstVerbIndex <= 0) return parts;

  const leading = parts.slice(0, firstVerbIndex);
  if (
    leading.some((part, index) => {
      const label = String(part.label || "").trim();
      if (index === 0) return false;
      return boundaryLabels.has(label);
    })
  ) {
    return parts;
  }

  return [
    {
      text: joinPartTexts(leading),
      translation: "",
      label: "主语",
      note: "",
    },
    ...parts.slice(firstVerbIndex),
  ];
}

function splitLeakedSubjectVerb(part) {
  if (String(part?.label || "").trim() !== "主语") return [part];
  const match = String(part.text || "").match(
    /^(.*?)(?:\s+)(am|is|are|was|were|be|been|being)$/i,
  );
  if (!match) return [part];
  const subjectText = match[1].trim();
  const verbText = match[2].trim();
  if (!subjectText || !verbText) return [part];
  return [
    {
      ...part,
      text: subjectText,
      translation: "",
      note: part.note || "",
    },
    {
      text: verbText,
      translation: "",
      label: "系动词",
      note: "",
    },
  ];
}

function pushSentencePart(parts, part) {
  const text = String(part?.text || "");
  if (!normalizeInlineWhitespace(text)) return;
  const normalized = {
    text: text.trim(),
    translation: String(part?.translation || "").trim(),
    label: String(part?.label || "").trim() || inferPartLabel(text),
    note: String(part?.note || "").trim(),
  };
  if (/^[.?!,:;]+$/.test(normalized.text) && parts.length > 0) {
    parts[parts.length - 1].text += normalized.text;
    return;
  }
  parts.push(normalized);
}

function finalizeSentenceStudy(sentenceStudy) {
  if (!sentenceStudy || !Array.isArray(sentenceStudy.parts)) return null;
  const parts = mergeLeadingSubjectPhrase(sentenceStudy.parts);
  if (parts.length === 0) return null;
  return {
    pattern: normalizeSentencePattern(sentenceStudy.pattern, parts),
    parts,
  };
}

function validateSentenceStudyCoverage(original, sentenceStudy) {
  if (!sentenceStudy || !Array.isArray(sentenceStudy.parts)) return null;

  const targetSentence = getFirstSentence(original);
  if (!targetSentence) return null;

  let cursor = 0;
  for (const part of sentenceStudy.parts) {
    const index = targetSentence.indexOf(part.text, cursor);
    if (index === -1) return null;
    if (normalizeInlineWhitespace(targetSentence.slice(cursor, index)) !== "") {
      return null;
    }
    const end = index + part.text.length;
    const previousChar = index > 0 ? targetSentence[index - 1] : "";
    const nextChar = end < targetSentence.length ? targetSentence[end] : "";
    const firstChar = part.text[0] || "";
    const lastChar = part.text[part.text.length - 1] || "";
    if (/[A-Za-z]/.test(previousChar) && /[A-Za-z]/.test(firstChar)) {
      return null;
    }
    if (/[A-Za-z]/.test(lastChar) && /[A-Za-z]/.test(nextChar)) {
      return null;
    }
    if (!SENTENCE_PART_LABELS.has(String(part.label || "").trim())) {
      return null;
    }
    cursor = end;
  }

  if (normalizeInlineWhitespace(targetSentence.slice(cursor)) !== "") {
    return null;
  }

  const combined = normalizeInlineWhitespace(
    sentenceStudy.parts.map((part) => part.text).join(" "),
  );
  if (combined !== normalizeInlineWhitespace(targetSentence)) return null;

  return sentenceStudy;
}

function repairSentenceStudyCoverage(original, sentenceStudy) {
  if (!sentenceStudy || !Array.isArray(sentenceStudy.parts)) return null;
  const targetSentence = getFirstSentence(original);
  if (!targetSentence) return null;

  if (validateSentenceStudyCoverage(original, sentenceStudy)) {
    return sentenceStudy;
  }

  const rawParts = sentenceStudy.parts.flatMap(splitLeakedSubjectVerb);
  const repairedParts = [];
  let cursor = 0;

  for (const rawPart of rawParts) {
    let candidate = String(rawPart.text || "").trim();
    if (!candidate) continue;
    let index = targetSentence.indexOf(candidate, cursor);
    if (index === -1) {
      const withoutTrailingPunctuation = candidate.replace(/[.?!,:;]+$/, "");
      if (withoutTrailingPunctuation && withoutTrailingPunctuation !== candidate) {
        candidate = withoutTrailingPunctuation;
        index = targetSentence.indexOf(candidate, cursor);
      }
    }
    if (index === -1) continue;

    const gap = targetSentence.slice(cursor, index);
    if (normalizeInlineWhitespace(gap)) {
      pushSentencePart(repairedParts, {
        text: gap,
        label: inferPartLabel(gap, getLastPart(repairedParts)?.label),
      });
    }

    pushSentencePart(repairedParts, {
      ...rawPart,
      text: targetSentence.slice(index, index + candidate.length),
    });
    cursor = index + candidate.length;
  }

  const tail = targetSentence.slice(cursor);
  if (normalizeInlineWhitespace(tail)) {
    pushSentencePart(repairedParts, {
      text: tail,
      label: inferPartLabel(tail, getLastPart(repairedParts)?.label),
    });
  }

  if (repairedParts.length === 0) return null;

  return finalizeSentenceStudy({
    pattern: sentenceStudy.pattern || inferSentencePattern(repairedParts),
    parts: repairedParts,
  });
}

function buildHeuristicSentenceStudy(original) {
  const targetSentence = getFirstSentence(original);
  if (!targetSentence) return null;

  const parts = [];
  const words = targetSentence.split(/\s+/);
  const verbIndex = words.findIndex((word) =>
    /^(am|is|are|was|were|be|been|being|do|does|did|have|has|had|can|could|will|would|should|may|might|must)$/i.test(
      word.replace(/[.?!,:;]+$/g, ""),
    ),
  );

  if (verbIndex > 0) {
    const subject = words.slice(0, verbIndex).join(" ");
    const verb = words[verbIndex];
    const rest = words.slice(verbIndex + 1).join(" ");
    pushSentencePart(parts, { text: subject, label: "主语" });
    pushSentencePart(parts, { text: verb, label: inferPartLabel(verb, "主语") });
    if (rest) {
      const restChunks = rest
        .split(/\s+(?=without|with|in|on|at|by|from|as|if|when|while|because|after|before)\b/i)
        .filter(Boolean);
      restChunks.forEach((chunk, index) => {
        pushSentencePart(parts, {
          text: chunk,
          label: index === 0 && /^(for|to)\b/i.test(chunk) ? "表语" : "状语",
        });
      });
    }
  } else {
    pushSentencePart(parts, { text: targetSentence, label: "主句" });
  }

  return parts.length > 0
    ? finalizeSentenceStudy({
        pattern: inferSentencePattern(parts),
        parts,
      })
    : null;
}

function getStaticPartTranslation(part) {
  const text = String(part?.text || "")
    .trim()
    .replace(/[.?!,:;]+$/g, "")
    .toLowerCase();
  const label = String(part?.label || "").trim();

  if (!text) return "";
  if (label === "系动词") {
    if (["am", "is", "are", "was", "were", "be", "been", "being"].includes(text)) {
      return "是";
    }
  }
  if (text === "this") return "这";
  if (text === "that") return "那";
  if (text === "these") return "这些";
  if (text === "those") return "那些";
  if (text === "in") return "在";
  if (text === "on") return "在";
  if (text === "at") return "在";
  if (text === "by") return "通过";
  if (text === "with") return "带有";
  if (text === "without") return "不需";
  if (text === "for") return "用于";
  if (text === "to") return "去";
  return "";
}

function combinePrepositionalTranslation(preposition, bodyTranslation) {
  const prefix = String(preposition || "").trim().toLowerCase();
  const body = sanitizePartTranslation(bodyTranslation);
  if (!body) return "";

  if (["in", "on", "at"].includes(prefix)) {
    return body.endsWith("中") || body.endsWith("内") ? `在${body}` : `在${body}中`;
  }
  if (prefix === "without") return `不需要${body}`;
  if (prefix === "with") return `带有${body}`;
  if (prefix === "by") return `通过${body}`;
  if (prefix === "for") return `用于${body}`;
  if (prefix === "to") return `去${body}`;
  return "";
}

function isReasonablePartTranslation(part, translation) {
  const value = sanitizePartTranslation(translation);
  if (!value) return false;
  if (/[\r\n]/.test(value)) return false;
  if (hasLatinLetters(value)) return false;

  const english = String(part?.text || "")
    .trim()
    .replace(/[.?!,:;]+$/g, "");
  const englishWordCount = english ? english.split(/\s+/).length : 0;
  const label = String(part?.label || "").trim();

  if (label === "系动词" && value.length > 4) return false;
  if (englishWordCount <= 1 && value.length > 8) return false;
  if (englishWordCount <= 2 && value.length > 14) return false;
  if (/[，,。；;]/u.test(value) && englishWordCount <= 2) return false;

  return true;
}

async function requestDirectPartTranslation(base, model, original, translation, part) {
  const prompt = `请把下面这个英文片段翻译成简短自然的简体中文短语，只输出中文结果，不要解释，不要引号。

整句原文：
${getFirstSentence(original)}

整句译文：
${translation || ""}

当前片段：
${part.text}

要求：
1. 只翻译当前片段本身，不要把别的片段意思带进来。
2. 输出必须是中文，不能保留英文单词。
3. 如果是功能词或短语，也要给出最贴切的中文作用义。`;

  try {
    const responseText = await generateOllamaResponse(base, model, prompt);
    const candidate = sanitizePartTranslation(responseText);
    if (!isReasonablePartTranslation(part, candidate)) return "";
    return candidate;
  } catch (_) {
    return "";
  }
}

async function requestPhraseBodyTranslation(base, model, original, translation, text) {
  const prompt = `请把下面这个英文名词短语或短语主体翻译成简短自然的简体中文，只输出中文结果，不要解释，不要引号。

整句原文：
${getFirstSentence(original)}

整句译文：
${translation || ""}

短语：
${text}`;

  try {
    const responseText = await generateOllamaResponse(base, model, prompt);
    const candidate = sanitizePartTranslation(responseText);
    if (!candidate || hasLatinLetters(candidate)) return "";
    return candidate;
  } catch (_) {
    return "";
  }
}

async function requestPartTranslation(
  base,
  model,
  original,
  translation,
  sentenceStudy,
  index,
) {
  const part = sentenceStudy.parts[index];
  if (!part) return "";

  const staticTranslation = getStaticPartTranslation(part);
  if (staticTranslation) return staticTranslation;

  const pieces = sentenceStudy.parts.map((item, itemIndex) => ({
    index: itemIndex + 1,
    text: item.text,
    label: item.label,
  }));

  const prompt = `你在帮助中文用户学习英文句子结构。现在只翻译其中一个英文片段，只输出这个片段本身在整句中的简短中文意思，不要吞并别的片段意思。

整句原文：
${getFirstSentence(original)}

整句译文：
${translation || ""}

整句片段（按顺序）：
${JSON.stringify(pieces, null, 2)}

当前片段：
${JSON.stringify(
  {
    index: index + 1,
    text: part.text,
    label: part.label,
    previous: sentenceStudy.parts[index - 1]?.text || "",
    next: sentenceStudy.parts[index + 1]?.text || "",
  },
  null,
  2,
)}

要求：
1. 只输出一个中文短语，不要解释，不要 JSON，不要引号，不要序号。
2. 只能表达当前片段本身的意思，不能把前后片段的意思带进来。
3. 如果当前片段是功能词或系动词，只输出最短作用义，例如 "is" 输出 "是"。
4. 如果当前片段确实不适合单独翻译，输出空字符串。`;

  try {
    const responseText = await generateOllamaResponse(base, model, prompt);
    const candidate = sanitizePartTranslation(responseText);
    if (isReasonablePartTranslation(part, candidate)) return candidate;

    const directCandidate = await requestDirectPartTranslation(
      base,
      model,
      original,
      translation,
      part,
    );
    if (directCandidate) return directCandidate;

    const phraseMatch = String(part.text || "").trim().match(
      /^(in|on|at|by|with|without|for|to)\s+(.+)$/i,
    );
    if (phraseMatch) {
      const [, preposition, bodyText] = phraseMatch;
      const bodyTranslation = await requestPhraseBodyTranslation(
        base,
        model,
        original,
        translation,
        bodyText,
      );
      const combined = combinePrepositionalTranslation(preposition, bodyTranslation);
      if (isReasonablePartTranslation(part, combined)) return combined;
    }

    return "";
  } catch (_) {
    return "";
  }
}

async function requestSentenceStudy(base, model, original, prompt) {
  const responseText = await generateOllamaResponse(base, model, prompt);
  const jsonText = extractJsonObject(responseText);
  if (!jsonText) return null;
  const normalized = finalizeSentenceStudy(normalizeSentenceStudy(JSON.parse(jsonText)));
  return repairSentenceStudyCoverage(original, normalized);
}

async function fillSentenceStudyTranslations(
  base,
  model,
  original,
  translation,
  sentenceStudy,
) {
  if (!sentenceStudy || !Array.isArray(sentenceStudy.parts)) return sentenceStudy;
  const parts = [];

  for (let index = 0; index < sentenceStudy.parts.length; index += 1) {
    const part = sentenceStudy.parts[index];
    const partTranslation = await requestPartTranslation(
      base,
      model,
      original,
      translation,
      sentenceStudy,
      index,
    );
    parts.push({
      ...part,
      translation: partTranslation,
    });
  }

  return {
    ...sentenceStudy,
    parts,
  };
}

export async function analyzeSentenceStudy(base, model, original, translation) {
  const text = String(original || "").trim();
  if (!text || text.length > SENTENCE_STUDY_MAX_TEXT_LENGTH) return null;
  // 单个单词不做句型分析
  if (!/\s/.test(text)) return null;
  const targetSentence = getFirstSentence(text);
  if (!targetSentence) return null;

  const prompt = `你是一个给中文用户做外语句型学习的助手。请分析下面原文的句型结构，只返回 JSON，不要 markdown，不要额外解释。

返回格式：
{
  "pattern": "句型名称，简短中文",
  "parts": [
    {
      "text": "必须逐字符复制自原文的连续英文片段",
      "translation": "该片段的中文意思",
      "label": "句法角色",
      "note": "简短说明"
    }
  ]
}

规则：
1. 只分析第一句完整英文句子；如果第一句里有从句或较长短语，也必须完整覆盖，不能截断句子结尾。
2. parts 里的 text 必须逐字符复制自原文，保持原顺序，不重叠，不能改写、不能翻译。
3. 所有 parts.text 首尾拼接后，必须完整覆盖被分析的那一句，不能遗漏任何英文单词、短语或标点。
4. 主语必须只保留主语名词短语，不要把系动词、助动词或谓语动词放进主语。例如 "This domain is ..." 中，主语只能是 "This domain"，不能写成 "This domain is"。
5. parts 里的 translation 用简体中文，尽量准确简短。
6. label 使用简体中文，例如：主语、系动词、谓语、宾语、表语、状语、从句、定语。
7. note 使用简体中文，尽量短；如果没有额外学习价值，可以留空。
8. 优先按最自然的语法边界切分，通常 3 到 8 段。

原文：
${text}

译文：
${translation || ""}`;

  const repairPrompt = `请重新生成一个更严格的句型分析 JSON，只分析下面这一个英文句子。

目标句子：
${targetSentence}

你必须满足：
1. 只返回 JSON。
2. parts 必须按原顺序完整覆盖整句，不能遗漏任何单词、短语或句末标点。
3. 每个 text 都必须逐字符复制自目标句子。
4. 主语不要带系动词或谓语动词；例如 "This domain is ..." 中，主语只能是 "This domain"。
5. label 只用中文语法名称。
6. translation 用中文短语。
7. 如果 note 没必要，可留空字符串。

JSON 格式：
{
  "pattern": "句型名称，简短中文",
  "parts": [
    {
      "text": "英文原文片段",
      "translation": "中文短语",
      "label": "中文句法角色",
      "note": "简短中文说明"
    }
  ]
}`;

  try {
    const primary = await requestSentenceStudy(base, model, text, prompt);
    const repaired =
      primary || (await requestSentenceStudy(base, model, text, repairPrompt));
    const fallback = repaired || buildHeuristicSentenceStudy(text);
    if (!fallback) return null;
    return await fillSentenceStudyTranslations(base, model, text, translation, fallback);
  } catch (_) {
    const fallback = buildHeuristicSentenceStudy(text);
    if (!fallback) return null;
    return await fillSentenceStudyTranslations(base, model, text, translation, fallback);
  }
}
