import {
  DEFAULT_MINIMAX_API_URL,
  DEFAULT_MINIMAX_MODEL,
} from "./constants.js";

export function normalizeMiniMaxBaseUrl(base) {
  const raw = String(base || "").trim();
  if (!raw) return DEFAULT_MINIMAX_API_URL;
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withProtocol.replace(/\/$/, "");
}

function buildMiniMaxErrorMessage(status, responseText) {
  const fallback = `MiniMax 请求失败（HTTP ${status}）`;
  if (!responseText) return fallback;

  try {
    const payload = JSON.parse(responseText);
    const message =
      payload?.error?.message ||
      payload?.error?.msg ||
      payload?.message ||
      payload?.msg;
    if (!message) return fallback;
    return `${fallback}：${String(message).trim()}`;
  } catch (_) {
    const brief = String(responseText).trim().slice(0, 200);
    return brief ? `${fallback}：${brief}` : fallback;
  }
}

function flattenMessageContent(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  return content
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      if (typeof item.text === "string") return item.text;
      if (typeof item.output_text === "string") return item.output_text;
      return "";
    })
    .filter(Boolean)
    .join("");
}

function flattenMaybeText(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return flattenMessageContent(value);
  if (!value || typeof value !== "object") return "";
  if (typeof value.text === "string") return value.text;
  if (typeof value.output_text === "string") return value.output_text;
  if (Array.isArray(value.content)) return flattenMessageContent(value.content);
  return "";
}

function extractChoiceResponseText(choice) {
  return (
    flattenMaybeText(choice?.delta?.content) ||
    flattenMaybeText(choice?.message?.content) ||
    flattenMaybeText(choice?.content) ||
    flattenMaybeText(choice?.text)
  );
}

function extractChoiceThinkingText(choice) {
  return (
    flattenMaybeText(choice?.delta?.reasoning_content) ||
    flattenMaybeText(choice?.delta?.reasoning) ||
    flattenMaybeText(choice?.message?.reasoning_content) ||
    flattenMaybeText(choice?.message?.reasoning) ||
    flattenMaybeText(choice?.reasoning_content) ||
    flattenMaybeText(choice?.reasoning) ||
    flattenMaybeText(choice?.thinking)
  );
}

function parseMiniMaxErrorPayload(payload) {
  if (!payload || typeof payload !== "object" || !payload.error) return "";
  const message =
    payload?.error?.message ||
    payload?.error?.msg ||
    payload?.error?.detail ||
    "";
  return String(message || "").trim();
}

function parseMiniMaxChoicePayload(payload) {
  const choices = Array.isArray(payload?.choices) ? payload.choices : [];
  if (choices.length === 0) return { response: "", thinking: "" };

  let response = "";
  let thinking = "";
  choices.forEach((choice) => {
    response += extractChoiceResponseText(choice);
    thinking += extractChoiceThinkingText(choice);
  });

  return {
    response,
    thinking,
  };
}

