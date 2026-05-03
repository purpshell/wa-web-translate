// Observe the WhatsApp composer (contenteditable footer). When the user types,
// debounce and request a translation preview so the DraftPreview component can render it.

import { translate } from '../bridge';
import { getActiveChatId } from '../wa';
import { getChatLang, getConfig, subscribe } from '../store';

type Listener = (state: ComposerState) => void;

export interface ComposerState {
  chatId: string | null;
  targetLang: string | null;
  source: string;
  translation: string;
  loading: boolean;
  error: string | null;
}

const state: ComposerState = {
  chatId: null,
  targetLang: null,
  source: '',
  translation: '',
  loading: false,
  error: null,
};

const listeners = new Set<Listener>();

function update(patch: Partial<ComposerState>) {
  Object.assign(state, patch);
  for (const fn of listeners) {
    try {
      fn(state);
    } catch {}
  }
}

export function subscribeComposer(cb: Listener): () => void {
  listeners.add(cb);
  cb(state);
  return () => listeners.delete(cb);
}

export function getComposerState(): ComposerState {
  return state;
}

let lastReqId = 0;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function findComposer(): HTMLElement | null {
  // The composer is a contenteditable; data-tab values change but role=textbox is stable.
  const candidates = document.querySelectorAll<HTMLElement>(
    'footer [contenteditable="true"][role="textbox"], footer [contenteditable="true"]',
  );
  // The last one in the footer is the message composer (the others are e.g. the search box).
  return candidates.length ? candidates[candidates.length - 1] : null;
}

function readComposerText(el: HTMLElement): string {
  // WhatsApp wraps lines in <p><span class="..."><span class="selectable-text">...</span></span></p>
  // and emojis in <img alt="emoji">. innerText is the closest plain-text view.
  return el.innerText.replace(/ /g, ' ').trim();
}

function onComposerInput(el: HTMLElement) {
  const text = readComposerText(el);
  const chatId = getActiveChatId();
  const targetLang = chatId ? getChatLang(chatId) : null;

  update({ chatId, targetLang, source: text });

  if (!text || !targetLang) {
    update({ translation: '', loading: false, error: null });
    return;
  }

  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    const reqId = ++lastReqId;
    update({ loading: true, error: null });
    try {
      const config = getConfig();
      const result = await translate({
        text,
        source: config.nativeLang || 'auto',
        target: targetLang,
      });
      if (reqId !== lastReqId) return;
      update({ translation: result.translated, loading: false });
    } catch (err) {
      if (reqId !== lastReqId) return;
      update({
        loading: false,
        error: err instanceof Error ? err.message : String(err),
        translation: '',
      });
    }
  }, 350);
}

export function installComposerObserver(): void {
  let attached: HTMLElement | null = null;
  const handler = (e: Event) => onComposerInput(e.currentTarget as HTMLElement);

  const attach = () => {
    const el = findComposer();
    if (!el || el === attached) return;
    if (attached) attached.removeEventListener('input', handler);
    attached = el;
    el.addEventListener('input', handler);
    onComposerInput(el);
  };

  // Re-attach when WA re-renders (chat switches, etc.)
  const root = document.body;
  const mo = new MutationObserver(() => attach());
  mo.observe(root, { childList: true, subtree: true });
  attach();

  // Re-evaluate when target language changes for the current chat.
  subscribe('chatLangs', () => {
    if (attached) onComposerInput(attached);
  });
}
