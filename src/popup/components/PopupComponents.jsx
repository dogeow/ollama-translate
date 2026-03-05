/**
 * 弹出窗口专用组件
 * 提供选择卡片、面板等通用 UI 元素
 */

/**
 * 选择卡片组件
 * 用于显示可选择的选项
 */
export function ChoiceCard({
  value,
  title,
  hint,
  isActive,
  isCompact = false,
  onClick,
}) {
  const className = `popup-choice-card${
    isCompact ? " popup-choice-card--compact" : ""
  }${isActive ? " is-active" : ""}`;

  return (
    <button
      type="button"
      className={className}
      onClick={() => onClick(value)}
    >
      <div className="popup-choice-card__title">{title}</div>
      {hint ? <div className="popup-choice-card__hint">{hint}</div> : null}
    </button>
  );
}

/**
 * 选择卡片网格容器
 */
export function ChoiceGrid({
  options,
  value,
  onChange,
  isCompact = false,
}) {
  const className = `popup-choice-grid${
    isCompact ? " popup-choice-grid--compact" : ""
  }`;

  return (
    <div className={className}>
      {options.map((option) => (
        <ChoiceCard
          key={option.value}
          value={option.value}
          title={option.title}
          hint={option.hint}
          isActive={value === option.value}
          isCompact={isCompact}
          onClick={onChange}
        />
      ))}
    </div>
  );
}

/**
 * 面板组件
 */
export function Panel({
  title,
  hint,
  children,
  isSubtle = false,
  showStatus = false,
  statusText = "已保存中",
  className = "",
}) {
  const panelClassName = `popup-panel${isSubtle ? " popup-panel--subtle" : ""} ${className}`;

  return (
    <section className={panelClassName}>
      {(title || hint) && (
        <div className="popup-panel__header">
          <div>
            {title && <div className="popup-panel__title">{title}</div>}
            {hint && <div className="popup-panel__hint">{hint}</div>}
          </div>
          {showStatus && <div className="popup-status">{statusText}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/**
 * 应用开关按钮组件
 */
export function AppToggle({
  enabled,
  onToggle,
}) {
  const className = `popup-app-toggle${enabled ? " is-active" : ""}`;
  const label = enabled ? "关闭应用" : "开启应用";
  const statusText = enabled ? "已开启" : "已关闭";

  return (
    <button
      type="button"
      className={className}
      onClick={onToggle}
      aria-pressed={enabled}
      aria-label={label}
      title={label}
    >
      <span className="popup-app-toggle__track" aria-hidden="true">
        <span className="popup-app-toggle__thumb" />
      </span>
      <span className="popup-app-toggle__text">{statusText}</span>
    </button>
  );
}

/**
 * 更新提示横幅组件
 */
export function UpdateBanner({
  latestVersion,
  currentVersion,
  onOpenUpdate,
}) {
  return (
    <div className="popup-update-banner">
      <div className="popup-update-banner__title">
        发现新版本 {latestVersion}
      </div>
      <div className="popup-update-banner__text">
        需要手动下载安装，当前版本 {currentVersion}
      </div>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={onOpenUpdate}
      >
        打开更新页面
      </button>
    </div>
  );
}
