import { useEffect, useMemo, useState } from 'react';
import { LANGUAGES } from '@/shared/languages';
import { DEFAULT_CONFIG, type Config, type Provider } from '@/shared/types';
import { loadConfig, saveConfig } from '@/shared/storage';

const PROVIDERS: { id: Provider; label: string; keyHint: string }[] = [
  { id: 'anthropic', label: 'Anthropic (Claude)', keyHint: 'sk-ant-...' },
  { id: 'openai', label: 'OpenAI (GPT)', keyHint: 'sk-...' },
  { id: 'google', label: 'Google (Gemini)', keyHint: 'AIza...' },
];

export function OptionsApp() {
  const [config, setConfig] = useState<Config | null>(null);
  const [status, setStatus] = useState<{ tone: 'ok' | 'err' | ''; text: string }>({ tone: '', text: '' });

  useEffect(() => {
    loadConfig().then(setConfig);
  }, []);

  const setAndSave = useMemo(
    () => (patch: Partial<Config>) => {
      setConfig((prev) => (prev ? { ...prev, ...patch } : prev));
      saveConfig(patch).then(() => {
        setStatus({ tone: 'ok', text: 'Saved' });
        setTimeout(() => setStatus({ tone: '', text: '' }), 1200);
      });
    },
    [],
  );

  if (!config) {
    return <div className="opts-shell">Loading…</div>;
  }

  const setApiKey = (provider: Provider, key: string) => {
    setAndSave({ apiKeys: { ...config.apiKeys, [provider]: key } });
  };

  const setModel = (provider: Provider, model: string) => {
    setAndSave({ model: { ...config.model, [provider]: model } });
  };

  return (
    <div className="opts-shell">
      <h1>WA Web Translate</h1>
      <p className="opts-sub">AI translation for WhatsApp Web. Settings save automatically.</p>

      <section className="opts-section">
        <h2>Native language</h2>
        <div className="opts-row">
          <label htmlFor="native-lang">Your native (source) language</label>
          <select
            id="native-lang"
            value={config.nativeLang}
            onChange={(e) => setAndSave({ nativeLang: e.target.value })}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.native} ({l.name})
              </option>
            ))}
          </select>
          <div className="opts-help">
            Used as the source for outbound translation. Inbound messages always auto-detect.
          </div>
        </div>
      </section>

      <section className="opts-section">
        <h2>AI provider</h2>
        <div className="opts-providers">
          {PROVIDERS.map((p) => (
            <div
              key={p.id}
              className="opts-provider"
              data-active={config.provider === p.id ? 'true' : 'false'}
              onClick={() => setAndSave({ provider: p.id })}
            >
              {p.label}
            </div>
          ))}
        </div>
        {PROVIDERS.map((p) => (
          <div key={p.id} style={{ display: config.provider === p.id ? 'block' : 'none' }}>
            <div className="opts-row">
              <label htmlFor={`apikey-${p.id}`}>{p.label} API key</label>
              <input
                id={`apikey-${p.id}`}
                type="password"
                placeholder={p.keyHint}
                value={config.apiKeys[p.id] ?? ''}
                onChange={(e) => setApiKey(p.id, e.target.value)}
              />
              <div className="opts-help">
                Stored locally in <code>chrome.storage.local</code>. Never synced.
              </div>
            </div>
            <div className="opts-row">
              <label htmlFor={`model-${p.id}`}>Model</label>
              <input
                id={`model-${p.id}`}
                type="text"
                value={config.model[p.id] ?? DEFAULT_CONFIG.model[p.id] ?? ''}
                onChange={(e) => setModel(p.id, e.target.value)}
              />
            </div>
          </div>
        ))}
      </section>

      <section className="opts-section">
        <h2>Style &amp; personality</h2>
        <div className="opts-row">
          <label htmlFor="personality">Translation style guidance</label>
          <textarea
            id="personality"
            value={config.personality}
            onChange={(e) => setAndSave({ personality: e.target.value })}
          />
          <div className="opts-help">
            Applied as a system prompt. E.g. "Match the casual tone of the source. Use UK spelling."
          </div>
        </div>
      </section>

      <section className="opts-section">
        <h2>Send mode</h2>
        <div className="opts-toggle">
          <input
            id="send-both"
            type="checkbox"
            checked={config.sendBoth}
            onChange={(e) => setAndSave({ sendBoth: e.target.checked })}
          />
          <label htmlFor="send-both">
            Include the original below the translation when sending
          </label>
        </div>
        <div className="opts-help">
          Format: <code>{'<lang>: <translation>\\n-----\\n<lang>: <original>'}</code>
        </div>
      </section>

      <section className="opts-section">
        <h2>Enable</h2>
        <div className="opts-toggle">
          <input
            id="enabled"
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => setAndSave({ enabled: e.target.checked })}
          />
          <label htmlFor="enabled">Enable translation hooks</label>
        </div>
        <div className="opts-help">
          Reload web.whatsapp.com after toggling.
        </div>
      </section>

      <div className="opts-status" data-tone={status.tone}>
        {status.text}
      </div>
    </div>
  );
}
