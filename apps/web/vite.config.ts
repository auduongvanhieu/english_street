import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'English Street',
        short_name: 'English Street',
        description: 'Practise real-life English on a 3D street with AI shopkeepers and other learners.',
        theme_color: '#7dd3fc',
        background_color: '#bae6fd',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
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
