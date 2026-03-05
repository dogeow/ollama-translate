import { useState } from "react";
import { ShortcutsList } from "./ShortcutsList.jsx";
import {
  normalizeHoverTranslateDelayMs,
  normalizePageTranslateConcurrency,
  normalizePageTranslateBatchSize,
} from "../../shared/settings.js";
import { SHORTCUTS_URL } from "../../shared/constants.js";
import { tabsCreate } from "../lib/chrome.js";

export function ShortcutsTab({
  settings,
  settingsRef,
  updateSettings,
  persistSettings,
  showAutoSaveStatus,
  shortcuts,
}) {
  const [showShortcutsHint, setShowShortcutsHint] = useState(false);

  async function openShortcutsPage() {
    try {
      await tabsCreate(SHORTCUTS_URL);
      setShowShortcutsHint(false);
    } catch (_) {
      setShowShortcutsHint(true);
    }
  }

  return (
    <>
      <div className="card shortcuts-card">
        <h2>快捷键</h2>
        <p className="shortcuts-desc">
          选中页面文字后，可使用快捷键直接翻译（需在浏览器中先绑定按键）。
        </p>
        <div className="field">
          <label>自动翻译模式</label>
          <div className="choice-list">
            <label className="choice-item">
              <input
                type="radio"
                name="autoTranslateMode"
                value="off"
                checked={settings.ollamaAutoTranslateMode === "off"}
                onChange={() =>
                  updateSettings({ ollamaAutoTranslateMode: "off" }, "now")
                }
              />
              <span className="choice-item__title">关闭自动翻译</span>
              <span className="choice-item__hint">
                仅保留手动快捷键、右键菜单和选区按钮。
              </span>
            </label>
            <label className="choice-item">
              <input
                type="radio"
                name="autoTranslateMode"
                value="selection"
                checked={settings.ollamaAutoTranslateMode === "selection"}
                onChange={() =>
                  updateSettings({ ollamaAutoTranslateMode: "selection" }, "now")
                }
              />
              <span className="choice-item__title">双击 / 三击选中后自动翻译</span>
              <span className="choice-item__hint">
                双击单词或三击整段后自动翻译，适合基于选区的操作方式。
              </span>
            </label>
            <label className="choice-item">
              <input
                type="radio"
                name="autoTranslateMode"
                value="hover"
                checked={settings.ollamaAutoTranslateMode === "hover"}
                onChange={() =>
                  updateSettings({ ollamaAutoTranslateMode: "hover" }, "now")
                }
              />
              <span className="choice-item__title">悬停自动翻译</span>
              <span className="choice-item__hint">
                鼠标移动到文本上后自动取词或取整段，无需双击或按快捷键。
              </span>
            </label>
          </div>
        </div>

        <div className="field" hidden={settings.ollamaAutoTranslateMode !== "hover"}>
          <label htmlFor="hoverTranslateScope">悬停翻译范围</label>
          <select
            id="hoverTranslateScope"
            className="select"
            value={settings.ollamaHoverTranslateScope}
            onChange={(event) =>
              updateSettings(
                { ollamaHoverTranslateScope: event.target.value },
                "now",
              )
            }
          >
            <option value="word">只翻译单词</option>
            <option value="paragraph">翻译整段话</option>
          </select>
          <span className="hint">
            悬停模式下，决定自动发送给 Ollama 的文本范围。
          </span>
        </div>

        <div className="field" hidden={settings.ollamaAutoTranslateMode !== "hover"}>
          <label htmlFor="hoverTranslateDelayMs">悬停延迟</label>
          <div className="input-with-suffix">
            <input
              id="hoverTranslateDelayMs"
              type="number"
              className="field-input field-input--number"
              min="0"
              max="5000"
              step="50"
              inputMode="numeric"
              value={settings.ollamaHoverTranslateDelayMs}
              onChange={(event) =>
                updateSettings(
                  { ollamaHoverTranslateDelayMs: event.target.value },
                  "debounced",
                  { delay: 500 },
                )
              }
              onBlur={() => {
                const normalized = String(
                  normalizeHoverTranslateDelayMs(
                    settingsRef.current.ollamaHoverTranslateDelayMs,
                  ),
                );
                const nextSettings = {
                  ...settingsRef.current,
                  ollamaHoverTranslateDelayMs: normalized,
                };
                settingsRef.current = nextSettings;
                updateSettings(() => nextSettings, "none");
                void persistSettings(nextSettings).catch((error) => {
                  console.error("Save settings failed:", error);
                  showAutoSaveStatus("自动保存失败", true);
                });
              }}
            />
            <span className="input-suffix">毫秒</span>
          </div>
          <span className="hint">
            鼠标停留多久后开始自动翻译，默认 200 毫秒。
          </span>
        </div>

        <div className="field">
          <label htmlFor="pageTranslateConcurrency">整页翻译并发</label>
          <div className="input-with-suffix">
            <input
              id="pageTranslateConcurrency"
              type="number"
              className="field-input field-input--number"
              min="1"
              max="8"
              step="1"
              inputMode="numeric"
              value={settings.ollamaPageTranslateConcurrency}
              onChange={(event) =>
                updateSettings(
                  { ollamaPageTranslateConcurrency: event.target.value },
                  "debounced",
                  { delay: 500 },
                )
              }
              onBlur={() => {
                const normalized = String(
                  normalizePageTranslateConcurrency(
                    settingsRef.current.ollamaPageTranslateConcurrency,
                  ),
                );
                const nextSettings = {
                  ...settingsRef.current,
                  ollamaPageTranslateConcurrency: normalized,
                };
                settingsRef.current = nextSettings;
                updateSettings(() => nextSettings, "none");
                void persistSettings(nextSettings).catch((error) => {
                  console.error("Save settings failed:", error);
                  showAutoSaveStatus("自动保存失败", true);
                });
              }}
            />
            <span className="input-suffix">请求</span>
          </div>
          <span className="hint">同时发送的整页翻译请求数，默认 2。</span>
        </div>

        <div className="field">
          <label htmlFor="pageTranslateBatchSize">整页翻译批量条数</label>
          <div className="input-with-suffix">
            <input
              id="pageTranslateBatchSize"
              type="number"
              className="field-input field-input--number"
              min="1"
              max="12"
              step="1"
              inputMode="numeric"
              value={settings.ollamaPageTranslateBatchSize}
              onChange={(event) =>
                updateSettings(
                  { ollamaPageTranslateBatchSize: event.target.value },
                  "debounced",
                  { delay: 500 },
                )
              }
              onBlur={() => {
                const normalized = String(
                  normalizePageTranslateBatchSize(
                    settingsRef.current.ollamaPageTranslateBatchSize,
                  ),
                );
                const nextSettings = {
                  ...settingsRef.current,
                  ollamaPageTranslateBatchSize: normalized,
                };
                settingsRef.current = nextSettings;
                updateSettings(() => nextSettings, "none");
                void persistSettings(nextSettings).catch((error) => {
                  console.error("Save settings failed:", error);
                  showAutoSaveStatus("自动保存失败", true);
                });
              }}
            />
            <span className="input-suffix">条/批</span>
          </div>
          <span className="hint">
            每次请求合并多少段文本一起翻译，默认 6。数值越大，请求更少但单次响应更慢。
          </span>
        </div>

        <ShortcutsList
          commands={shortcuts}
          supportsCommands={!!chrome.commands?.getAll}
        />
        <div className="shortcuts-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={openShortcutsPage}
          >
            打开浏览器快捷键设置
          </button>
          {showShortcutsHint ? (
            <span className="hint shortcuts-open-hint">
              若无法自动打开，请手动打开：扩展程序 → 键盘快捷方式（Chrome
              地址栏输入 <code>{SHORTCUTS_URL}</code>）
            </span>
          ) : null}
        </div>
      </div>
      <p className="shortcuts-hint">
        使用方式：选中文字后按快捷键；或将鼠标悬停在单词上按快捷键；或右键
        「Ollama 翻译选中内容」
      </p>
    </>
  );
}
