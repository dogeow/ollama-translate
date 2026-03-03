import { formatShortcut } from "../lib/utils.js";

export function ShortcutsList({ commands, supportsCommands }) {
  if (!supportsCommands) {
    return (
      <div className="shortcuts-list">
        <p className="shortcut-item">
          <span className="shortcut-unset">当前浏览器可能不支持扩展快捷键</span>
        </p>
      </div>
    );
  }

  const visibleCommands = commands.filter((command) => command.name !== "_execute_action");
  if (visibleCommands.length === 0) {
    return (
      <div className="shortcuts-list">
        <p className="shortcut-item">
          <span className="shortcut-unset">暂无命令</span>
        </p>
      </div>
    );
  }

  return (
    <div className="shortcuts-list" aria-live="polite">
      {visibleCommands.map((command) => {
        const shortcut = formatShortcut(command.shortcut) || command.suggested_key;
        return (
          <div key={command.name} className="shortcut-item">
            {shortcut ? <code>{String(shortcut)}</code> : <span className="shortcut-unset">未设置</span>}
            <span>{command.description || command.name}</span>
          </div>
        );
      })}
    </div>
  );
}
