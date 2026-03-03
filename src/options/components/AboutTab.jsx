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

  let updateSummaryText = "等待版本检查";
  if (updateState.status === "checking") {
    updateSummaryText = "正在检查新版本…";
  } else if (updateState.status === "available") {
    updateSummaryText = `发现新版本 ${updateState.latestVersion}`;
  } else if (updateState.status === "up-to-date") {
    updateSummaryText = "当前已是最新版本";
  } else if (updateState.status === "error") {
    updateSummaryText = updateState.error || "检查更新失败";
  } else if (updateState.checkedAt) {
    updateSummaryText = "等待下一次检查";
  }

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
            <span className="update-status-card__value">{updateCheckedAtText}</span>
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
          disabled={updateState.status !== "available" || !updateState.updateUrl}
        >
          打开更新页面
        </button>
      </div>
    </div>
  );
}
