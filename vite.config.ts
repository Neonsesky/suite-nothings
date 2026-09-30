import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { privateLetter } from './build/private-letter.ts';
import { COUPLE } from './src/config/couple.ts';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

function normaliseBase(raw: string | undefined): string {
  const b = (raw ?? '').trim();
  if (!b || b === '/') return '/';
  return `/${b.replace(/^\/+|\/+$/g, '')}/`;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // VITE_BASE wins; in CI fall back to /<repo-name>/; locally "/".
  const repo = process.env.GITHUB_REPOSITORY?.split('/')[1];
  const base = normaliseBase(env.VITE_BASE || (process.env.CI && repo ? repo : '/'));

  return {
    base,
    define: { __APP_VERSION__: JSON.stringify(pkg.version), __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)) },
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    server: { watch: { ignored: ['**/design/**', '**/private/**', '**/.tmp/**'] } },
    build: {
      target: 'es2022',
      sourcemap: false,
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          // Heavy libraries get their own chunks; they are only ever imported lazily.
          manualChunks(id: string) {
            if (id.includes('node_modules/maplibre-gl')) return 'maplibre';
            if (id.includes('node_modules/three')) return 'three';
            if (id.includes('node_modules/gsap')) return 'gsap';
            // exifr: no manual chunk. Its own dynamic import() already splits it, and a manual chunk
            // would capture Vite's preload helper and get modulepreloaded on the initial path.
            if (id.includes('node_modules/qrcode')) return 'qrcode';
            return undefined;
          },
        },
      },
    },
    plugins: [
      react(),
      privateLetter(),
      // PWA section — owned by w1-shell after merge.
      VitePWA({
        strategies: 'generateSW',
        registerType: 'prompt',
        injectRegister: false,
        includeAssets: ['favicon.svg'],
        manifest: {
          id: base,
          name: COUPLE.appName,
          short_name: COUPLE.shortName,
          description: COUPLE.tagline,
          lang: 'en',
          start_url: base,
          scope: base,
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#FFF8E9',
          theme_color: '#FFFFFF',
          categories: ['lifestyle', 'travel'],
          icons: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: 'icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
            { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
            { src: 'icons/icon-monochrome-512.png', sizes: '512x512', type: 'image/png', purpose: 'monochrome' },
          ],
          shortcuts: [
            { name: 'Add a stay', url: `${base}#/add`, icons: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }] },
            { name: 'Map', url: `${base}#/map`, icons: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }] },
          ],
        },
        workbox: {
          // Splash images are excluded below: iOS fetches `apple-touch-startup-image` itself,
          // and at ~12 large PNGs they're not worth the install-time precache weight.
          globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest,json,pbf,geojson}'],
          globIgnores: ['**/icons/splash-*.png'],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          navigateFallback: `${base}index.html`,
          // Only extensionless (hash-routed) paths fall back to the shell; a request for a
          // real asset that 404s should 404, not silently return index.html.
          navigateFallbackDenylist: [/\/[^/?]+\.[^/]+$/],
          cleanupOutdatedCaches: true,
          runtimeCaching: [
            {
              // Covers tiles, glyphs, sprites and the style JSON: all served from this host.
              urlPattern: ({ url }) => url.hostname === 'tiles.openfreemap.org',
              handler: 'CacheFirst',
              options: {
                cacheName: 'sn-tiles',
                expiration: { maxEntries: 4000, maxAgeSeconds: 60 * 60 * 24 * 60 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              urlPattern: ({ url }) => url.hostname === 'photon.komoot.io',
              handler: 'NetworkFirst',
              options: {
                cacheName: 'sn-geocode',
                networkTimeoutSeconds: 6,
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              // Apps Script API responses must never be served from the SW cache; IndexedDB
              // (via the outbox/store) is the offline source of truth for that data.
              urlPattern: ({ url }) => url.hostname === 'script.google.com' || url.hostname.endsWith('.googleusercontent.com'),
              handler: 'NetworkOnly',
            },
          ],
        },
        devOptions: { enabled: false },
      }),
    ],
  };
});
