// Inject a single <style> tag with all of our in-page CSS so we don't fight WhatsApp's
// stylesheets and don't depend on a CSS bundler in the page world.

const STYLE_ID = 'wa-translate-styles';

const CSS = `
.wa-translate-picker-host {
  display: inline-flex;
  align-items: center;
  margin-right: 6px;
  position: relative;
  z-index: 10;
}
.wa-translate-picker-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  border-radius: 18px;
  background: rgba(0, 0, 0, 0);
  color: var(--icon-default, #aebac1);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 120ms ease;
  user-select: none;
  font-family: inherit;
}
.wa-translate-picker-btn:hover {
  background: rgba(255, 255, 255, 0.06);
  color: var(--primary-strong, #e9edef);
}
.wa-translate-picker-btn[data-active="true"] {
  background: rgba(0, 168, 132, 0.18);
  color: #00a884;
  border-color: rgba(0, 168, 132, 0.35);
}
.wa-translate-picker-pop {
  position: absolute;
  bottom: calc(100% + 8px);
  right: 0;
  width: 260px;
  max-height: 320px;
  overflow: hidden;
  background: var(--background-default-active, #2a3942);
  color: var(--primary-strong, #e9edef);
  border-radius: 10px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
  display: flex;
  flex-direction: column;
  z-index: 9999;
}
.wa-translate-picker-search {
  appearance: none;
  border: none;
  background: rgba(0, 0, 0, 0.18);
  color: inherit;
  padding: 10px 12px;
  font-size: 13px;
  outline: none;
  font-family: inherit;
}
.wa-translate-picker-list {
  overflow: auto;
  padding: 4px 0;
}
.wa-translate-picker-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 13px;
}
.wa-translate-picker-item:hover {
  background: rgba(255, 255, 255, 0.05);
}
.wa-translate-picker-item[data-selected="true"] {
  color: #00a884;
}
.wa-translate-picker-clear {
  padding: 8px 12px;
  font-size: 12px;
  opacity: 0.7;
  cursor: pointer;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}
.wa-translate-picker-clear:hover { opacity: 1; }

.wa-translate-draft {
  position: absolute;
  left: 64px;
  right: 64px;
  bottom: calc(100% + 4px);
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(6px);
  border: 1px solid rgba(0, 168, 132, 0.35);
  border-radius: 10px;
  color: #e9edef;
  font-size: 13px;
  line-height: 1.35;
  white-space: pre-wrap;
  pointer-events: none;
  z-index: 50;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
}
.wa-translate-draft[data-empty="true"] { display: none; }
.wa-translate-draft-label {
  display: block;
  font-size: 11px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #00a884;
  margin-bottom: 2px;
  opacity: 0.85;
}
.wa-translate-draft-loading::after {
  content: '...';
  animation: wa-translate-blink 1s steps(3, end) infinite;
}
@keyframes wa-translate-blink {
  0% { content: ''; }
  33% { content: '.'; }
  66% { content: '..'; }
  100% { content: '...'; }
}
.wa-translate-draft-error {
  color: #f15c6d;
}

.wa-translate-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  z-index: 100000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.wa-translate-modal-card {
  width: 380px;
  max-width: 100%;
  background: #1f2c33;
  color: #e9edef;
  border-radius: 12px;
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
}
.wa-translate-modal-head {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 14px 16px 8px;
}
.wa-translate-modal-sub {
  font-size: 12px;
  color: #8696a0;
}
.wa-translate-modal-search {
  appearance: none;
  border: none;
  margin: 0 12px 8px;
  padding: 9px 12px;
  background: rgba(0, 0, 0, 0.25);
  color: inherit;
  border-radius: 8px;
  font: inherit;
  font-size: 13px;
  outline: none;
}
.wa-translate-modal-search:focus {
  box-shadow: 0 0 0 2px rgba(0, 168, 132, 0.35);
}
.wa-translate-modal-list {
  max-height: 320px;
  overflow: auto;
  padding: 4px 0;
}
.wa-translate-modal-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  cursor: pointer;
  font-size: 13px;
}
.wa-translate-modal-item:hover { background: rgba(255, 255, 255, 0.06); }
.wa-translate-modal-item[data-selected="true"] { color: #00a884; }
.wa-translate-modal-clear {
  padding: 12px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 12px;
  opacity: 0.7;
  cursor: pointer;
}
.wa-translate-modal-clear:hover { opacity: 1; }

.wa-translate-incoming {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px dashed rgba(255, 255, 255, 0.18);
  font-style: italic;
  opacity: 0.86;
  font-size: 0.92em;
  white-space: pre-wrap;
}
.wa-translate-incoming::before {
  content: '↳ ';
  opacity: 0.5;
}
`;

export function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = CSS;
  document.head.appendChild(s);
}
