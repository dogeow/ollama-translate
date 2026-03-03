import { useRef } from "react";
import { ModelDropdown } from "./ModelDropdown.jsx";
import { useOutsideClick } from "../hooks/useOutsideClick.js";
import { LANG_OPTIONS } from "../../shared/constants.js";

export function HomeTab({
  settings,
  updateSettings,
  persistSettings,
  settingsRef,
  showAutoSaveStatus,
  connectionStatus,
  models,
  modelDropdownOpen,
  setModelDropdownOpen,
  setOriginsModalOpen,
  testConnectionResult,
  updateConnectionStatus,
}) {
  const dropdownRef = useRef(null);

  useOutsideClick(dropdownRef, () => setModelDropdownOpen(false), modelDropdownOpen);

  const modelCountText =
    connectionStatus.kind === "ok" ? `（总 ${models.length} 个模型）` : "";
  const testConnectionClassName =
    testConnectionResult.tone === "ok"
      ? "test-result ok"
      : testConnectionResult.tone === "err"
        ? "test-result err"
        : "test-result";

  return (
    <div className="card">
      <h2>Ollama</h2>
      <div className="field">
        <label htmlFor="ollamaUrl">Ollama API 地址</label>
        <input
          id="ollamaUrl"
          type="text"
          placeholder="http://127.0.0.1:11434"
          value={settings.ollamaUrl}
          onChange={(event) =>
            updateSettings({ ollamaUrl: event.target.value }, "debounced", {
              delay: 500,
            })
          }
          onBlur={() => {
            void persistSettings(settingsRef.current).catch((error) => {
              console.error("Save settings failed:", error);
              showAutoSaveStatus("自动保存失败", true);
            });
          }}
        />
        <div className="field-row" style={{ marginTop: 10 }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={async () => {
              await updateConnectionStatus(settingsRef.current, {
                skipModalOnError: true,
                preserveTestMessage: false,
              });
            }}
          >
            测试连接
          </button>
          <span className={testConnectionClassName}>{testConnectionResult.text}</span>
          {testConnectionResult.showAction ? (
            <button
              type="button"
              className="btn btn-secondary test-result-action"
              onClick={() => setOriginsModalOpen(true)}
            >
              查看解决方法
            </button>
          ) : null}
        </div>
      </div>

      <div className="field">
        <label htmlFor="ollamaModel">
          模型<span className="model-count">{modelCountText}</span>
        </label>
        <input type="hidden" id="ollamaModel" value={settings.ollamaModel} />
        <ModelDropdown
          models={models}
          selectedValue={settings.ollamaModel}
          disabled={connectionStatus.kind !== "ok"}
          isOpen={modelDropdownOpen}
          onToggle={() => {
            if (connectionStatus.kind !== "ok") return;
            setModelDropdownOpen((open) => !open);
          }}
          onSelect={(value) => {
            setModelDropdownOpen(false);
            updateSettings({ ollamaModel: value }, "now");
          }}
          dropdownRef={dropdownRef}
        />
      </div>

      <div className="field">
        <label htmlFor="ollamaTranslateTargetLang">默认翻译语言</label>
        <select
          id="ollamaTranslateTargetLang"
          className="select"
          value={settings.ollamaTranslateTargetLang}
          onChange={(event) => {
            updateSettings(
              { ollamaTranslateTargetLang: event.target.value },
              "now",
            );
          }}
        >
          {LANG_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
