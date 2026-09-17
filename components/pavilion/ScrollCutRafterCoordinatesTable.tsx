"use client";
import { useMemo, useState } from "react";
import type { PieceAdjust } from "./PieceAdjuster";

type XYZ = { x: number; y: number; z: number };
type Ext = { xp: number; xn: number; yp: number; yn: number; zp: number; zn: number };

const WIDTHS = ["12", "14", "16", "20", "24", "28", "32"] as const;
type W = (typeof WIDTHS)[number];

const fmt = (n: number | undefined) =>
  typeof n === "number" && Number.isFinite(n) ? Number(n.toFixed(3)).toString() : "—";
const xyz = (v: XYZ | undefined) => (v ? `${fmt(v.x)} / ${fmt(v.y)} / ${fmt(v.z)}` : "—");
const ext = (e: Ext | undefined) =>
  e
    ? `xp ${fmt(e.xp)}  xn ${fmt(e.xn)}  yp ${fmt(e.yp)}  yn ${fmt(e.yn)}  zp ${fmt(e.zp)}  zn ${fmt(e.zn)}`
    : "—";

function readLS<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// ---- Baked defaults — mirror of Configurator.tsx scroll-tail bakes ----
const SCROLL_COLLAR_BAKE: Record<string, PieceAdjust> = {
  "side.collar": {
    off: { x: 0, y: 0, z: -0.25 },
    ext: { xp: 0, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 },
    scl: { x: 1.03, y: 1, z: 0.94 },
  },
};

const SCROLL14_RAFTER_BAKE_HAMMER: Record<string, PieceAdjust> = {
  "side.rafter.l":   { off: { x: -1.25, y: 0, z: 0 }, ext: { xp: 4.25, xn: 6.75, yp: 0, yn: 0, zp: 0, zn: 0 }, scl: { x: 0.91, y: 1, z: 1 } },
  "side.rafter.r":   { off: { x:  1.25, y: 0, z: 0 }, ext: { xp: 6.75, xn: 4.25, yp: 0, yn: 0, zp: 0, zn: 0 }, scl: { x: 0.91, y: 1, z: 1 } },
  "hammer.rafter.r": { off: { x:  1.25, y: 0, z: 0 }, ext: { xp: 6.75, xn: 4.25, yp: 0, yn: 0, zp: 0, zn: 0 }, scl: { x: 0.91, y: 1, z: 1 } },
};

const SCROLL14_RAFTER_BAKE_KING: Record<string, PieceAdjust> = {
  "side.rafter.l": { off: { x: -1.75, y: 0, z: 0 }, ext: { xp: 6.75, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 }, scl: { x: 0.91, y: 1, z: 1 } },
  "side.rafter.r": { off: { x:  1.75, y: 0, z: 0 }, ext: { xp: 6.75, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 }, scl: { x: 0.91, y: 1, z: 1 } },
  "king.rafter.l": { off: { x: -1.75, y: 0, z: 0 }, ext: { xp: 6.75, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 }, scl: { x: 0.91, y: 1, z: 1 } },
  "king.rafter.r": { off: { x:  1.75, y: 0, z: 0 }, ext: { xp: 6.75, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 }, scl: { x: 0.91, y: 1, z: 1 } },
};

const SCROLL14_RAFTER_BAKE_ARCH: Record<string, PieceAdjust> = {
  "side.rafter.l": { off: { x: -1.75, y: 0, z: 0 }, ext: { xp: 6.75, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 }, scl: { x: 0.91, y: 1, z: 1 } },
  "side.rafter.r": { off: { x:  1.75, y: 0, z: 0 }, ext: { xp: 6.75, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 }, scl: { x: 0.91, y: 1, z: 1 } },
  "arch.rafter.r": { off: { x:  1.75, y: 0, z: 0 }, ext: { xp: 6.75, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 }, scl: { x: 0.91, y: 1, z: 1 } },
};

const HAMMER_KEYS = ["side.rafter.l", "side.rafter.r", "hammer.rafter.r", "side.collar"];
const KING_KEYS   = ["side.rafter.l", "side.rafter.r", "king.rafter.l", "king.rafter.r", "side.collar"];
const ARCH_KEYS   = ["side.rafter.l", "side.rafter.r", "arch.rafter.r", "side.collar"];

const HAMMER_BAKED_BY_WIDTH: Partial<Record<W, Record<string, PieceAdjust>>> = {
  "12": { ...SCROLL_COLLAR_BAKE },
  "14": { ...SCROLL14_RAFTER_BAKE_HAMMER, ...SCROLL_COLLAR_BAKE },
  "16": { ...SCROLL_COLLAR_BAKE },
  "20": { ...SCROLL_COLLAR_BAKE },
};
const KING_BAKED_BY_WIDTH: Partial<Record<W, Record<string, PieceAdjust>>> = {
  "12": { ...SCROLL_COLLAR_BAKE },
  "14": { ...SCROLL14_RAFTER_BAKE_KING, ...SCROLL_COLLAR_BAKE },
  "16": { ...SCROLL_COLLAR_BAKE },
  "20": { ...SCROLL_COLLAR_BAKE },
};
const ARCH_BAKED_BY_WIDTH: Partial<Record<W, Record<string, PieceAdjust>>> = {
  "12": { ...SCROLL_COLLAR_BAKE },
  "14": { ...SCROLL14_RAFTER_BAKE_ARCH, ...SCROLL_COLLAR_BAKE },
  "16": { ...SCROLL_COLLAR_BAKE },
  "20": { ...SCROLL_COLLAR_BAKE },
};

