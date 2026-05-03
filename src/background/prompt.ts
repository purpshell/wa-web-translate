import type { Config, TranslateRequest } from '@/shared/types';
import { getLanguage } from '@/shared/languages';

export interface BuiltPrompt {
  system: string;
  user: string;
  expectsSourcePrefix: boolean;
}

export function buildPrompt(req: TranslateRequest, config: Config): BuiltPrompt {
  const target = getLanguage(req.target);
  const targetName = target ? `${target.name} (${target.code})` : req.target;

  const source = req.source && req.source !== 'auto' ? getLanguage(req.source) : undefined;
  const sourceName = source ? `${source.name} (${source.code})` : 'auto-detected';
  const expectsSourcePrefix = !source;

  const personality = config.personality.trim();

  const system = [
    `You are translating WhatsApp chat messages into ${targetName}.`,
    `Source language: ${sourceName}.`,
    personality && `Style and tone guidance: ${personality}`,
    expectsSourcePrefix
      ? `First detect the source language, then on the FIRST line output exactly: \`SRC: <ISO 639-1 code>\` (e.g. \`SRC: es\`). On subsequent lines output ONLY the translation. No quotes, no explanation, no labels other than the first SRC line.`
      : `Output ONLY the translation. No quotes, no labels, no explanation.`,
    `Preserve emojis and formatting (line breaks, punctuation). Keep proper nouns and @-mentions verbatim.`,
    `If the input is already in ${targetName}, return it unchanged${expectsSourcePrefix ? ` and set SRC: ${target?.code ?? req.target}` : ''}.`,
  ]
    .filter(Boolean)
    .join('\n');

  const user = req.text;
  return { system, user, expectsSourcePrefix };
}

export function parseModelOutput(
  raw: string,
  expectsSourcePrefix: boolean,
  fallbackSource: string,
): { translated: string; source: string } {
  const trimmed = raw.replace(/^\s+|\s+$/g, '');
  if (!expectsSourcePrefix) {
    return { translated: trimmed, source: fallbackSource };
  }
  const m = trimmed.match(/^SRC:\s*([A-Za-z-]{2,7})\s*\n?([\s\S]*)$/);
  if (m) {
    return { translated: m[2].replace(/^\s+/, ''), source: m[1].toLowerCase() };
  }
  return { translated: trimmed, source: 'unknown' };
}
