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
import { Card } from "./common/Card.jsx";
import {
  AutoSaveInputField,
  AutoSaveSelectField,
  ConditionalFields,
} from "./common/AutoSaveField.jsx";
import {
  getConnectionResultClass,
  getMiniMaxConfig,
  isMiniMaxKeyMissing as checkMiniMaxKeyMissing,
} from "../lib/homeTabUtils.js";

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
  const testConnectionClassName = getConnectionResultClass(testConnectionResult.tone);
  const minimaxConfig = getMiniMaxConfig(settings);
  const isMiniMaxKeyMissing = checkMiniMaxKeyMissing(settings);
  const minimaxKeyMissingHint = `请先填写${minimaxConfig.apiKeyLabel}`;

  const handleProviderChange = (event, newProvider) => {
    const nextSettings = {
      ...settingsRef.current,
      ollamaProvider: newProvider,
    };
    updateSettings(() => nextSettings, "now");
    void updateConnectionStatus(nextSettings, {
      skipModalOnError: true,
      preserveTestMessage: false,
    });
  };

  const handleRegionChange = (event, newRegion) => {
    const normalizedRegion = normalizeMiniMaxRegion(newRegion);
    const nextApiUrl =
      normalizedRegion === MINIMAX_REGION_GLOBAL
        ? DEFAULT_MINIMAX_API_URL_GLOBAL
        : DEFAULT_MINIMAX_API_URL_CN;
    const nextSettings = {
      ...settingsRef.current,
      minimaxRegion: normalizedRegion,
      minimaxApiUrl: nextApiUrl,
    };
    const hasKey = normalizedRegion === MINIMAX_REGION_GLOBAL
      ? !!String(nextSettings.minimaxApiKeyGlobal || "").trim()
      : !!String(nextSettings.minimaxApiKeyCn || "").trim();

    updateSettings(() => nextSettings, "now");
    void updateConnectionStatus(nextSettings, {
      skipModalOnError: true,
      preserveTestMessage: false,
      suppressTestMessageOnMissingKey: !hasKey,
    });
  };

  return (
    <>
      <Card title="翻译引擎">
        <AutoSaveSelectField
          id="ollamaProvider"
          label="API 厂家"
          value={settings.ollamaProvider}
          options={TRANSLATE_PROVIDER_OPTIONS}
          settingKey="ollamaProvider"
          updateSettings={updateSettings}
          onChange={handleProviderChange}
        />

        <ConditionalFields condition={isMiniMax}>
          <AutoSaveSelectField
            id="minimaxRegion"
            label="MiniMax 区域"
            value={minimaxConfig.region}
            options={MINIMAX_REGION_OPTIONS}
            settingKey="minimaxRegion"
            updateSettings={updateSettings}
            onChange={handleRegionChange}
          />
        </ConditionalFields>

        <AutoSaveInputField
          id="providerApiUrl"
          label={isMiniMax ? "MiniMax API 地址" : "Ollama API 地址"}
          placeholder={
            isMiniMax ? minimaxConfig.urlPlaceholder : "http://127.0.0.1:11434"
          }
          value={isMiniMax ? settings.minimaxApiUrl : settings.ollamaUrl}
          settingKey={isMiniMax ? "minimaxApiUrl" : "ollamaUrl"}
          updateSettings={updateSettings}
          persistSettings={persistSettings}
          settingsRef={settingsRef}
          showAutoSaveStatus={showAutoSaveStatus}
        />

        <ConditionalFields condition={isMiniMax}>
          <AutoSaveInputField
            id="minimaxRegionApiKey"
            label={minimaxConfig.apiKeyLabel}
            placeholder={`输入${minimaxConfig.isGlobal ? "海外" : "国内"} sk- 开头的 MiniMax API Key`}
            value={minimaxConfig.apiKeyValue}
            settingKey={
              minimaxConfig.isGlobal ? "minimaxApiKeyGlobal" : "minimaxApiKeyCn"
            }
            updateSettings={updateSettings}
            persistSettings={persistSettings}
            settingsRef={settingsRef}
            showAutoSaveStatus={showAutoSaveStatus}
            error={isMiniMaxKeyMissing ? minimaxKeyMissingHint : null}
          />
        </ConditionalFields>

        <AutoSaveInputField
          id="providerModel"
          label="模型"
          placeholder={
            isMiniMax
              ? "输入 MiniMax 模型，例如 MiniMax-M2.5-highspeed"
              : "输入 Ollama 模型，例如 qwen2.5:7b"
          }
          value={isMiniMax ? settings.minimaxModel : settings.ollamaModel}
          settingKey={isMiniMax ? "minimaxModel" : "ollamaModel"}
          updateSettings={updateSettings}
          persistSettings={persistSettings}
          settingsRef={settingsRef}
          showAutoSaveStatus={showAutoSaveStatus}
        />

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
      </Card>

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
