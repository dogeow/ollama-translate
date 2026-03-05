import { AI_REQUEST_LOG_MAX_ENTRIES } from "../../shared/constants.js";
import { useAiRequestLogs } from "../hooks/useAiRequestLogs.js";

function formatDateTime(value) {
  const text = String(value || "").trim();
  if (!text) return "-";
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return date.toLocaleString();
}

function formatDuration(durationMs) {
  if (!Number.isFinite(durationMs) || durationMs < 0) return "-";
  return `${Math.round(durationMs)} ms`;
}

function formatStatus(status) {
  if (status === null || status === undefined || status === "") return "-";
  return String(status);
}

function normalizeBlockText(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text;
}

export function AiLogsTab() {
  const { logs, loading, error, copyStatus, refreshLogs, clearLogs, copyLogs } =
    useAiRequestLogs();

  const successCount = logs.filter((entry) => entry.phase === "success").length;
  const errorCount = logs.filter((entry) => entry.phase === "error").length;
  const hasLogs = logs.length > 0;

  return (
    <div className="card ai-logs-card">
      <h2>AI 请求日志</h2>
      <p className="ai-logs-desc">
        展示最近 {AI_REQUEST_LOG_MAX_ENTRIES} 条 AI 请求。包含请求时间、请求内容、返回内容、耗时等信息。
      </p>

      <div className="ai-logs-toolbar">
        <button type="button" className="btn btn-secondary" onClick={refreshLogs}>
          刷新
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={copyLogs}
          disabled={!hasLogs}
        >
          复制全部
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={clearLogs}
          disabled={!hasLogs}
        >
          清空日志
        </button>
      </div>

      <div className="ai-logs-summary">
        <span>总计 {logs.length} 条</span>
        <span>成功 {successCount}</span>
        <span>失败 {errorCount}</span>
      </div>

      {loading ? <div className="ai-logs-empty">正在加载日志...</div> : null}
      {!loading && !hasLogs ? (
        <div className="ai-logs-empty">
          暂无日志。触发一次翻译后，日志会出现在这里。
        </div>
      ) : null}
      {error ? <div className="ai-logs-error">{error}</div> : null}
      {copyStatus ? <div className="ai-logs-status">{copyStatus}</div> : null}

      {hasLogs ? (
        <div className="ai-logs-list">
          {logs.map((entry) => (
            <details
              key={entry.id || `${entry.requestTime}-${entry.provider}-${entry.phase}`}
              className={`ai-log-item ai-log-item--${entry.phase || "unknown"}`.trim()}
            >
              <summary className="ai-log-item__summary">
                <span className="ai-log-item__summary-main">
                  <span className="ai-log-item__phase">{entry.phase || "-"}</span>
                  <span className="ai-log-item__provider">{entry.provider || "-"}</span>
                  <span className="ai-log-item__duration">
                    {formatDuration(entry.durationMs)}
                  </span>
                </span>
                <span className="ai-log-item__summary-meta">
                  {formatDateTime(entry.responseTime || entry.requestTime)}
                </span>
              </summary>

              <div className="ai-log-item__meta">
                <span>模型：{entry.model || "-"}</span>
                <span>状态：{formatStatus(entry.status)}</span>
                <span>流式：{entry.stream ? "是" : "否"}</span>
                <span>分片：{entry.chunkCount ?? "-"}</span>
              </div>

              <div className="ai-log-item__meta">
                <span>请求时间：{formatDateTime(entry.requestTime)}</span>
                <span>返回时间：{formatDateTime(entry.responseTime)}</span>
              </div>

              <div className="ai-log-item__section">
                <div className="ai-log-item__label">请求正文（具体翻译内容）</div>
                <pre className="ai-log-item__block">{normalizeBlockText(entry.requestBody) || "-"}</pre>
              </div>

              {entry.promptText ? (
                <div className="ai-log-item__section">
                  <details className="ai-log-item__thinking-details">
                    <summary className="ai-log-item__thinking-summary">
                      提示词（已折叠）
                    </summary>
                    <pre className="ai-log-item__block">{entry.promptText}</pre>
                  </details>
                </div>
              ) : null}

              {entry.requestPayloadBody ? (
                <div className="ai-log-item__section">
                  <details className="ai-log-item__thinking-details">
                    <summary className="ai-log-item__thinking-summary">
                      请求内容（已折叠）
                    </summary>
                    <pre className="ai-log-item__block">{entry.requestPayloadBody}</pre>
                  </details>
                </div>
              ) : null}

              <div className="ai-log-item__section">
                <div className="ai-log-item__label">返回正文</div>
                <pre className="ai-log-item__block">{normalizeBlockText(entry.responseBody) || "-"}</pre>
              </div>

              {entry.thinkingBody ? (
                <div className="ai-log-item__section">
                  <details className="ai-log-item__thinking-details">
                    <summary className="ai-log-item__thinking-summary">
                      思维链（已折叠）
                    </summary>
                    <pre className="ai-log-item__block">{`<think>\n${entry.thinkingBody}\n</think>`}</pre>
                  </details>
                </div>
              ) : null}

              {entry.error ? (
                <div className="ai-log-item__section">
                  <div className="ai-log-item__label">错误</div>
                  <pre className="ai-log-item__block ai-log-item__block--error">
                    {entry.error}
                  </pre>
                </div>
              ) : null}
            </details>
          ))}
        </div>
      ) : null}
    </div>
  );
}