function getMiniMaxAuthHeaders(apiKey) {
  const token = String(apiKey || "").trim();
  if (!token) {
    throw new Error("请先填写 MiniMax API Key。");
  }
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function normalizeMiniMaxModelName(model) {
  if (typeof model === "string") return model.trim();
  if (!model || typeof model !== "object") return "";
  return String(
    model.id || model.model || model.name || model.model_name || "",
  ).trim();
}

function mergeModelNamesWithDefault(names) {
  const deduped = Array.from(
    new Set(
      names
        .map((name) => String(name || "").trim())
        .filter(Boolean),
    ),
  );
  if (deduped.length === 0) return [DEFAULT_MINIMAX_MODEL];
  if (!deduped.includes(DEFAULT_MINIMAX_MODEL)) {
    deduped.unshift(DEFAULT_MINIMAX_MODEL);
  }
  return deduped;
}

async function requestMiniMaxChatCompletion(base, apiKey, body) {
  const normalizedBase = normalizeMiniMaxBaseUrl(base);

  const response = await fetch(`${normalizedBase}/chat/completions`, {
    method: "POST",
    headers: getMiniMaxAuthHeaders(apiKey),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(buildMiniMaxErrorMessage(response.status, text));
  }

  return response.json();
}

export async function generateMiniMaxCompletion(base, apiKey, model, prompt) {
  const payload = await requestMiniMaxChatCompletion(base, apiKey, {
    model: model || DEFAULT_MINIMAX_MODEL,
    messages: [{ role: "user", content: prompt }],
    stream: false,
  });

  const { response } = parseMiniMaxChoicePayload(payload);
  const text = String(response || "").trim();
  if (!text) {
    throw new Error("MiniMax 未返回可用内容。");
  }
  return text;
}

/**
 * 调用 MiniMax chat/completions（流式）
 * @param {string} base
 * @param {string} apiKey
 * @param {string} model
 * @param {string} prompt
 * @param {{ onChunk?: (chunk: { response: string, thinking: string }) => void }} [options]
 * @returns {Promise<{response: string, thinking: string}>}
 */
export async function generateMiniMaxStreamingCompletion(
  base,
  apiKey,
  model,
  prompt,
  options = {},
) {
  const { onChunk } = options;
  const normalizedBase = normalizeMiniMaxBaseUrl(base);
  const response = await fetch(`${normalizedBase}/chat/completions`, {
    method: "POST",
    headers: getMiniMaxAuthHeaders(apiKey),
    body: JSON.stringify({
      model: model || DEFAULT_MINIMAX_MODEL,
      messages: [{ role: "user", content: prompt }],
      stream: true,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(buildMiniMaxErrorMessage(response.status, text));
  }

  if (!response.body) {
    const payload = await response.json();
    const payloadError = parseMiniMaxErrorPayload(payload);
    if (payloadError) {
      throw new Error(payloadError);
    }
    const parsed = parseMiniMaxChoicePayload(payload);
    onChunk?.(parsed);
    return {
      response: String(parsed.response || "").trim(),
      thinking: String(parsed.thinking || "").trim(),
    };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let responseAcc = "";
  let thinkingAcc = "";
  let streamError = "";

  function applyPayloadText(payloadText) {
    const chunkText = String(payloadText || "").trim();
    if (!chunkText || chunkText === "[DONE]") return;

    let payload;
    try {
      payload = JSON.parse(chunkText);
    } catch (_) {
      return;
    }

    const payloadError = parseMiniMaxErrorPayload(payload);
    if (payloadError) {
      streamError = payloadError;
      return;
    }

    const parsed = parseMiniMaxChoicePayload(payload);
    if (!parsed.response && !parsed.thinking) return;

    responseAcc += parsed.response || "";
    thinkingAcc += parsed.thinking || "";
    onChunk?.({
      response: responseAcc,
      thinking: thinkingAcc,
    });
  }

  function processSseLine(line) {
    const rawLine = String(line || "").trim();
    if (!rawLine) return;
    if (!rawLine.startsWith("data:")) return;
    applyPayloadText(rawLine.slice(5).trim());
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    while (buffer.includes("\n")) {
      const newlineIndex = buffer.indexOf("\n");
      const line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      processSseLine(line);
      if (streamError) break;
    }

    if (streamError) break;
  }

  if (!streamError) {
    buffer += decoder.decode();
    if (buffer.trim()) {
      processSseLine(buffer);
    }
  }

  if (streamError) {
    await reader.cancel(streamError).catch(() => {});
    throw new Error(streamError);
  }

  const responseText = String(responseAcc || "").trim();
  const thinkingText = String(thinkingAcc || "").trim();
  if (!responseText && !thinkingText) {
    throw new Error("MiniMax 未返回可用内容。");
  }

  return {
    response: responseText,
    thinking: thinkingText,
  };
}

export async function fetchMiniMaxModels(base, apiKey) {
  const normalizedBase = normalizeMiniMaxBaseUrl(base);
  const response = await fetch(`${normalizedBase}/models`, {
    method: "GET",
    headers: getMiniMaxAuthHeaders(apiKey),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(buildMiniMaxErrorMessage(response.status, text));
  }

  const payload = await response.json();
  const sourceList = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.models)
      ? payload.models
      : [];
  const modelNames = sourceList
    .map(normalizeMiniMaxModelName)
    .filter(Boolean);
  return mergeModelNamesWithDefault(modelNames);
}

export async function testMiniMaxConnection(base, apiKey, model) {
  await requestMiniMaxChatCompletion(base, apiKey, {
    model: model || DEFAULT_MINIMAX_MODEL,
    messages: [{ role: "user", content: "Reply with OK only." }],
    stream: false,
    max_tokens: 4,
    temperature: 0,
  });
}
