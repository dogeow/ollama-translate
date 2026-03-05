import {
  DEFAULT_MINIMAX_API_URL_CN,
  DEFAULT_MINIMAX_API_URL_GLOBAL,
  LANG_OPTIONS,
  MINIMAX_REGION_GLOBAL,
  MINIMAX_REGION_OPTIONS,
  PROVIDER_MINIMAX,
  TRANSLATE_PROVIDER_OPTIONS,
} from "../../shared/constants.js";
import { normalizeMiniMaxRegion } from "../../shared/settings.js";

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
  setOriginsModalOpen,
  testConnectionResult,
  updateConnectionStatus,
}) {
  const isMiniMax = settings.ollamaProvider === PROVIDER_MINIMAX;
  const testConnectionClassName = getConnectionResultClass(
    testConnectionResult.tone,
  );
  const minimaxRegion = normalizeMiniMaxRegion(settings.minimaxRegion);
  const usingGlobalMiniMax = minimaxRegion === MINIMAX_REGION_GLOBAL;
  const minimaxUrlPlaceholder = usingGlobalMiniMax
    ? DEFAULT_MINIMAX_API_URL_GLOBAL
    : DEFAULT_MINIMAX_API_URL_CN;
  const minimaxRegionApiKeyValue = usingGlobalMiniMax
    ? settings.minimaxApiKeyGlobal || ""
    : settings.minimaxApiKeyCn || "";
  const minimaxRegionApiKeyLabel = usingGlobalMiniMax
    ? "MiniMax 海外 API Key（minimax.io）"
    : "MiniMax 国内 API Key（minimaxi.com）";
  const isMiniMaxKeyMissing =
    isMiniMax && !String(minimaxRegionApiKeyValue || "").trim();
  const minimaxKeyMissingHint = `请先填写${minimaxRegionApiKeyLabel}`;

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

        {isMiniMax ? (
          <>
            <div className="field">
              <label htmlFor="minimaxRegion">MiniMax 区域</label>
              <select
                id="minimaxRegion"
                className="select"
                value={minimaxRegion}
                onChange={(event) => {
                  const nextRegion = normalizeMiniMaxRegion(event.target.value);
                  const nextApiUrl =
                    nextRegion === MINIMAX_REGION_GLOBAL
                      ? DEFAULT_MINIMAX_API_URL_GLOBAL
                      : DEFAULT_MINIMAX_API_URL_CN;
                  const nextSettings = {
                    ...settingsRef.current,
                    minimaxRegion: nextRegion,
                    minimaxApiUrl: nextApiUrl,
                  };
                  const nextRegionKey = String(
                    nextRegion === MINIMAX_REGION_GLOBAL
                      ? nextSettings.minimaxApiKeyGlobal || ""
                      : nextSettings.minimaxApiKeyCn || "",
                  ).trim();

                  updateSettings(() => nextSettings, "now");
                  void updateConnectionStatus(nextSettings, {
                    skipModalOnError: true,
                    preserveTestMessage: false,
                    suppressTestMessageOnMissingKey: !nextRegionKey,
                  });
                }}
              >
                {MINIMAX_REGION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </>
        ) : null}

        <div className="field">
          <label htmlFor="providerApiUrl">
            {isMiniMax ? "MiniMax API 地址" : "Ollama API 地址"}
          </label>
          <input
            id="providerApiUrl"
            type="text"
            placeholder={
              isMiniMax ? minimaxUrlPlaceholder : "http://127.0.0.1:11434"
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
          <>
            <div className="field">
              <label htmlFor="minimaxRegionApiKey">{minimaxRegionApiKeyLabel}</label>
              <input
                id="minimaxRegionApiKey"
                type="text"
                className="field-input"
                placeholder={`输入${usingGlobalMiniMax ? "海外" : "国内"} sk- 开头的 MiniMax API Key`}
                value={minimaxRegionApiKeyValue}
                aria-invalid={isMiniMaxKeyMissing ? "true" : "false"}
                onChange={(event) =>
                  updateSettings(
                    usingGlobalMiniMax
                      ? { minimaxApiKeyGlobal: event.target.value }
                      : { minimaxApiKeyCn: event.target.value },
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
              {isMiniMaxKeyMissing ? (
                <div className="field-validation field-validation--error">
                  {minimaxKeyMissingHint}
                </div>
              ) : null}
            </div>
          </>
        ) : null}

        <div className="field">
          <label htmlFor="providerModel">模型</label>
          <input
            id="providerModel"
            type="text"
            className="field-input"
            placeholder={
              isMiniMax
                ? "输入 MiniMax 模型，例如 MiniMax-M2.5-highspeed"
                : "输入 Ollama 模型，例如 qwen2.5:7b"
            }
            value={isMiniMax ? settings.minimaxModel : settings.ollamaModel}
            onChange={(event) =>
              updateSettings(
                isMiniMax
                  ? { minimaxModel: event.target.value }
                  : { ollamaModel: event.target.value },
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

        <div className="field">
          <div className="field-row" style={{ marginTop: 10 }}>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={isMiniMaxKeyMissing}
              onClick={async () => {
                await updateConnectionStatus(settingsRef.current, {
                  skipModalOnError: true,
                  preserveTestMessage: false,
                  updateBannerStatus: false,
                  showTestPending: true,
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
