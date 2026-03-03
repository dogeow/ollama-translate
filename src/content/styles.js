/** 注入滑词翻译用到的全局样式 */
import { BUTTON_ID, TIP_ID, STYLE_ID, SHORTCUT_HINT_ID } from "./constants.js";

export function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
/* ===== Hover translate button ===== */
#${BUTTON_ID} {
    position: absolute;
    z-index: 2147483646;
    padding: 6px 14px;
    font-size: 13px;
    font-weight: 500;
    color: #fff;
    background: linear-gradient(135deg, #6366f1, #7c3aed);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    box-shadow: 0 2px 12px rgba(99, 102, 241, 0.35), 0 1px 3px rgba(0,0,0,0.2);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    letter-spacing: 0.01em;
}
#${BUTTON_ID}:hover {
    background: linear-gradient(135deg, #4f46e5, #6d28d9);
    transform: scale(1.03);
    box-shadow: 0 4px 16px rgba(99, 102, 241, 0.45), 0 1px 3px rgba(0,0,0,0.2);
}

/* ===== Tip container ===== */
#${TIP_ID} {
    position: fixed;
    z-index: 2147483647;
    max-width: 420px;
    min-width: 260px;
    padding: 0;
    font-size: 13px;
    color: #e4e4e7;
    background: #131316;
    border: 1px solid #27272a;
    border-radius: 14px;
    box-shadow:
        0 8px 32px rgba(0, 0, 0, 0.5),
        0 2px 8px rgba(0, 0, 0, 0.3);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    overflow: hidden;
    animation: ollama-tip-enter 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    line-height: 1.5;
}

@keyframes ollama-tip-enter {
    from { opacity: 0; transform: translateY(6px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
}

/* ===== Tip inner wrapper ===== */
#${TIP_ID} .ollama-tip-body {
    padding: 14px 16px;
}

/* ===== Header ===== */
#${TIP_ID} .ollama-tip-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 11px 12px 11px 16px;
    background: #18181b;
    border-bottom: 1px solid #27272a;
    margin: 0;
}

#${TIP_ID} .ollama-tip-title {
    color: #a1a1aa;
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.02em;
}

#${TIP_ID} .ollama-tip-close {
    background: none;
    border: none;
    color: #52525b;
    cursor: pointer;
    padding: 0;
    width: 26px;
    height: 26px;
    border-radius: 6px;
    font-size: 16px;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s ease, color 0.15s ease;
}
#${TIP_ID} .ollama-tip-close:hover {
    background: #27272a;
    color: #e4e4e7;
}

/* ===== Model label ===== */
#${TIP_ID} .ollama-tip-model {
    color: #52525b;
    font-size: 11px;
    padding: 0 16px;
    margin-top: 10px;
    letter-spacing: 0.02em;
}

/* ===== Model select (need-model state) ===== */
#${TIP_ID} .ollama-tip-model-select {
    width: 100%;
    padding: 8px 10px;
    font-size: 13px;
    background: #0f0f12;
    color: #e4e4e7;
    border: 1px solid #27272a;
    border-radius: 8px;
    outline: none;
    transition: border-color 0.15s ease;
    -webkit-appearance: none;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 10px center;
    padding-right: 32px;
}
#${TIP_ID} .ollama-tip-model-select:focus {
    border-color: #6366f1;
    box-shadow: 0 0 0 3px #1e1e3a;
}
#${TIP_ID} .ollama-tip-model-select option {
    direction: rtl;
    text-align: left;
    padding-right: 10px;
}

/* ===== Translate button (need-model state) ===== */
#${TIP_ID} .ollama-tip-translate-btn {
    width: 100%;
    padding: 9px;
    font-size: 13px;
    font-weight: 500;
    color: #fff;
    background: linear-gradient(135deg, #6366f1, #7c3aed);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    margin-top: 10px;
    transition: opacity 0.15s ease, transform 0.1s ease;
    letter-spacing: 0.01em;
}
#${TIP_ID} .ollama-tip-translate-btn:hover {
    opacity: 0.9;
}
#${TIP_ID} .ollama-tip-translate-btn:active {
    transform: scale(0.98);
}
#${TIP_ID} .ollama-tip-translate-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    transform: none;
}

/* ===== Sections ===== */
#${TIP_ID} .ollama-tip-section {
    margin-top: 12px;
    padding: 0 16px;
}
#${TIP_ID} .ollama-tip-section:first-child {
    margin-top: 0;
}
#${TIP_ID} .ollama-tip-section:last-child {
    padding-bottom: 2px;
}

/* ===== Labels ===== */
#${TIP_ID} .ollama-tip-label {
    color: #71717a;
    font-size: 11px;
    font-weight: 500;
    margin-bottom: 4px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

/* ===== Text content ===== */
#${TIP_ID} .ollama-tip-text {
    word-break: break-word;
    white-space: pre-wrap;
    color: #f4f4f5;
    font-size: 13px;
    line-height: 1.6;
}

