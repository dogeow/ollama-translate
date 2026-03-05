import { useRef } from "react";
import { ModelDropdown } from "./ModelDropdown.jsx";
import { useOutsideClick } from "../hooks/useOutsideClick.js";
import {
  DEFAULT_MINIMAX_API_URL,
  LANG_OPTIONS,
  PROVIDER_MINIMAX,
  TRANSLATE_PROVIDER_OPTIONS,
} from "../../shared/constants.js";

const CONNECTION_RESULT_CLASSES = {
  ok: "test-result ok",
  err: "test-result err",
};

function getConnectionResultClass(tone) {
  return CONNECTION_RESULT_CLASSES[tone] || "test-result";
}

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
  const isMiniMax = settings.ollamaProvider === PROVIDER_MINIMAX;

  useOutsideClick(
    dropdownRef,
    () => setModelDropdownOpen(false),
    modelDropdownOpen,
  );

  const modelCountText =
    connectionStatus.kind === "ok" && models.length > 0
      ? `（总 ${models.length} 个模型）`
      : "";
  const minimaxModelOptions =
    models.length > 0
      ? models
      : [{ name: settings.minimaxModel || "MiniMax-M2.5-highspeed" }];
  const testConnectionClassName = getConnectionResultClass(
    testConnectionResult.tone,
  );

  return (
    <>
      <div className="card">
        <h2>翻译引擎</h2>
        <div className="field">
          <label htmlFor="ollamaProvider">API 厂家</label>
          <select
            id="ollamaProvider"
            className="select"
            value={settings.ollamaProvider}
            onChange={(event) => {
              const provider = event.target.value;
              const nextSettings = {
                ...settingsRef.current,
                ollamaProvider: provider,
              };
              updateSettings(() => nextSettings, "now");
              void updateConnectionStatus(nextSettings, {
                skipModalOnError: true,
                preserveTestMessage: false,
              });
            }}
          >
            {TRANSLATE_PROVIDER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="providerApiUrl">
            {isMiniMax ? "MiniMax API 地址" : "Ollama API 地址"}
          </label>
          <input
            id="providerApiUrl"
            type="text"
            placeholder={
              isMiniMax ? DEFAULT_MINIMAX_API_URL : "http://127.0.0.1:11434"
            }
            value={isMiniMax ? settings.minimaxApiUrl : settings.ollamaUrl}
            onChange={(event) =>
              updateSettings(
                isMiniMax
                  ? { minimaxApiUrl: event.target.value }
                  : { ollamaUrl: event.target.value },
                "debounced",
                {
                  delay: 500,
                },
              )
            }
            onBlur={() => {
              void persistSettings(settingsRef.current).catch((error) => {
                console.error("Save settings failed:", error);
                showAutoSaveStatus("自动保存失败", true);
              });
            }}
          />
        </div>

        {isMiniMax ? (
          <div className="field">
            <label htmlFor="minimaxApiKey">MiniMax API Key</label>
            <input
              id="minimaxApiKey"
              type="password"
              className="field-input"
              placeholder="输入 sk- 开头的 MiniMax API Key"
              value={settings.minimaxApiKey}
              onChange={(event) =>
                updateSettings(
                  { minimaxApiKey: event.target.value },
                  "debounced",
                  {
                    delay: 500,
                  },
                )
              }
              onBlur={() => {
                void persistSettings(settingsRef.current).catch((error) => {
                  console.error("Save settings failed:", error);
                  showAutoSaveStatus("自动保存失败", true);
                });
              }}
            />
          </div>
        ) : null}

        <div className="field">
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
            <span className={testConnectionClassName}>
              {testConnectionResult.text}
            </span>
            {!isMiniMax && testConnectionResult.showAction ? (
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
          <label htmlFor={isMiniMax ? "minimaxModel" : "ollamaModel"}>
            模型
            <span className="model-count">{modelCountText}</span>
          </label>
          {isMiniMax ? (
            <select
              id="minimaxModel"
              className="select"
              value={settings.minimaxModel}
              onChange={(event) =>
                updateSettings({ minimaxModel: event.target.value }, "now")
              }
            >
              {minimaxModelOptions.map((model) => {
                const name = String(model?.name || "").trim();
                if (!name) return null;
                return (
                  <option key={name} value={name}>
                    {name}
                  </option>
                );
              })}
            </select>
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>

      <div className="card">
        <h2>翻译偏好</h2>
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
    </>
  );
}
