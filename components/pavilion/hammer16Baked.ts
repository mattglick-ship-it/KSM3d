/**
 * Baked-in default coordinates for the 16′ hammer-beam pavilion.
 *
 * These values are the canonical source of truth for the 16′ width. The
 * configurator forces these at runtime when `config.width === 16`, so they
 * cannot be tweaked from the admin UI and any stale localStorage values
 * are ignored.
 *
 * Captured from the published pavilion-defaults snapshot.
 */

import type { PieceAdjust } from "./PieceAdjuster";

export type PlateXYZ = { x: number; y: number; z: number };

export const HAMMER16_BAKED_PIECE_ADJUSTS: Record<string, PieceAdjust> = {
  "ridge": {
    off: { x: 0, y: 0, z: 0 },
    ext: { xp: 0, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 },
  },
  "hammer.kingpost": {
    off: { x: -2, y: 27, z: -3.75 },
    ext: { xp: 0, xn: 0, yp: 0, yn: 0, zp: 1.5, zn: 0 },
    scl: { x: 1, y: 1, z: 0.79 },
  },
  "hammer.toptie": {
    off: { x: -1.5, y: 29.5, z: -2.75 },
    ext: { xp: 0, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 },
    scl: { x: 1.3, y: 1, z: 1 },
  },
  "hammer.tie.l": {
    off: { x: -2.5, y: 30, z: -2.75 },
    ext: { xp: 0, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 },
    scl: { x: 1.19, y: 1, z: 1 },
    hidden: false,
  },
  "hammer.tie.r": {
    off: { x: -5.5, y: 31.75, z: -2.75 },
    ext: { xp: 0, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 },
    scl: { x: 1.09, y: 1, z: 1 },
    hidden: false,
  },
  "hammer.prince.l": {
    off: { x: -0.25, y: 30.25, z: -2.75 },
    ext: { xp: 0, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 },
    scl: { x: 1.26, y: 1, z: 1 },
  },
  "hammer.prince.r": {
    off: { x: -5.5, y: 31, z: -2.75 },
    ext: { xp: 0, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 },
    scl: { x: 1.26, y: 1.03, z: 1 },
    hidden: false,
  },
  "hammer.kingbrace.l": {
    off: { x: -5.75, y: 5.5, z: -0.25 },
    ext: { xp: 0, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 },
    scl: { x: 0.8, y: 0.8, z: 1 },
    hidden: false,
  },
  "hammer.kingbrace.r": {
    off: { x: -2.25, y: 5.5, z: -0.25 },
    ext: { xp: 0, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 },
    scl: { x: 0.8, y: 0.8, z: 1 },
    hidden: false,
  },
  "hammer.strut.l": {
    off: { x: 0, y: 48, z: 0 },
    ext: { xp: 0, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 },
    hidden: true,
  },
  "hammer.strut.r": {
    off: { x: 0, y: 48, z: 0 },
    ext: { xp: 0, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 },
    hidden: true,
  },
  "hammer.rafter.l": {
    off: { x: 0, y: 0, z: 0 },
    ext: { xp: 0, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 },
  },
  "hammer.rafter.r": {
    off: { x: 0, y: 0, z: 0 },
    ext: { xp: 0, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 },
  },
};

export const HAMMER16_BAKED_PLATE_OFFSETS_IN: Record<
  "vL" | "vR" | "wL" | "wR" | "peak",
  PlateXYZ
> = {
  vL: { x: 0, y: 0, z: 0 },
  vR: { x: 0, y: 0, z: 0 },
  wL: { x: -4.5, y: -3, z: 0 },
  wR: { x: 4.5, y: -3, z: 0 },
  peak: { x: 0, y: 0, z: 0 },
};

/** Per-piece position offsets (inches) — all zero for 16′. */
export const HAMMER16_BAKED_PIECE_OFFSETS_IN: Record<string, PlateXYZ> = {
  "hammer.tie.l":     { x: 0, y: 0, z: 0 },
  "hammer.tie.r":     { x: 0, y: 0, z: 0 },
  "hammer.kingpost":  { x: 0, y: 0, z: 0 },
  "hammer.post":      { x: 0, y: 0, z: 0 },
  "hammer.strut.l":   { x: 0, y: 0, z: 0 },
  "hammer.strut.r":   { x: 0, y: 0, z: 0 },
  "hammer.corbel.l":  { x: 0, y: 0, z: 0 },
  "hammer.corbel.r":  { x: 0, y: 0, z: 0 },
  "hammer.drop.l":    { x: 0, y: 0, z: 0 },
  "hammer.drop.r":    { x: 0, y: 0, z: 0 },
  "hammer.prince.l":  { x: 0, y: 0, z: 0 },
  "hammer.prince.r":  { x: 0, y: 0, z: 0 },
};

/** Per-piece scales — all unity for 16′. */
export const HAMMER16_BAKED_PIECE_SCALES: Record<string, PlateXYZ> = {
  "hammer.tie.l":     { x: 1, y: 1, z: 1 },
  "hammer.tie.r":     { x: 1, y: 1, z: 1 },
  "hammer.toptie":    { x: 1, y: 1, z: 1 },
  "hammer.kingpost":  { x: 1, y: 1, z: 1 },
  "hammer.post":      { x: 1, y: 1, z: 1 },
  "hammer.strut.l":   { x: 1, y: 1, z: 1 },
  "hammer.strut.r":   { x: 1, y: 1, z: 1 },
  "hammer.corbel.l":  { x: 1, y: 1, z: 1 },
  "hammer.corbel.r":  { x: 1, y: 1, z: 1 },
  "hammer.drop.l":    { x: 1, y: 1, z: 1 },
  "hammer.drop.r":    { x: 1, y: 1, z: 1 },
  "hammer.prince.l":  { x: 1, y: 1, z: 1 },
  "hammer.prince.r":  { x: 1, y: 1, z: 1 },
};

/** Whole-truss scale for 16′ (matches baseHammerScale). */
export const HAMMER16_BAKED_SCALE: PlateXYZ = { x: 1.02, y: 1.02, z: 1 };

