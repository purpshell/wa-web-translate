# WA Web Translate

A hilariously vibe-coded Chrome extension that adds **two-way AI translation** to WhatsApp Web. Pick a target language for any chat — outgoing messages are translated before they're sent, incoming messages are translated as they arrive. The original is shown alongside so the recipient can verify.

> If this saves you time talking to people across languages, please consider [sponsoring my work](https://purpshell.dev/sponsor) so I can keep maintaining it.

## What it does

- **Outgoing**: type in your native language → press send → recipient receives the translation. A live preview of the translation sits under the composer while you type, so you always know what's about to go out. Optional "send both" mode posts `<lang>: <translation> ----- <lang>: <original>` in a single message.
- **Incoming**: foreign-language messages get translated inline. Translation runs once, at protocol-decrypt time — not on every render — so scrolling, search, copy-paste, and edits all show the translated body consistently.
- **Per-chat target language**: open WhatsApp's "+" attach menu → pick **Translate** → choose a language. The selection persists per chat across reloads.
- **Configurable AI**: Anthropic Claude, OpenAI GPT, or Google Gemini. Bring your own API key.
- **Configurable style**: a global "personality" prompt lets you steer tone — e.g. *"Match the casual tone of the source. Use UK spelling. Keep emojis."*

All keys live in `chrome.storage.local`. Nothing is sent anywhere except the AI provider you've chosen.

## Install (developer mode)

1. Clone this repo.
2. `pnpm install && pnpm build` (Node 20+).
3. In Chrome, go to `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select the `dist/` folder.
4. Right-click the extension icon → **Options**. Pick your native language, your AI provider, paste an API key, edit the personality prompt to taste.
5. Open `https://web.whatsapp.com`, click the **+** attach button next to the composer, choose **Translate**, pick a language for that chat. Send a message.

## How it works

WhatsApp Web ships a Metro-style module bundle that exposes `window.require("ModuleName")` once `Debug.VERSION ≥ 2.3000`. The extension waits for that, then hooks WhatsApp's own internals at four levels:

| Layer | Module | What we do |
| --- | --- | --- |
| Anti-ban | `WAWebWamCodegenUtils.defineEvents` | Blank the `extentionIds`/`externalSources` fields of the `WebcFingerprint` WAM event so our presence isn't reported back to WhatsApp's telemetry. |
| Outbound | `WAWebSendTextMsgChatAction.sendTextMsgToChat` (+ `WAWebNewsletterSendMsgAction.sendNewsletterTextMsg`) | Intercept the text body, translate via the configured provider, replace the body before WhatsApp encodes the stanza. |
| Inbound | `WAWebMsgProcessingDecryptEnc.decryptEnc` | After decryption, decode the protobuf via `decodeProtobuf(WAWebProtobufsE2E.pb.MessageSpec, payload)`, translate `conversation` / `extendedTextMessage.text` / image-video-document captions, re-encode. |
| UI | `React.createElement` wrap on `WAWebAttachMenuPopup.react` | Insert a real `WAWebAttachMenuPopupItem.react` for **Translate** alongside Photos/Camera/Document — so it looks and behaves like a native menu entry. |

Mode-specific UI (the live draft preview) is rendered into the WhatsApp chat footer with a separate React root, mounted via a `MutationObserver` that watches the composer.

## Architecture

```
┌────────────────────────────────────┐
│ web.whatsapp.com (MAIN world)      │
│  ─ React.createElement wraps       │
│  ─ Module hooks via window.require │
│  ─ Live composer preview UI        │
└─────────────┬──────────────────────┘
        postMessage
┌─────────────┴──────────────────────┐
│ Content script (ISOLATED world)    │
│  ─ Bridges page ↔ service worker   │
│  ─ Proxies chrome.storage          │
└─────────────┬──────────────────────┘
        chrome.runtime.connect
┌─────────────┴──────────────────────┐
│ Service worker (MV3)               │
│  ─ Holds API keys                  │
│  ─ Direct fetch to provider APIs   │
│    (Anthropic / OpenAI / Google)   │
└────────────────────────────────────┘
```

Built with **Vite** + **@crxjs/vite-plugin** + **React 18** + **TypeScript**. The page-world entry is bundled separately and injected via a `<script src=chrome.runtime.getURL(...)>` tag from the isolated content script — that way Chrome gives the script a real base URL, so the bundle's relative dynamic imports resolve into `chrome-extension://` URLs that are reachable through `web_accessible_resources`.

## Privacy

- **No telemetry from this extension.** Nothing is logged to any server.
- **API keys are stored locally** in `chrome.storage.local` — they never leave your machine except to the AI provider you've configured.
- **Message text leaves your browser only when translated**, going directly to the provider's API endpoint you chose. WhatsApp itself doesn't see the AI provider in any way; it just sees a translated text body.
- **Anti-ban hook** zeroes out the WAM `extentionIds`/`externalSources` fields so WhatsApp's telemetry doesn't enumerate your installed extensions.

This is **unofficial** and not affiliated with WhatsApp / Meta. Use it at your own risk; modifying WhatsApp Web's internals can technically violate the ToS.

## Develop

```bash
pnpm install
pnpm dev      # Vite dev server with HMR
pnpm build    # production build into dist/
```

Project layout:

```
src/
  background/      service worker — translation API calls
  content/         isolated-world bridge
  page/
    index.ts       MAIN-world entry, orchestrates hooks
    bridge.ts      promise-based RPC over postMessage
    wa.ts          window.require helpers
    store.ts       page-side wrapper for chrome.storage
    hooks/
      wam-scrub.ts          anti-ban
      send.ts               outgoing send-hook
      incoming-decrypt.ts   inbound decrypt-hook
      composer.ts           live draft-preview observer
      attach-menu.ts        React.createElement wrap for "+" menu
    ui/
      LanguagePicker.tsx
      DraftPreview.tsx
      ModalPicker.tsx       triggered by attach-menu item
      mount.tsx             React-root lifecycle
  options/         options page (React)
  popup/           toolbar popup (React)
  shared/          types, language list, RPC shapes
```

## Sponsor

I build and maintain this in my spare time. If it makes your life easier, please consider sponsoring at **[purpshell.dev/sponsor](https://purpshell.dev/sponsor)**. Sponsorship lets me keep the extension working through WhatsApp Web's frequent module renames, add new providers, and answer issues.

## License

MIT.
