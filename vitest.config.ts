import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { privateLetter } from './build/private-letter';

export default defineConfig({
  plugins: [react(), privateLetter()],
  define: { __APP_VERSION__: JSON.stringify('test') },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'happy-dom',
    setupFiles: ['tests/setup.ts'],
    include: ['tests/unit/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
    exclude: ['design/**', 'private/**', 'dist/**', 'dev-dist/**', '.tmp/**', 'apps-script/**', 'node_modules/**', 'tests/e2e/**'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
});
