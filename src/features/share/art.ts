/**
 * Rasterises the app's own SVG components (StayArt, the key-tag mark, mood stamps) for the
 * canvas: render to static markup, resolve the token variables, load through an <img>.
 * Lives in the lazy share-renderer chunk with react-dom/server.
 */
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StayArt } from '@/components/StayArt';
import { KeyTagMark } from '@/components/brand/KeyTagMark';
import { MoodStamp, MOODS as STAMP_MOODS, isMoodId, type MoodId } from '@/components/brand/MoodStamps';
import type { Mood } from '@/data/types';
import { resolveCssVars } from './layout';

const TOKEN_NAMES = [
  'color-ink',
  'color-paper',
  'color-cream',
  'color-honey',
  'color-honey-soft',
  'color-honey-deep',
  'color-ginger',
  'color-ginger-soft',
  'color-ginger-ink',
  'color-muted',
  'color-subtle',
  'color-line',
  'color-focus',
  'font-sans',
] as const;

/** Fallbacks match src/styles/tokens.css, used when the stylesheet isn't there (tests). */
const FALLBACK: Record<(typeof TOKEN_NAMES)[number], string> = {
  'color-ink': '#292935',
  'color-paper': '#ffffff',
  'color-cream': '#fff8e9',
  'color-honey': '#ffc536',
  'color-honey-soft': '#ffeab0',
  'color-honey-deep': '#ffaf36',
  'color-ginger': '#fc5e57',
  'color-ginger-soft': '#ffe1dc',
  'color-ginger-ink': '#b3302a',
  'color-muted': '#54545d',
  'color-subtle': '#6b7280',
  'color-line': '#e5e7eb',
  'color-focus': '#2299dd',
  'font-sans': 'Manrope, sans-serif',
};

export type Tokens = Record<(typeof TOKEN_NAMES)[number], string>;

export function readTokens(): Tokens {
  const cs = getComputedStyle(document.documentElement);
  const out = { ...FALLBACK };
  for (const name of TOKEN_NAMES) {
    const v = cs.getPropertyValue(`--${name}`).trim();
    if (v) out[name] = v;
  }
  return out;
}

function svgImage(el: ReactElement, width: number, height: number, tokens: Tokens, transform?: (markup: string) => string): Promise<HTMLImageElement> {
  let markup = renderToStaticMarkup(el);
  markup = resolveCssVars(markup, tokens);
  if (transform) markup = transform(markup);
  // An <img> needs the namespace and an intrinsic size.
  markup = markup.replace(/^<svg\b([^>]*)>/, (_, attrs: string) => {
    const rest = attrs.replace(/\s(width|height|class)="[^"]*"/g, '');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(width)}" height="${Math.round(height)}"${rest}>`;
  });
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('svg rasterise failed'));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  });
}

export function stayArtImage(seed: string, width: number, height: number, tokens: Tokens): Promise<HTMLImageElement> {
  return svgImage(createElement(StayArt, { seed }), width, height, tokens);
}

export function keyTagImage(size: number, tokens: Tokens): Promise<HTMLImageElement> {
  return svgImage(createElement(KeyTagMark, { size }), size, size, tokens);
}

/** Moods without their own stamp borrow the nearest glyph; the label is drawn on the canvas. */
const STAMP_FOR: Partial<Record<Mood, MoodId>> = { giddy: 'giggly', sleepy: 'lazy' };

export function stampFor(mood: Mood): { id: MoodId; tilt: number } {
  const id = isMoodId(mood) ? mood : (STAMP_FOR[mood] ?? 'blissful');
  return { id, tilt: STAMP_MOODS.find((m) => m.id === id)?.tilt ?? 0 };
}

/** The stamp without its label (an <img> can't use the page's web fonts) and laid flat. */
export function moodStampImage(mood: Mood, size: number, tokens: Tokens): Promise<HTMLImageElement> {
  const { id } = stampFor(mood);
  return svgImage(createElement(MoodStamp, { mood: id, size, title: '', selected: true, tilted: false }), size, size, tokens, (m) =>
    m.replace(/<text\b[\s\S]*?<\/text>/g, ''),
  );
}
