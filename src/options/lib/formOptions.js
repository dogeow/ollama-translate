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
    hint: "同时发送的页面翻译请求数，默认 2。",
  },
  pageTranslateBatchChars: {
    min: 32,
    max: 2048,
    step: 32,
    default: 128,
    suffix: "字符",
    hint: "每批累计文字达到该长度后不再加条，避免短句过多时提示词比正文还长。默认 128。",
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
