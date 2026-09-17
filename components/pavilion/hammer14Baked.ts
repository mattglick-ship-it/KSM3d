/**
 * Baked-in coordinates for the 14′ hammer-beam pavilion.
 *
 * Canonical source of truth for the 14′ width. The Configurator forces these
 * at runtime when `config.width === 14`, so they cannot be tweaked from the
 * admin UI and any stale localStorage values are ignored.
 *
 * Captured from the published pavilion-defaults snapshot.
 */

import type { PieceAdjust } from "./PieceAdjuster";

export type PlateXYZ = { x: number; y: number; z: number };

export const HAMMER14_BAKED_PIECE_OFFSETS_IN: Record<string, PlateXYZ> = {
  "hammer.tie.l":     { x: 0,     y: 0.5,  z: 0 },
  "hammer.tie.r":     { x: 0,     y: 0.5,  z: 0 },
  "hammer.kingpost":  { x: 0,     y: -3,   z: 0 },
  "hammer.post":      { x: 0,     y: 0,    z: 0 },
  "hammer.strut.l":   { x: -0.25, y: -3,   z: 0 },
  "hammer.strut.r":   { x: 0.25,  y: -3,   z: 0 },
  "hammer.corbel.l":  { x: 3.75,  y: 1.75, z: -0.25 },
  "hammer.corbel.r":  { x: 3.75,  y: 1.75, z: -0.25 },
  "hammer.drop.l":    { x: 0,     y: 0,    z: 0 },
  "hammer.drop.r":    { x: 0,     y: 0,    z: 0 },
  "hammer.prince.l":  { x: 0,     y: 0,    z: 0 },
  "hammer.prince.r":  { x: 0,     y: 0,    z: 0 },
};

export const HAMMER14_BAKED_PIECE_SCALES: Record<string, PlateXYZ> = {
  "hammer.tie.l":     { x: 1,    y: 1,    z: 1 },
  "hammer.tie.r":     { x: 1,    y: 1,    z: 1 },
  "hammer.kingpost":  { x: 1.18, y: 1,    z: 1 },
  "hammer.post":      { x: 1,    y: 1,    z: 1 },
  "hammer.strut.l":   { x: 1.03, y: 1,    z: 0.99 },
  "hammer.strut.r":   { x: 1.03, y: 1,    z: 0.99 },
  "hammer.corbel.l":  { x: 0.57, y: 0.7,  z: 1 },
  "hammer.corbel.r":  { x: 0.57, y: 0.7,  z: 1 },
  "hammer.drop.l":    { x: 1,    y: 1,    z: 1 },
  "hammer.drop.r":    { x: 1,    y: 1,    z: 1 },
  "hammer.prince.l":  { x: 1,    y: 1,    z: 1 },
  "hammer.prince.r":  { x: 1,    y: 1,    z: 1 },
};

export const HAMMER14_BAKED_SCALE: PlateXYZ = { x: 1.08, y: 1.08, z: 1.08 };

export const HAMMER14_BAKED_PLATE_OFFSETS_IN: Record<
  "vL" | "vR" | "wL" | "wR" | "peak",
  PlateXYZ
> = {
  vL:   { x: 0,  y: 0,    z: 0 },
  vR:   { x: 0,  y: 0,    z: 0 },
  wL:   { x: -6, y: -3.5, z: 0 },
  wR:   { x: 6,  y: -3.5, z: 0 },
  peak: { x: 0,  y: 0,    z: 0 },
};

export const HAMMER14_BAKED_PIECE_ADJUSTS: Record<string, PieceAdjust> = {
  "hammer.tie.l": {
    off: { x: -11.25, y: 31.75, z: -3 },
    ext: { xp: 0, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 },
    scl: { x: 1.34, y: 1, z: 1 },
    hidden: false,
  },
  "hammer.tie.r": {
    off: { x: 8.25, y: 33, z: -2.75 },
    ext: { xp: 0, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 },
    scl: { x: 1.34, y: 1, z: 1 },
    hidden: false,
  },
  "hammer.toptie": {
    off: { x: -2.75, y: 26, z: -3 },
    ext: { xp: 0, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 },
    scl: { x: 1.3, y: 1, z: 1 },
  },
  "hammer.strut.l": {
    off: { x: 0, y: 120, z: 0 },
    ext: { xp: 0, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 },
    scl: { x: 1, y: 1, z: 1 },
    hidden: true,
  },
  "hammer.strut.r": {
    off: { x: 0, y: 120, z: 0 },
    ext: { xp: 0, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 },
    scl: { x: 1, y: 1, z: 1 },
    hidden: true,
  },
  "hammer.kingpost": {
    off: { x: -1.5, y: 27.25, z: -3 },
    ext: { xp: 0, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 },
    scl: { x: 0.93, y: 1.34, z: 0.99 },
  },
  "hammer.prince.l": {
    off: { x: -8.25, y: 31, z: -3 },
    ext: { xp: 0, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 },
    scl: { x: 1, y: 1.3, z: 0.99 },
    hidden: false,
  },
  "hammer.prince.r": {
    off: { x: 4.75, y: 30.25, z: -2.75 },
    ext: { xp: 0, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 },
    scl: { x: 1, y: 1.3, z: 0.99 },
  },
  "hammer.kingbrace.l": {
    off: { x: 0.25, y: 0.749999999999999, z: 0 },
    ext: { xp: 0, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 },
    scl: { x: 1.2, y: 1, z: 1 },
    hidden: false,
  },
  "hammer.kingbrace.r": {
    off: { x: 3.75, y: 0.75, z: 0 },
    ext: { xp: 0, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 },
    scl: { x: 1.2, y: 1, z: 1 },
  },
};

