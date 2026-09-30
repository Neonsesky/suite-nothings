import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { privateLetter } from './build/private-letter';
import { COUPLE } from './src/config/couple';

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
    define: { __APP_VERSION__: JSON.stringify(pkg.version) },
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
            if (id.includes('node_modules/exifr')) return 'exifr';
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
        includeAssets: ['favicon.svg', 'icons/*.png'],
        manifest: {
          name: COUPLE.appName,
          short_name: COUPLE.shortName,
          description: COUPLE.tagline,
          lang: 'en',
          start_url: base,
          scope: base,
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#FFFFFF',
          theme_color: '#FFFFFF',
          icons: [
            { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest,json,pbf}'],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          navigateFallback: `${base}index.html`,
          cleanupOutdatedCaches: true,
          runtimeCaching: [
            {
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
          ],
        },
        devOptions: { enabled: false },
      }),
    ],
  };
});
