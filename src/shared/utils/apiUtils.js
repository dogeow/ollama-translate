/**
 * API 调用的通用工具函数
 * 提供错误处理、响应解析等复用逻辑
 */

/**
 * 规范化 API Base URL
 * 添加协议前缀并移除尾部斜杠
 */
export function normalizeApiBaseUrl(url, defaultUrl = "") {
  const raw = String(url || "").trim();
  if (!raw) return defaultUrl;
  
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withProtocol.replace(/\/$/, "");
}

/**
 * 构建标准 JSON 请求选项
 */
export function buildJsonRequestOptions(method, body, headers = {}) {
  return {
    method: method.toUpperCase(),
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  };
}

/**
 * 安全解析 JSON 响应
 */
export async function safeJsonParse(response) {
  try {
    return await response.json();
  } catch (error) {
    const text = await response.text();
    throw new Error(`Invalid JSON response: ${text.slice(0, 100)}`);
  }
}

/**
 * 提取错误消息（支持多种格式）
 */
export function extractErrorMessage(data, fallback = "请求失败") {
  if (typeof data === "string") return data;
  if (!data || typeof data !== "object") return fallback;
  
  // 尝试常见的错误字段
  const message =
    data.error?.message ||
    data.error?.msg ||
    data.error?.detail ||
    data.message ||
    data.msg ||
    data.detail ||
    data.error_description;
  
  return String(message || fallback).trim();
}

/**
 * 构建 HTTP 错误消息
 */
export function buildHttpErrorMessage(status, provider, responseText = "") {
  const fallback = `${provider} 请求失败（HTTP ${status}）`;
  
  if (!responseText) return fallback;
  
  try {
    const data = JSON.parse(responseText);
    const message = extractErrorMessage(data);
    return message === "请求失败" ? fallback : `${fallback}：${message}`;
  } catch {
    const brief = String(responseText).trim().slice(0, 200);
    return brief ? `${fallback}：${brief}` : fallback;
  }
}

/**
 * 扁平化可能的文本内容（支持字符串、数组、对象）
 */
export function flattenTextContent(value, textFields = ["text", "content", "output_text"]) {
  if (typeof value === "string") return value;
  if (!value) return "";
  
  if (Array.isArray(value)) {
    return value
      .map((item) => flattenTextContent(item, textFields))
      .filter(Boolean)
      .join("");
  }
  
  if (typeof value === "object") {
    for (const field of textFields) {
      if (typeof value[field] === "string") return value[field];
      if (Array.isArray(value[field])) {
        return flattenTextContent(value[field], textFields);
      }
    }
  }
  
  return "";
}

/**
 * 安全地从对象中提取文本（多路径尝试）
 */
export function extractTextFromPaths(obj, paths) {
  if (!obj || typeof obj !== "object") return "";
  
  for (const path of paths) {
    const keys = path.split(".");
    let current = obj;
    
    for (const key of keys) {
      if (current && typeof current === "object" && key in current) {
        current = current[key];
      } else {
        current = null;
        break;
      }
    }
    
    if (current) {
      const text = flattenTextContent(current);
      if (text) return text;
    }
  }
  
  return "";
}

/**
 * 创建超时 Promise
 */
export function createTimeoutPromise(ms, errorMessage = "请求超时") {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(errorMessage)), ms);
  });
}

/**
 * 带超时的 fetch 请求
 */
export async function fetchWithTimeout(url, options, timeoutMs = 30000) {
  const fetchPromise = fetch(url, options);
  const timeoutPromise = createTimeoutPromise(timeoutMs);
  
  return Promise.race([fetchPromise, timeoutPromise]);
}

/**
 * 解析 SSE（Server-Sent Events）行
 */
export function parseSseLine(line) {
  const trimmed = String(line || "").trim();
  if (!trimmed || trimmed.startsWith(":")) return null;
  
  if (trimmed.startsWith("data: ")) {
    const data = trimmed.slice(6).trim();
    if (data === "[DONE]") return { done: true };
    
    try {
      return { data: JSON.parse(data) };
    } catch {
      return { raw: data };
    }
  }
  
  return null;
}

/**
 * 处理流式响应
 */
export async function processStreamResponse(response, onChunk) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      
      for (const line of lines) {
        if (line.trim()) {
          await onChunk(line);
        }
      }
    }
    
    // 处理最后的缓冲区
    if (buffer.trim()) {
      await onChunk(buffer);
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * 重试逻辑
 */
export async function retryWithBackoff(
  fn,
  { maxRetries = 3, initialDelay = 1000, backoffFactor = 2 } = {},
) {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(backoffFactor, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}
