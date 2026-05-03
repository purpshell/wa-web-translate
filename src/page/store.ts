// Page-world wrapper around chrome.storage. The page world cannot use chrome.* directly,
// so we proxy via the content script with a lightweight RPC.

import type { ChatLangMap, Config } from '@/shared/types';
import { DEFAULT_CONFIG } from '@/shared/types';

type StoreEvent = 'config' | 'chatLangs';

const subscribers = new Map<StoreEvent, Set<() => void>>();

let config: Config = { ...DEFAULT_CONFIG };
let chatLangs: ChatLangMap = {};

const STORE_TAG = '__waTransStore';

interface StoreResp {
  [STORE_TAG]: true;
  kind: 'STORE_PUSH';
  config?: Config;
  chatLangs?: ChatLangMap;
}

window.addEventListener('message', (e) => {
  if (e.source !== window) return;
  const data = e.data as StoreResp | undefined;
  if (!data || (data as unknown as Record<string, unknown>)[STORE_TAG] !== true) return;
  if (data.kind === 'STORE_PUSH') {
    if (data.config) {
      config = data.config;
      fire('config');
    }
    if (data.chatLangs) {
      chatLangs = data.chatLangs;
      fire('chatLangs');
    }
  }
});

function fire(ev: StoreEvent) {
  for (const fn of subscribers.get(ev) ?? []) {
    try {
      fn();
    } catch {}
  }
}

function emit(kind: string, payload: Record<string, unknown> = {}) {
  window.postMessage({ [STORE_TAG]: true, kind, ...payload }, '*');
}

export function requestSnapshot() {
  emit('STORE_REQUEST');
}

export function setChatLang(chatId: string, lang: string | null) {
  chatLangs = { ...chatLangs };
  if (lang) chatLangs[chatId] = lang;
  else delete chatLangs[chatId];
  fire('chatLangs');
  emit('STORE_SET_CHAT_LANG', { chatId, lang });
}

export function getChatLang(chatId: string): string | null {
  return chatLangs[chatId] ?? null;
}

export function getChatLangs(): ChatLangMap {
  return chatLangs;
}

export function getConfig(): Config {
  return config;
}

export function subscribe(ev: StoreEvent, cb: () => void): () => void {
  if (!subscribers.has(ev)) subscribers.set(ev, new Set());
  subscribers.get(ev)!.add(cb);
  return () => subscribers.get(ev)?.delete(cb);
}
