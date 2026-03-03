export const DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434";
export const DEFAULT_OLLAMA_MODEL = "";
export const DEFAULT_TRANSLATE_TARGET_LANG = "Chinese";
export const DEFAULT_AUTO_TRANSLATE_MODE = "off";
export const DEFAULT_HOVER_TRANSLATE_SCOPE = "word";
export const DEFAULT_HOVER_TRANSLATE_DELAY_MS = 200;
export const DEFAULT_LEARNING_MODE_ENABLED = false;
export const TRANSLATE_RESULT_KEY = "ollamaTranslateResult";
export const SHORTCUTS_URL = "chrome://extensions/shortcuts";

export const LANG_OPTIONS = [
  { value: "Chinese", label: "中文" },
  { value: "English", label: "English" },
  { value: "Japanese", label: "日本語" },
  { value: "Korean", label: "한국어" },
  { value: "French", label: "Français" },
  { value: "German", label: "Deutsch" },
  { value: "Spanish", label: "Español" },
];

export const TARGET_LANG_LABELS = Object.fromEntries(
  LANG_OPTIONS.map((option) => [option.value, option.label]),
);

export const ORIGINS_PLATFORM_CONTENT = {
  macos: {
    label: "macOS",
    blocks: [
      {
        type: "hint",
        text: (
          <>
            官方推荐用 <code>launchctl setenv</code> 设置环境变量，然后
            <strong>完全退出并重新打开 Ollama App</strong>。
          </>
        ),
      },
      {
        type: "sub",
        text: "仅 Chrome 扩展",
      },
      {
        type: "code",
        text: 'launchctl setenv OLLAMA_ORIGINS "chrome-extension://*"',
      },
      {
        type: "sub",
        text: "Chrome + Firefox + Safari 扩展",
      },
      {
        type: "code",
        text: 'launchctl setenv OLLAMA_ORIGINS "chrome-extension://*,moz-extension://*,safari-web-extension://*"',
      },
      {
        type: "link",
        text: "参考：Ollama FAQ - Setting environment variables on Mac",
        href: "https://github.com/ollama/ollama/blob/main/docs/faq.md#setting-environment-variables-on-mac",
      },
    ],
  },
  win: {
    label: "Windows",
    blocks: [
      {
        type: "hint",
        text: (
          <>
            Ollama 会读取用户/系统环境变量。在
            <strong>系统环境变量</strong>中新增：
          </>
        ),
      },
      {
        type: "code",
        text: "OLLAMA_ORIGINS=chrome-extension://*",
      },
      {
        type: "hint",
        text: (
          <>
            如需支持 Firefox：
            <code>
              OLLAMA_ORIGINS=chrome-extension://*,moz-extension://*,safari-web-extension://*
            </code>
          </>
        ),
      },
      {
        type: "hint",
        text: (
          <>
            然后<strong>退出 Ollama</strong>，再从开始菜单重新打开。
          </>
        ),
      },
      {
        type: "link",
        text: "参考：Ollama FAQ - Setting environment variables on Windows",
        href: "https://github.com/ollama/ollama/blob/main/docs/faq.md#setting-environment-variables-on-windows",
      },
    ],
  },
  linux: {
    label: "Linux",
    blocks: [
      {
        type: "hint",
        text: (
          <>
            若使用 systemd 管理 Ollama 服务，在服务配置的 <code>[Service]</code>{" "}
            下增加：
          </>
        ),
      },
      {
        type: "code",
        text: 'Environment="OLLAMA_ORIGINS=chrome-extension://*"',
      },
      {
        type: "hint",
        text: "然后执行：",
      },
      {
        type: "code",
        text: "systemctl daemon-reload\nsystemctl restart ollama",
      },
      {
        type: "link",
        text: "参考：Ollama FAQ - Setting environment variables on Linux",
        href: "https://github.com/ollama/ollama/blob/main/docs/faq.md#setting-environment-variables-on-linux",
      },
    ],
  },
};
