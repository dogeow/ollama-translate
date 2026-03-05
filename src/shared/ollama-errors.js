/**
 * Ollama 错误处理统一模块
 * 提供错误消息常量和错误解析函数
 */

/**
 * 错误消息映射
 */
export const OLLAMA_ERROR_MESSAGES = {
  "403": "Ollama 拒绝了扩展的请求（403）。请在终端设置 OLLAMA_ORIGINS 环境变量后重启 Ollama。",
  "403_detailed":
    "HTTP 403：Ollama 拒绝了扩展的请求。请在终端用以下命令启动 Ollama 后再试：\n\nollama serve",
  connection: "无法连接 Ollama。请确认本机已启动 Ollama（终端运行 ollama serve）。",
  connection_detailed:
    "无法连接 Ollama。请确认本机已安装并启动 Ollama（终端运行 ollama serve），且扩展设置中地址为 http://127.0.0.1:11434",
  timeout: "请求超时，请稍后再试。",
  no_model: "请先选择一个模型。",
  app_disabled: "应用已关闭，请在扩展弹窗中重新开启应用。",
};

/**
 * 判断是否为 Ollama 连接错误
 * @param {Error|string} error - 错误对象或错误消息
 * @returns {boolean}
 */
export function isOllamaConnectionError(error) {
  if (!error) return false;
  const message = typeof error === "string" ? error : error?.message || "";
  return (
    error?.name === "TypeError" &&
    (message.includes("fetch") ||
      message.includes("network") ||
      message.includes("Failed to fetch"))
  );
}

/**
 * 判断是否为 Ollama 403 错误
 * @param {Error|string} error - 错误对象或错误消息
 * @returns {boolean}
 */
export function isOllama403Error(error) {
  if (!error) return false;
  const message = typeof error === "string" ? error : error?.message || "";
  return message === "403" || message.includes("403");
}

const ERROR_CODE_MAP = {
  "403": { simple: "403", detailed: "403_detailed", check: isOllama403Error },
  connection: {
    simple: "connection",
    detailed: "connection_detailed",
    check: isOllamaConnectionError,
  },
  timeout: { simple: "timeout" },
  no_model: { simple: "no_model" },
  app_disabled: { simple: "app_disabled" },
};

/**
 * 获取 Ollama 错误消息
 * @param {string|Error} error - 错误代码或错误对象
 * @param {object} options - 选项
 * @param {boolean} options.detailed - 是否返回详细错误信息
 * @returns {string} 错误消息
 */
export function getOllamaErrorMessage(error, options = {}) {
  const { detailed = false } = options;
  const errorCode = typeof error === "string" ? error : error?.message || "";

  for (const [, config] of Object.entries(ERROR_CODE_MAP)) {
    if (errorCode === config.simple || (config.check && config.check(error))) {
      const key = detailed && config.detailed ? config.detailed : config.simple;
      return OLLAMA_ERROR_MESSAGES[key];
    }
  }

  // 返回原始错误消息
  return typeof error === "string" ? error : error?.message || "未知错误";
}
