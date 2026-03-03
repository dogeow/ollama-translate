/** 注入滑词翻译用到的全局样式 */
import { BUTTON_ID, TIP_ID, STYLE_ID, SHORTCUT_HINT_ID } from "./constants.js";

export function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
            #${BUTTON_ID} {
                position: absolute;
                z-index: 2147483646;
                padding: 6px 12px;
                font-size: 13px;
                color: #fff;
                background: #6366f1;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            }
            #${BUTTON_ID}:hover { background: #4f46e5; }
            #${TIP_ID} {
                position: fixed;
                z-index: 2147483647;
                max-width: 320px;
                padding: 12px 14px;
                font-size: 13px;
                color: #e5e5e5;
                background: #1a1a1a;
                border: 1px solid #333;
                border-radius: 10px;
                box-shadow: 0 8px 24px rgba(0,0,0,0.35);
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            }
            #${TIP_ID} { max-width: 400px; }
            #${TIP_ID} .ollama-tip-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid #333; }
            #${TIP_ID} .ollama-tip-title { color: #a3a3a3; font-size: 13px; font-weight: 500; }
            #${TIP_ID} .ollama-tip-close { background: #3f3f46; border: none; color: #a3a3a3; width: 24px; height: 24px; border-radius: 50%; cursor: pointer; font-size: 16px; line-height: 1; display: flex; align-items: center; justify-content: center; }
            #${TIP_ID} .ollama-tip-close:hover { background: #52525b; color: #fff; }
            #${TIP_ID} .ollama-tip-model { color: #71717a; font-size: 11px; margin-bottom: 6px; }
            #${TIP_ID} .ollama-tip-model-select { width: 100%; padding: 6px 8px; font-size: 13px; background: #27272a; color: #e5e5e5; border: 1px solid #3f3f46; border-radius: 6px; margin-bottom: 8px; }
            #${TIP_ID} .ollama-tip-model-select option { direction: rtl; text-align: left; padding-right: 10px; }
            #${TIP_ID} .ollama-tip-translate-btn { width: 100%; padding: 8px; font-size: 13px; color: #fff; background: #6366f1; border: none; border-radius: 6px; cursor: pointer; margin-top: 8px; }
            #${TIP_ID} .ollama-tip-translate-btn:hover { background: #4f46e5; }
            #${TIP_ID} .ollama-tip-close { background: none; border: none; color: #71717a; cursor: pointer; padding: 0 4px; font-size: 18px; line-height: 1; }
            #${TIP_ID} .ollama-tip-close:hover { color: #fff; }
            #${TIP_ID} .ollama-tip-section { margin-top: 8px; }
            #${TIP_ID} .ollama-tip-label { color: #71717a; font-size: 11px; margin-bottom: 2px; }
            #${TIP_ID} .ollama-tip-text { word-break: break-word; white-space: pre-wrap; }
            #${TIP_ID} .ollama-tip-loading { color: #cbd5e1; font-size: 12px; margin-top: 2px; }
            #${TIP_ID} .ollama-tip-placeholder { height: 10px; margin-top: 8px; border-radius: 999px; background: linear-gradient(90deg, rgba(63,63,70,0.9), rgba(82,82,91,0.5), rgba(63,63,70,0.9)); background-size: 200% 100%; animation: ollama-tip-loading 1.3s linear infinite; }
            #${TIP_ID} .ollama-tip-placeholder--short { width: 62%; }
            #${TIP_ID} .ollama-tip-placeholder--title { width: 48%; }
            #${TIP_ID} .ollama-tip-error { color: #fca5a5; font-size: 12px; }
            #${TIP_ID} .ollama-tip-copy { margin-top: 10px; padding: 4px 10px; font-size: 12px; color: #6366f1; background: rgba(99,102,241,0.15); border: none; border-radius: 6px; cursor: pointer; }
            #${TIP_ID} .ollama-tip-copy:hover { background: rgba(99,102,241,0.25); }
            #${TIP_ID} .ollama-tip-grammar-section { margin-top: 12px; padding-top: 10px; border-top: 1px dashed #333; }
            #${TIP_ID} .ollama-tip-grammar-pattern { color: #f5f5f5; font-size: 13px; font-weight: 600; margin-top: 4px; }
            #${TIP_ID} .ollama-tip-grammar-parts { display: flex; gap: 10px; margin-top: 10px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: thin; }
            #${TIP_ID} .ollama-tip-grammar-part { flex: 0 0 auto; width: fit-content; max-width: min(240px, calc(100vw - 96px)); padding: 10px 12px; background: #111827; border: 1px solid #23304a; border-radius: 8px; }
            #${TIP_ID} .ollama-tip-grammar-text { color: #f9fafb; font-size: 13px; line-height: 1.45; word-break: break-word; }
            #${TIP_ID} .ollama-tip-grammar-translation { color: #cbd5e1; font-size: 12px; line-height: 1.4; margin-top: 6px; word-break: break-word; }
            #${TIP_ID} .ollama-tip-grammar-line { width: 100%; height: 1px; margin: 8px 0; background: linear-gradient(90deg, rgba(96,165,250,0.9), rgba(96,165,250,0.15)); }
            #${TIP_ID} .ollama-tip-grammar-role { display: inline-flex; align-items: center; gap: 6px; padding: 3px 8px; border-radius: 999px; background: rgba(96,165,250,0.14); color: #93c5fd; font-size: 11px; font-weight: 600; }
            #${TIP_ID} .ollama-tip-grammar-note { color: #9ca3af; font-size: 11px; line-height: 1.4; margin-top: 6px; }
            #${TIP_ID} .ollama-tip-grammar-empty { color: #94a3b8; font-size: 12px; line-height: 1.5; margin-top: 6px; }
            #${SHORTCUT_HINT_ID} {
                position: fixed;
                bottom: 24px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 2147483647;
                padding: 10px 18px;
                font-size: 13px;
                color: #e5e5e5;
                background: #1a1a1a;
                border: 1px solid #333;
                border-radius: 8px;
                box-shadow: 0 4px 16px rgba(0,0,0,0.35);
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                pointer-events: none;
            }
            @keyframes ollama-tip-loading {
                0% { background-position: 200% 0; }
                100% { background-position: -200% 0; }
            }
        `;
  (document.head || document.documentElement).appendChild(style);
}
