/** Map lighting: sun position → phase → palette. Pure functions, no map runtime dependency. */

import type { LightSpecification, SkySpecification } from 'maplibre-gl';

export type LightingPhase = 'dawn' | 'day' | 'golden' | 'sunset' | 'night';
/** Mirrors `SettingsMap.map_lighting`. */
export type LightingMode = 'auto' | 'day' | 'golden' | 'night';
/** Degrees. Azimuth is clockwise from north (0–360). */
export interface SolarPosition {
  altitude: number;
  azimuth: number;
}

/** How often an 'auto' map should re-resolve its phase. */
export const LIGHTING_REFRESH_MS = 5 * 60 * 1000;

const RAD = Math.PI / 180;
const DAY_MS = 86_400_000;
const J1970 = 2440588;
const J2000 = 2451545;
const OBLIQUITY = RAD * 23.4397;

/** Low-precision solar ephemeris (SunCalc / Astronomical Algorithms): altitude, azimuth, hour angle in radians. */
function sunCoords(date: Date, lat: number, lng: number) {
  const d = date.getTime() / DAY_MS - 0.5 + J1970 - J2000;
  const M = RAD * (357.5291 + 0.98560028 * d);
  const C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const L = M + C + RAD * 102.9372 + Math.PI;
  const dec = Math.asin(Math.sin(OBLIQUITY) * Math.sin(L));
  const ra = Math.atan2(Math.sin(L) * Math.cos(OBLIQUITY), Math.cos(L));
  const φ = RAD * lat;
  const H = RAD * (280.16 + 360.9856235 * d) + RAD * lng - ra;
  const altitude = Math.asin(Math.sin(φ) * Math.sin(dec) + Math.cos(φ) * Math.cos(dec) * Math.cos(H));
  // Measured from south, positive westward.
  const azSouth = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(φ) - Math.tan(dec) * Math.cos(φ));
  return { altitude, azSouth, hourAngle: Math.atan2(Math.sin(H), Math.cos(H)) };
}

/** Sun altitude/azimuth in degrees for a moment and place (accurate to ~0.5°). */
export function solarPosition(date: Date, lat: number, lng: number): SolarPosition {
  const { altitude, azSouth } = sunCoords(date, lat, lng);
  return { altitude: altitude / RAD, azimuth: (azSouth / RAD + 540) % 360 };
}

/**
 * Phase from sun altitude. Morning (rising): < −6° night, < 8° dawn, else day.
 * Evening (setting): < −6° night, < 4° sunset, < 15° golden, else day.
 */
export function phaseForSun(sun: SolarPosition, rising: boolean): LightingPhase {
  const alt = sun.altitude;
  if (alt < -6) return 'night';
  if (rising) return alt < 8 ? 'dawn' : 'day';
  if (alt < 4) return 'sunset';
  return alt < 15 ? 'golden' : 'day';
}

/** Phase for a moment and place. Rising = negative hour angle (before local solar noon). */
export function phaseAt(date: Date, lat: number, lng: number): LightingPhase {
  const rising = sunCoords(date, lat, lng).hourAngle < 0;
  return phaseForSun(solarPosition(date, lat, lng), rising);
}

/** Fixed modes win; 'auto' follows the sun. */
export function resolvePhase(mode: LightingMode, date: Date, lat: number, lng: number): LightingPhase {
  return mode === 'auto' ? phaseAt(date, lat, lng) : mode;
}

export interface LightingLook {
  phase: LightingPhase;
  sky: SkySpecification;
  light: LightSpecification;
  /** fill-extrusion colour */
  buildingColor: string;
  /** background colour */
  landColor: string;
  waterColor: string;
  roadColor: string;
  labelColor: string;
  labelHalo: string;
  /** 'dark' at night so HUD plates can adapt. */
  hudTone: 'light' | 'dark';
}

interface Palette {
  sky: string;
  horizon: string;
  lightColor: string;
  intensity: number;
  building: string;
  land: string;
  water: string;
  road: string;
  /** Representative sun when none is supplied (fixed modes). */
  sun: SolarPosition;
}

const PALETTES: Record<LightingPhase, Palette> = {
  day: {
    sky: '#F4EEDF',
    horizon: '#FFF8E9',
    lightColor: '#FFF6E8',
    intensity: 0.45,
    building: '#F1E4CC',
    land: '#FBF6EC',
    water: '#CFDFE3',
    road: '#FFFFFF',
    sun: { altitude: 55, azimuth: 160 },
  },
  golden: {
    sky: '#F7E3B0',
    horizon: '#FFD98A',
    lightColor: '#FFD98A',
    intensity: 0.5,
    building: '#F6DDA8',
    land: '#FBEFD6',
    water: '#D6DCD2',
    road: '#FFF8EA',
    sun: { altitude: 12, azimuth: 280 },
  },
  sunset: {
    sky: '#E9B2A0',
    horizon: '#FC8D6E',
    lightColor: '#FCA283',
    intensity: 0.5,
    building: '#F2C3A8',
    land: '#F8E4D6',
    water: '#D9D3D6',
    road: '#FFF1EA',
    sun: { altitude: 2, azimuth: 290 },
  },
  dawn: {
    sky: '#DCE3EE',
    horizon: '#F3D9CF',
    lightColor: '#F8E6E0',
    intensity: 0.4,
    building: '#EEDFD6',
    land: '#F6F0EC',
    water: '#D3DDE6',
    road: '#FFFFFF',
    sun: { altitude: 3, azimuth: 75 },
  },
  night: {
    sky: '#1B1D33',
    horizon: '#2E3048',
    lightColor: '#AFB8D6',
    intensity: 0.25,
    building: '#4A4C66',
    land: '#2E3048',
    water: '#1E2238',
    road: '#50536E',
    sun: { altitude: -20, azimuth: 0 },
  },
};

const NIGHT_LIGHT_POSITION: [number, number, number] = [1.15, 210, 60];
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Full style look for a phase; `sun` (if given) aims the extrusion light at the real sun. */
export function lookFor(phase: LightingPhase, sun?: SolarPosition): LightingLook {
  const p = PALETTES[phase];
  const s = sun ?? p.sun;
  const night = phase === 'night';
  const position: [number, number, number] = night
    ? NIGHT_LIGHT_POSITION
    : [1.15, s.azimuth, clamp(90 - s.altitude, 20, 80)];
  return {
    phase,
    sky: {
      'sky-color': p.sky,
      'horizon-color': p.horizon,
      'fog-color': p.horizon,
      'fog-ground-blend': 0.5,
      'horizon-fog-blend': 0.8,
      'sky-horizon-blend': 0.6,
      // Atmosphere only on the globe (low zooms).
      'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0],
    },
    light: { anchor: 'map', position, color: p.lightColor, intensity: p.intensity },
    buildingColor: p.building,
    landColor: p.land,
    waterColor: p.water,
    roadColor: p.road,
    labelColor: night ? '#E9E6F2' : '#292935',
    labelHalo: night ? '#1E2238' : '#FFFFFF',
    hudTone: night ? 'dark' : 'light',
  };
}
