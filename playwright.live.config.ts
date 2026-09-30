import { defineConfig, devices } from '@playwright/test';

/**
 * Live-sync e2e (w1-backend): a production build with `VITE_ALLOW_LOCAL_API=1` on $PREVIEW_PORT,
 * talking to the mock Apps Script (tools/mock-apps-script.mjs, the real Code.gs in a Node harness)
 * on $AUX_PORT. Run with `npm run e2e:live`. Serial: every test shares one mock Sheet.
 */
const port = Number(process.env.PREVIEW_PORT ?? 4173);
const mockPort = Number(process.env.AUX_PORT ?? 8787);
const outDir = '.tmp/dist-live';

export default defineConfig({
  testDir: 'tests/e2e-live',
  outputDir: 'test-results/live',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${port}/`,
    trace: 'retain-on-failure',
    serviceWorkers: 'block',
  },
  projects: [{ name: 'pixel-412', use: { ...devices['Pixel 7'], viewport: { width: 412, height: 915 } } }],
  webServer: [
    {
      command: `node tools/mock-apps-script.mjs --port ${mockPort} --key our-secret-suite`,
      url: `http://127.0.0.1:${mockPort}/__admin/stats`,
      reuseExistingServer: false,
      timeout: 30_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      command: `VITE_ALLOW_LOCAL_API=1 SN_NO_PRIVATE_LETTER=1 npx vite build --outDir ${outDir} --emptyOutDir && npx vite preview --outDir ${outDir} --port ${port} --strictPort`,
      url: `http://localhost:${port}/`,
      reuseExistingServer: false,
      timeout: 240_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
  ],
});
