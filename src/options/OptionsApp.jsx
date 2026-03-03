import { useEffect, useRef, useState } from "react";
import { ConnectionStatusBanner } from "./components/ConnectionStatusBanner.jsx";
import { ModelDropdown } from "./components/ModelDropdown.jsx";
import { OriginsModal } from "./components/OriginsModal.jsx";
import { ShortcutsList } from "./components/ShortcutsList.jsx";
import { TranslateResultView } from "./components/TranslateResultView.jsx";
import { useOutsideClick } from "./hooks/useOutsideClick.js";
import { useTransientStatus } from "./hooks/useTransientStatus.js";
import {
  DEFAULT_AUTO_TRANSLATE_MODE,
  DEFAULT_HOVER_TRANSLATE_DELAY_MS,
  DEFAULT_HOVER_TRANSLATE_SCOPE,
  DEFAULT_LEARNING_MODE_ENABLED,
  DEFAULT_OLLAMA_MODEL,
  DEFAULT_OLLAMA_URL,
  DEFAULT_TRANSLATE_TARGET_LANG,
  LANG_OPTIONS,
  SHORTCUTS_URL,
  TRANSLATE_RESULT_KEY,
} from "./lib/constants.js";
import {
  commandsGetAll,
  storageLocalGet,
  storageSyncGet,
  storageSyncSet,
  tabsCreate,
} from "./lib/chrome.js";
import {
  detectPlatform,
  getConfig,
  getSettingsSnapshot,
  getStoredSettingsShape,
  normalizeHoverTranslateDelayMs,
  runGenerateRequest,
} from "./lib/utils.js";

