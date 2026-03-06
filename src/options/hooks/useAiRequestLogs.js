import { useCallback, useEffect, useRef, useState } from "react";
import { AI_REQUEST_LOG_STORAGE_KEY } from "../../shared/constants.js";
import { isMiniMaxProvider } from "../../shared/settings.js";
import {
  storageLocalGetValue,
  storageLocalRemove,
  storageOnChanged,
} from "../lib/chrome.js";

const COPY_STATUS_RESET_MS = 1800;
const THINK_BLOCK_RE = /<think\b[^>]*>([\s\S]*?)<\/think>/gi;
const THINK_OPEN_TAG_RE = /<think\b[^>]*>/i;
const THINK_ANY_TAG_RE = /<\/?think\b[^>]*>/i;
const INPUT_JSON_LABEL = "Input JSON:";

function normalizeBlockText(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitThinkingFromResponse(text) {
  const raw = String(text || "");
  if (!raw) return { responseBody: "", thinkingFromThinkTag: "" };

  const thinkParts = [];
  let stripped = raw.replace(THINK_BLOCK_RE, (_, inner = "") => {
    const cleaned = normalizeBlockText(inner);
    if (cleaned) thinkParts.push(cleaned);
    return "\n";
  });

  const danglingMatch = THINK_OPEN_TAG_RE.exec(stripped);
  if (danglingMatch) {
    const dangling = normalizeBlockText(
      stripped.slice(danglingMatch.index).replace(THINK_OPEN_TAG_RE, ""),
    );
    if (dangling) thinkParts.push(dangling);
    stripped = stripped.slice(0, danglingMatch.index);
  }

  const responseBody = normalizeBlockText(stripped);
  const thinkingFromThinkTag = normalizeBlockText(thinkParts.join("\n\n"));

  if (!thinkingFromThinkTag && !THINK_ANY_TAG_RE.test(raw)) {
    return {
      responseBody: normalizeBlockText(raw),
      thinkingFromThinkTag: "",
    };
  }

  return {
    responseBody,
    thinkingFromThinkTag,
  };
}

function mergeThinkingText(...parts) {
  const deduped = [];
  parts.forEach((part) => {
    const text = normalizeBlockText(part);
    if (!text) return;
    if (deduped.includes(text)) return;
    deduped.push(text);
  });
  return deduped.join("\n\n");
}

function splitPromptForDisplay(promptText) {
  const raw = normalizeBlockText(promptText);
  if (!raw) return { requestBody: "", promptText: "" };

  const inputJsonIndex = raw.lastIndexOf(INPUT_JSON_LABEL);
  if (inputJsonIndex >= 0) {
    const promptPart = normalizeBlockText(
      raw.slice(0, inputJsonIndex + INPUT_JSON_LABEL.length),
    );
    const requestBody = normalizeBlockText(
      raw.slice(inputJsonIndex + INPUT_JSON_LABEL.length),
    );
    return {
      requestBody: requestBody || raw,
      promptText: promptPart,
    };
  }

  const delimiter = /\n\s*\n/;
  const match = delimiter.exec(raw);
  if (!match || typeof match.index !== "number") {
    return { requestBody: raw, promptText: "" };
  }

  const promptPart = normalizeBlockText(raw.slice(0, match.index));
  const requestBody = normalizeBlockText(raw.slice(match.index));
  return {
    requestBody: requestBody || raw,
    promptText: promptPart,
  };
}

function normalizeLogEntry(entry) {
  const responseRaw = String(entry?.responseContent || "");
  const requestRaw = String(entry?.requestContent || "");
  const requestPayloadRaw = String(entry?.requestPayload || "");
  const parsedRequest = splitPromptForDisplay(requestRaw);
  const parsed = splitThinkingFromResponse(responseRaw);
  const thinking = mergeThinkingText(
    entry?.thinkingContent || "",
    parsed.thinkingFromThinkTag,
  );
  const hasThinkInResponse = THINK_ANY_TAG_RE.test(responseRaw);
  const isMiniMax = isMiniMaxProvider(entry?.provider);
  const responseBody =
    isMiniMax || hasThinkInResponse
      ? parsed.responseBody || ""
      : normalizeBlockText(responseRaw);

  return {
    ...entry,
    requestBody: parsedRequest.requestBody || normalizeBlockText(requestRaw),
    promptText: parsedRequest.promptText || "",
    requestPayloadBody: normalizeBlockText(requestPayloadRaw),
    responseBody,
    thinkingBody: thinking,
  };
}

function normalizeLogList(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry) => entry && typeof entry === "object")
    .map(normalizeLogEntry)
    .sort((a, b) => {
      const left = Number(a?.responseTimestamp || a?.requestTimestamp || 0);
      const right = Number(b?.responseTimestamp || b?.requestTimestamp || 0);
      return right - left;
    });
}

