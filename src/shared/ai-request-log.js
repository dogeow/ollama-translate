import {
  AI_REQUEST_LOG_MAX_ENTRIES,
  AI_REQUEST_LOG_STORAGE_KEY,
} from "./constants.js";

const AI_LOG_PREFIX = "[AI 请求日志]";
const MAX_LOG_CONTENT_LENGTH = 6000;
const MAX_PERSIST_CONTENT_LENGTH = 4000;
let persistQueue = Promise.resolve();

function normalizeText(value) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

function clampLogText(value, max = MAX_LOG_CONTENT_LENGTH) {
  const text = normalizeText(value);
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...[truncated ${text.length - max} chars]`;
}

function toIsoTime(ts = Date.now()) {
  return new Date(ts).toISOString();
}

function normalizeExtra(extra) {
  if (!extra || typeof extra !== "object") return {};
  return Object.fromEntries(
    Object.entries(extra).filter(([, value]) => value !== undefined),
  );
}

function canUseLocalStorage() {
  return (
    typeof chrome !== "undefined" &&
    !!chrome?.storage?.local &&
    typeof chrome.storage.local.get === "function" &&
    typeof chrome.storage.local.set === "function"
  );
}

function storageLocalGetRaw(key) {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.get(key, (result) => {
        if (chrome.runtime?.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(result?.[key]);
      });
    } catch (error) {
      reject(error);
    }
  });
}

function storageLocalSetRaw(payload) {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.set(payload, () => {
        if (chrome.runtime?.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      });
    } catch (error) {
      reject(error);
    }
  });
}

function clampPersistText(value) {
  return clampLogText(value, MAX_PERSIST_CONTENT_LENGTH);
}

function queuePersistAiLog(entry) {
  if (!canUseLocalStorage()) return;

  persistQueue = persistQueue
    .then(async () => {
      const currentRaw = await storageLocalGetRaw(AI_REQUEST_LOG_STORAGE_KEY);
      const current = Array.isArray(currentRaw) ? currentRaw : [];
      current.push(entry);
      const next = current.slice(-AI_REQUEST_LOG_MAX_ENTRIES);
      await storageLocalSetRaw({
        [AI_REQUEST_LOG_STORAGE_KEY]: next,
      });
    })
    .catch((error) => {
      console.warn(
        AI_LOG_PREFIX,
        "persist:failed",
        error?.message || String(error),
      );
    });
}

function buildBasePayload(trace, finishedAtMs, status) {
  return {
    provider: trace.provider,
    endpoint: trace.endpoint,
    model: trace.model,
    stream: trace.stream,
    requestTime: toIsoTime(trace.startedAtMs),
    responseTime: toIsoTime(finishedAtMs),
    requestTimestamp: trace.startedAtMs,
    responseTimestamp: finishedAtMs,
    durationMs: finishedAtMs - trace.startedAtMs,
    status: status ?? null,
    requestLength: trace.requestText.length,
    requestContent: clampLogText(trace.requestText),
    requestPayload: trace.requestPayloadText,
  };
}

function buildPersistEntry(phase, payload) {
  const now = Date.now();
  return {
    id: `ai-log:${now}:${Math.random().toString(36).slice(2, 8)}`,
    phase,
    loggedAt: toIsoTime(now),
    ...payload,
    requestContent: clampPersistText(payload.requestContent),
    requestPayload: payload.requestPayload
      ? clampPersistText(payload.requestPayload)
      : null,
    responseContent: payload.responseContent
      ? clampPersistText(payload.responseContent)
      : null,
    error: payload.error ? clampPersistText(payload.error) : null,
    errorBody: payload.errorBody ? clampPersistText(payload.errorBody) : null,
    thinkingContent: payload.thinkingContent
      ? clampPersistText(payload.thinkingContent)
      : null,
  };
}

export function createAiRequestLog({
  provider,
  endpoint,
  model,
  stream = false,
  requestContent,
  requestPayload,
  extra,
}) {
  const startedAtMs = Date.now();
  const requestPayloadText = requestPayload
    ? clampLogText(JSON.stringify(requestPayload))
    : undefined;
  const requestText = normalizeText(requestContent);

  console.log(AI_LOG_PREFIX, "request:start", {
    provider,
    endpoint,
    model: model || null,
    stream: !!stream,
    requestTime: toIsoTime(startedAtMs),
    requestLength: requestText.length,
    requestContent: clampLogText(requestText),
    requestPayload: requestPayloadText,
    ...normalizeExtra(extra),
  });

  return {
    provider,
    endpoint,
    model: model || null,
    stream: !!stream,
    startedAtMs,
    requestText,
    requestPayloadText,
  };
}

export function logAiRequestSuccess(trace, { status, responseContent, extra } = {}) {
  const finishedAtMs = Date.now();
  const responseText = normalizeText(responseContent);
  const payload = {
    ...buildBasePayload(trace, finishedAtMs, status),
    responseLength: responseText.length,
    responseContent: clampLogText(responseText),
    ...normalizeExtra(extra),
  };

  console.log(AI_LOG_PREFIX, "request:success", payload);
  queuePersistAiLog(buildPersistEntry("success", payload));
}

export function logAiRequestError(trace, error, { status, extra } = {}) {
  const finishedAtMs = Date.now();
  const message = normalizeText(error?.message || error || "unknown_error");
  const payload = {
    ...buildBasePayload(trace, finishedAtMs, status),
    error: clampLogText(message),
    ...normalizeExtra(extra),
  };

  console.error(AI_LOG_PREFIX, "request:error", payload);
  queuePersistAiLog(buildPersistEntry("error", payload));
}
