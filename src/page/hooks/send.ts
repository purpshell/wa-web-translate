// Hook the outgoing-text-message send so we can replace the body with a translation
// (and optionally include the original) before WhatsApp encodes/transmits it.
//
// The exact module/function name has shifted across WhatsApp Web versions. We try a
// list of known candidates and install on the first one we find. If all of them are
// missing, we log and fall back to a no-op.

import { tryRequire } from '../wa';
import { translate } from '../bridge';
import { getChatLang, getConfig } from '../store';
import { getLanguage } from '@/shared/languages';

interface Candidate {
  module: string;
  function: string;
  bodyArgIndex: number;
  chatArgIndex: number;
}

// Verified live against current WhatsApp Web (compose flow in WAWebComposeBox.react):
//   o("WAWebSendTextMsgChatAction").sendTextMsgToChat(chat, body, options)
//   o("WAWebNewsletterSendMsgAction").sendNewsletterTextMsg(chat, body, options)
const CANDIDATES: Candidate[] = [
  { module: 'WAWebSendTextMsgChatAction', function: 'sendTextMsgToChat', bodyArgIndex: 1, chatArgIndex: 0 },
  { module: 'WAWebNewsletterSendMsgAction', function: 'sendNewsletterTextMsg', bodyArgIndex: 1, chatArgIndex: 0 },
  // Fallbacks if WhatsApp renames in the future:
  { module: 'WAWebSendTextMsgChatAction', function: 'addAndSendTextMsg', bodyArgIndex: 1, chatArgIndex: 0 },
];

export function installSendHook(): Array<{ module: string; function: string }> {
  const installed: Array<{ module: string; function: string }> = [];
  for (const c of CANDIDATES) {
    const mod = tryRequire(c.module);
    if (!mod || typeof mod[c.function] !== 'function') continue;
    const orig = mod[c.function].bind(mod);
    mod[c.function] = async (...args: any[]) => {
      try {
        const next = await maybeRewrite(args, c);
        return orig(...next);
      } catch (err) {
        console.warn(`[wa-translate] ${c.module}.${c.function} rewrite failed:`, err);
        return orig(...args);
      }
    };
    installed.push({ module: c.module, function: c.function });
    console.info(`[wa-translate] send hook installed on ${c.module}.${c.function}`);
  }
  if (installed.length === 0) {
    console.warn('[wa-translate] no candidate send module found; outbound translation disabled');
  }
  return installed;
}

async function maybeRewrite(args: any[], c: Candidate): Promise<any[]> {
  const config = getConfig();
  if (!config.enabled) return args;

  const chat = args[c.chatArgIndex];
  const chatId: string | null = chat?.id?._serialized ?? null;
  if (!chatId) return args;

  const targetLang = getChatLang(chatId);
  if (!targetLang) return args;

  const body = args[c.bodyArgIndex];
  if (typeof body !== 'string' || !body.trim()) return args;

  const result = await translate({
    text: body,
    source: config.nativeLang || 'auto',
    target: targetLang,
  });
  if (!result.translated) return args;
  if (result.translated.trim() === body.trim()) return args;

  let finalBody = result.translated;
  if (config.sendBoth) {
    const targetName = getLanguage(targetLang)?.code ?? targetLang;
    const sourceCode = result.source && result.source !== 'unknown' ? result.source : config.nativeLang;
    const sourceName = getLanguage(sourceCode)?.code ?? sourceCode;
    finalBody = `${targetName}: ${result.translated}\n-----\n${sourceName}: ${body}`;
  }

  const next = args.slice();
  next[c.bodyArgIndex] = finalBody;
  return next;
}