/* ===== Loading state ===== */
#${TIP_ID} .ollama-tip-loading {
    color: #71717a;
    font-size: 12px;
    margin-top: 2px;
}

#${TIP_ID} .ollama-tip-placeholder {
    height: 10px;
    margin-top: 8px;
    border-radius: 999px;
    background: linear-gradient(90deg, #27272a, #3f3f46, #27272a);
    background-size: 200% 100%;
    animation: ollama-tip-loading 1.5s ease-in-out infinite;
}
#${TIP_ID} .ollama-tip-placeholder--short { width: 62%; }
#${TIP_ID} .ollama-tip-placeholder--title { width: 48%; }

/* ===== Error ===== */
#${TIP_ID} .ollama-tip-error {
    color: #fca5a5;
    font-size: 12px;
    line-height: 1.5;
    padding: 8px 10px;
    background: #1c1517;
    border: 1px solid #3b1c1c;
    border-radius: 8px;
    border-color: rgba(239, 68, 68, 0.4);
    border-left: 3px solid #ef4444;
}

/* ===== Copy button ===== */
#${TIP_ID} .ollama-tip-copy {
    margin: 12px 0 0 16px;
    padding: 6px 14px;
    font-size: 12px;
    font-weight: 500;
    color: #fff;
    background: #818cf8;
    border: 1px solid #6366f1;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    letter-spacing: 0.01em;
}
#${TIP_ID} .ollama-tip-copy:hover {
    background: #7c7ff0;
    border-color: #818cf8;
    color: #fff;
}

/* ===== Grammar / Sentence Study Section ===== */
#${TIP_ID} .ollama-tip-grammar-section {
    margin-top: 14px;
    padding: 14px 16px 14px;
    border-top: 1px solid #27272a;
    background: #0f0f12;
}

#${TIP_ID} .ollama-tip-grammar-pattern {
    color: #f4f4f5;
    font-size: 13px;
    font-weight: 600;
    margin-top: 6px;
    line-height: 1.5;
}

#${TIP_ID} .ollama-tip-grammar-parts {
    display: flex;
    gap: 8px;
    margin-top: 12px;
    overflow-x: auto;
    padding-bottom: 4px;
    scrollbar-width: thin;
    scrollbar-color: #27272a transparent;
}
#${TIP_ID} .ollama-tip-grammar-parts::-webkit-scrollbar {
    height: 4px;
}
#${TIP_ID} .ollama-tip-grammar-parts::-webkit-scrollbar-track {
    background: transparent;
}
#${TIP_ID} .ollama-tip-grammar-parts::-webkit-scrollbar-thumb {
    background: #27272a;
    border-radius: 2px;
}

#${TIP_ID} .ollama-tip-grammar-part {
    flex: 0 0 auto;
    width: fit-content;
    max-width: min(230px, calc(100vw - 96px));
    padding: 10px 12px;
    background: #1a1a2e;
    border: 1px solid #2a2a4a;
    border-radius: 10px;
    transition: border-color 0.15s ease;
}
#${TIP_ID} .ollama-tip-grammar-part:hover {
    border-color: #3a3a5c;
}

#${TIP_ID} .ollama-tip-grammar-text {
    color: #f4f4f5;
    font-size: 13px;
    line-height: 1.5;
    word-break: break-word;
    font-weight: 500;
}

#${TIP_ID} .ollama-tip-grammar-translation {
    color: #a1a1aa;
    font-size: 12px;
    line-height: 1.45;
    margin-top: 5px;
    word-break: break-word;
}

#${TIP_ID} .ollama-tip-grammar-line {
    width: 100%;
    height: 1px;
    margin: 8px 0;
    background: linear-gradient(90deg, #6366f1, #2a2a4a);
}

#${TIP_ID} .ollama-tip-grammar-role {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 9px;
    border-radius: 999px;
    background: #1e1e3a;
    color: #a5b4fc;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.02em;
}

#${TIP_ID} .ollama-tip-grammar-note {
    color: #71717a;
    font-size: 11px;
    line-height: 1.45;
    margin-top: 6px;
}

#${TIP_ID} .ollama-tip-grammar-empty {
    color: #71717a;
    font-size: 12px;
    line-height: 1.5;
    margin-top: 6px;
    font-style: italic;
}

/* ===== Shortcut hint toast ===== */
#${SHORTCUT_HINT_ID} {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 2147483647;
    padding: 10px 20px;
    font-size: 13px;
    font-weight: 500;
    color: #e4e4e7;
    background: #131316;
    border: 1px solid #27272a;
    border-radius: 10px;
    box-shadow:
        0 8px 24px rgba(0, 0, 0, 0.5);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    pointer-events: none;
    animation: ollama-tip-enter 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    letter-spacing: 0.01em;
}

/* ===== Skeleton loading animation ===== */
@keyframes ollama-tip-loading {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
}
`;
  (document.head || document.documentElement).appendChild(style);
}
