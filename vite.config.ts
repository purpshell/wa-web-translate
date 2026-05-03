import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config';
import path from 'node:path';

// We declare the page-world entry as a content_script with `world: "MAIN"` so that
// crxjs bundles it. But Chrome's MAIN-world content scripts don't reliably expose
// `chrome.runtime`, so we don't actually want Chrome to inject it that way. After
// build, we:
//   1. find the MAIN-world content_script's bundled path;
//   2. strip it from the manifest;
//   3. inject the path into the ISOLATED content script (replacing __PAGE_BUNDLE_URL__).
// At runtime the ISOLATED content script then injects a real <script src=...> tag so
// the page bundle loads with a proper base URL and its relative imports resolve.
function rewireMainWorldEntry(): Plugin {
  return {
    name: 'wa-translate:rewire-main-world-entry',
    apply: 'build',
    enforce: 'post',
    async writeBundle(options) {
      const { promises: fs } = await import('node:fs');
      const outDir = options.dir ?? path.resolve(__dirname, 'dist');
      const manifestPath = path.join(outDir, 'manifest.json');
      let manifest: any;
      try {
        manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
      } catch {
        return;
      }
      const scripts: any[] = manifest.content_scripts ?? [];
      const mainIdx = scripts.findIndex((s) => s.world === 'MAIN');
      if (mainIdx < 0) return;
      const main = scripts[mainIdx];
      const pageBundlePath: string | undefined = main.js?.[0];
      if (!pageBundlePath) return;

      // 1. Strip the MAIN-world entry from the manifest.
      scripts.splice(mainIdx, 1);
      manifest.content_scripts = scripts;
      await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

      // 2. Replace the placeholder in every content-script bundle output.
      const isolated = scripts[0];
      const isolatedLoader = isolated?.js?.[0];
      const filesToPatch = new Set<string>();
      if (isolatedLoader) filesToPatch.add(isolatedLoader);
      // The loader dynamically imports the actual content-script chunk, so patch any
      // chunk that contains the placeholder string.
      const assetsDir = path.join(outDir, 'assets');
      try {
        for (const f of await fs.readdir(assetsDir)) {
          if (f.endsWith('.js')) filesToPatch.add(`assets/${f}`);
        }
      } catch {}

      for (const rel of filesToPatch) {
        const full = path.join(outDir, rel);
        let code: string;
        try {
          code = await fs.readFile(full, 'utf8');
        } catch {
          continue;
        }
        if (!code.includes('__PAGE_BUNDLE_URL__')) continue;
        const next = code.replaceAll('__PAGE_BUNDLE_URL__', pageBundlePath);
        await fs.writeFile(full, next);
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), crx({ manifest }), rewireMainWorldEntry()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    cors: {
      origin: [/chrome-extension:\/\//],
    },
  },
  build: {
    sourcemap: true,
    target: 'esnext',
  },
});
