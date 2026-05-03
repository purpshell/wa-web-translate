import { loadConfig } from '@/shared/storage';
import type { TranslateRequest, TranslateResult } from '@/shared/types';
import { buildPrompt, parseModelOutput } from './prompt';
import { callModel } from './providers';
import type { RpcMessage, TranslateRpcRequest } from '@/shared/messages';

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'wa-translate') return;
  port.onMessage.addListener(async (msg: TranslateRpcRequest) => {
    if (!msg || msg.kind !== 'TRANSLATE_REQUEST') return;
    try {
      const result = await translate(msg.payload);
      const reply: RpcMessage = {
        __waTrans: true,
        kind: 'TRANSLATE_RESULT',
        id: msg.id,
        ok: true,
        result,
      };
      port.postMessage(reply);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn('[wa-translate sw] translate failed:', message);
      const reply: RpcMessage = {
        __waTrans: true,
        kind: 'TRANSLATE_RESULT',
        id: msg.id,
        ok: false,
        error: message,
      };
      try {
        port.postMessage(reply);
      } catch {}
    }
  });
});

async function translate(req: TranslateRequest): Promise<TranslateResult> {
  const text = (req.text ?? '').trim();
  if (!text) {
    return { translated: '', source: 'unknown', target: req.target };
  }
  const config = await loadConfig();
  const prompt = buildPrompt(req, config);

  const raw = await callModel(config, { system: prompt.system, user: prompt.user });

  const fallbackSource = req.source && req.source !== 'auto' ? req.source : 'unknown';
  const parsed = parseModelOutput(raw, prompt.expectsSourcePrefix, fallbackSource);
  return {
    translated: parsed.translated,
    source: parsed.source as TranslateResult['source'],
    target: req.target,
  };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.kind === 'PING_CONFIG') {
    loadConfig().then((c) => {
      sendResponse({
        provider: c.provider,
        hasKey: !!c.apiKeys[c.provider],
        nativeLang: c.nativeLang,
      });
    });
    return true;
  }
  return false;
});
