import {
  LANG_OPTIONS,
  MINIMAX_REGION_CN,
  MINIMAX_REGION_GLOBAL,
  PROVIDER_MINIMAX_CN,
  PROVIDER_MINIMAX_GLOBAL,
  TRANSLATE_PROVIDER_OPTIONS,
} from "../../shared/constants.js";
import {
  getDefaultMiniMaxApiUrlByRegion,
  isMiniMaxProvider,
} from "../../shared/settings.js";
import { useRef } from "react";
import { Card } from "./common/Card.jsx";
import {
  AutoSaveInputField,
  AutoSaveSelectField,
  ConditionalFields,
} from "./common/AutoSaveField.jsx";
import { ModelDropdown } from "./ModelDropdown.jsx";
import { useOutsideClick } from "../hooks/useOutsideClick.js";
import {
  getConnectionResultClass,
  getMiniMaxConfig,
  isMiniMaxKeyMissing as checkMiniMaxKeyMissing,
} from "../lib/homeTabUtils.js";

const FIELD_IDS = Object.freeze({
  provider: "ollamaProvider",
  providerApiUrl: "providerApiUrl",
  minimaxRegionApiKey: "minimaxRegionApiKey",
  providerModel: "providerModel",
  translateTargetLang: "translateTargetLang",
});

function MiniMaxApiKeyField({
  isMiniMax,
  minimaxConfig,
  isMiniMaxKeyMissing,
  minimaxKeyMissingHint,
  updateSettings,
  persistSettings,
  settingsRef,
  showAutoSaveStatus,
}) {
  return (
    <ConditionalFields condition={isMiniMax}>
      <AutoSaveInputField
        id={FIELD_IDS.minimaxRegionApiKey}
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
  );
}

function ProviderModelField({
  isMiniMax,
  settings,
  updateSettings,
  persistSettings,
  settingsRef,
  showAutoSaveStatus,
  models,
  modelDropdownOpen,
  setModelDropdownOpen,
  modelDropdownRef,
}) {
  if (isMiniMax) {
    return (
      <AutoSaveInputField
        id={FIELD_IDS.providerModel}
        label="模型"
        placeholder="输入 MiniMax 模型，例如 MiniMax-M2.5-highspeed"
        value={settings.minimaxModel}
        settingKey="minimaxModel"
        updateSettings={updateSettings}
        persistSettings={persistSettings}
        settingsRef={settingsRef}
        showAutoSaveStatus={showAutoSaveStatus}
      />
    );
  }

  return (
    <div className="field">
      <label id={`${FIELD_IDS.providerModel}-label`}>模型</label>
      <ModelDropdown
        models={models}
        selectedValue={settings.ollamaModel}
        disabled={models.length === 0}
        isOpen={modelDropdownOpen}
        onToggle={() => setModelDropdownOpen((v) => !v)}
        onSelect={(name) => {
          updateSettings({ ollamaModel: name }, "now");
          void persistSettings(settingsRef.current);
          setModelDropdownOpen(false);
        }}
        dropdownRef={modelDropdownRef}
      />
    </div>
  );
}

function ConnectionTestField({
  isMiniMax,
  isMiniMaxKeyMissing,
  testConnectionClassName,
  testConnectionResult,
  settingsRef,
  updateConnectionStatus,
  setOriginsModalOpen,
}) {
  return (
    <div className="field">
      <div className="field-row" style={{ marginTop: 10 }}>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={isMiniMaxKeyMissing}
          onClick={async () => {
            await updateConnectionStatus(settingsRef.current, {
              preserveTestMessage: false,
              updateBannerStatus: false,
              showTestPending: true,
            });
          }}
        >
          测试连接
        </button>
        <span className={testConnectionClassName}>{testConnectionResult.text}</span>
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
  );
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
  models,
  modelDropdownOpen,
  setModelDropdownOpen,
}) {
  const modelDropdownRef = useRef(null);
  useOutsideClick(
    modelDropdownRef,
    () => setModelDropdownOpen(false),
    modelDropdownOpen,
  );
  const isMiniMax = isMiniMaxProvider(settings.ollamaProvider);
  const testConnectionClassName = getConnectionResultClass(
    testConnectionResult.tone,
  );
  const minimaxConfig = getMiniMaxConfig(settings);
  const isMiniMaxKeyMissing = checkMiniMaxKeyMissing(settings);
  const minimaxKeyMissingHint = `请先填写${minimaxConfig.apiKeyLabel}`;

  const handleProviderChange = (event, newProvider) => {
    const nextSettings = {
      ...settingsRef.current,
      ollamaProvider: newProvider,
    };
    if (
      newProvider === PROVIDER_MINIMAX_CN ||
      newProvider === PROVIDER_MINIMAX_GLOBAL
    ) {
      const region =
        newProvider === PROVIDER_MINIMAX_GLOBAL
          ? MINIMAX_REGION_GLOBAL
          : MINIMAX_REGION_CN;
      nextSettings.minimaxRegion = region;
      nextSettings.minimaxApiUrl = getDefaultMiniMaxApiUrlByRegion(region);
    }
    updateSettings(() => nextSettings, "now");
    void updateConnectionStatus(nextSettings, {
      preserveTestMessage: false,
      updateBannerStatus: false,
      showTestPending: true,
    });
  };

  return (
    <>
      <Card title="翻译引擎">
        <AutoSaveSelectField
          id={FIELD_IDS.provider}
          label="API 厂家"
          value={settings.ollamaProvider}
          options={TRANSLATE_PROVIDER_OPTIONS}
          settingKey="ollamaProvider"
          updateSettings={updateSettings}
          onChange={handleProviderChange}
        />

        <AutoSaveInputField
          id={FIELD_IDS.providerApiUrl}
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

        <MiniMaxApiKeyField
          isMiniMax={isMiniMax}
          minimaxConfig={minimaxConfig}
          isMiniMaxKeyMissing={isMiniMaxKeyMissing}
          minimaxKeyMissingHint={minimaxKeyMissingHint}
          updateSettings={updateSettings}
          persistSettings={persistSettings}
          settingsRef={settingsRef}
          showAutoSaveStatus={showAutoSaveStatus}
        />

        <ProviderModelField
          isMiniMax={isMiniMax}
          settings={settings}
          updateSettings={updateSettings}
          persistSettings={persistSettings}
          settingsRef={settingsRef}
          showAutoSaveStatus={showAutoSaveStatus}
          models={models}
          modelDropdownOpen={modelDropdownOpen}
          setModelDropdownOpen={setModelDropdownOpen}
          modelDropdownRef={modelDropdownRef}
        />

        <ConnectionTestField
          isMiniMax={isMiniMax}
          isMiniMaxKeyMissing={isMiniMaxKeyMissing}
          testConnectionClassName={testConnectionClassName}
          testConnectionResult={testConnectionResult}
          settingsRef={settingsRef}
          updateConnectionStatus={updateConnectionStatus}
          setOriginsModalOpen={setOriginsModalOpen}
        />
      </Card>

      <div className="card">
        <h2>翻译偏好</h2>
        <div className="field">
          <label htmlFor={FIELD_IDS.translateTargetLang}>默认翻译语言</label>
          <select
            id={FIELD_IDS.translateTargetLang}
            className="select"
            value={settings.translateTargetLang}
            onChange={(event) => {
              updateSettings(
                { translateTargetLang: event.target.value },
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
