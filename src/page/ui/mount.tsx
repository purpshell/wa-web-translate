// Mount our React roots into WhatsApp's DOM. We use our own bundled React (the page-world
// script ships with React via the Vite build); we don't share WA's React because pulling
// the right module name reliably across versions is fragile and a separate root is fine.

import { createRoot, type Root } from 'react-dom/client';
import { StrictMode, useEffect, useState } from 'react';
import { LanguagePicker } from './LanguagePicker';
import { DraftPreview } from './DraftPreview';
import { ModalPicker } from './ModalPicker';
import { injectStyles } from './styles';

const PICKER_HOST_ID = 'wa-translate-picker-host';
const DRAFT_HOST_ID = 'wa-translate-draft-host';
const MODAL_HOST_ID = 'wa-translate-modal-host';

let pickerRoot: Root | null = null;
let pickerRootHost: HTMLElement | null = null;
let draftRoot: Root | null = null;
let draftRootHost: HTMLElement | null = null;
let modalRoot: Root | null = null;

function findComposer(): HTMLElement | null {
  // WhatsApp may use either <footer> or a div container; the composer itself is stable.
  const candidates = document.querySelectorAll<HTMLElement>(
    '[contenteditable="true"][role="textbox"]',
  );
  for (let i = candidates.length - 1; i >= 0; i--) {
    const el = candidates[i];
    if (el.closest('#main')) return el;
  }
  return candidates.length ? candidates[candidates.length - 1] : null;
}

function findFooter(): HTMLElement | null {
  const composer = findComposer();
  if (!composer) return null;
  return (composer.closest('footer') as HTMLElement | null) ?? composer.parentElement?.parentElement ?? null;
}

// Anchor on the mic/send button. Insert our picker as a sibling of that button so it
// sits on the action row but isn't nested inside the button itself.
function findSendActionAnchor(): { container: HTMLElement; before: HTMLElement } | null {
  const footer = findFooter();
  if (!footer) return null;
  const icon = footer.querySelector<HTMLElement>(
    '[data-icon="mic-outlined" i], [data-icon*="send" i], [data-icon="wds-ic-send" i]',
  );
  if (!icon) return null;
  const button = icon.closest<HTMLElement>('button, [role="button"]');
  if (!button) return null;
  // Walk up to the first ancestor that is NOT a single-child wrapper around `button`.
  // That gives us a stable container that's already laying out multiple action items.
  let target: HTMLElement = button;
  while (
    target.parentElement &&
    target.parentElement !== footer &&
    target.parentElement.children.length === 1
  ) {
    target = target.parentElement;
  }
  const container = target.parentElement;
  if (!container || container === footer) return null;
  return { container, before: target };
}

function ensurePickerHost(): HTMLDivElement | null {
  const anchor = findSendActionAnchor();
  if (!anchor) return null;
  let host = document.getElementById(PICKER_HOST_ID) as HTMLDivElement | null;
  if (host && host.parentElement === anchor.container) return host;
  host?.remove();
  host = document.createElement('div');
  host.id = PICKER_HOST_ID;
  host.style.display = 'inline-flex';
  host.style.alignItems = 'center';
  anchor.container.insertBefore(host, anchor.before);
  return host;
}

function ensureDraftHost(): HTMLDivElement | null {
  const footer = findFooter();
  if (!footer) return null;
  // The footer has `position: relative` enough of the time; force it just in case.
  if (getComputedStyle(footer).position === 'static') {
    footer.style.position = 'relative';
  }
  let host = document.getElementById(DRAFT_HOST_ID) as HTMLDivElement | null;
  if (host && host.parentElement === footer) return host;
  host?.remove();
  host = document.createElement('div');
  host.id = DRAFT_HOST_ID;
  footer.appendChild(host);
  return host;
}

function PickerWrapper() {
  // Bump signal whenever the active chat may have changed (DOM mutations).
  const [signal, setSignal] = useState(0);
  useEffect(() => {
    const obs = new MutationObserver(() => setSignal((n) => n + 1));
    const main = document.querySelector('#main');
    if (main) {
      obs.observe(main, { subtree: false, childList: true });
      const header = main.querySelector('header');
      if (header) obs.observe(header, { subtree: true, childList: true });
    }
    const interval = setInterval(() => setSignal((n) => n + 1), 1500);
    return () => {
      obs.disconnect();
      clearInterval(interval);
    };
  }, []);
  return <LanguagePicker chatIdSignal={signal} />;
}

function ensureModalHost(): HTMLDivElement {
  let host = document.getElementById(MODAL_HOST_ID) as HTMLDivElement | null;
  if (host) return host;
  host = document.createElement('div');
  host.id = MODAL_HOST_ID;
  document.body.appendChild(host);
  return host;
}

export function mountUI(): void {
  injectStyles();

  // Modal picker is global — mount once.
  if (!modalRoot) {
    modalRoot = createRoot(ensureModalHost());
    modalRoot.render(
      <StrictMode>
        <ModalPicker />
      </StrictMode>,
    );
  }

  let logged = false;
  const tick = () => {
    const anchor = findSendActionAnchor();
    const composer = findComposer();
    if (!logged && (anchor || composer)) {
      console.info('[wa-translate] DOM probe', {
        composer: !!composer,
        anchor: !!anchor,
      });
      logged = true;
    }

    const pickerHost = ensurePickerHost();
    if (pickerHost !== pickerRootHost) {
      // Host is missing or replaced — re-mount.
      if (pickerRoot) {
        try { pickerRoot.unmount(); } catch {}
        pickerRoot = null;
      }
      pickerRootHost = pickerHost;
      if (pickerHost) {
        pickerRoot = createRoot(pickerHost);
        pickerRoot.render(
          <StrictMode>
            <PickerWrapper />
          </StrictMode>,
        );
        console.info('[wa-translate] picker mounted');
      }
    }

    const draftHost = ensureDraftHost();
    if (draftHost !== draftRootHost) {
      if (draftRoot) {
        try { draftRoot.unmount(); } catch {}
        draftRoot = null;
      }
      draftRootHost = draftHost;
      if (draftHost) {
        draftRoot = createRoot(draftHost);
        draftRoot.render(
          <StrictMode>
            <DraftPreview />
          </StrictMode>,
        );
        console.info('[wa-translate] draft preview mounted');
      }
    }
  };

  tick();
  const mo = new MutationObserver(tick);
  mo.observe(document.body, { childList: true, subtree: true });
}
