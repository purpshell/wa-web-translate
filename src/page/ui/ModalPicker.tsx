import { useEffect, useMemo, useRef, useState } from 'react';
import { LANGUAGES } from '@/shared/languages';
import { getChatLang, setChatLang, subscribe } from '../store';
import { ATTACH_MENU_OPEN_EVENT } from '../hooks/attach-menu';

interface OpenDetail {
  chatId: string | null;
}

export function ModalPicker() {
  const [chatId, setChatId] = useState<string | null>(null);
  const [, force] = useState(0);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<OpenDetail>).detail;
      setChatId(detail?.chatId ?? null);
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 30);
    };
    window.addEventListener(ATTACH_MENU_OPEN_EVENT, onOpen as EventListener);
    return () => window.removeEventListener(ATTACH_MENU_OPEN_EVENT, onOpen as EventListener);
  }, []);

  useEffect(() => subscribe('chatLangs', () => force((n) => n + 1)), []);

  useEffect(() => {
    if (!chatId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setChatId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [chatId]);

  const current = chatId ? getChatLang(chatId) : null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return LANGUAGES;
    return LANGUAGES.filter(
      (l) =>
        l.code.toLowerCase().includes(q) ||
        l.name.toLowerCase().includes(q) ||
        l.native.toLowerCase().includes(q),
    );
  }, [query]);

  if (!chatId) return null;

  const onSelect = (code: string | null) => {
    setChatLang(chatId, code);
    setChatId(null);
  };

  return (
    <div className="wa-translate-modal-overlay" onClick={() => setChatId(null)}>
      <div className="wa-translate-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="wa-translate-modal-head">
          <strong>Translate this chat</strong>
          <span className="wa-translate-modal-sub">
            {current ? `Currently translating to ${current.toUpperCase()}` : 'No translation set'}
          </span>
        </div>
        <input
          ref={inputRef}
          className="wa-translate-modal-search"
          placeholder="Search language…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="wa-translate-modal-list">
          {filtered.map((l) => (
            <div
              key={l.code}
              className="wa-translate-modal-item"
              data-selected={current === l.code ? 'true' : 'false'}
              onClick={() => onSelect(l.code)}
            >
              <span>
                {l.native} <span style={{ opacity: 0.55 }}>· {l.name}</span>
              </span>
              <span style={{ opacity: 0.55, fontSize: 11 }}>{l.code}</span>
            </div>
          ))}
          {filtered.length === 0 ? (
            <div style={{ padding: '12px', opacity: 0.6, fontSize: 13 }}>No matches</div>
          ) : null}
        </div>
        {current ? (
          <div className="wa-translate-modal-clear" onClick={() => onSelect(null)}>
            Clear translation for this chat
          </div>
        ) : null}
      </div>
    </div>
  );
}
