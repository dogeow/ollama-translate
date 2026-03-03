/** 底部快捷键提示条 */
import { SHORTCUT_HINT_ID } from "./constants.js";
import { injectStyles } from "./styles.js";

export function showShortcutHint(message) {
  let el = document.getElementById(SHORTCUT_HINT_ID);
  if (el) el.remove();
  injectStyles();
  el = document.createElement("div");
  el.id = SHORTCUT_HINT_ID;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => {
    if (el.parentNode) el.remove();
  }, 2500);
}
