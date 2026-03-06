/**
 * 模型处理工具函数
 * 提供模型名称解析、格式化与翻译用模型过滤
 */

/**
 * 用于过滤「非翻译用」模型的名称或 details.families 匹配规则（小写）
 * 命中任一则从下拉中排除：embed、图形/vision/vl/视频、:cloud 等
 */
const TRANSLATION_MODEL_EXCLUDE_PATTERNS = [
  /embed/i,
  /:cloud/i,
  /video/i,
  /vision/i,
  /图形/i,
  /llava/i,
  /clip/i,
  /pixart/i,
  /flux/i,
  /stable.?diffusion/i,
  // -vl / .vl 等（如 qwen2-vl、llama3.2-vl）
  /[-.]vl(?:$|[-.])/i,
  /\bvl\b/i,
];

/**
 * 判断是否为应排除的模型（embed/图形/vl/视频/vision/:cloud 等）
 * @param {object} model - Ollama 模型对象，含 name、可选 details.families
 * @returns {boolean} true 表示应排除，不展示在下拉中
 */
export function isExcludedFromTranslationList(model) {
  const name = getModelName(model);
  if (!name) return true;

  const nameLower = name.toLowerCase();
  if (TRANSLATION_MODEL_EXCLUDE_PATTERNS.some((re) => re.test(nameLower))) {
    return true;
  }

  const families = model?.details?.families;
  if (Array.isArray(families)) {
    const familyStr = families.join(" ").toLowerCase();
    if (/clip|vision|embed|video/.test(familyStr)) return true;
  }

  return false;
}

/**
 * 从模型列表中过滤掉 embed、图形、vl、视频、:cloud 等，仅保留适合翻译的模型
 * @param {Array<object>} models - Ollama /api/tags 返回的 models 数组
 * @returns {Array<object>} 过滤后的模型列表
 */
export function filterTranslationModels(models) {
  if (!Array.isArray(models)) return [];
  return models.filter((m) => !isExcludedFromTranslationList(m));
}

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
    typeof model === "object" && model?.size != null
      ? formatModelSize(model.size)
      : "";
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
