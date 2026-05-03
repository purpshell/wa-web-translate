import type { LanguageCode } from './languages';

export type Provider = 'anthropic' | 'openai' | 'google';

export interface Config {
  nativeLang: LanguageCode;
  provider: Provider;
  apiKeys: Partial<Record<Provider, string>>;
  model: Partial<Record<Provider, string>>;
  personality: string;
  sendBoth: boolean;
  enabled: boolean;
}

export const DEFAULT_CONFIG: Config = {
  nativeLang: 'en',
  provider: 'anthropic',
  apiKeys: {},
  model: {
    anthropic: 'claude-sonnet-4-6',
    openai: 'gpt-4o-mini',
    google: 'gemini-2.0-flash',
  },
  personality: 'Translate naturally and idiomatically. Match the tone of the original message (casual chat stays casual, formal stays formal). Preserve emojis. Do not add explanations.',
  sendBoth: false,
  enabled: true,
};

export interface ChatLangMap {
  [chatId: string]: LanguageCode;
}

export interface TranslateRequest {
  text: string;
  source?: LanguageCode | 'auto';
  target: LanguageCode;
}

export interface TranslateResult {
  translated: string;
  source: LanguageCode | 'unknown';
  target: LanguageCode;
}
