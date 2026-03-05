/**
 * 数字输入字段组件
 * 支持后缀、范围限制和自动保存
 */

/**
 * 带后缀的数字输入框
 */
export function NumberInputWithSuffix({
  id,
  label,
  value,
  onChange,
  onBlur,
  suffix,
  min,
  max,
  step = 1,
  hint,
}) {
  return (
    <div className="field">
      {label && <label htmlFor={id}>{label}</label>}
      <div className="input-with-suffix">
        <input
          id={id}
          type="number"
          className="field-input field-input--number"
          min={min}
          max={max}
          step={step}
          inputMode="numeric"
          value={value}
          onChange={onChange}
          onBlur={onBlur}
        />
        {suffix && <span className="input-suffix">{suffix}</span>}
      </div>
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

/**
 * 配置项数字输入（集成规范化和持久化）
 */
export function SettingNumberInput({
  id,
  label,
  settingKey,
  value,
  updateSettings,
  persistSettings,
  settingsRef,
  showAutoSaveStatus,
  normalizer,
  suffix,
  min,
  max,
  step = 1,
  hint,
  debounceDelay = 500,
}) {
  const handleChange = (event) => {
    updateSettings(
      { [settingKey]: event.target.value },
      "debounced",
      { delay: debounceDelay },
    );
  };

  const handleBlur = () => {
    const normalized = String(normalizer(settingsRef.current[settingKey]));
    const nextSettings = {
      ...settingsRef.current,
      [settingKey]: normalized,
    };
    settingsRef.current = nextSettings;
    updateSettings(() => nextSettings, "none");
    
    void persistSettings(nextSettings).catch((error) => {
      console.error("Save settings failed:", error);
      showAutoSaveStatus("自动保存失败", true);
    });
  };

  return (
    <NumberInputWithSuffix
      id={id}
      label={label}
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      suffix={suffix}
      min={min}
      max={max}
      step={step}
      hint={hint}
    />
  );
}
