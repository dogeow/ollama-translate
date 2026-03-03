/**
 * Ollama API 统一调用层
 * 提供 generate、tags 等 API 的统一封装
 */

import { getOllamaErrorMessage } from "./ollama-errors.js";

/**
 * 调用 Ollama generate API（非流式）
 * @param {string} base - Ollama 服务地址，如 http://127.0.0.1:11434
 * @param {string} model - 模型名称
 * @param {string} prompt - 提示词
 * @returns {Promise<string>} 生成的文本
 */
export async function generateCompletion(base, model, prompt) {
  const response = await fetch(`${base}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt, stream: false }),
  });

  if (!response.ok) {
    const text = await response.text();
    if (response.status === 403) {
      throw new Error(getOllamaErrorMessage("403"));
    }
    throw new Error(text || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return (data.response || "").trim();
}

function throwGenerateError(response, text) {
  if (response.status === 403) {
    throw new Error(getOllamaErrorMessage("403"));
  }
  throw new Error(text || `HTTP ${response.status}`);
}

function parseStreamLine(line) {
  const raw = String(line || "").trim();
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

/**
 * 调用 Ollama generate API（流式）
 * @param {string} base - Ollama 服务地址，如 http://127.0.0.1:11434
 * @param {string} model - 模型名称
 * @param {string} prompt - 提示词
 * @param {{ onChunk?: (chunk: { response: string, thinking: string }) => void }} [options]
 * @returns {Promise<{response: string, thinking: string}>}
 */
export async function generateStreamingCompletion(base, model, prompt, options = {}) {
  const { onChunk } = options;
  const response = await fetch(`${base}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt, stream: true }),
  });

  if (!response.ok) {
    const text = await response.text();
    throwGenerateError(response, text);
  }

  if (!response.body) {
    const data = await response.json();
    const chunk = {
      response: data.response || "",
      thinking: data.thinking || "",
    };
    onChunk?.(chunk);
    return {
      response: chunk.response.trim(),
      thinking: chunk.thinking.trim(),
    };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let accumulatedResponse = "";
  let accumulatedThinking = "";

  function handleChunkLine(line) {
    const payload = parseStreamLine(line);
    if (!payload) return;

    let hasDelta = false;

    if (typeof payload.response === "string" && payload.response) {
      accumulatedResponse += payload.response;
      hasDelta = true;
    }

    if (typeof payload.thinking === "string" && payload.thinking) {
      accumulatedThinking += payload.thinking;
      hasDelta = true;
    }

    if (hasDelta) {
      onChunk?.({
        response: accumulatedResponse,
        thinking: accumulatedThinking,
      });
    }
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    while (buffer.includes("\n")) {
      const newlineIndex = buffer.indexOf("\n");
      const line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      handleChunkLine(line);
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    handleChunkLine(buffer);
  }

  return {
    response: accumulatedResponse.trim(),
    thinking: accumulatedThinking.trim(),
  };
}

/**
 * 获取 Ollama 可用模型列表
 * @param {string} base - Ollama 服务地址
 * @returns {Promise<{models?: Array, error?: string}>}
 */
export async function fetchModels(base) {
  const tagsUrl = `${base}/api/tags`;

  try {
    const response = await fetch(tagsUrl);
    if (response.status === 403) {
      return { error: "403" };
    }
    if (!response.ok) {
      return { error: "connection" };
    }
    const data = await response.json();
    return { models: data.models || [] };
  } catch (_) {
    return { error: "connection" };
  }
}

/**
 * 检查 Ollama 连接并获取模型列表
 * @param {string} ollamaUrl - Ollama 服务地址
 * @returns {Promise<{models?: Array, error?: string}>}
 */
export async function checkOllamaAndGetModels(ollamaUrl) {
  const base = ollamaUrl.replace(/\/$/, "");
  return fetchModels(base);
}
