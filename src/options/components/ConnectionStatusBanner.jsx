export function ConnectionStatusBanner({ status, onOpenOrigins }) {
  return (
    <div className={`connection-status connection-status-${status.kind}`}>
      <span className="connection-dot"></span>
      <span className="connection-status-text">{status.text}</span>
      {status.showAction ? (
        <span className="connection-status-action">
          <button
            type="button"
            className="connection-status-action-btn"
            onClick={onOpenOrigins}
          >
            查看解决方法
          </button>
        </span>
      ) : null}
    </div>
  );
}
