/**
 * 消息通信和结果处理相关工具函数
 * 从 background.js 中提取
 */

/**
 * 发送翻译待处理消息到内容脚本
 */
export async function sendTranslatePending(tabId, payload) {
  try {
    await chrome.tabs.sendMessage(tabId, {
      action: "translatePending",
      ...payload,
    });
  } catch (error) {
    console.warn(`Failed to send pending to tab ${tabId}:`, error);
  }
}

/**
 * 构建待处理翻译的 payload
 */
export function buildPendingTranslatePayload({
  requestId,
  text,
  selection,
  rect,
  tabId,
}) {
  return {
    requestId,
    text,
    selection,
    rect,
    tabId,
  };
}

/**
 * 发送翻译结果到内容脚本
 */
export async function sendTranslateResult(
  tabId,
  result,
  options = {},
) {
  const { skipPersist = false } = options;
  
  try {
    await chrome.tabs.sendMessage(tabId, {
      action: "translateResult",
      ...result,
    });
  } catch (error) {
    console.warn(`Failed to send result to tab ${tabId}:`, error);
  }

  if (!skipPersist && result.success) {
    await persistTranslateResult(result);
  }
}

/**
 * 持久化翻译结果到存储
 */
export async function persistTranslateResult(result) {
  // 目前仅用于日志记录，可根据需要扩展
  console.log("Translation result:", result);
}

/**
 * 创建翻译请求 ID
 */
export function createTranslateRequestId(requestId) {
  if (requestId) return requestId;
  return `translate-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * 构建错误结果对象
 */
export function buildErrorResult({
  requestId,
  text,
  error,
  errorMessage,
  isRateLimit = false,
}) {
  return {
    requestId,
    text,
    success: false,
    error: error || "translation_failed",
    errorMessage: errorMessage || "翻译失败，请重试",
    isRateLimit,
    thinking: "",
    translation: "",
    timestamp: Date.now(),
  };
}

/**
 * 构建成功结果对象
 */
export function buildSuccessResult({
  requestId,
  text,
  translation,
  thinking = "",
  metadata = {},
}) {
  return {
    requestId,
    text,
    success: true,
    translation,
    thinking,
    timestamp: Date.now(),
    ...metadata,
  };
}
