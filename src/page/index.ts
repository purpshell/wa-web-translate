// Main-world entry point. Loaded into web.whatsapp.com as a module via the content script.
// Order matters: the WAM scrub must be installed before WhatsApp builds its event registry.

import { waitTillReady, waitForModules } from './wa';
import { installWamScrub } from './hooks/wam-scrub';
import { installSendHook } from './hooks/send';
import { installComposerObserver } from './hooks/composer';
import { installDecryptHook } from './hooks/incoming-decrypt';
import { installAttachMenuItem } from './hooks/attach-menu';
import { mountUI } from './ui/mount';
import { requestSnapshot } from './store';

// Modules our hooks depend on. Most of these are lazy-loaded by WhatsApp after the user
// authenticates and opens a chat for the first time, so we wait for them before binding
// the hooks (otherwise window.require returns undefined and the hooks no-op).
const REQUIRED_MODULES = [
  'react',
  'WAWebChatCollection',
  'WAWebSendTextMsgChatAction',
  'WAWebMsgProcessingDecryptEnc',
  'WAWebAttachMenuPopup.react',
  'WAWebAttachMenuPopupItem.react',
  'WDSMenu.react',
  'WDSIconIcLanguage.react',
  'WAWebWamCodegenUtils',
];

console.info('[wa-translate] page-world script booted');

(async () => {
  // The DOM-based observers and the modal/picker UI don't need WA's modules — mount them
  // immediately so the user sees responsive UI as soon as WhatsApp's chat list renders.
  requestSnapshot();
  mountUI();
  installComposerObserver();

  // Try the scrub as early as possible; retry until WhatsApp's WAM module is loaded.
  let scrubbed = installWamScrub();

  await waitTillReady();
  console.info('[wa-translate] WhatsApp bundle ready');

  // Wait for the lazy-loaded chat/composer modules before installing module-level hooks.
  const missing = await waitForModules(REQUIRED_MODULES);
  if (missing.length) {
    console.warn('[wa-translate] some modules never loaded after 60s:', missing);
  } else {
    console.info('[wa-translate] all required modules loaded');
  }

  if (!scrubbed) scrubbed = installWamScrub();
  if (!scrubbed) console.warn('[wa-translate] wam scrub could not install (module not found)');

  installSendHook();
  installAttachMenuItem();
  installDecryptHook();
  console.info('[wa-translate] ready');
})();
