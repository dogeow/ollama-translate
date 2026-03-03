// 从共享模块重新导出，保持向后兼容
export {
  generateCompletion as generateOllamaResponse,
  checkOllamaAndGetModels,
} from "../shared/ollama-api.js";
