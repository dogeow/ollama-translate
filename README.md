# Ollama 翻译 - 浏览器扩展

使用本机 Ollama 模型翻译选中文字，支持句型学习模式。

## 功能

- **右键翻译**：选中文字后右键「Ollama 翻译选中内容」
- **快捷键**：`Alt+T` 翻译当前选中内容（可在扩展快捷方式中修改）
- **弹窗**：点击扩展图标打开快捷入口，可跳转设置页
- **设置页**：配置 Ollama 地址（默认 `http://127.0.0.1:11434`）、模型、目标语言、悬停翻译、学习模式等
- **学习模式**（可选）：翻译后可查看句型分析（主语/谓语/状语等分句释义）

## 前置条件

- 本机已安装 [Ollama](https://ollama.com)
- 至少拉取一个模型，例如：`ollama pull qwen2.5:7b`

## 开发

```bash
# 安装依赖
npm install

# 修改版本号（推荐）
npm version patch

# 开发模式（监听变化，自动重载）
npm run dev

# 构建
npm run build

# 构建并启动预览
npm start
```

版本号现在以 `package.json` 为单一来源。执行 `npm run dev`、`npm run build`、`npm start` 或 `npm version patch|minor|major` 时，会自动把版本同步到 `src/manifest.json`，不再需要手动维护两份。

## 更新提醒

扩展默认启用“发现新版本后提醒用户手动更新”，但**不会自动安装新包**。

版本清单 URL 已内置为：

`https://raw.githubusercontent.com/dogeow/ollama-translate/main/latest.json`

发布新版本时，同步更新仓库根目录的 `latest.json` 即可。后台会定期检查该文件；如果发现更高版本，弹窗和设置页的「关于」页签都会提示用户打开更新页面。

## 安装

1. 运行 `npm run build`
2. Chrome 打开 `chrome://extensions/`，开启「开发者模式」
3. 点击「加载已解压的扩展程序」，选择 `dist/chrome` 目录

## 项目结构

```
browser-extension/
├── src/
│   ├── manifest.json
│   ├── popup.html / popup.css / popup.jsx   # React 弹窗入口
│   ├── popup/PopupApp.jsx
│   ├── options.html / options.css / options.jsx  # React 设置页挂载入口
│   ├── options/
│   │   ├── OptionsApp.jsx
│   │   ├── components/
│   │   ├── hooks/
│   │   └── lib/
│   ├── content/          # 注入页面的脚本（翻译气泡、选中等）
│   │   ├── tip/TipView.jsx
│   │   └── ...
│   ├── background.js    # 后台消息流与浏览器事件
│   ├── background/
│   │   ├── ollama.js
│   │   └── sentenceStudy.js
│   └── icons/
└── package.json
```
