/**
 * 表单选项配置常量
 * 集中管理所有表单的选项配置
 */

/**
 * 自动翻译模式选项
 */
export const AUTO_TRANSLATE_MODE_OPTIONS = [
  {
    value: "off",
    title: "关闭自动翻译",
    description: "仅保留手动快捷键、右键菜单和选区按钮。",
    hint: "只保留右键、快捷键和手动触发。",
  },
  {
    value: "selection",
    title: "双击 / 三击选中后自动翻译",
    description: "双击单词或三击整段后自动翻译，适合基于选区的操作方式。",
    hint: "双击单词或三击整段后立即翻译。",
  },
  {
    value: "hover",
    title: "悬停自动翻译",
    description: "鼠标移动到文本上后自动取词或取整段，无需双击或按快捷键。",
    hint: "鼠标停留在文本上时自动触发翻译。",
  },
];

/**
 * 悬停翻译范围选项
 */
export const HOVER_SCOPE_OPTIONS = [
  {
    value: "word",
    label: "只翻译单词",
    title: "只翻译单词",
    hint: "更轻量，适合看英文文章。",
  },
  {
    value: "paragraph",
    label: "翻译整段话",
    title: "翻译整段话",
    hint: "适合整段阅读和快速理解上下文。",
  },
];

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
