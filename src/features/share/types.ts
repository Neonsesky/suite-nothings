/** Share card data (SPEC §12). Stable API: the journey screen renders `'route'` cards too. */
import type { HomeBase, Stay } from '@/data/types';

export type ShareCardKind = 'stay' | 'stats' | 'route';

export interface StayCardData {
  stay: Stay;
  /** Live stays in total ("Stay {i} of {n}"). */
  total: number;
  /** Full-size photo; StayArt is drawn when absent. */
  photo?: Blob | null;
}

export interface StatsCardData {
  stays: Stay[];
  home?: HomeBase;
}

export interface RouteCardData {
  stays: Stay[];
  home?: HomeBase;
  /** Headline; defaults to "Our journey so far". */
  title?: string;
}

export interface ShareCardDataMap {
  stay: StayCardData;
  stats: StatsCardData;
  route: RouteCardData;
}

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'unavailable';

/** Card size in px (portrait story format). */
export const CARD_W = 1080;
export const CARD_H = 1920;
