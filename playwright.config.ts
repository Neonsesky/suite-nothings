import { existsSync } from 'node:fs';
import { defineConfig, devices, webkit } from '@playwright/test';

/**
 * `npm run e2e`     → builds and serves a production preview on $PREVIEW_PORT.
 * `npm run e2e:dev` → runs against the dev server on $PORT.
 * reuseExistingServer is off so parallel agents never share a server.
 */
const target = process.env.E2E_TARGET === 'dev' ? 'dev' : 'preview';
const port = Number(target === 'dev' ? process.env.PORT ?? 5173 : process.env.PREVIEW_PORT ?? 4173);
const baseURL = `http://localhost:${port}/`;

function webkitInstalled(): boolean {
  try {
    return existsSync(webkit.executablePath());
  } catch {
    return false;
  }
}
const hasWebkit = webkitInstalled();

const iphone = hasWebkit
  ? { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } }
  : {
      ...devices['Pixel 5'],
      viewport: { width: 390, height: 844 },
      userAgent: devices['iPhone 13'].userAgent,
    };

export default defineConfig({
  testDir: 'tests/e2e',
  testIgnore: ['**/design/**', '**/private/**', '**/dist/**', '**/.tmp/**', '**/apps-script/**'],
  outputDir: 'test-results',
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  workers: 3,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL,
    screenshot: 'on',
    trace: 'retain-on-failure',
    serviceWorkers: 'block',
  },
  projects: [
    { name: 'iphone-390', use: { ...iphone } },
    { name: 'pixel-412', use: { ...devices['Pixel 7'], viewport: { width: 412, height: 915 } } },
    { name: 'desktop-1440', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command:
      target === 'dev'
        ? `npm run dev -- --port ${port} --strictPort`
        : `npm run build && npm run preview -- --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 240_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
