import { formatModelSize } from "../lib/utils.js";

export function ModelDropdown({
  models,
  selectedValue,
  disabled,
  isOpen,
  onToggle,
  onSelect,
  dropdownRef,
}) {
  const selectedModel = models.find((item) => item.name === selectedValue);
  let triggerName =
    models.length === 0 ? "请先点击「测试连接」获取模型列表" : "请选择模型";
  let triggerSize = "";

  if (selectedModel) {
    triggerName = selectedModel.name;
    triggerSize = formatModelSize(selectedModel.size);
  } else if (!disabled && models.length === 0) {
    triggerName = "连接成功，但未找到已拉取的模型";
  }

  return (
    <div
      ref={dropdownRef}
      className={`model-dropdown ${disabled ? "model-dropdown--disabled" : ""}`.trim()}
    >
      <button
        type="button"
        className="model-dropdown-trigger"
        onClick={onToggle}
      >
        <span className="model-dropdown-name">{triggerName}</span>
        <span className="model-dropdown-size">{triggerSize}</span>
      </button>
      {!disabled && isOpen ? (
        <div className="model-dropdown-list">
          {models.map((model) => (
            <div
              key={model.name}
              className="model-dropdown-item"
              onClick={() => onSelect(model.name)}
            >
              <span className="model-name">{model.name}</span>
              <span className="model-size">{formatModelSize(model.size)}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
