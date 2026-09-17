/**
 * Baked-in coordinates for the 20′ hammer-beam pavilion.
 *
 * Canonical source of truth for the 20′ width. The Configurator forces these
 * at runtime when `config.width === 20`, so they cannot be tweaked from the
 * admin UI and any stale localStorage values are ignored.
 *
 * Captured from the published pavilion-defaults snapshot.
 */

import type { PieceAdjust } from "./PieceAdjuster";

export type PlateXYZ = { x: number; y: number; z: number };

export const HAMMER20_BAKED_PIECE_OFFSETS_IN: Record<string, PlateXYZ> = {
  "hammer.tie.l":     { x: -13.5, y: 29.5,  z: -2.5 },
  "hammer.tie.r":     { x: 11,    y: 31.25, z: -2.5 },
  "hammer.toptie":    { x: -2.75, y: 31.5,  z: -2.5 },
  "hammer.kingpost":  { x: -1.75, y: 34,    z: -2.5 },
  "hammer.post":      { x: 0,     y: 0,     z: 0 },
  "hammer.strut.l":   { x: 0,     y: 0,     z: 0 },
  "hammer.strut.r":   { x: 0,     y: 0,     z: 0 },
  "hammer.corbel.l":  { x: 0,     y: 0,     z: 0 },
  "hammer.corbel.r":  { x: -0.25, y: 0,     z: 0 },
  "hammer.drop.l":    { x: 3,     y: 0,     z: 0 },
  "hammer.drop.r":    { x: 0,     y: 0,     z: 0 },
  "hammer.prince.l":  { x: -12.5, y: 30.75, z: -2.5 },
  "hammer.prince.r":  { x: 8,     y: -10.25,z: 0 },
};

export const HAMMER20_BAKED_PIECE_SCALES: Record<string, PlateXYZ> = {
  "hammer.tie.l":     { x: 1.31, y: 1.05, z: 1 },
  "hammer.tie.r":     { x: 1.31, y: 1.05, z: 1 },
  "hammer.toptie":    { x: 1.27, y: 1,    z: 1 },
  "hammer.kingpost":  { x: 1,    y: 1.1,  z: 0.99 },
  "hammer.post":      { x: 1,    y: 1,    z: 1 },
  "hammer.strut.l":   { x: 1,    y: 1,    z: 1 },
  "hammer.strut.r":   { x: 1,    y: 1,    z: 1 },
  "hammer.corbel.l":  { x: 1,    y: 1,    z: 1 },
  "hammer.corbel.r":  { x: 1,    y: 1,    z: 1 },
  "hammer.drop.l":    { x: 1,    y: 1,    z: 1 },
  "hammer.drop.r":    { x: 1,    y: 1,    z: 1 },
  "hammer.prince.l":  { x: 1,    y: 1.1,  z: 0.98 },
  "hammer.prince.r":  { x: 1,    y: 1.1,  z: 1 },
};

export const HAMMER20_BAKED_SCALE_V: PlateXYZ = { x: 1.03, y: 1.15, z: 1 };

export const HAMMER20_BAKED_GROUP_OFFSET_IN: PlateXYZ = { x: 0, y: -1.5, z: 0 };

export const HAMMER20_BAKED_PLATE_OFFSETS_IN: Record<
  "vL" | "vR" | "wL" | "wR" | "peak",
  PlateXYZ
> = {
  vL:   { x: 0,   y: 1.75, z: 0 },
  vR:   { x: 0,   y: 1.75, z: 0 },
  wL:   { x: 11,  y: 9.25, z: 0 },
  wR:   { x: -11, y: 9.25, z: 0 },
  peak: { x: 0,   y: 1.5,  z: 0 },
};

export const HAMMER20_BAKED_PIECE_ADJUSTS_FULL: Record<string, PieceAdjust> = {
  "hammer.rafter.l": {
    off: { x: 0, y: 0, z: 0 },
    ext: { xp: 0, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 },
  },
  "hammer.rafter.r": {
    off: { x: 0, y: 0, z: 0 },
    ext: { xp: 0, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 },
  },
  "hammer.prince.r": {
    off: { x: 0, y: 47.5, z: -2.75 },
    ext: { xp: 0, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 },
    scl: { x: 1, y: 1, z: 1 },
    hidden: false,
  },
  "hammer.prince.l": {
    off: { x: 0, y: 0, z: 0 },
    ext: { xp: 0, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 },
    scl: { x: 1, y: 1, z: 1 },
    hidden: false,
  },
  "hammer.tie.l": {
    off: { x: -1.75, y: -0.25, z: 0 },
    ext: { xp: 0, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 },
  },
  "hammer.tie.r": {
    off: { x: 0, y: -0.25, z: 0 },
    ext: { xp: 0, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 },
  },
  "hammer.kingpost": {
    off: { x: -0.25, y: 0.5, z: 0 },
    ext: { xp: 0, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 },
    scl: { x: 1.05, y: 1, z: 1 },
  },
  "hammer.toptie": {
    off: { x: 0.5, y: 0, z: 0 },
    ext: { xp: 0, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 },
    scl: { x: 1.03, y: 1, z: 1 },
  },
  "hammer.kingbrace.l": {
    off: { x: 14.5, y: -15.75, z: 0 },
    ext: { xp: 0, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 },
    scl: { x: 1, y: 1, z: 1 },
    hidden: false,
  },
  "hammer.kingbrace.r": {
    off: { x: -14.5, y: -15.75, z: 0 },
    ext: { xp: 0, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 },
  },
  "cat:beam": {
    off: { x: 0, y: 0, z: 0 },
    ext: { xp: 0, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 },
  },
};

