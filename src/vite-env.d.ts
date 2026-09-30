/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare const __APP_VERSION__: string;
/** YYYY-MM-DD of the production build. */
declare const __BUILD_DATE__: string;

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_BASE?: string;
  readonly VITE_ALLOW_LOCAL_API?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module 'virtual:private-letter' {
  /** Exact contents of private/letter.md at build time, or null (CI / file absent). */
  export const body: string | null;
  const letter: { body: string | null };
  export default letter;
}

declare module '*.module.css' {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}
