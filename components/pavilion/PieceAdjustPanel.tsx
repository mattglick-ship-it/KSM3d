"use client";
import { useRef, useState, useEffect } from "react";
import { ZERO_PIECE_ADJUST, type PieceAdjust } from "./PieceAdjuster";


function Row({
  label,
  value,
  onChange,
  min = -120,
  max = 120,
  step = 0.25,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="w-12 shrink-0 font-mono text-muted-foreground">{label}</div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 accent-brand"
      />
      <input
        type="number"
        value={value}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-16 rounded border border-input bg-background px-1 py-0.5 text-right font-mono"
      />
      <span className="w-3 text-muted-foreground">″</span>
    </div>
  );
}

export function PieceAdjustPanel({
  pieceKey,
  label,
  adjust,
  onChange,
  onReset,
  onClose,
  onDelete,
  onUndoDelete,
  onCopyFromTwin,

  twinPieceKey,
  linkTwin,
  onLinkTwinChange,
  onScaleAllPieces,
  onMoveAllPieces,
}: {
  pieceKey: string | null;
  label: string;
  adjust: PieceAdjust;
  onChange: (next: PieceAdjust) => void;
  onReset: () => void;
  onClose: () => void;
  /** Hides the piece from the scene (also hides its mirrored twin when linked). */
  onDelete?: () => void;
  /** Restores the most recently deleted piece(s). Hidden when undefined. */
  onUndoDelete?: () => void;

  /** Copies the mirrored twin's adjust into this piece. */
  onCopyFromTwin?: () => void;
  /** Twin id used to label the button; hides the button when null. */
  twinPieceKey?: string | null;
  /** When true, every change is also mirrored live to the twin. */
  linkTwin?: boolean;
  /** Setter for linkTwin — hides the toggle when undefined (no twin). */
  onLinkTwinChange?: (v: boolean) => void;
  /** Apply a uniform per-axis scale to every truss piece at once. */
  onScaleAllPieces?: (scl: { x: number; y: number; z: number }) => void;
  /** Nudge every truss piece by a delta offset (inches) on the given axis. */
  onMoveAllPieces?: (delta: { x: number; y: number; z: number }) => void;
}) {
  if (!pieceKey) return null;
  // Right-side pieces are mirrored copies of their left twins, so their local
  // +X axis points the opposite direction in world space. To give the panel a
  // "common origin" — same number typed on left & right yields symmetric
  // positions — we flip the X-axis controls for right-side pieces. Storage
  // stays in raw local units; only the UI is mirrored.
  const mirror = /(?:^|[._-])(r|right)(?:$|[._-])/i.test(pieceKey);
  const mx = mirror ? -1 : 1;
  const setOff = (k: "x" | "y" | "z", v: number) =>
    onChange({ ...adjust, off: { ...adjust.off, [k]: k === "x" ? v * mx : v } });
  const setExt = (k: keyof PieceAdjust["ext"], v: number) => {
    // Swap xp <-> xn on right so "Right (+X)" always grows the world-+X side
    // of the piece regardless of which twin you're editing.
    const realKey = mirror && (k === "xp" || k === "xn") ? (k === "xp" ? "xn" : "xp") : k;
    onChange({ ...adjust, ext: { ...adjust.ext, [realKey]: v } });
  };
  const scl = adjust.scl ?? { x: 1, y: 1, z: 1 };
  const setScl = (k: "x" | "y" | "z", v: number) =>
    onChange({ ...adjust, scl: { ...scl, [k]: v } });
  const rot = adjust.rot ?? { x: 0, y: 0, z: 0 };
  const setRot = (k: "x" | "y" | "z", v: number) =>
    onChange({ ...adjust, rot: { ...rot, [k]: v } });
  // Display values in the mirrored frame.
  const dispOffX = adjust.off.x * mx;
  const dispExtXp = mirror ? adjust.ext.xn : adjust.ext.xp;
  const dispExtXn = mirror ? adjust.ext.xp : adjust.ext.xn;

  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      setPos({ x: e.clientX - dragRef.current.dx, y: e.clientY - dragRef.current.dy });
    };
    const onUp = () => { dragRef.current = null; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  // Arrow-key nudging: Up/Down = Y axis, Left/Right = X axis.
  // Shift = 1″, default = 0.25″, Alt = 0.05″. Ignored while typing in inputs.
  useEffect(() => {
    if (!pieceKey) return;
    const onKey = (e: KeyboardEvent) => {
      const k = e.key;
      if (k !== "ArrowUp" && k !== "ArrowDown" && k !== "ArrowLeft" && k !== "ArrowRight") return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (t && t.isContentEditable)) return;
      e.preventDefault();
      const step = e.shiftKey ? 1 : e.altKey ? 0.05 : 0.25;
      if (k === "ArrowUp") setOff("y", adjust.off.y + step);
      else if (k === "ArrowDown") setOff("y", adjust.off.y - step);
      else if (k === "ArrowRight") setOff("x", dispOffX + step);
      else if (k === "ArrowLeft") setOff("x", dispOffX - step);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pieceKey, adjust, dispOffX]);
  const startDrag = (e: React.MouseEvent) => {
    const rect = (e.currentTarget.parentElement!.parentElement as HTMLElement).getBoundingClientRect();
    dragRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    setPos({ x: rect.left, y: rect.top });
  };

  const style: React.CSSProperties = pos
    ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" }
    : {};
  return (
    <div
      className="pointer-events-auto fixed top-20 right-4 z-[100] flex max-h-[calc(100vh-6rem)] w-[28rem] flex-col overflow-hidden rounded-lg border border-border bg-white p-3 shadow-2xl"
      style={style}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div
          className="min-w-0 cursor-move select-none"
          onMouseDown={startDrag}
          title="Drag to move"
        >


          <div className="truncate text-sm font-semibold">{label || pieceKey}</div>
          <div className="truncate font-mono text-[10px] text-muted-foreground">{pieceKey}</div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1">
          {onLinkTwinChange && twinPieceKey && (
            <button
              type="button"
              onClick={() => onLinkTwinChange(!linkTwin)}
              aria-pressed={!!linkTwin}
              className={`rounded border px-2 py-0.5 text-xs ${
                linkTwin
                  ? "border-brand bg-brand text-white"
                  : "border-input bg-background hover:bg-muted"
              }`}
              title={
                linkTwin
                  ? `Linked — every change also moves ${twinPieceKey} symmetrically`
                  : `Link sliders to ${twinPieceKey} (move both sides together)`
              }
            >
              {linkTwin ? "Linked ↔" : "Link ↔"}
            </button>
          )}
          {onCopyFromTwin && twinPieceKey && (
            <button
              type="button"
              onClick={onCopyFromTwin}
              className="rounded border border-input bg-background px-2 py-0.5 text-xs hover:bg-muted"
              title={`Mirror most-recently-edited side onto ${twinPieceKey}`}
            >
              Mirror to other side
            </button>
          )}
          <button
            type="button"
            onClick={onReset}
            className="rounded border border-input bg-background px-2 py-0.5 text-xs hover:bg-muted"
          >
            Reset
          </button>
          {onDelete && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Delete ${label || pieceKey}? It will be hidden from the scene (restore from the Hidden pieces list).`)) {
                  onDelete();
                }
              }}
              className="rounded border border-destructive bg-background px-2 py-0.5 text-xs text-destructive hover:bg-destructive hover:text-destructive-foreground"
              title="Hide this piece from the scene"
            >
              Delete
            </button>
          )}
          {onUndoDelete && (
            <button
              type="button"
              onClick={onUndoDelete}
              className="rounded border border-input bg-background px-2 py-0.5 text-xs hover:bg-muted"
              title="Restore the most recently deleted piece"
            >
              Undo delete
            </button>
          )}


          <button
            type="button"
            onClick={onClose}
            className="rounded border border-input bg-background px-2 py-0.5 text-xs hover:bg-muted"
            aria-label="Close"
          >
            ×
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Move
      </div>
      <div className="mb-2 space-y-1">
        <Row label="Left/Right (X)" value={dispOffX} onChange={(v) => setOff("x", v)} />
        <Row label="Up/Down (Y)" value={adjust.off.y} onChange={(v) => setOff("y", v)} />
        <Row label="Front/Back (Z)" value={adjust.off.z} onChange={(v) => setOff("z", v)} />
      </div>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Rotate (about piece center, degrees)
      </div>
      <div className="mb-2 space-y-1">
        {(["x", "y", "z"] as const).map((axis) => (
          <div key={axis} className="flex items-center gap-2 text-xs">
            <div className="w-12 shrink-0 font-mono text-muted-foreground">
              Rot {axis.toUpperCase()}
            </div>
            <input
              type="range"
              min={-180}
              max={180}
              step={0.5}
              value={rot[axis]}
              onChange={(e) => setRot(axis, parseFloat(e.target.value))}
              className="flex-1 accent-brand"
            />
            <input
              type="number"
              value={rot[axis]}
              step={0.5}
              onChange={(e) => setRot(axis, parseFloat(e.target.value) || 0)}
              className="w-16 rounded border border-input bg-background px-1 py-0.5 text-right font-mono"
            />
            <span className="w-3 text-muted-foreground">°</span>
          </div>
        ))}
      </div>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Extend (one side)
      </div>
      <div className="space-y-1">
        <Row label="Right (+X)" value={dispExtXp} onChange={(v) => setExt("xp", v)} min={0} max={96} />
        <Row label="Left (−X)" value={dispExtXn} onChange={(v) => setExt("xn", v)} min={0} max={96} />
        <Row label="Up (+Y)" value={adjust.ext.yp} onChange={(v) => setExt("yp", v)} min={0} max={96} />
        <Row label="Down (−Y)" value={adjust.ext.yn} onChange={(v) => setExt("yn", v)} min={0} max={96} />
        <Row label="Back (+Z)" value={adjust.ext.zp} onChange={(v) => setExt("zp", v)} min={0} max={96} />
        <Row label="Front (−Z)" value={adjust.ext.zn} onChange={(v) => setExt("zn", v)} min={0} max={96} />
      </div>
      <div className="mb-1 mt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Scale (per axis)
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-xs">
          <div className="w-12 shrink-0 font-mono text-muted-foreground">All</div>
          <input
            type="range"
            min={0.1}
            max={5}
            step={0.01}
            value={Math.min(scl.x, scl.y, scl.z)}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              onChange({ ...adjust, scl: { x: v, y: v, z: v } });
            }}
            className="flex-1 accent-brand"
          />
          <input
            type="number"
            value={Math.min(scl.x, scl.y, scl.z)}
            step={0.01}
            min={0.01}
            onChange={(e) => {
              const v = parseFloat(e.target.value) || 1;
              onChange({ ...adjust, scl: { x: v, y: v, z: v } });
            }}
            className="w-16 rounded border border-input bg-background px-1 py-0.5 text-right font-mono"
          />
          <span className="w-3 text-muted-foreground">×</span>
        </div>
        {(["x", "y", "z"] as const).map((axis) => (
          <div key={axis} className="flex items-center gap-2 text-xs">
            <div className="w-12 shrink-0 font-mono text-muted-foreground">
              Scale {axis.toUpperCase()}
            </div>
            <input
              type="range"
              min={0.1}
              max={5}
              step={0.01}
              value={scl[axis]}
              onChange={(e) => setScl(axis, parseFloat(e.target.value))}
              className="flex-1 accent-brand"
            />
            <input
              type="number"
              value={scl[axis]}
              step={0.01}
              min={0.01}
              onChange={(e) => setScl(axis, parseFloat(e.target.value) || 1)}
              className="w-16 rounded border border-input bg-background px-1 py-0.5 text-right font-mono"
            />
            <span className="w-3 text-muted-foreground">×</span>
          </div>
        ))}
      </div>
      {onScaleAllPieces && (
        <>
          <div className="mb-1 mt-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Scale ALL truss pieces
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs">
              <div className="w-12 shrink-0 font-mono text-muted-foreground">All</div>
              <input
                type="range"
                min={0.1}
                max={5}
                step={0.01}
                value={Math.min(scl.x, scl.y, scl.z)}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  onScaleAllPieces({ x: v, y: v, z: v });
                }}
                className="flex-1 accent-brand"
              />
              <input
                type="number"
                value={Math.min(scl.x, scl.y, scl.z)}
                step={0.01}
                min={0.01}
                onChange={(e) => {
                  const v = parseFloat(e.target.value) || 1;
                  onScaleAllPieces({ x: v, y: v, z: v });
                }}
                className="w-16 rounded border border-input bg-background px-1 py-0.5 text-right font-mono"
              />
              <span className="w-3 text-muted-foreground">×</span>
            </div>
            {(["x", "y", "z"] as const).map((axis) => (
              <div key={axis} className="flex items-center gap-2 text-xs">
                <div className="w-12 shrink-0 font-mono text-muted-foreground">
                  Scale {axis.toUpperCase()}
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={5}
                  step={0.01}
                  value={scl[axis]}
                  onChange={(e) =>
                    onScaleAllPieces({ ...scl, [axis]: parseFloat(e.target.value) })
                  }
                  className="flex-1 accent-brand"
                />
                <input
                  type="number"
                  value={scl[axis]}
                  step={0.01}
                  min={0.01}
                  onChange={(e) =>
                    onScaleAllPieces({ ...scl, [axis]: parseFloat(e.target.value) || 1 })
                  }
                  className="w-16 rounded border border-input bg-background px-1 py-0.5 text-right font-mono"
                />
                <span className="w-3 text-muted-foreground">×</span>
              </div>
            ))}
            <div className="text-[10px] leading-tight text-muted-foreground">
              Applies the chosen scale to every piece in the current truss at once.
            </div>
          </div>
        </>
      )}
      {onMoveAllPieces && (
        <>
          <div className="mb-1 mt-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Position ALL truss pieces (nudge)
          </div>
          <div className="space-y-1">
            {(["x", "y", "z"] as const).map((axis) => (
              <div key={axis} className="flex items-center gap-2 text-xs">
                <div className="w-12 shrink-0 font-mono text-muted-foreground">
                  Move {axis.toUpperCase()}
                </div>
                <input
                  type="range"
                  min={-12}
                  max={12}
                  step={0.25}
                  defaultValue={0}
                  onMouseUp={(e) => {
                    const v = parseFloat((e.target as HTMLInputElement).value);
                    if (v) {
                      onMoveAllPieces({ x: 0, y: 0, z: 0, [axis]: v } as { x: number; y: number; z: number });
                      (e.target as HTMLInputElement).value = "0";
                    }
                  }}
                  onTouchEnd={(e) => {
                    const v = parseFloat((e.target as HTMLInputElement).value);
                    if (v) {
                      onMoveAllPieces({ x: 0, y: 0, z: 0, [axis]: v } as { x: number; y: number; z: number });
                      (e.target as HTMLInputElement).value = "0";
                    }
                  }}
                  className="flex-1 accent-brand"
                />
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onMoveAllPieces({ x: 0, y: 0, z: 0, [axis]: -1 } as { x: number; y: number; z: number })}
                    className="rounded border border-input bg-background px-2 py-0.5 font-mono hover:bg-muted"
                    title={`Nudge all pieces -1″ on ${axis.toUpperCase()}`}
                  >−1</button>
                  <button
                    type="button"
                    onClick={() => onMoveAllPieces({ x: 0, y: 0, z: 0, [axis]: 1 } as { x: number; y: number; z: number })}
                    className="rounded border border-input bg-background px-2 py-0.5 font-mono hover:bg-muted"
                    title={`Nudge all pieces +1″ on ${axis.toUpperCase()}`}
                  >+1</button>
                </div>
                <span className="w-3 text-muted-foreground">″</span>
              </div>
            ))}
            <div className="text-[10px] leading-tight text-muted-foreground">
              Drag and release to nudge every piece in the current truss by that
              many inches. Use ±1 buttons for quick steps. Slider resets to 0
              after each nudge.
            </div>
          </div>
        </>
      )}
      <div className="mt-2 text-[10px] leading-tight text-muted-foreground">
        Axes are mesh-local. If a slider moves the piece an unexpected direction,
        try the corresponding opposite axis — local orientation depends on the
        beam's rotation.
      </div>
      </div>
    </div>
  );
}

export { ZERO_PIECE_ADJUST };
export type { PieceAdjust };

