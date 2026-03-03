/**
 * 模型处理工具函数
 * 提供模型名称解析和格式化函数
 */

/**
 * 格式化模型大小
 * @param {number} bytes - 字节数
 * @returns {string} 格式化后的大小字符串
 */
export function formatModelSize(bytes) {
  if (bytes == null || bytes === 0) return "";
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(1)} KB`;
  return `${bytes} B`;
}

/**
 * 获取模型名称
 * @param {string|object} model - 模型字符串或模型对象
 * @returns {string} 模型名称
 */
export function getModelName(model) {
  return typeof model === "string" ? model : model?.name || "";
}

/**
 * 获取模型显示名称（包含大小信息）
 * @param {string|object} model - 模型字符串或模型对象
 * @returns {string} 格式化后的显示名称
 */
export function getModelDisplay(model) {
  const name = getModelName(model);
  if (!name) return "";
  const size =
    typeof model === "object" && model?.size != null ? formatModelSize(model.size) : "";
  return size ? `${name} (${size})` : name;
}

/**
 * 解析模型信息
 * @param {string|object} model - 模型字符串或模型对象
 * @returns {object} 解析后的模型信息
 */
export function parseModelInfo(model) {
  const name = getModelName(model);
  const size = typeof model === "object" ? model?.size : null;
  const modifiedAt = typeof model === "object" ? model?.modified_at : null;

  return {
    name,
    size,
    sizeFormatted: formatModelSize(size),
    modifiedAt,
  };
}
