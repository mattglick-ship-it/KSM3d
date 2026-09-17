import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

// Scratch vectors reused every frame to avoid allocations.
const __scratchParentScale = new THREE.Vector3();

export type PieceAdjust = {
  /** Mesh-local offset in inches. */
  off: { x: number; y: number; z: number };
  /** Per-side extension in inches (positive = grow that side outward). */
  ext: { xp: number; xn: number; yp: number; yn: number; zp: number; zn: number };
  /** Optional multiplicative scale per local axis (default 1). */
  scl?: { x: number; y: number; z: number };
  /** Optional rotation in DEGREES, about the mesh-local bbox center (XYZ Euler). */
  rot?: { x: number; y: number; z: number };
  /** When true, every mesh matching this pieceKey is hidden. */
  hidden?: boolean;
};

export const ZERO_PIECE_ADJUST: PieceAdjust = {
  off: { x: 0, y: 0, z: 0 },
  ext: { xp: 0, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 },
  scl: { x: 1, y: 1, z: 1 },
  rot: { x: 0, y: 0, z: 0 },
};

export function isZeroAdjust(a?: PieceAdjust | null): boolean {
  if (!a) return true;
  const s = a.scl ?? { x: 1, y: 1, z: 1 };
  const r = a.rot ?? { x: 0, y: 0, z: 0 };
  return (
    a.off.x === 0 && a.off.y === 0 && a.off.z === 0 &&
    a.ext.xp === 0 && a.ext.xn === 0 &&
    a.ext.yp === 0 && a.ext.yn === 0 &&
    a.ext.zp === 0 && a.ext.zn === 0 &&
    s.x === 1 && s.y === 1 && s.z === 1 &&
    r.x === 0 && r.y === 0 && r.z === 0
  );
}

const IN = 0.0254;

/**
 * Traverses the pavilion root each frame and applies per-piece-key
 * scale/position adjustments. Pivot for "extend" is the original mesh
 * bounding box center; positive xp/yp/zp grow the +X/+Y/+Z face only,
 * negative xn/yn/zn grow the −X/−Y/−Z face only. Adjustments are in
 * mesh-LOCAL axes because each beam's local frame is what stays
 * consistent across width/style changes.
 *
 * When `cacheKey` changes (typically on width/style change), all cached
 * original positions/scales are invalidated so adjustments re-baseline
 * against the new R3F-provided values.
 */
