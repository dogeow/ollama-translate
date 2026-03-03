import { ORIGINS_PLATFORM_CONTENT } from "../lib/constants.js";
import { getOrderedOriginsPlatforms } from "../lib/utils.js";

export function OriginsModal({
  isOpen,
  activePlatform,
  onChangePlatform,
  onClose,
}) {
  if (!isOpen) return null;

  const orderedPlatforms = getOrderedOriginsPlatforms();

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose}></div>
      <div className="modal-content">
        <div className="modal-header">
          <h2>允许浏览器扩展访问（解决 403）</h2>
          <button type="button" className="modal-close" onClick={onClose}>
            关闭
          </button>
        </div>
        <div className="origins-hint">
          <div className="origins-tabs__tablist" role="tablist" aria-label="按系统选择">
            {orderedPlatforms.map((platform) => {
              const item = ORIGINS_PLATFORM_CONTENT[platform];
              return (
                <button
                  key={platform}
                  type="button"
                  role="tab"
                  aria-selected={activePlatform === platform}
                  onClick={() => onChangePlatform(platform)}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
          {orderedPlatforms.map((platform) => {
            const item = ORIGINS_PLATFORM_CONTENT[platform];
            return (
              <div
                key={platform}
                role="tabpanel"
                className="origins-tabs__panel"
                hidden={activePlatform !== platform}
              >
                {item.blocks.map((block, index) => {
                  if (block.type === "sub") {
                    return (
                      <p key={index} className="origins-hint__sub">
                        {block.text}
                      </p>
                    );
                  }
                  if (block.type === "code") {
                    return (
                      <pre key={index} className="origins-hint__code">
                        <code>{block.text}</code>
                      </pre>
                    );
                  }
                  if (block.type === "link") {
                    return (
                      <p key={index} className="hint">
                        <a
                          href={block.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="origins-hint__link"
                        >
                          {block.text}
                        </a>
                      </p>
                    );
                  }
                  return (
                    <p key={index} className="hint">
                      {block.text}
                    </p>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
