// Bridge between the MAIN-world page script and the service worker. This script runs
// in the ISOLATED world so it has access to chrome.* APIs. It also injects the page
// bundle as a real <script src> tag — that gives the script a proper base URL so its
// relative dynamic imports resolve correctly. (Manifest content_script with world:MAIN
// doesn't expose chrome.runtime.id in many Chrome builds, so we don't rely on that.)
import type { RpcMessage } from '@/shared/messages';
import { TAG } from '@/shared/messages';
import {
  loadChatLangs,
  loadConfig,
  setChatLang,
  watchChatLangs,
  watchConfig,
} from '@/shared/storage';
import type { ChatLangMap, Config } from '@/shared/types';

// `__PAGE_BUNDLE_URL__` is a placeholder. The post-build Vite plugin replaces it with
// the bundled MAIN-world entry path (e.g. `assets/index.ts-XXX.js`).
const PAGE_BUNDLE_PATH = '__PAGE_BUNDLE_URL__';

(function injectPageBundle() {
  if (PAGE_BUNDLE_PATH.startsWith('__PAGE_BUNDLE')) {
    console.warn('[wa-translate] page bundle path was not injected at build time');
    return;
  }
  const url = chrome.runtime.getURL(PAGE_BUNDLE_PATH);
  const s = document.createElement('script');
  s.type = 'module';
  s.src = url;
  s.dataset.waTranslate = 'true';
  (document.documentElement || document.head).appendChild(s);
  s.addEventListener('load', () => s.remove());
})();

// MV3 service workers are suspended after a period of inactivity. When that happens
// the existing port disconnects silently — `port.postMessage` becomes a no-op and
// every subsequent translate request times out. We track the connection state and
// lazily reconnect when needed.

let port: chrome.runtime.Port | null = null;

function connect(): chrome.runtime.Port {
  const p = chrome.runtime.connect({ name: 'wa-translate' });
  p.onMessage.addListener((msg: RpcMessage) => {
    try {
      window.postMessage(msg, '*');
    } catch {}
  });
  p.onDisconnect.addListener(() => {
    if (port === p) port = null;
  });
  return p;
}

function getPort(): chrome.runtime.Port {
  if (!port) port = connect();
  return port;
}

function postToSw(rpc: RpcMessage): void {
  // Try once on the cached port; if it's dead, reconnect and retry.
  try {
    getPort().postMessage(rpc);
    return;
  } catch {
    port = null;
  }
  try {
    getPort().postMessage(rpc);
  } catch (err) {
    console.warn('[wa-translate] port post failed twice', err);
  }
}

// Prime the connection eagerly so the SW boots up before the first user message.
getPort();

window.addEventListener('message', (e) => {
  if (e.source !== window) return;
  const data = e.data as Record<string, unknown> | undefined;
  if (!data) return;

  if (data[TAG] === true) {
    const rpc = data as unknown as RpcMessage;
    if (rpc.kind === 'TRANSLATE_REQUEST') postToSw(rpc);
    return;
  }

  if (data['__waTransStore'] === true) {
    handleStoreMsg(data);
  }
});

window.addEventListener('pagehide', () => {
  try {
    port?.disconnect();
  } catch {}
  port = null;
});

// --- Store proxy: page world cannot use chrome.* directly. ---

function pushStore(patch: { config?: Config; chatLangs?: ChatLangMap }) {
  window.postMessage({ __waTransStore: true, kind: 'STORE_PUSH', ...patch }, '*');
}

async function pushSnapshot() {
  const [config, chatLangs] = await Promise.all([loadConfig(), loadChatLangs()]);
  pushStore({ config, chatLangs });
}

function handleStoreMsg(data: Record<string, unknown>) {
  if (data.kind === 'STORE_REQUEST') {
    pushSnapshot();
  } else if (data.kind === 'STORE_SET_CHAT_LANG') {
    const chatId = String(data.chatId);
    const lang = data.lang == null ? null : String(data.lang);
    setChatLang(chatId, lang);
  }
}

watchConfig((config) => pushStore({ config }));
watchChatLangs((chatLangs) => pushStore({ chatLangs }));

// Initial push as soon as the page world is ready (it'll call STORE_REQUEST too,
// but this keeps the warm-up path short).
pushSnapshot();