const HAMMER_KING_LS_KEY = "pav.pieceAdjustsByWidth.v20-king14scroll";
const ARCH_LS_KEY = "pav.archPieceAdjustsByWidth.v10-scroll20follow";

type PA = Partial<PieceAdjust>;

function mergeWidth(baked: Record<string, PieceAdjust>, persisted: Record<string, PA> | undefined) {
  return { ...baked, ...(persisted ?? {}) } as Record<string, PieceAdjust>;
}

function PieceRow({
  pieceKey,
  byWidth,
}: {
  pieceKey: string;
  byWidth: Record<W, Record<string, PieceAdjust>>;
}) {
  return (
    <>
      <tr className="border-b border-border/50">
        <td className="px-2 py-1 font-semibold align-top" rowSpan={4}>{pieceKey}</td>
        <td className="px-2 py-1 text-muted-foreground">offset ″</td>
        {WIDTHS.map((w) => (
          <td key={w} className="px-2 py-1">{xyz(byWidth[w][pieceKey]?.off)}</td>
        ))}
      </tr>
      <tr className="border-b border-border/50">
        <td className="px-2 py-1 text-muted-foreground">extend ″</td>
        {WIDTHS.map((w) => (
          <td key={w} className="px-2 py-1">{ext(byWidth[w][pieceKey]?.ext)}</td>
        ))}
      </tr>
      <tr className="border-b border-border/50">
        <td className="px-2 py-1 text-muted-foreground">scale ×</td>
        {WIDTHS.map((w) => (
          <td key={w} className="px-2 py-1">{xyz(byWidth[w][pieceKey]?.scl)}</td>
        ))}
      </tr>
      <tr className="border-b border-border">
        <td className="px-2 py-1 text-muted-foreground">hidden</td>
        {WIDTHS.map((w) => (
          <td key={w} className="px-2 py-1">{byWidth[w][pieceKey]?.hidden ? "yes" : ""}</td>
        ))}
      </tr>
    </>
  );
}

function StyleTable({
  title,
  pieceKeys,
  byWidth,
}: {
  title: string;
  pieceKeys: string[];
  byWidth: Record<W, Record<string, PieceAdjust>>;
}) {
  return (
    <div className="mb-6">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink">{title}</div>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="px-2 py-1 text-left">Piece</th>
            <th className="px-2 py-1 text-left">Field</th>
            {WIDTHS.map((w) => (
              <th key={w} className="px-2 py-1 text-left">{w}′</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pieceKeys.map((p) => (
            <PieceRow key={p} pieceKey={p} byWidth={byWidth} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ScrollCutRafterCoordinatesTable() {
  const [open, setOpen] = useState(false);

  const data = useMemo(() => {
    if (!open) return null;

    const hammerKingPersisted = readLS<Record<string, Record<string, PA>>>(HAMMER_KING_LS_KEY, {});
    const archPersisted = readLS<Record<string, Record<string, PA>>>(ARCH_LS_KEY, {});

    const hammerByWidth = Object.fromEntries(
      WIDTHS.map((w) => [w, mergeWidth(HAMMER_BAKED_BY_WIDTH[w] ?? {}, hammerKingPersisted[w])]),
    ) as Record<W, Record<string, PieceAdjust>>;

    const kingByWidth = Object.fromEntries(
      WIDTHS.map((w) => [w, mergeWidth(KING_BAKED_BY_WIDTH[w] ?? {}, hammerKingPersisted[`king-${w}`])]),
    ) as Record<W, Record<string, PieceAdjust>>;

    const archByWidth = Object.fromEntries(
      WIDTHS.map((w) => [w, mergeWidth(ARCH_BAKED_BY_WIDTH[w] ?? {}, archPersisted[w])]),
    ) as Record<W, Record<string, PieceAdjust>>;

    return { hammerByWidth, kingByWidth, archByWidth };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border border-input bg-white px-2 py-1 text-xs font-semibold text-ink shadow-sm hover:bg-muted"
        title="Show every scroll-cut rafter tail coordinate across all truss styles and widths"
      >
        🌀 Scroll-cut rafter tail coordinates
      </button>
      {open && data && (
        <div
          className="pointer-events-auto fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[92vh] w-full max-w-[1400px] flex-col overflow-hidden rounded-lg border border-border bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-2">
              <div>
                <div className="text-sm font-semibold">
                  Scroll-cut rafter tail coordinates — every style & width
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Read-only snapshot. Values combine baked defaults with any persisted overrides
                  in localStorage. Active only when Rafter Tail = Scroll. Fields: offset ″ (x/y/z),
                  extend ″ (per-face), scale ×, hidden.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded border border-input bg-background px-2 py-0.5 text-xs hover:bg-muted"
              >
                Close ×
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-4 font-mono text-[10.5px] leading-tight">
              <StyleTable title="Hammer-beam truss — scroll-cut rafter tail" pieceKeys={HAMMER_KEYS} byWidth={data.hammerByWidth} />
              <StyleTable title="King truss — scroll-cut rafter tail" pieceKeys={KING_KEYS} byWidth={data.kingByWidth} />
              <StyleTable title="Arch truss — scroll-cut rafter tail" pieceKeys={ARCH_KEYS} byWidth={data.archByWidth} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

