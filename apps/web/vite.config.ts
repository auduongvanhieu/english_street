import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

import { readdirSync, readFileSync } from 'node:fs';

const DESCRIPTION = 'Practise real-life English on a 3D street with AI shopkeepers and other learners.';
const MANIFEST = {
  name: 'English Street',
  short_name: 'English Street',
  description: DESCRIPTION,
  theme_color: '#7dd3fc',
  background_color: '#bae6fd',
  display: 'standalone' as const,
  orientation: 'any' as const,
  start_url: '/',
  icons: [
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};

/** manifest-<lang>.webmanifest for every interface catalog (i18n/index.ts switches the <link rel=manifest>). */
function localizedManifests() {
  const dir = new URL('./src/i18n/locales/', import.meta.url);
  return {
    name: 'localized-manifests',
    apply: 'build' as const,
    generateBundle(this: { emitFile: (f: { type: 'asset'; fileName: string; source: string }) => void }) {
      for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
        const cat = JSON.parse(readFileSync(new URL(f, dir), 'utf8')) as Record<string, string>;
        const lang = f.replace(/\.json$/, '');
        this.emitFile({ type: 'asset', fileName: `manifest-${lang}.webmanifest`, source: JSON.stringify({ ...MANIFEST, id: '/', lang, description: cat[DESCRIPTION] || DESCRIPTION }) });
      }
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    localizedManifests(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'],
      manifest: { ...MANIFEST, id: '/' },
      workbox: {
        // App shell is precached; 3D models are cached on first use so revisits start instantly.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // Interface catalogs: each player only needs their own language, fetched (and then cached) on demand.
        globIgnores: ['**/locales/**'],
        navigateFallbackDenylist: [/^\/api\//, /^\/ws\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/assets/locales/'),
            handler: 'CacheFirst',
            options: { cacheName: 'es-locales', expiration: { maxEntries: 40, maxAgeSeconds: 30 * 24 * 3600 } },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/models/'),
            handler: 'CacheFirst',
            options: { cacheName: 'es-models', expiration: { maxEntries: 60, maxAgeSeconds: 30 * 24 * 3600 } },
          },
        ],
      },
    }),
  ],
  server: { port: 5173 },
  build: {
    rollupOptions: {
      output: {
        // src/i18n/locales/<code>.json → assets/locales/<code>-<hash>.js (kept out of the PWA precache)
        chunkFileNames: (c) => (c.facadeModuleId?.includes('/i18n/locales/') ? 'assets/locales/[name]-[hash].js' : 'assets/[name]-[hash].js'),
      },
    },
  },
});