export function PieceAdjuster({
  rootRef,
  adjusts,
  cacheKey,
}: {
  rootRef: React.MutableRefObject<THREE.Group | null>;
  adjusts: Record<string, PieceAdjust>;
  cacheKey?: string;
}) {
  useFrame(() => {
    const root = rootRef.current;
    if (!root) return;
    root.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (!(m as any).isMesh) return;
      const mat = Array.isArray(m.material) ? m.material[0] : m.material;
      const pieceKey: string | undefined = (mat as any)?.userData?.pieceKey;
      if (!pieceKey) return;

      const ud: any = m.userData;
      // The picker stores adjustments under the bare id (e.g. "hammer.strut.r")
      // while material userData.pieceKey is prefixed ("piece:hammer.strut.r" or
      // "cat:beam"). Look up under both shapes so either keying works.
      const bareKey = pieceKey.replace(/^(piece:|cat:)/, "");
      const adj = adjusts[pieceKey] ?? adjusts[bareKey];
      // Hidden flag → toggle visibility. Track whether we own the current
      // hidden state so unhide cleanly restores meshes we hid.
      const shouldHide = !!adj?.hidden;
      if (shouldHide) {
        if (m.visible) {
          ud.__paHiddenByUs = true;
          m.visible = false;
        }
        return;
      }
      if (ud.__paHiddenByUs) {
        m.visible = true;
        delete ud.__paHiddenByUs;
      }
      const isZero = !adj || isZeroAdjust(adj);

      // Invalidate cached baseline on cacheKey change (width/style remount).
      // R3F re-renders only meshes whose props changed. For meshes that did
      // NOT change (e.g. side rafters when only truss style toggles), their
      // m.position is still last frame's MUTATED value. If we naively drop
      // the cache and re-capture, we'd treat the mutated pose as the new
      // "original" and double-apply the offset on the next adjust.
      //
      // Heuristic: if m.position still matches the value we wrote last
      // frame, R3F did NOT touch this mesh — restore to origPos before
      // dropping the cache. Otherwise R3F committed a fresh prop-driven
      // pose; accept it as the new baseline.
      if (ud.__paKey !== cacheKey) {
        if (ud.__paOrigPos && ud.__paLastWritten) {
          const lw: THREE.Vector3 = ud.__paLastWritten;
          if (
            Math.abs(m.position.x - lw.x) < 1e-6 &&
            Math.abs(m.position.y - lw.y) < 1e-6 &&
            Math.abs(m.position.z - lw.z) < 1e-6
          ) {
            m.position.copy(ud.__paOrigPos);
            m.scale.copy(ud.__paOrigScale);
            if (ud.__paOrigQuat) m.quaternion.copy(ud.__paOrigQuat);
          }
        }
        delete ud.__paOrigPos;
        delete ud.__paOrigScale;
        delete ud.__paOrigQuat;
        delete ud.__paBbox;
        delete ud.__paLastWritten;
        ud.__paKey = cacheKey;
      }



      if (isZero) {
        // No adjust active — restore any prior mutation and drop the cache
        // so the next non-zero adjust re-captures R3F's current intended pose.
        if (ud.__paOrigPos) {
          m.position.copy(ud.__paOrigPos);
          m.scale.copy(ud.__paOrigScale);
          if (ud.__paOrigQuat) m.quaternion.copy(ud.__paOrigQuat);
          delete ud.__paOrigPos;
          delete ud.__paOrigScale;
          delete ud.__paOrigQuat;
          delete ud.__paBbox;
          delete ud.__paLastWritten;
        }
        return;
      }

      if (!ud.__paOrigPos) {
        ud.__paOrigPos = m.position.clone();
        ud.__paOrigScale = m.scale.clone();
        ud.__paOrigQuat = m.quaternion.clone();
        if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
        ud.__paBbox = m.geometry.boundingBox!.clone();
      }
      const origPos: THREE.Vector3 = ud.__paOrigPos;
      const origScale: THREE.Vector3 = ud.__paOrigScale;
      const origQuat: THREE.Quaternion = ud.__paOrigQuat;
      const bbox: THREE.Box3 = ud.__paBbox;

      const W = Math.max(1e-6, bbox.max.x - bbox.min.x);
      const H = Math.max(1e-6, bbox.max.y - bbox.min.y);
      const D = Math.max(1e-6, bbox.max.z - bbox.min.z);
      const cx = (bbox.min.x + bbox.max.x) / 2;
      const cy = (bbox.min.y + bbox.max.y) / 2;
      const cz = (bbox.min.z + bbox.max.z) / 2;
      const scl = adj!.scl ?? { x: 1, y: 1, z: 1 };
      const rot = adj!.rot ?? { x: 0, y: 0, z: 0 };
      const sx = ((W + (adj!.ext.xp + adj!.ext.xn) * IN) / W) * scl.x;
      const sy = ((H + (adj!.ext.yp + adj!.ext.yn) * IN) / H) * scl.y;
      const sz = ((D + (adj!.ext.zp + adj!.ext.zn) * IN) / D) * scl.z;

      // Build extra rotation (mesh-local) around bbox center.
      const DEG = Math.PI / 180;
      const extraQuat = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(rot.x * DEG, rot.y * DEG, rot.z * DEG, "XYZ"),
      );
      m.quaternion.copy(origQuat).multiply(extraQuat);

      // Pivot shift to keep bbox center fixed when rotating in mesh-local frame.
      const cLocal = new THREE.Vector3(cx, cy, cz);
      const cRot = cLocal.clone().applyQuaternion(extraQuat);
      const rotPivotLocal = cLocal.clone().sub(cRot);

      // The parent group can carry non-uniform scale. Normalize the
      // user-driven slider portion (off + ext shift) so sliders mean
      // "N inches in world space" regardless of parent scale.
      __scratchParentScale.set(1, 1, 1);
      if (m.parent) {
        m.parent.updateWorldMatrix(true, false);
        m.parent.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), __scratchParentScale);
      }
      const psx = Math.abs(__scratchParentScale.x) > 1e-6 ? __scratchParentScale.x : 1;
      const psy = Math.abs(__scratchParentScale.y) > 1e-6 ? __scratchParentScale.y : 1;
      const psz = Math.abs(__scratchParentScale.z) > 1e-6 ? __scratchParentScale.z : 1;
      const userLocal = new THREE.Vector3(
        ((adj!.ext.xp - adj!.ext.xn) * IN * 0.5 + adj!.off.x * IN) / psx,
        ((adj!.ext.yp - adj!.ext.yn) * IN * 0.5 + adj!.off.y * IN) / psy,
        ((adj!.ext.zp - adj!.ext.zn) * IN * 0.5 + adj!.off.z * IN) / psz,
      );
      const pivotLocal = new THREE.Vector3(
        (1 - sx) * cx,
        (1 - sy) * cy,
        (1 - sz) * cz,
      );
      const combinedLocal = pivotLocal.add(userLocal).add(rotPivotLocal);
      const tParent = combinedLocal.applyQuaternion(origQuat);

      m.scale.set(origScale.x * sx, origScale.y * sy, origScale.z * sz);
      m.position.set(origPos.x + tParent.x, origPos.y + tParent.y, origPos.z + tParent.z);
      // Remember what we wrote so cacheKey-change detection can tell whether
      // R3F has since overwritten this mesh's position.
      if (!ud.__paLastWritten) ud.__paLastWritten = new THREE.Vector3();
      ud.__paLastWritten.copy(m.position);
    });
  });
  return null;
}

