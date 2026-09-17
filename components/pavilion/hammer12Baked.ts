/**
 * Baked-in coordinates for the 12′ hammer-beam pavilion.
 *
 * These are the canonical source of truth for the 12′ width. The Configurator
 * forces these at runtime when `config.width === 12`, so they cannot be tweaked
 * from the admin UI and any stale localStorage values are ignored.
 *
 * Captured from the published pavilion-defaults snapshot.
 */

import type { PieceAdjust } from "./PieceAdjuster";

export type PlateXYZ = { x: number; y: number; z: number };

export const HAMMER12_BAKED_PIECE_OFFSETS_IN: Record<string, PlateXYZ> = {
  "hammer.tie.l":     { x: -1.25, y: 1.5,  z: 0 },
  "hammer.tie.r":     { x: 1.25,  y: 1.5,  z: 0 },
  "hammer.kingpost":  { x: 0,     y: 2,    z: 0 },
  "hammer.post":      { x: 0,     y: 0,    z: 0 },
  "hammer.strut.l":   { x: -0.5,  y: 4,    z: -0.25 },
  "hammer.strut.r":   { x: 0.5,   y: 4,    z: -0.25 },
  "hammer.corbel.l":  { x: 9.25,  y: 9.25, z: 0 },
  "hammer.corbel.r":  { x: 9.25,  y: 9.25, z: 0 },
  "hammer.drop.l":    { x: 0,     y: 0,    z: 0 },
  "hammer.drop.r":    { x: 0,     y: 0,    z: 0 },
  "hammer.prince.l":  { x: 3.25,  y: 1.75, z: 0 },
  "hammer.prince.r":  { x: -3.25, y: 1.75, z: 0 },
};

export const HAMMER12_BAKED_PIECE_SCALES: Record<string, PlateXYZ> = {
  "hammer.tie.l":     { x: 1.3,  y: 1.36, z: 1 },
  "hammer.tie.r":     { x: 1.3,  y: 1.36, z: 1 },
  "hammer.kingpost":  { x: 1.49, y: 1.09, z: 1 },
  "hammer.post":      { x: 1,    y: 1,    z: 1 },
  "hammer.strut.l":   { x: 1.07, y: 1.4,  z: 1 },
  "hammer.strut.r":   { x: 1.07, y: 1.4,  z: 1 },
  "hammer.corbel.l":  { x: 1.4,  y: 1.4,  z: 0.95 },
  "hammer.corbel.r":  { x: 1.4,  y: 1.4,  z: 0.95 },
  "hammer.drop.l":    { x: 1,    y: 1,    z: 1 },
  "hammer.drop.r":    { x: 1,    y: 1,    z: 1 },
  "hammer.prince.l":  { x: 1.42, y: 1.2,  z: 1 },
  "hammer.prince.r":  { x: 1.42, y: 1.2,  z: 1 },
};

export const HAMMER12_BAKED_SCALE: PlateXYZ = { x: 1, y: 1, z: 1 };

export const HAMMER12_BAKED_PLATE_OFFSETS_IN: Record<
  "vL" | "vR" | "wL" | "wR" | "peak",
  PlateXYZ
> = {
  vL:   { x: 0,     y: 0,  z: 0 },
  vR:   { x: 0,     y: 0,  z: 0 },
  wL:   { x: -6.75, y: -5, z: 0 },
  wR:   { x: 6.75,  y: -5, z: 0 },
  peak: { x: 0,     y: 0,  z: 0 },
};

export const HAMMER12_BAKED_PIECE_ADJUSTS: Record<string, PieceAdjust> = {
  "ridge": {
    off: { x: 0, y: 0, z: 0 },
    ext: { xp: 0, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 },
  },
  "hammer.tie.l": {
    off: { x: -6.5, y: 28.546324084124244, z: -2.4999999999999956 },
    ext: { xp: 0, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 },
    scl: { x: 1.33, y: 0.76, z: 1 },
    hidden: false,
  },
  "hammer.tie.r": {
    off: { x: 4, y: 30, z: -2.4999999999999956 },
    ext: { xp: 0, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 },
    scl: { x: 1.33, y: 0.76, z: 1 },
    hidden: false,
  },
  "hammer.toptie": {
    off: { x: 0, y: 24.5, z: -2.5 },
    ext: { xp: 0, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 },
    scl: { x: 1.28, y: 1, z: 1 },
  },
  "hammer.strut.l": {
    off: { x: 0, y: 0, z: 98.75 },
    ext: { xp: 0, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 },
    scl: { x: 1.82, y: 1, z: 1 },
    hidden: true,
  },
  "hammer.strut.r": {
    off: { x: 0.000008267548495745009, y: 0.0000000000000122386790116159, z: 98.75 },
    ext: { xp: 0, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 },
    scl: { x: 1.82, y: 1, z: 1 },
    hidden: true,
  },
  "hammer.kingpost": {
    off: { x: 0, y: 18.5, z: 0 },
    ext: { xp: 0, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 },
    scl: { x: 0.76, y: 0.86, z: 1 },
  },
  "hammer.prince.l": {
    off: { x: -8, y: 26.75, z: -2.5 },
    ext: { xp: 0, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 },
    scl: { x: 0.78, y: 1.33, z: 0.98 },
    hidden: false,
  },
  "hammer.prince.r": {
    off: { x: 5.5, y: 26.77399352662389, z: -2.5000000000000018 },
    ext: { xp: 0, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 },
    scl: { x: 0.78, y: 1.33, z: 0.98 },
    hidden: false,
  },
  "hammer.rafter.r": {
    off: { x: 0, y: 0, z: 0 },
    ext: { xp: 0, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 },
  },
  "hammer.kingbrace.l": {
    off: { x: -10.021823045775646, y: 7.749999999999984, z: 0.2499999999999856 },
    ext: { xp: 0, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 },
    scl: { x: 0.75, y: 0.75, z: 0.96 },
    hidden: false,
  },
  "hammer.kingbrace.r": {
    off: { x: 0.75, y: 7.749999999999998, z: 0.25 },
    ext: { xp: 0, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 },
    scl: { x: 0.75, y: 0.75, z: 0.96 },
    hidden: false,
  },
};

