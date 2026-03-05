const UPDATE_STATUS_LABELS = {
  idle: "等待版本检查",
  checking: "正在检查新版本…",
  available: (version) => `发现新版本 ${version}`,
  "up-to-date": "当前已是最新版本",
  error: (error) => error || "检查更新失败",
};

function getUpdateSummaryText(status, latestVersion, error, checkedAt) {
  const config = UPDATE_STATUS_LABELS[status];
  if (!config) {
    return checkedAt ? "等待下一次检查" : "等待版本检查";
  }
  if (typeof config === "function") {
    return status === "available" ? config(latestVersion) : config(error);
  }
  return config;
}

export function AboutTab({
  currentVersion,
  updateState,
  runExtensionUpdateCheck,
  openUpdatePage,
}) {
  const updateCheckedAtText = updateState.checkedAt
    ? new Intl.DateTimeFormat("zh-CN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(updateState.checkedAt)
    : "";

  const updateSummaryText = getUpdateSummaryText(
    updateState.status,
    updateState.latestVersion,
    updateState.error,
    updateState.checkedAt,
  );

  return (
    <div className="card update-card">
      <h2>关于 Ollama 翻译</h2>
      <div className="update-status-card">
        <div className="update-status-card__row">
          <span className="update-status-card__label">当前版本</span>
          <span className="update-status-card__value">{currentVersion}</span>
        </div>
        <div className="update-status-card__row">
          <span className="update-status-card__label">更新状态</span>
          <span
            className={`update-status-card__value update-status-card__value--${updateState.status}`.trim()}
          >
            {updateSummaryText}
          </span>
        </div>
        {updateCheckedAtText ? (
          <div className="update-status-card__row">
            <span className="update-status-card__label">最近检查</span>
            <span className="update-status-card__value">
              {updateCheckedAtText}
            </span>
          </div>
        ) : null}
        {updateState.notes ? (
          <div className="update-status-card__notes">{updateState.notes}</div>
        ) : null}
      </div>

      <div className="update-actions">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={runExtensionUpdateCheck}
        >
          立即检查
        </button>
        <button
          type="button"
          className="btn"
          onClick={openUpdatePage}
          disabled={
            updateState.status !== "available" || !updateState.updateUrl
          }
        >
          打开更新页面
        </button>
      </div>
    </div>
  );
}
