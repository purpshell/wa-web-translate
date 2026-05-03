import { DEFAULT_CONFIG, type ChatLangMap, type Config } from './types';

const KEY_CONFIG = 'config';
const KEY_CHAT_LANGS = 'chatLangs';
const KEY_INBOUND_CACHE = 'inboundCache';

export async function loadConfig(): Promise<Config> {
  const got = await chrome.storage.local.get(KEY_CONFIG);
  const stored = (got[KEY_CONFIG] ?? {}) as Partial<Config>;
  return {
    ...DEFAULT_CONFIG,
    ...stored,
    apiKeys: { ...DEFAULT_CONFIG.apiKeys, ...(stored.apiKeys ?? {}) },
    model: { ...DEFAULT_CONFIG.model, ...(stored.model ?? {}) },
  };
}

export async function saveConfig(patch: Partial<Config>): Promise<Config> {
  const current = await loadConfig();
  const next = { ...current, ...patch };
  await chrome.storage.local.set({ [KEY_CONFIG]: next });
  return next;
}

export async function loadChatLangs(): Promise<ChatLangMap> {
  const got = await chrome.storage.local.get(KEY_CHAT_LANGS);
  return (got[KEY_CHAT_LANGS] ?? {}) as ChatLangMap;
}

export async function setChatLang(chatId: string, lang: string | null): Promise<void> {
  const map = await loadChatLangs();
  if (lang) map[chatId] = lang;
  else delete map[chatId];
  await chrome.storage.local.set({ [KEY_CHAT_LANGS]: map });
}

export async function getInboundCache(): Promise<Record<string, string>> {
  const got = await chrome.storage.local.get(KEY_INBOUND_CACHE);
  return (got[KEY_INBOUND_CACHE] ?? {}) as Record<string, string>;
}

export async function cacheInbound(messageId: string, translated: string): Promise<void> {
  const cache = await getInboundCache();
  cache[messageId] = translated;
  // Cap to 5000 entries
  const keys = Object.keys(cache);
  if (keys.length > 5000) {
    for (const k of keys.slice(0, keys.length - 5000)) delete cache[k];
  }
  await chrome.storage.local.set({ [KEY_INBOUND_CACHE]: cache });
}

export function watchConfig(cb: (cfg: Config) => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area !== 'local' || !changes[KEY_CONFIG]) return;
    loadConfig().then(cb);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

export function watchChatLangs(cb: (map: ChatLangMap) => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area !== 'local' || !changes[KEY_CHAT_LANGS]) return;
    cb((changes[KEY_CHAT_LANGS].newValue ?? {}) as ChatLangMap);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
