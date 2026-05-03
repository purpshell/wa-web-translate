import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { loadConfig, saveConfig } from '@/shared/storage';
import type { Config } from '@/shared/types';
import './styles.css';

function PopupApp() {
  const [config, setConfig] = useState<Config | null>(null);
  useEffect(() => {
    loadConfig().then(setConfig);
  }, []);

  if (!config) return <div className="popup-shell">Loading…</div>;

  const hasKey = !!config.apiKeys[config.provider];
  return (
    <div className="popup-shell">
      <div className="popup-row">
        <strong>WA Web Translate</strong>
        <span className={hasKey ? 'popup-pill ok' : 'popup-pill warn'}>
          {hasKey ? 'configured' : 'no API key'}
        </span>
      </div>
      <div className="popup-row">
        <span>Provider</span>
        <span>{config.provider}</span>
      </div>
      <div className="popup-row">
        <span>Native</span>
        <span>{config.nativeLang}</span>
      </div>
      <label className="popup-toggle">
        <input
          type="checkbox"
          checked={config.enabled}
          onChange={(e) => {
            const next = { ...config, enabled: e.target.checked };
            setConfig(next);
            saveConfig({ enabled: e.target.checked });
          }}
        />
        Enabled
      </label>
      <button
        type="button"
        className="popup-btn"
        onClick={() => chrome.runtime.openOptionsPage()}
      >
        Open settings
      </button>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PopupApp />
  </StrictMode>,
);
