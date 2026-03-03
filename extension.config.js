/** @type {import('extension').Config} */
export default {
  browser: ["chrome", "firefox"],
  // 开发时使用固定 profile，避免每次随机新 profile；首次创建时会预置「开发者模式」开启
  commands: {
    dev: {
      profile: ".extension-dev-profile",
      preferences: {
        extensions: { ui: { developer_mode: true } },
      },
    },
    start: {
      profile: ".extension-dev-profile",
      preferences: {
        extensions: { ui: { developer_mode: true } },
      },
    },
  },
};
