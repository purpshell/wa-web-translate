import type { Config, Provider } from '@/shared/types';

export class MissingApiKeyError extends Error {
  constructor(public provider: Provider) {
    super(`Missing API key for ${provider}. Configure it in the extension options.`);
  }
}

export class ProviderError extends Error {
  constructor(public provider: Provider, public status: number, public body: string) {
    super(`${provider} API error ${status}: ${body.slice(0, 200)}`);
  }
}

export interface CallArgs {
  system: string;
  user: string;
}

export async function callModel(config: Config, args: CallArgs): Promise<string> {
  const provider = config.provider;
  const apiKey = config.apiKeys[provider];
  if (!apiKey) throw new MissingApiKeyError(provider);
  const model = config.model[provider] ?? defaultModel(provider);

  switch (provider) {
    case 'anthropic':
      return callAnthropic(apiKey, model, args);
    case 'openai':
      return callOpenAI(apiKey, model, args);
    case 'google':
      return callGoogle(apiKey, model, args);
  }
}

function defaultModel(provider: Provider): string {
  switch (provider) {
    case 'anthropic':
      return 'claude-sonnet-4-6';
    case 'openai':
      return 'gpt-4o-mini';
    case 'google':
      return 'gemini-2.0-flash';
  }
}

async function callAnthropic(apiKey: string, model: string, args: CallArgs): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: args.system,
      messages: [{ role: 'user', content: args.user }],
    }),
  });
  if (!res.ok) throw new ProviderError('anthropic', res.status, await safeText(res));
  const data: any = await res.json();
  const text = data?.content?.find?.((c: any) => c.type === 'text')?.text ?? '';
  return String(text);
}

async function callOpenAI(apiKey: string, model: string, args: CallArgs): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: args.system },
        { role: 'user', content: args.user },
      ],
      temperature: 0.2,
    }),
  });
  if (!res.ok) throw new ProviderError('openai', res.status, await safeText(res));
  const data: any = await res.json();
  return String(data?.choices?.[0]?.message?.content ?? '');
}

async function callGoogle(apiKey: string, model: string, args: CallArgs): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: args.system }] },
      contents: [{ role: 'user', parts: [{ text: args.user }] }],
      generationConfig: { temperature: 0.2 },
    }),
  });
  if (!res.ok) throw new ProviderError('google', res.status, await safeText(res));
  const data: any = await res.json();
  return String(data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '');
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '';
  }
}
