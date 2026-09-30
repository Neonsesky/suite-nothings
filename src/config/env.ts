/** Build-time and runtime environment constants. Change a provider in one line here. */
const env = import.meta.env;

/** Optional default Apps Script URL. A URL pasted in Settings → Connection always wins. */
export const API_URL: string = (env.VITE_API_URL ?? '').trim();

/** Basemap style. OpenFreeMap "liberty" (free, no key). Swap = this one line. */
export const TILE_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

/** Photon geocoder (komoot). */
export const PHOTON_URL = 'https://photon.komoot.io';

/** Vite base path, always ending in "/". */
export const BASE_URL: string = env.BASE_URL;

/** Tests only: allow non-Google API URLs (local mock servers). */
export const ALLOW_LOCAL_API: boolean = env.VITE_ALLOW_LOCAL_API === 'true';

/** Demo mode is the default unless a default API URL was baked into the build. */
export const IS_DEMO_DEFAULT: boolean = API_URL === '';

/** App version shown in About; injected by Vite `define`. */
export const APP_VERSION: string = __APP_VERSION__;
/** YYYY-MM-DD the app was built (About). */
export const BUILD_DATE: string = __BUILD_DATE__;
