/**
 * 表单选项配置常量
 * 集中管理所有表单的选项配置
 */

// 从 shared/constants.js 导入统一定义
export {
  AUTO_TRANSLATE_MODE_OPTIONS,
  HOVER_TRANSLATE_SCOPE_OPTIONS,
} from "../../shared/constants.js";

/**
 * 数字输入限制
 */
export const INPUT_LIMITS = {
  hoverDelay: {
    min: 0,
    max: 5000,
    step: 50,
    default: 200,
    suffix: "毫秒",
    hint: "鼠标停留多久后开始自动翻译，默认 200 毫秒。",
  },
  pageTranslateConcurrency: {
    min: 1,
    max: 8,
    step: 1,
    default: 2,
    suffix: "请求",
    hint: "同时发送的整页翻译请求数，默认 2。",
  },
  pageTranslateBatchSize: {
    min: 1,
    max: 12,
    step: 1,
    default: 6,
    suffix: "条/批",
    hint: "每次请求合并多少段文本一起翻译，默认 6。数值越大，请求更少但单次响应更慢。",
  },
};

/**
 * 验证提示消息
 */
export const VALIDATION_MESSAGES = {
  required: "此字段为必填项",
  invalidUrl: "请输入有效的 URL",
  invalidApiKey: "请输入有效的 API Key",
  outOfRange: (min, max) => `请输入 ${min} 到 ${max} 之间的值`,
};
