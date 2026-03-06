import { useState } from "react";
import { ShortcutsList } from "./ShortcutsList.jsx";
import { RadioGroup, SelectField } from "./common/FormField.jsx";
import { SettingNumberInput } from "./common/NumberInput.jsx";
import {
  normalizeHoverTranslateDelayMs,
  normalizePageTranslateConcurrency,
  normalizePageTranslateBatchSize,
} from "../../shared/settings.js";
import {
  AUTO_TRANSLATE_MODE_OPTIONS,
  HOVER_TRANSLATE_SCOPE_OPTIONS,
  SHORTCUTS_URL,
} from "../../shared/constants.js";
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

        <RadioGroup
          name="autoTranslateMode"
          label="自动翻译模式"
          value={settings.ollamaAutoTranslateMode}
          onChange={(value) =>
            updateSettings({ ollamaAutoTranslateMode: value }, "now")
          }
          options={AUTO_TRANSLATE_MODE_OPTIONS}
        />

        {settings.ollamaAutoTranslateMode === "hover" && (
          <>
            <SelectField
              id="hoverTranslateScope"
              label="悬停翻译范围"
              value={settings.ollamaHoverTranslateScope}
              onChange={(event) =>
                updateSettings(
                  { ollamaHoverTranslateScope: event.target.value },
                  "now",
                )
              }
              options={HOVER_TRANSLATE_SCOPE_OPTIONS}
            />
            <span className="hint">
              悬停模式下，决定自动发送给 Ollama 的文本范围。
            </span>

            <SettingNumberInput
              id="hoverTranslateDelayMs"
              label="悬停延迟"
              settingKey="ollamaHoverTranslateDelayMs"
              value={settings.ollamaHoverTranslateDelayMs}
              updateSettings={updateSettings}
              persistSettings={persistSettings}
              settingsRef={settingsRef}
              showAutoSaveStatus={showAutoSaveStatus}
              normalizer={normalizeHoverTranslateDelayMs}
              suffix="毫秒"
              min={0}
              max={5000}
              step={50}
              hint="鼠标停留多久后开始自动翻译，默认 200 毫秒。"
            />
          </>
        )}

        <SettingNumberInput
          id="pageTranslateConcurrency"
          label="整页翻译并发"
          settingKey="ollamaPageTranslateConcurrency"
          value={settings.ollamaPageTranslateConcurrency}
          updateSettings={updateSettings}
          persistSettings={persistSettings}
          settingsRef={settingsRef}
          showAutoSaveStatus={showAutoSaveStatus}
          normalizer={normalizePageTranslateConcurrency}
          suffix="请求"
          min={1}
          max={8}
          step={1}
          hint="同时发送的整页翻译请求数，默认 2。"
        />

        <SettingNumberInput
          id="pageTranslateBatchSize"
          label="整页翻译批量条数"
          settingKey="ollamaPageTranslateBatchSize"
          value={settings.ollamaPageTranslateBatchSize}
          updateSettings={updateSettings}
          persistSettings={persistSettings}
          settingsRef={settingsRef}
          showAutoSaveStatus={showAutoSaveStatus}
          normalizer={normalizePageTranslateBatchSize}
          suffix="条/批"
          min={1}
          max={12}
          step={1}
          hint="每次请求合并多少段文本一起翻译，默认 6。数值越大，请求更少但单次响应更慢。"
        />

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
