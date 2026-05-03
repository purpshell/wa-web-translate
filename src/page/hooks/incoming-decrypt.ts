// Protocol-level incoming-message translation. We hook `WAWebMsgProcessingDecryptEnc.
// decryptEnc` — the function WhatsApp calls to decrypt an incoming encrypted stanza.
// After decryption, we inspect the resulting message protobuf and replace the visible
// text fields (`conversation`, `extendedTextMessage.text`, image/video/document captions)
// with our translation BEFORE the message reaches the message store and React renderer.
//
// Why this is better than wrapping React components:
// - Translation runs ONCE per message (at decrypt time), not on every render.
// - Group chats and DMs both flow through the same decrypt path.
// - Edits, replies, search, copy-paste all show the translated text consistently.
//
// We append the original under the translation so the recipient can verify.

import { injectToFunction } from '../wa';
import { translate } from '../bridge';
import { getChatLang, getConfig } from '../store';

let installed = false;

// translation cache: `${target}\0${original}` -> translated text
const cache = new Map<string, string>();
const ORIGINAL_MARKER = '\n\n— ';

export function installDecryptHook(): boolean {
  if (installed) return true;
  const ok = injectToFunction(
    { module: 'WAWebMsgProcessingDecryptEnc', function: 'decryptEnc' },
    async (orig, ...args: any[]) => {
      let result = await orig(...args);
      try {
        const decodedResult = require("decodeProtobuf").decodeProtobuf(require("WAWebProtobufsE2E.pb").MessageSpec, require("WACryptoPkcs7").unpadPkcs7(new Uint8Array(result)));
        await maybeTranslateResult(decodedResult, args[1]._serialized);
        result = require('WAWebSendMsgCommonApi').encodeAndPad(decodedResult);
      } catch (err) {
        console.warn('[wa-translate] decrypt translate failed', err);
      }
      return result;
    },
  );
  if (ok) {
    installed = true;
    console.info('[wa-translate] decrypt hook installed');
  }
  return ok;
}


interface TextField {
  read(): string;
  write(v: string): void;
}

async function maybeTranslateResult(result: any, chatId: string): Promise<any> {
  if (!result) return;
  const config = getConfig();
  if (!config.enabled) return;

  const target = getChatLang(chatId) || config.nativeLang;
  if (!target) return;

  const fields = collectTextFields(result);
  if (fields.length === 0) return;

  await Promise.all(
    fields.map(async (f) => {
      const original = f.read();
      if (!original || typeof original !== 'string') return;
      const trimmed = original.trim();
      if (trimmed.length < 2) return;
      // Skip if we previously decorated this very text (idempotency on re-runs).
      if (original.includes(ORIGINAL_MARKER)) return;

      const cacheKey = `${target}\0${original}`;
      let translated = cache.get(cacheKey);
      if (translated == null) {
        try {
          const r = await translate({ text: original, source: 'auto', target });
          translated = r.translated || '';
        } catch (err) {
          translated = '';
        }
        cache.set(cacheKey, translated);
      }
      if (!translated) return;
      if (translated.trim() === trimmed) return;
      f.write(`${translated}${ORIGINAL_MARKER}${original}`);
    }),
  );
}

// Walk the decrypted message tree and find every text-bearing field. Defensive: tries
// multiple known path shapes since WhatsApp's protobuf layout shifts subtly between
// versions and message types.
function collectTextFields(result: any): TextField[] {
  const out: TextField[] = [];
  // The decrypted result usually wraps the message in a `message` property.
  const candidates: any[] = [result, result?.message, result?.body, result?.msg];
  // Some shapes nest the textual message under deviceSentMessage / ephemeralMessage /
  // viewOnceMessage — unwrap a few common shells.
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    if (!c) continue;
    if (c.deviceSentMessage?.message) candidates.push(c.deviceSentMessage.message);
    if (c.ephemeralMessage?.message) candidates.push(c.ephemeralMessage.message);
    if (c.viewOnceMessage?.message) candidates.push(c.viewOnceMessage.message);
    if (c.viewOnceMessageV2?.message) candidates.push(c.viewOnceMessageV2.message);
    if (c.viewOnceMessageV2Extension?.message) candidates.push(c.viewOnceMessageV2Extension.message);
    if (c.editedMessage?.message) candidates.push(c.editedMessage.message);
    if (c.documentWithCaptionMessage?.message) candidates.push(c.documentWithCaptionMessage.message);
  }

  const seen = new Set<any>();
  for (const c of candidates) {
    if (!c || typeof c !== 'object' || seen.has(c)) continue;
    seen.add(c);

    if (typeof c.conversation === 'string') {
      out.push({
        read: () => c.conversation,
        write: (v) => { c.conversation = v; },
      });
    }
    if (c.extendedTextMessage && typeof c.extendedTextMessage.text === 'string') {
      const node = c.extendedTextMessage;
      out.push({ read: () => node.text, write: (v) => { node.text = v; } });
    }
    for (const k of [
      'imageMessage',
      'videoMessage',
      'documentMessage',
      'audioMessage',
    ]) {
      const node = c[k];
      if (node && typeof node.caption === 'string') {
        out.push({ read: () => node.caption, write: (v) => { node.caption = v; } });
      }
    }
  }

  return out;
}
