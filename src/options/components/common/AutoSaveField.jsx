/**
 * 配置驱动的表单字段组件
 * 自动处理更新、持久化和错误处理
 */

import { InputField, SelectField } from "./FormField.jsx";

/**
 * 创建持久化错误处理器（工厂函数）
 */
function createPersistHandler(persistSettings, settingsRef, showAutoSaveStatus) {
  return () => {
    void persistSettings(settingsRef.current).catch((error) => {
      console.error("Save settings failed:", error);
      showAutoSaveStatus("自动保存失败", true);
    });
  };
}

/**
 * 自动持久化的输入字段
 * 集成防抖更新和失焦保存
 */
export function AutoSaveInputField({
  id,
  label,
  type = "text",
  placeholder,
  value,
  settingKey,
  updateSettings,
  persistSettings,
  settingsRef,
  showAutoSaveStatus,
  error,
  debounceDelay = 500,
  ...props
}) {
  const handleChange = (event) => {
    updateSettings(
      { [settingKey]: event.target.value },
      "debounced",
      { delay: debounceDelay },
    );
  };

  const handleBlur = createPersistHandler(
    persistSettings,
    settingsRef,
    showAutoSaveStatus,
  );

  return (
    <InputField
      id={id}
      label={label}
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      error={error}
      {...props}
    />
  );
}

/**
 * 自动持久化的选择字段（立即保存）
 */
export function AutoSaveSelectField({
  id,
  label,
  value,
  options,
  settingKey,
  updateSettings,
  onChange,
  ...props
}) {
  const handleChange = (event) => {
    const newValue = event.target.value;
    
    if (onChange) {
      onChange(event, newValue);
    } else {
      updateSettings({ [settingKey]: newValue }, "now");
    }
  };

  return (
    <SelectField
      id={id}
      label={label}
      value={value}
      options={options}
      onChange={handleChange}
      {...props}
    />
  );
}

/**
 * 条件渲染的表单字段组
 */
export function ConditionalFields({ condition, children }) {
  if (!condition) return null;
  return <>{children}</>;
}
