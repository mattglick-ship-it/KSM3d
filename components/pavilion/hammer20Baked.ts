/**
 * Baked-in default coordinates for the 20′ hammer-beam pavilion.
 *
 * These values seed the persisted state for a fresh browser (no localStorage).
 * Update by clicking "Copy 20′ as code" in the admin panel (visible on the 20′
 * width) — it copies a snippet to your clipboard, then paste it here replacing
 * the three exported objects below and commit.
 *
 * Keys are piece IDs (e.g. "hammer.kingpost", "hammer.tie.l").
 * Offsets are in inches; scales are unit multipliers.
 */

export type Vec3 = { x: number; y: number; z: number };

export const HAMMER20_BAKED_OFFSETS_IN: Record<string, Vec3> = {};

export const HAMMER20_BAKED_SCALES: Record<string, Vec3> = {};

/**
 * Per-piece fine adjustments saved by the click-to-pick adjuster (off/ext/scl/hidden).
 * Use the matching `PieceAdjust` shape from `./PieceAdjuster`.
 */
export const HAMMER20_BAKED_PIECE_ADJUSTS: Record<string, unknown> = {};

