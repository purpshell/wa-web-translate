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

const port = chrome.runtime.connect({ name: 'wa-translate' });

window.addEventListener('message', (e) => {
  if (e.source !== window) return;
  const data = e.data as Record<string, unknown> | undefined;
  if (!data) return;

  if (data[TAG] === true) {
    const rpc = data as unknown as RpcMessage;
    if (rpc.kind === 'TRANSLATE_REQUEST') {
      try {
        port.postMessage(rpc);
      } catch {}
    }
    return;
  }

  if (data['__waTransStore'] === true) {
    handleStoreMsg(data);
  }
});

port.onMessage.addListener((msg: RpcMessage) => {
  try {
    window.postMessage(msg, '*');
  } catch {}
});

window.addEventListener('pagehide', () => {
  try {
    port.disconnect();
  } catch {}
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