function formatLogBlock(entry, index) {
  const lines = [
    `#${index + 1} phase=${entry.phase || "-"} provider=${entry.provider || "-"} stream=${entry.stream ? "true" : "false"}`,
    `requestTime: ${entry.requestTime || "-"}`,
    `responseTime: ${entry.responseTime || "-"}`,
    `durationMs: ${entry.durationMs ?? "-"}`,
    `status: ${entry.status ?? "-"}`,
    `model: ${entry.model || "-"}`,
    `endpoint: ${entry.endpoint || "-"}`,
    `requestLength: ${entry.requestLength ?? "-"}`,
  ];

  if (entry.responseLength !== undefined) {
    lines.push(`responseLength: ${entry.responseLength}`);
  }
  if (entry.chunkCount !== undefined) {
    lines.push(`chunkCount: ${entry.chunkCount}`);
  }
  if (entry.error) {
    lines.push(`error: ${entry.error}`);
  }
  if (entry.errorBody) {
    lines.push(`errorBody: ${entry.errorBody}`);
  }
  if (entry.requestBody) {
    lines.push("requestBody:");
    lines.push(String(entry.requestBody));
  }
  if (entry.promptText) {
    lines.push("promptText:");
    lines.push(String(entry.promptText));
  }
  if (entry.requestPayloadBody) {
    lines.push("requestPayload:");
    lines.push(String(entry.requestPayloadBody));
  }
  if (entry.responseBody) {
    lines.push("responseContent:");
    lines.push(String(entry.responseBody));
  }
  if (entry.thinkingBody) {
    lines.push("thinkingContent:");
    lines.push(String(entry.thinkingBody));
  }
  return lines.join("\n");
}

function formatLogsForCopy(entries) {
  return normalizeLogList(entries)
    .map(formatLogBlock)
    .join("\n\n----------------------------------------\n\n");
}

export function useAiRequestLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const copyStatusTimerRef = useRef(null);

  const applyLogs = useCallback((rawLogs) => {
    setLogs(normalizeLogList(rawLogs));
  }, []);

  const refreshLogs = useCallback(async () => {
    setError("");
    try {
      const raw = await storageLocalGetValue(AI_REQUEST_LOG_STORAGE_KEY, []);
      applyLogs(raw);
    } catch (err) {
      setError(err?.message || "读取日志失败");
    } finally {
      setLoading(false);
    }
  }, [applyLogs]);

  const clearLogs = useCallback(async () => {
    setError("");
    try {
      await storageLocalRemove(AI_REQUEST_LOG_STORAGE_KEY);
      applyLogs([]);
    } catch (err) {
      setError(err?.message || "清空日志失败");
    }
  }, [applyLogs]);

  const copyLogs = useCallback(async () => {
    if (!logs.length) {
      setCopyStatus("暂无日志");
      return;
    }

    try {
      await navigator.clipboard.writeText(formatLogsForCopy(logs));
      setCopyStatus(`已复制 ${logs.length} 条`);
    } catch (_) {
      setCopyStatus("复制失败");
    }
  }, [logs]);

  useEffect(() => {
    void refreshLogs();
  }, [refreshLogs]);

  useEffect(() => {
    const listener = (changes, areaName) => {
      if (areaName !== "local") return;
      if (!(AI_REQUEST_LOG_STORAGE_KEY in changes)) return;
      applyLogs(changes[AI_REQUEST_LOG_STORAGE_KEY]?.newValue || []);
      setLoading(false);
    };
    return storageOnChanged(listener);
  }, [applyLogs]);

  useEffect(() => {
    if (!copyStatus) return undefined;
    window.clearTimeout(copyStatusTimerRef.current);
    copyStatusTimerRef.current = window.setTimeout(
      () => setCopyStatus(""),
      COPY_STATUS_RESET_MS,
    );
    return () => window.clearTimeout(copyStatusTimerRef.current);
  }, [copyStatus]);

  return {
    logs,
    loading,
    error,
    copyStatus,
    refreshLogs,
    clearLogs,
    copyLogs,
  };
}