export function OptionsApp() {
  const [view, setView] = useState(
    window.location.hash === "#translate" ? "translate-result" : "options",
  );
  const [settings, setSettings] = useState({
    ollamaUrl: DEFAULT_OLLAMA_URL,
    ollamaModel: DEFAULT_OLLAMA_MODEL,
    ollamaTranslateTargetLang: DEFAULT_TRANSLATE_TARGET_LANG,
    ollamaAutoTranslateMode: DEFAULT_AUTO_TRANSLATE_MODE,
    ollamaHoverTranslateScope: DEFAULT_HOVER_TRANSLATE_SCOPE,
    ollamaHoverTranslateDelayMs: String(DEFAULT_HOVER_TRANSLATE_DELAY_MS),
    ollamaLearningModeEnabled: DEFAULT_LEARNING_MODE_ENABLED,
  });
  const [activeTab, setActiveTab] = useState("home");
  const [translateResult, setTranslateResult] = useState({});
  const { status, showStatus: showAutoSaveStatus } = useTransientStatus();
  const [connectionStatus, setConnectionStatus] = useState({
    kind: "pending",
    text: "检测中…",
    showAction: false,
  });
  const [models, setModels] = useState([]);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [originsModalOpen, setOriginsModalOpen] = useState(false);
  const [originsPlatform, setOriginsPlatform] = useState(detectPlatform());
  const [testConnectionResult, setTestConnectionResult] = useState({
    text: "",
    tone: "",
    showAction: false,
  });
  const [testInput, setTestInput] = useState("");
  const [testSourceLang, setTestSourceLang] = useState("auto");
  const [testTargetLang, setTestTargetLang] = useState(DEFAULT_TRANSLATE_TARGET_LANG);
  const [detectLangResult, setDetectLangResult] = useState({ text: "", isError: false });
  const [testTranslateHint, setTestTranslateHint] = useState({ text: "", isError: false });
  const [testTranslateResult, setTestTranslateResult] = useState({
    text: "",
    tone: "empty",
  });
  const [shortcuts, setShortcuts] = useState([]);
  const [showShortcutsHint, setShowShortcutsHint] = useState(false);
  const dropdownRef = useRef(null);
  const settingsRef = useRef(settings);
  const lastSavedSettingsRef = useRef("");
  const autoSaveTimerRef = useRef(null);
  const connectionRequestIdRef = useRef(0);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    return () => {
      window.clearTimeout(autoSaveTimerRef.current);
    };
  }, []);

  useOutsideClick(dropdownRef, () => setModelDropdownOpen(false), modelDropdownOpen);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const [storedSettings, storedTranslateResult, commandList] = await Promise.all([
        storageSyncGet({
          ollamaUrl: DEFAULT_OLLAMA_URL,
          ollamaModel: DEFAULT_OLLAMA_MODEL,
          ollamaTranslateTargetLang: DEFAULT_TRANSLATE_TARGET_LANG,
          ollamaAutoTranslateMode: DEFAULT_AUTO_TRANSLATE_MODE,
          ollamaAutoTranslateSelection: false,
          ollamaHoverTranslateScope: DEFAULT_HOVER_TRANSLATE_SCOPE,
          ollamaHoverTranslateDelayMs: DEFAULT_HOVER_TRANSLATE_DELAY_MS,
          ollamaLearningModeEnabled: DEFAULT_LEARNING_MODE_ENABLED,
        }),
        storageLocalGet(TRANSLATE_RESULT_KEY),
        commandsGetAll(),
      ]);
      if (cancelled) return;

      const nextSettings = getStoredSettingsShape(storedSettings);
      settingsRef.current = nextSettings;
      setSettings(nextSettings);
      setTestTargetLang(nextSettings.ollamaTranslateTargetLang);
      setTranslateResult(storedTranslateResult || {});
      setShortcuts(commandList);
      lastSavedSettingsRef.current = JSON.stringify(getSettingsSnapshot(nextSettings));
      await updateConnectionStatus(nextSettings);
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, []);

  async function persistSettings(nextSettings, options = {}) {
    const { force = false, silent = false } = options;
    const snapshot = getSettingsSnapshot(nextSettings);
    const serialized = JSON.stringify(snapshot);
    if (!force && serialized === lastSavedSettingsRef.current) {
      return snapshot;
    }
    await storageSyncSet(snapshot);
    lastSavedSettingsRef.current = serialized;
    if (!silent) showAutoSaveStatus("已自动保存");
    return snapshot;
  }

  function scheduleSettingsSave(nextSettings, delay = 500) {
    window.clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = window.setTimeout(() => {
      void persistSettings(nextSettings).catch((error) => {
        console.error("Auto save settings failed:", error);
        showAutoSaveStatus("自动保存失败", true);
      });
    }, delay);
  }

  function updateSettings(partial, persistMode = "none", options = {}) {
    setSettings((previous) => {
      const next =
        typeof partial === "function" ? partial(previous) : { ...previous, ...partial };
      settingsRef.current = next;
      if (persistMode === "now") {
        void persistSettings(next, options).catch((error) => {
          console.error("Save settings failed:", error);
          showAutoSaveStatus("自动保存失败", true);
        });
      } else if (persistMode === "debounced") {
        scheduleSettingsSave(next, options.delay);
      }
      return next;
    });
  }

  async function updateConnectionStatus(nextSettings, options = {}) {
    const { skipModalOnError = false, preserveTestMessage = false } = options;
    const requestId = ++connectionRequestIdRef.current;
    setConnectionStatus({
      kind: "pending",
      text: "检测中…",
      showAction: false,
    });
    setModelDropdownOpen(false);

    const { base } = getConfig(nextSettings);

    try {
      const tagsResponse = await fetch(`${base}/api/tags`, { method: "GET" });
      if (requestId !== connectionRequestIdRef.current) return;

      if (tagsResponse.status === 403) {
        setConnectionStatus({
          kind: "403",
          text: "Ollama 已运行，但拒绝扩展请求（403）",
          showAction: true,
        });
        setModels([]);
        if (!preserveTestMessage) {
          setTestConnectionResult({
            text: "Ollama 已运行，但拒绝扩展请求（403）",
            tone: "err",
            showAction: true,
          });
        }
        if (!skipModalOnError) setOriginsModalOpen(true);
        return;
      }

      if (!tagsResponse.ok) {
        throw new Error(`HTTP ${tagsResponse.status}`);
      }

      const tagsData = await tagsResponse.json();
      const nextModels = tagsData.models || [];
      const probeResponse = await fetch(`${base}/api/__probe_origin__`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });

      if (requestId !== connectionRequestIdRef.current) return;

      if (probeResponse.status === 403) {
        setConnectionStatus({
          kind: "403",
          text: "Ollama 已运行，但拒绝扩展请求（403）",
          showAction: true,
        });
        setModels([]);
        if (!preserveTestMessage) {
          setTestConnectionResult({
            text: "Ollama 已运行，但拒绝扩展请求（403）",
            tone: "err",
            showAction: true,
          });
        }
        if (!skipModalOnError) setOriginsModalOpen(true);
        return;
      }

      setConnectionStatus({
        kind: "ok",
        text: "Ollama 已运行",
        showAction: false,
      });
      setModels(nextModels);
      setOriginsModalOpen(false);

      if (!preserveTestMessage) {
        setTestConnectionResult({
          text:
            nextModels.length > 0
              ? `连接成功，已拉取 ${nextModels.length} 个模型`
              : "连接成功，但未找到已拉取的模型",
          tone: "ok",
          showAction: false,
        });
      }

      const currentModel = nextSettings.ollamaModel;
      const names = nextModels.map((model) => model.name);
      const selectedModel = names.includes(currentModel) ? currentModel : names[0] || "";

      if (selectedModel !== currentModel) {
        const correctedSettings = {
          ...settingsRef.current,
          ollamaModel: selectedModel,
        };
        settingsRef.current = correctedSettings;
        setSettings(correctedSettings);
        await persistSettings(correctedSettings, { silent: true });
      }
    } catch (error) {
      if (requestId !== connectionRequestIdRef.current) return;
      setConnectionStatus({
        kind: "err",
        text: "Ollama 未连接",
        showAction: true,
      });
      setModels([]);
      if (!preserveTestMessage) {
        setTestConnectionResult({
          text:
            (error.message || String(error)) === "Failed to fetch"
              ? "Ollama 连接失败"
              : error.message || String(error),
          tone: "err",
          showAction: true,
        });
      }
      if (!skipModalOnError) setOriginsModalOpen(true);
    }
  }

  async function runDetectLanguage() {
    const text = testInput.trim();
    if (!text) {
      setDetectLangResult({ text: "请先输入要识别的文本", isError: true });
      return;
    }

    const { base, model } = getConfig(settingsRef.current);
    if (!model) {
      setDetectLangResult({ text: "请先选择模型", isError: true });
      return;
    }

    setDetectLangResult({ text: "识别中…", isError: false });

    try {
      const probe = await fetch(`${base}/api/__probe_origin__`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (probe.status === 403) {
        setDetectLangResult({ text: "", isError: false });
        setConnectionStatus({
          kind: "403",
          text: "Ollama 已运行，但拒绝扩展请求（403）",
          showAction: true,
        });
        setOriginsModalOpen(true);
        return;
      }

      const prompt =
        "Identify the language of the following text. Reply with only one word: the language name in English (e.g. Chinese, English, Japanese, French, German, Spanish, Korean). No other text.\n\n" +
        text;
      const language = await runGenerateRequest(base, model, prompt);
      setDetectLangResult({
        text: language ? `识别为：${language.replace(/\.$/, "")}` : "未能识别",
        isError: false,
      });
    } catch (error) {
      setDetectLangResult({
        text:
          (error.message || String(error)) === "Failed to fetch"
            ? "Ollama 连接失败"
            : error.message || String(error),
        isError: true,
      });
      setOriginsModalOpen(true);
    }
  }

  async function runTranslateTest() {
    const text = testInput.trim();
    if (!text) {
      setTestTranslateHint({ text: "请先输入要翻译的文本", isError: true });
      setTestTranslateResult({ text: "", tone: "empty" });
      return;
    }

    const { base, model } = getConfig(settingsRef.current);
    if (!model) {
      setTestTranslateHint({ text: "请先选择模型", isError: true });
      setTestTranslateResult({ text: "", tone: "empty" });
      return;
    }

    setTestTranslateHint({ text: "", isError: false });
    setTestTranslateResult({ text: "翻译中…", tone: "normal" });

    try {
      const probe = await fetch(`${base}/api/__probe_origin__`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (probe.status === 403) {
        setTestTranslateResult({ text: "", tone: "empty" });
        setConnectionStatus({
          kind: "403",
          text: "Ollama 已运行，但拒绝扩展请求（403）",
          showAction: true,
        });
        setOriginsModalOpen(true);
        return;
      }

      const prompt =
        testSourceLang === "auto"
          ? `Translate the following text to ${testTargetLang}. Detect the source language automatically. Only output the translation, no explanation or extra text.\n\n${text}`
          : `Translate the following text from ${testSourceLang} to ${testTargetLang}. Only output the translation, no explanation or extra text.\n\n${text}`;
      const translation = await runGenerateRequest(base, model, prompt);
      setTestTranslateResult({
        text: translation || "（模型未返回内容）",
        tone: "normal",
      });
    } catch (error) {
      setTestTranslateResult({
        text:
          (error.message || String(error)) === "Failed to fetch"
            ? "Ollama 连接失败"
            : error.message || String(error),
        tone: "error",
      });
      setOriginsModalOpen(true);
    }
  }

  async function openShortcutsPage() {
    try {
      await tabsCreate(SHORTCUTS_URL);
      setShowShortcutsHint(false);
    } catch (_) {
      setShowShortcutsHint(true);
    }
  }

  function openOptionsView() {
    history.replaceState(null, "", window.location.pathname);
    setView("options");
  }

  if (view === "translate-result") {
    return <TranslateResultView result={translateResult} onBack={openOptionsView} />;
  }

  const modelCountText =
    connectionStatus.kind === "ok" ? `（总 ${models.length} 个模型）` : "";
  const testConnectionClassName =
    testConnectionResult.tone === "ok"
      ? "test-result ok"
      : testConnectionResult.tone === "err"
        ? "test-result err"
        : "test-result";
  const testTranslateClassName =
    testTranslateResult.tone === "error"
      ? "test-result-block error"
      : testTranslateResult.tone === "empty"
        ? "test-result-block empty"
        : "test-result-block";

  return (
    <>
      <OriginsModal
        isOpen={originsModalOpen}
        activePlatform={originsPlatform}
        onChangePlatform={setOriginsPlatform}
        onClose={() => setOriginsModalOpen(false)}
      />
      <div className="options">
        <h1>Ollama 翻译设置</h1>
        <ConnectionStatusBanner
          status={connectionStatus}
          onOpenOrigins={() => setOriginsModalOpen(true)}
        />
        <div className="options-tabs">
          <div className="options-tabs__tablist" role="tablist" aria-label="设置">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "home"}
              onClick={() => setActiveTab("home")}
            >
              首页
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "translate"}
              onClick={() => setActiveTab("translate")}
            >
              翻译测试
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "shortcuts"}
              onClick={() => setActiveTab("shortcuts")}
            >
              快捷键
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "learning"}
              onClick={() => setActiveTab("learning")}
            >
              学习模式
            </button>
          </div>

          <div className="options-tabs__panel" hidden={activeTab !== "home"}>
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
                <div className="field-row" style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={async () => {
                      setTestConnectionResult({
                        text: "检测中…",
                        tone: "",
                        showAction: false,
                      });
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
                    const value = event.target.value;
                    setTestTargetLang(value);
                    updateSettings({ ollamaTranslateTargetLang: value }, "now");
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
          </div>

          <div className="options-tabs__panel" hidden={activeTab !== "translate"}>
            <div className="card card-translate-test">
              <h2>翻译测试</h2>
              <div className="field">
                <label htmlFor="ollamaTestInput">要翻译的文本</label>
                <textarea
                  id="ollamaTestInput"
                  className="textarea"
                  rows="3"
                  placeholder="输入要翻译的文本，点击下方按钮测试"
                  value={testInput}
                  onChange={(event) => setTestInput(event.target.value)}
                ></textarea>
              </div>
              <div className="field translate-test-actions-wrap">
                <div className="field translate-test-actions">
                  <label htmlFor="ollamaTestSourceLang" className="translate-test-actions__label">
                    输入语言
                  </label>
                  <div className="translate-test-actions__row">
                    <select
                      id="ollamaTestSourceLang"
                      className="select translate-test-actions__select"
                      value={testSourceLang}
                      onChange={(event) => setTestSourceLang(event.target.value)}
                    >
                      <option value="auto">自动识别</option>
                      {LANG_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <button type="button" className="btn btn-secondary" onClick={runDetectLanguage}>
                      识别语言
                    </button>
                    <span
                      className={`detect-lang-result ${detectLangResult.isError ? "error" : ""}`.trim()}
                      aria-live="polite"
                    >
                      {detectLangResult.text}
                    </span>
                  </div>
                </div>

                <div className="field translate-test-actions">
                  <label htmlFor="ollamaTestLang" className="translate-test-actions__label">
                    翻译为
                  </label>
                  <div className="translate-test-actions__row">
                    <select
                      id="ollamaTestLang"
                      className="select translate-test-actions__select"
                      value={testTargetLang}
                      onChange={(event) => setTestTargetLang(event.target.value)}
                    >
                      {LANG_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <button type="button" className="btn btn-secondary" onClick={runTranslateTest}>
                      测试翻译
                    </button>
                    <span
                      className={`detect-lang-result ${testTranslateHint.isError ? "error" : ""}`.trim()}
                      aria-live="polite"
                    >
                      {testTranslateHint.text}
                    </span>
                  </div>
                </div>

                <div className="field translate-test-actions translate-test-result-row">
                  <label className="translate-test-actions__label">翻译</label>
                  <div className={testTranslateClassName} aria-live="polite">
                    {testTranslateResult.text}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="options-tabs__panel" hidden={activeTab !== "shortcuts"}>
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
                      setSettings(nextSettings);
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
          </div>

          <div className="options-tabs__panel" hidden={activeTab !== "learning"}>
            <div className="card">
              <h2>学习模式</h2>
              <div className="field">
                <label className="checkbox-label" htmlFor="learningModeEnabled">
                  <input
                    id="learningModeEnabled"
                    type="checkbox"
                    checked={settings.ollamaLearningModeEnabled}
                    onChange={(event) =>
                      updateSettings(
                        { ollamaLearningModeEnabled: event.target.checked },
                        "now",
                      )
                    }
                  />
                  <span>启用学习模式</span>
                </label>
                <span className="hint">
                  开启后，翻译完成的 tip 弹窗会追加主句结构、句法拆分和学习说明。默认关闭，以减少额外分析带来的等待时间。
                </span>
              </div>
            </div>
          </div>
        </div>
        <p className={`status ${status.isError ? "status--error" : ""}`.trim()}>
          {status.text}
        </p>
      </div>
    </>
  );
}
