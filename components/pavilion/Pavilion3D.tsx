import {expandedFrame,pavilionStations} from '@/lib/pavilion-layout';
import { configureTimberMaterial } from './timber-grain';
import { snowGuardPositions, snowRailLength, snowRoofLength } from '@/lib/snow-retention';
import {NATURAL_PINE_BEAM,NATURAL_PINE_DECK} from '@/lib/natural-pine';
import naturalPineDeckAsset from '@/assets/pine_planks.jpg.asset.json';
import { createContext, useContext, useEffect, useMemo, useRef, useState, useId, type ReactNode } from "react";
import { useLoader } from "@react-three/fiber";
import { PieceAdjuster, type PieceAdjust } from "./PieceAdjuster";

import * as THREE from "three";
import { createPartGeometry, createHammerMembers } from "./procedural-geometry";
import type { PavilionConfig } from "@/lib/pavilion-config";
import { WOOD_FINISHES, ROOF_MATERIALS } from "@/lib/pavilion-config";
import shingleTextureAsset from "@/assets/shingle_tile.jpg.asset.json";
import roofUndersideAsset from "@/assets/underside_planks_2k.jpg.asset.json";
import woodTextureAsset from "@/assets/beam_pine.png.asset.json";
import { useTimberSurface } from "./timber-surface";



























import { HAMMER20_PIECE_STLS, HAMMER20_EXTRA_PIECES, type Hammer20PieceKey } from "./hammer20PieceRegistry";
import { Hammer12Truss, HAMMER12_GLB_DEFAULT_ADJUST, type Hammer12Adjust } from "./Hammer12Truss";
import { Hammer14Truss, HAMMER14_GLB_DEFAULT_ADJUST, type Hammer14Adjust } from "./Hammer14Truss";
import { Hammer16Truss, HAMMER16_GLB_DEFAULT_ADJUST, type Hammer16Adjust } from "./Hammer16Truss";
import { Hammer20Truss, HAMMER20_GLB_DEFAULT_ADJUST, type Hammer20Adjust } from "./Hammer20Truss";




import pebblesAsset from "@/assets/ganges_pebbles.png.asset.json";
import capPebblesAsset from "@/assets/floor_pebbles.jpg.asset.json";

/** Fallback geometry used when the scroll-end STL fails to load (e.g. asset
 *  CDN 404). Keeps the rest of the pavilion visible. A simple box matches the
 *  beam cross-section so it renders as a flush cap. */
function makeFallbackScrollGeometry(): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(1, 1, 1);
  g.computeBoundingBox();
  return g;
}

/** Load the scroll-end STL once, centered, with a scale factor that fits its
 *  cross-section to a target beam thickness. Returns a geometry whose local
 *  +X axis runs along the beam's length (tip pointing +X). */
function useScrollEndGeometry(targetCrossSection: number) {
  const raw = useMemo(() => createPartGeometry("scroll_cut_concave"), []);
  useEffect(() => () => raw.dispose(), [raw]);
  return useMemo(() => {
    const g = raw.clone();
    g.computeBoundingBox();
    const bb = g.boundingBox!;
    const sx = bb.max.x - bb.min.x;
    const sy = bb.max.y - bb.min.y;
    const sz = bb.max.z - bb.min.z;
    // Center on all axes first.
    g.translate(-(bb.min.x + sx / 2), -(bb.min.y + sy / 2), -(bb.min.z + sz / 2));
    // Scale Y and Z independently so the cap cross-section exactly matches
    // the girder beam's square cross-section. X is the length axis; scale it
    // by the larger of the two cross-section factors so proportions of the
    // scroll along its length stay reasonable.
    const sYfactor = targetCrossSection / sy;
    const sZfactor = targetCrossSection / sz;
    // Length scale: base on cross-section scale, then shrink the X axis
    // (the cap's length axis — appears as world Z when placed on the girder)
    // by 8 inches so the scroll isn't over-stretched.
    const baseXfactor = Math.max(sYfactor, sZfactor);
    const shrinkBy = 12 * 0.0254;
    const sXfactor = Math.max(0.01, (sx * baseXfactor - shrinkBy) / sx);
    g.scale(sXfactor, sYfactor, sZfactor);
    // Generate planar UVs so the wood texture maps onto the STL the same way
    // it maps onto the BoxGeometry beam (one tile across the side face).
    const pos = g.attributes.position as THREE.BufferAttribute;
    const uv = new Float32Array(pos.count * 2);
    const lenX = sx * sXfactor;
    const lenY = targetCrossSection;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      uv[i * 2] = x / lenX + 0.5;
      uv[i * 2 + 1] = y / lenY + 0.5;
    }
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    g.computeVertexNormals();
    g.computeBoundingBox();
    return { geometry: g, length: lenX };
  }, [raw, targetCrossSection]);
}

/** Load the girder-beam STL once, scale Y/Z to match the beam's square
 *  cross-section, and scale X to the requested length. Geometry's local +X
 *  runs along the beam's length. */
function useGirderBeamGeometry(targetCrossSection: number, targetLength: number, assetUrl: string = "scroll_cut_girder_beam") {
  const raw = useMemo(() => createPartGeometry(assetUrl), [assetUrl]);
  useEffect(() => () => raw.dispose(), [raw]);
  return useMemo(() => {
    const src = raw ?? new THREE.BoxGeometry(1, 1, 1);
    const g = src.clone();
    g.computeBoundingBox();
    const bb = g.boundingBox!;
    const sx = bb.max.x - bb.min.x;
    const sy = bb.max.y - bb.min.y;
    const sz = bb.max.z - bb.min.z;
    g.translate(-(bb.min.x + sx / 2), -(bb.min.y + sy / 2), -(bb.min.z + sz / 2));
    const sYfactor = targetCrossSection / sy;
    const sZfactor = targetCrossSection / sz;
    const sXfactor = targetLength / sx;
    g.scale(sXfactor, sYfactor, sZfactor);
    splitGeometryByFaceNormal(g, targetLength, targetCrossSection, targetCrossSection);
    g.computeVertexNormals();
    g.computeBoundingBox();
    return g;
  }, [raw, targetCrossSection, targetLength]);
}

/** Girder end cap: load STL, scale Y/Z to beam cross-section, scale X
 *  proportionally so the cap keeps its natural aspect. Local +X points
 *  outward from the beam end. */
function useGirderCapGeometry(targetCrossSection: number) {
  const raw = useMemo(() => createPartGeometry("girder_cap"), []);
  useEffect(() => () => raw.dispose(), [raw]);
  return useMemo(() => {
    if (!raw) return null;
    const g = raw.clone();
    g.computeBoundingBox();
    const bb = g.boundingBox!;
    const sx = bb.max.x - bb.min.x;
    const sy = bb.max.y - bb.min.y;
    const sz = bb.max.z - bb.min.z;
    g.translate(-(bb.min.x + sx / 2), -(bb.min.y + sy / 2), -(bb.min.z + sz / 2));
    const sYfactor = targetCrossSection / sy;
    const sZfactor = targetCrossSection / sz;
    const sXfactor = Math.max(sYfactor, sZfactor);
    g.scale(sXfactor, sYfactor, sZfactor);
    const lenX = sx * sXfactor;
    // Shift so the inner face (originally at local -X half) sits at x=0,
    // and the cap extends to +X (outward from the beam).
    g.translate(lenX / 2, 0, 0);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      uv[i * 2] = pos.getX(i) / lenX;
      uv[i * 2 + 1] = pos.getY(i) / targetCrossSection + 0.5;
    }
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    g.computeVertexNormals();
    g.computeBoundingBox();
    return { geometry: g, length: lenX };
  }, [raw, targetCrossSection]);
}

/** Reorder a non-indexed BufferGeometry so triangles are grouped by their
 *  dominant normal axis and assign per-face UVs + material groups. Buckets
 *  match BoxGeometry face order: 0:+x, 1:-x, 2:+y, 3:-y, 4:+z, 5:-z.
 *  Each face's UVs are planar in the two non-dominant axes, normalized to
 *  the piece's local dimensions so adjacent faces do NOT share UV continuity
 *  — every face is treated as an independent surface (so per-face grain
 *  rotation / hand-peeled randomization apply independently). */
function splitGeometryByFaceNormal(
  g: THREE.BufferGeometry,
  sx: number,
  sy: number,
  sz: number,
) {
  // Force non-indexed so we can freely reorder triangles.
  const flat = g.index ? g.toNonIndexed() : g;
  const posAttr = flat.attributes.position as THREE.BufferAttribute;
  const triCount = posAttr.count / 3;
  const buckets: number[][] = [[], [], [], [], [], []];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let t = 0; t < triCount; t++) {
    const i = t * 3;
    a.fromBufferAttribute(posAttr, i);
    b.fromBufferAttribute(posAttr, i + 1);
    c.fromBufferAttribute(posAttr, i + 2);
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    n.crossVectors(ab, ac).normalize();
    const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
    let bucket: number;
    if (ax >= ay && ax >= az) bucket = n.x >= 0 ? 0 : 1;
    else if (ay >= az) bucket = n.y >= 0 ? 2 : 3;
    else bucket = n.z >= 0 ? 4 : 5;
    buckets[bucket].push(t);
  }
  // Rebuild positions in bucket order and write planar UVs per face.
  const newPos = new Float32Array(posAttr.count * 3);
  const newUV = new Float32Array(posAttr.count * 2);
  const groups: Array<{ start: number; count: number; mat: number }> = [];
  let cursor = 0;
  for (let bIdx = 0; bIdx < 6; bIdx++) {
    const tris = buckets[bIdx];
    if (tris.length === 0) { groups.push({ start: cursor * 3, count: 0, mat: bIdx }); continue; }
    const start = cursor;
    for (const t of tris) {
      for (let k = 0; k < 3; k++) {
        const srcIdx = t * 3 + k;
        const x = posAttr.getX(srcIdx);
        const y = posAttr.getY(srcIdx);
        const z = posAttr.getZ(srcIdx);
        newPos[cursor * 3 + 0] = x;
        newPos[cursor * 3 + 1] = y;
        newPos[cursor * 3 + 2] = z;
        // Planar UV in the two non-dominant axes, normalized to piece size.
        let u = 0, v = 0;
        if (bIdx === 0 || bIdx === 1) { u = z / sz + 0.5; v = y / sy + 0.5; }
        else if (bIdx === 2 || bIdx === 3) { u = x / sx + 0.5; v = z / sz + 0.5; }
        else { u = x / sx + 0.5; v = y / sy + 0.5; }
        newUV[cursor * 2 + 0] = u;
        newUV[cursor * 2 + 1] = v;
        cursor++;
      }
    }
    groups.push({ start: start * 3, count: tris.length * 3, mat: bIdx });
  }
  g.setAttribute("position", new THREE.BufferAttribute(newPos, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(newUV, 2));
  if (g.index) g.setIndex(null);
  g.clearGroups();
  for (const grp of groups) {
    if (grp.count > 0) g.addGroup(grp.start, grp.count, grp.mat);
  }
}

/** Load the scroll-cut rafter STL and return a geometry pre-scaled to the
 *  requested rafter dimensions. The source STL is authored with:
 *    +X = thickness, +Y = horizontal run (peak → tail tip), +Z = vertical profile.
 *  Caller supplies `runX` (horizontal run incl. tail) and `t` (vertical profile)
 *  in world meters; `depth` is the rafter thickness (along scene Z when placed).
 *  Output geometry's +X axis matches the scene's horizontal run direction so it
 *  can be mirrored by scaling X by `side`. */
function useScrollCutRafterGeometry(runX: number, t: number, depth: number) {
  const raw = useMemo(() => createPartGeometry("scroll_cut_rafter2"), []);
  useEffect(() => () => raw.dispose(), [raw]);
  return useMemo(() => {
    const src = raw ?? new THREE.BoxGeometry(1, 1, 1);
    const g = src.clone();
    void t; void depth;
    // Remap STL axes → scene axes via a swap matrix:
    //   STL Y (run) → scene X
    //   STL Z (profile) → scene Y
    //   STL X (thickness) → scene Z
    const m = new THREE.Matrix4().set(
      0, 1, 0, 0,
      0, 0, 1, 0,
      1, 0, 0, 0,
      0, 0, 0, 1,
    );
    g.applyMatrix4(m);
    // Base scale: STL is authored in inches → meters.
    const s = 0.0254;
    g.scale(s, s, s);
    // Center & origin so peak (min X) → 0, top edge (max Y) → 0, centered Z.
    g.computeBoundingBox();
    const bb1 = g.boundingBox!;
    g.translate(-bb1.min.x, -bb1.max.y, -(bb1.min.z + (bb1.max.z - bb1.min.z) / 2));
    // Stretch X so the rafter's length along the slope matches `runX`
    // (the requested slant length in meters). This makes the scroll-cut
    // rafter the same length as the standard plumb-cut rafter.
    g.computeBoundingBox();
    const bb2 = g.boundingBox!;
    const lenX0 = bb2.max.x - bb2.min.x;
    if (runX > 0 && lenX0 > 0) {
      g.scale(runX / lenX0, 1, 1);
    }
    g.computeBoundingBox();
    const bb3 = g.boundingBox!;
    const lenX = bb3.max.x - bb3.min.x;
    const lenY = bb3.max.y - bb3.min.y;
    // Planar UVs so the wood texture maps cleanly across the side face.
    const pos = g.attributes.position as THREE.BufferAttribute;
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      uv[i * 2] = pos.getX(i) / lenX + 0.5;
      uv[i * 2 + 1] = pos.getY(i) / lenY + 0.5;
    }
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    g.computeVertexNormals();
    g.computeBoundingBox();
    return g;
  }, [raw, runX, t, depth]);

}

/** Unstained decking uses the knotty pine photo; stained decking retains its existing map. */
function useUndersideTexture(
  repeatX: number,
  repeatY: number,
  rotate = 0,
  offsetX = 0,
  offsetY = 0,
) {
  const natural = useContext(NaturalDeckContext);
  const tex = useLoader(THREE.TextureLoader, natural ? naturalPineDeckAsset.url : roofUndersideAsset.url) as THREE.Texture;
  return useMemo(() => {
    const t = tex.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.center.set(0.5, 0.5);
    // Pine photo grain is vertical; the original plank map grain is horizontal.
    t.rotation = rotate + (natural ? 0 : Math.PI / 2);
    t.repeat.set(repeatX, repeatY);
    t.offset.set(offsetX, offsetY);
    t.anisotropy = 8;
    t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  }, [tex, natural, repeatX, repeatY, rotate, offsetX, offsetY]);
}

export const ShingleScaleContext = createContext<number>(1);
export const ShingleContrastContext = createContext<number>(1.55);
export const PureWhiteShinglesContext = createContext<boolean>(false);
export const ShingleBrightnessContext = createContext<number>(0.92);
export const ShingleSaturateContext = createContext<number>(1.05);
export const ShingleBumpScaleContext = createContext<number>(1.2);
export const ShingleRoughnessContext = createContext<number>(0.95);
/** Color tint applied to the roof underside / deckboard planks.
 *  Use "#ffffff" for no tint (natural plank texture). */
export const DeckStainContext = createContext<string>(NATURAL_PINE_DECK);
const NaturalDeckContext = createContext(true);

/** Load a tileable shingle texture; rotated so courses run along the ridge. */
function useShingleTexture(dimX: number, dimY: number) {
  const scale = useContext(ShingleScaleContext);
  const contrast = useContext(ShingleContrastContext);
  const pureWhite = useContext(PureWhiteShinglesContext);
  const brightness = useContext(ShingleBrightnessContext);
  const saturate = useContext(ShingleSaturateContext);

  // Constant world tile size so shingles look identical regardless of roof size.
  // Base tile ≈ 1.5m at scale=1; smaller scale => larger tiles.
  const s = Math.max(0.01, scale);
  const tileSize = 1.5 / s;
  const rX = Math.max(0.05, dimX / tileSize);
  const rY = Math.max(0.05, dimY / tileSize);

  const tex = useLoader(THREE.TextureLoader, shingleTextureAsset.url) as THREE.Texture;
  return useMemo(() => {
    const src = tex.image as HTMLImageElement | HTMLCanvasElement | undefined;
    let source: TexImageSource = tex.image as TexImageSource;
    if (src && (src as HTMLImageElement).width) {
      const w = (src as HTMLImageElement).width;
      const h = (src as HTMLImageElement).height;
      // Composite a 2x2 grid of the source tile with random horizontal
      // offsets + flips and per-cell tint jitter so the eye can't lock onto
      // the repeat. Plus a low-frequency blob overlay across the whole thing.
      const CELLS = 2;
      const cw = w;
      const ch = h;
      const W = cw * CELLS;
      const H = ch * CELLS;
      const c = document.createElement("canvas");
      c.width = W;
      c.height = H;
      const ctx = c.getContext("2d");
      if (ctx) {
        ctx.filter = pureWhite
          ? `contrast(0.75) brightness(${brightness * 2.01}) saturate(0)`
          : `contrast(${contrast}) brightness(${brightness}) saturate(${saturate})`;
        // deterministic pseudo-random per cell
        const rand = (i: number) => {
          const x = Math.sin(i * 9301 + 49297) * 233280;
          return x - Math.floor(x);
        };
        for (let cy = 0; cy < CELLS; cy++) {
          for (let cx = 0; cx < CELLS; cx++) {
            const idx = cy * CELLS + cx;
            const offX = Math.floor(rand(idx + 1) * cw);
            const flipX = rand(idx + 7) > 0.5;
            ctx.save();
            ctx.translate(cx * cw, cy * ch);
            // tile within the cell, with horizontal offset for course shift
            const scaleX = flipX ? -1 : 1;
            ctx.save();
            if (flipX) {
              ctx.translate(cw, 0);
              ctx.scale(-1, 1);
            }
            // draw twice horizontally to cover the offset wrap
            ctx.drawImage(src as CanvasImageSource, -offX, 0, cw, ch);
            ctx.drawImage(src as CanvasImageSource, cw - offX, 0, cw, ch);
            ctx.restore();
            ctx.restore();
            if (!pureWhite) {
              // subtle per-cell tint to vary weathering
              const tint = rand(idx + 13);
              ctx.save();
              ctx.globalCompositeOperation = "multiply";
              const shade = Math.round(220 + tint * 35); // 220-255
              ctx.fillStyle = `rgb(${shade},${shade - 4},${shade - 8})`;
              ctx.fillRect(cx * cw, cy * ch, cw, ch);
              ctx.restore();
            }
            void scaleX;
          }
        }
        if (!pureWhite) {
          // Low-frequency blob overlay across the composite to break tiling
          ctx.save();
          ctx.globalCompositeOperation = "overlay";
          for (let i = 0; i < 60; i++) {
            const px = rand(i + 101) * W;
            const py = rand(i + 211) * H;
            const r = (0.15 + rand(i + 307) * 0.35) * Math.min(W, H);
            const dark = rand(i + 401) > 0.5;
            const g = ctx.createRadialGradient(px, py, 0, px, py, r);
            if (dark) {
              g.addColorStop(0, "rgba(40,30,20,0.28)");
            } else {
              g.addColorStop(0, "rgba(230,220,200,0.22)");
            }
            g.addColorStop(1, "rgba(128,128,128,0)");
            ctx.fillStyle = g;
            ctx.fillRect(px - r, py - r, r * 2, r * 2);
          }
          ctx.restore();
        }
        source = c;
      }
    }
    const t = new THREE.Texture(source);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.center.set(0.5, 0.5);
    t.rotation = Math.PI / 2;
    // Composite is 2x larger than source tile, so halve the repeats to keep
    // the same world-space tile size.
    t.repeat.set(rX / 2, rY / 2);
    t.anisotropy = 8;
    t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  }, [tex, rX, rY, contrast, pureWhite, brightness, saturate]);
}



/** Per-finish wood texture context. Lets the WoodMaterial switch its base
 *  diffuse map when a rougher finish (e.g. hatchet & hand-peeled) is picked. */
export const WoodFinishContext = createContext<string>("smooth");

/** Global controls for hand-peeled randomization. seed bumps regenerate
 *  the pattern; flipChance (0..1) is the probability a piece is flipped
 *  end-for-end; offsetAmount (0..1) scales the per-piece UV shift. */
export type HandPeeledRandom = { seed: string; flipChance: number; offsetAmount: number; tileScale: number };
export const DEFAULT_HAND_PEELED_RANDOM: HandPeeledRandom = { seed: "v1", flipChance: 0.5, offsetAmount: 1, tileScale: 1 };
export const HandPeeledRandomContext = createContext<HandPeeledRandom>(DEFAULT_HAND_PEELED_RANDOM);

/** Tileable wood texture for all timber surfaces (posts, beams, trusses, braces). */
/** Deterministic 0..1 hash from a string seed. */
function hash01(seed: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

export function useWoodTexture(rotate: number, repeatXMul: number = 1, repeatYMul: number = 1, randomSeed?: string) {
  const hp = useContext(HandPeeledRandomContext);
  const pine = useLoader(THREE.TextureLoader, woodTextureAsset.url) as THREE.Texture;
  const texture = useMemo(() => {
    const t = pine.clone();
    t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping;
    t.center.set(0.5, 0.5);
    const seed = `${hp.seed}:${randomSeed ?? "pine"}`;
    t.rotation = hash01(seed+":flip") < 0.5 ? Math.PI : 0;
    // TimberGrainMapping supplies physical lengthwise UVs on all four sides.
    // Legacy face/category rotations must not turn the grain across a member.
    t.repeat.set(1, 1);
    t.offset.set(hash01(seed+":u"), hash01(seed+":v"));
    t.anisotropy = 16;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  }, [pine, rotate, repeatXMul, repeatYMul, randomSeed, hp.seed]);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

/** Grain rotation offsets (radians) applied per material category from a parent context. */
export type GrainCategory = "post" | "beam" | "rafter" | "truss" | "brace" | "plank";
export type GrainAdjust = Partial<Record<GrainCategory, number>>;
export const GrainAdjustContext = createContext<GrainAdjust>({});

/** Per-piece grain rotation offsets keyed by a unique piece id. Adds on top of
 *  the per-category offset so admins can target an individual truss member. */
export type GrainPieceAdjust = Record<string, number>;
export const GrainPieceContext = createContext<GrainPieceAdjust>({});

/** Per-face grain rotation offsets (radians) keyed by piece id. The array is
 *  indexed by BoxGeometry's material index (0:+x, 1:-x, 2:+y, 3:-y, 4:+z, 5:-z).
 *  Additive on top of the per-piece + per-category offsets. */
export type GrainFaceAdjust = Record<string, number[]>;
export const GrainFaceContext = createContext<GrainFaceAdjust>({});

/** Rake-trim positional offsets in inches, applied in the slope local frame.
 *  x = along the slope (eave→ridge), y = roof normal (up off the panel),
 *  z = outboard (away from the panel, toward the rake edge). */
export type RakeTrimAdjust = { x: number; y: number; z: number };
export const DEFAULT_RAKE_TRIM_ADJUST: RakeTrimAdjust = { x: 0, y: -1, z: -1.25 };
export const DEFAULT_METAL_RAKE_TRIM_ADJUST: RakeTrimAdjust = { x: 0, y: -1.75, z: -1.25 };
export const RakeTrimAdjustContext = createContext<RakeTrimAdjust>(DEFAULT_RAKE_TRIM_ADJUST);
/** When true, the rake-trim pieces on the back gable end are rotated together
 *  180° about the back gable's vertical centerline, as one rigid assembly. */
export const DEFAULT_BACK_RAKE_ROTATE = true;
export const BackRakeRotateContext = createContext<boolean>(DEFAULT_BACK_RAKE_ROTATE);
/** User-controlled rotation (in degrees) applied to the back-gable rake-trim
 *  assembly about the back-gable center pivot. */
export type BackRakeRotation = { x: number; y: number; z: number };

/** Per-individual-plate world-space extra offsets (m). Used by 14′ admin UI
 *  to nudge each decorative truss plate independently. */
export type TrussPlateExtraOffsets = {
  vL: { x: number; y: number; z: number };
  vR: { x: number; y: number; z: number };
  wL: { x: number; y: number; z: number };
  wR: { x: number; y: number; z: number };
  peak: { x: number; y: number; z: number };
};
export const ZERO_TRUSS_PLATE_EXTRA_OFFSETS: TrussPlateExtraOffsets = {
  vL: { x: 0, y: 0, z: 0 },
  vR: { x: 0, y: 0, z: 0 },
  wL: { x: 0, y: 0, z: 0 },
  wR: { x: 0, y: 0, z: 0 },
  peak: { x: 0, y: 0, z: 0 },
};
export const DEFAULT_BACK_RAKE_ROTATION: BackRakeRotation = { x: 0, y: 0, z: 0 };
export const BackRakeRotationContext = createContext<BackRakeRotation>(DEFAULT_BACK_RAKE_ROTATION);

/** Catalog of individually addressable truss web pieces. Symmetric members
 *  are split into left (.l) and right (.r) variants so each side can be
 *  adjusted independently. Drives the per-piece grain menu. */
export const TRUSS_PIECES: Array<{ id: string; label: string; truss: "arch" | "hammer" | "king" | "side" }> = [
  { id: "side.rafter.l",    label: "Side Rafter (left)",       truss: "side" },
  { id: "side.rafter.r",    label: "Side Rafter (right)",      truss: "side" },
  { id: "arch.tie",         label: "Arch · Tie beam",          truss: "arch" },
  { id: "arch.collar",      label: "Arch · Collar tie",        truss: "arch" },
  { id: "arch.kingpost",    label: "Arch · King post",         truss: "arch" },
  { id: "arch.strut.l",     label: "Arch · Strut (left)",      truss: "arch" },
  { id: "arch.strut.r",     label: "Arch · Strut (right)",     truss: "arch" },
  { id: "arch.corbel.l",    label: "Arch · Corbel (left)",     truss: "arch" },
  { id: "arch.corbel.r",    label: "Arch · Corbel (right)",    truss: "arch" },
  { id: "arch.rafter.l",    label: "Arch · Rafter (left)",     truss: "arch" },
  { id: "arch.rafter.r",    label: "Arch · Rafter (right)",    truss: "arch" },
  { id: "arch.wing.l",      label: "Arch · Wing (left)",       truss: "arch" },
  { id: "arch.wing.r",      label: "Arch · Wing (right)",      truss: "arch" },
  { id: "arch.kingpin",     label: "Arch · King pin",          truss: "arch" },
  { id: "hammer.tie",       label: "Hammer · Tie beam",        truss: "hammer" },
  { id: "hammer.kingpost",  label: "Hammer · King post",       truss: "hammer" },
  { id: "hammer.post",      label: "Hammer · Post (stub)",     truss: "hammer" },
  { id: "hammer.strut.l",   label: "Hammer · Strut (left)",    truss: "hammer" },
  { id: "hammer.strut.r",   label: "Hammer · Strut (right)",   truss: "hammer" },
  { id: "hammer.corbel.l",  label: "Hammer · Corbel (left)",   truss: "hammer" },
  { id: "hammer.corbel.r",  label: "Hammer · Corbel (right)",  truss: "hammer" },
  { id: "hammer.drop.l",    label: "Hammer · Drop post (left)",  truss: "hammer" },
  { id: "hammer.drop.r",    label: "Hammer · Drop post (right)", truss: "hammer" },
  { id: "hammer.prince.l",  label: "Hammer · Prince beam (left)",  truss: "hammer" },
  { id: "hammer.prince.r",  label: "Hammer · Prince beam (right)", truss: "hammer" },
  { id: "hammer.rafter.l",  label: "Hammer · Rafter (left)",   truss: "hammer" },
  { id: "hammer.rafter.r",  label: "Hammer · Rafter (right)",  truss: "hammer" },
  { id: "king.tie",         label: "King · Tie beam",          truss: "king" },
  { id: "king.kingpost",    label: "King · King post",         truss: "king" },
  { id: "king.strut.l",     label: "King · Strut (left)",      truss: "king" },
  { id: "king.strut.r",     label: "King · Strut (right)",     truss: "king" },
  { id: "king.rafter.l",    label: "King · Rafter (left)",     truss: "king" },
  { id: "king.rafter.r",    label: "King · Rafter (right)",    truss: "king" },
];

/** Shared material for any wooden surface: texture tinted by the selected wood color.
 *  `vertical` controls grain direction. `category` adds a per-category offset
 *  from context; `piece` adds a further per-piece offset for individual members. */
function WoodMaterial({
  color,
  roughness = 0.85,
  side,
  vertical = false,
  rotation,
  category,
  piece,
  singleMaterial = false,
  faceRepeats,
  tileRepeat,
}: {
  color: string;
  roughness?: number;
  side?: THREE.Side;
  vertical?: boolean;
  rotation?: number;
  category?: GrainCategory;
  piece?: string;
  /** Render a single material instead of a 6-material array. Required for
   *  STL-loaded geometries that have no material groups, otherwise the mesh
   *  fails to render. */
  singleMaterial?: boolean;
  /** Per-face [repeatX, repeatY] multipliers (length 6, box face order
   *  +x, -x, +y, -y, +z, -z). Use to maintain grain aspect on tall/long
   *  pieces by tiling instead of stretching. */
  faceRepeats?: Array<[number, number]>;
  /** Single-material tiling multiplier [U, V]. Used by STL-loaded long
   *  pieces (e.g. the perimeter girder) to keep grain aspect on long runs. */
  tileRepeat?: [number, number];
}) {
  const adjust = useContext(GrainAdjustContext);
  const pieces = useContext(GrainPieceContext);
  const faces = useContext(GrainFaceContext);
  const baseOffset =
    (category ? adjust[category] ?? 0 : 0) + (piece ? pieces[piece] ?? 0 : 0);
  const baseRot = (rotation ?? (vertical ? 0 : Math.PI / 2)) + Math.PI / 2;
  const faceId = piece ?? (category ? `cat:${category}` : "");
  const faceRots = faceId ? faces[faceId] : undefined;
  const fr = (i: number) => (faceRots && faceRots[i] != null ? faceRots[i] : 0);
  // Per-face tiling: honor caller-provided faceRepeats (used by posts and
  // any long box-geom piece) so grain keeps its natural aspect instead of
  // being stretched across the full face.
  const rp = (i: number): [number, number] => {
    if (faceRepeats && faceRepeats[i]) return faceRepeats[i];
    if (singleMaterial && tileRepeat) return tileRepeat;
    return [1, 1];
  };
  const instanceId = useId();
  const finish = useContext(WoodFinishContext);
  const seedBase = `${piece ?? category ?? "timber"}:${instanceId}`;
  // 6 face-specific textures — fixed count, so the hook order is stable.
  const tex0 = useWoodTexture(baseRot + baseOffset + fr(0), rp(0)[0], rp(0)[1], `${seedBase}:0`);
  const tex1 = useWoodTexture(baseRot + baseOffset + fr(1), rp(1)[0], rp(1)[1], `${seedBase}:1`);
  const tex2 = useWoodTexture(baseRot + baseOffset + fr(2), rp(2)[0], rp(2)[1], `${seedBase}:2`);
  const tex3 = useWoodTexture(baseRot + baseOffset + fr(3), rp(3)[0], rp(3)[1], `${seedBase}:3`);
  const tex4 = useWoodTexture(baseRot + baseOffset + fr(4), rp(4)[0], rp(4)[1], `${seedBase}:4`);
  const tex5 = useWoodTexture(baseRot + baseOffset + fr(5), rp(5)[0], rp(5)[1], `${seedBase}:5`);
  const texs = [tex0, tex1, tex2, tex3, tex4, tex5];
  const surface0 = useTimberSurface(tex0, finish);
  const surface1 = useTimberSurface(tex1, finish);
  const surface2 = useTimberSurface(tex2, finish);
  const surface3 = useTimberSurface(tex3, finish);
  const surface4 = useTimberSurface(tex4, finish);
  const surface5 = useTimberSurface(tex5, finish);
  const surfaces = [surface0,surface1,surface2,surface3,surface4,surface5];
  const lightened = useMemo(() => new THREE.Color(color), [color]);
  const pieceKey = piece ? `piece:${piece}` : category ? `cat:${category}` : "";
  const pieceLabel = piece ?? category ?? "";
  // A finish owns its shader as well as its bump map. Recreate the material on
  // finish changes: R3F's onUpdate can otherwise run the previous render's
  // callback while applying new props, leaving the old finish shader active.
  if (singleMaterial) {
    return (
      <meshStandardMaterial
        key={finish}
        map={tex0}
        {...surface0}
        color={lightened}
        side={side}
        onUpdate={(self) => {
          configureTimberMaterial(self, finish);
          if (pieceKey) {
            self.userData.grainKey = `face:${faceId}:0`;
            self.userData.grainLabel = `${pieceLabel}`;
            self.userData.pieceKey = pieceKey;
            self.userData.pieceLabel = pieceLabel;
          }
        }}
      />
    );
  }
  return (
    <>
      {texs.map((tex, i) => (
        <meshStandardMaterial
          key={`${finish}:${i}`}
          attach={`material-${i}`}
          map={tex}
          {...surfaces[i]}
          color={lightened}
          side={side}
          onUpdate={(self) => {
            configureTimberMaterial(self, finish);
            if (pieceKey) {
              self.userData.grainKey = `face:${faceId}:${i}`;
              self.userData.grainLabel = `${pieceLabel} · face ${i}`;
              self.userData.pieceKey = pieceKey;
              self.userData.pieceLabel = pieceLabel;
            }
          }}
        />
      ))}
    </>
  );
}




const FT = 0.3048; // 1 foot in meters

function useWoodColor(id: string) {
  return useMemo(() => WOOD_FINISHES.find((w) => w.id === id)?.hex ?? "#8b5a2b", [id]);
}
function useRoofMat(id: string) {
  return useMemo(
    () => ROOF_MATERIALS.find((r) => r.id === id) ?? ROOF_MATERIALS[0],
    [id],
  );
}

function roofMaterialProps(type: string) {
  if (type === "standing-seam") return { roughness: 0.35, metalness: 0.7 };
  if (type === "metal") return { roughness: 0.45, metalness: 0.55 };
  return { roughness: 0.95, metalness: 0.0 };
}

/** Contrast accent — only brightens *dark* roofs so detail reads. Light
 *  roofs return their original color unchanged. */
function contrastAccent(hex: string, amount = 0.18): string {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  if (hsl.l >= 0.5) return hex; // light roof — no shift
  hsl.l = Math.min(1, hsl.l + amount);
  return new THREE.Color().setHSL(hsl.h, hsl.s, hsl.l).getStyle();
}

/** Shadow accent — gently darkens for dark roofs, near-black for light roofs
 *  (so shingle course lines stay visible on light colors too). */
function shadowAccent(hex: string, amount = 0.4): string {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  hsl.l = Math.max(0, hsl.l * (1 - amount));
  return new THREE.Color().setHSL(hsl.h, hsl.s, hsl.l).getStyle();
}

/** Standing-seam ridges: tall, slim vertical seam with a rounded cap. */
function SeamRidges({
  slopeLen,
  panelDepth,
  spacing = 12 * 0.0254, // 12" on center
  color,
  eaveTrim = 0,
  eaveSign = 1,
}: {
  slopeLen: number;
  panelDepth: number;
  spacing?: number;
  color: string;
  eaveTrim?: number;
  eaveSign?: 1 | -1;
}) {
  const count = Math.max(2, Math.floor(panelDepth / spacing));
  const step = panelDepth / count;
  const start = -panelDepth / 2 + step / 2;
  const effLen = Math.max(0.001, slopeLen - eaveTrim);
  const xOffset = -eaveSign * eaveTrim / 2;

  // Build a curved standing-seam cross-section in the XY plane and extrude
  // along Z = effLen. Mesh is rotated so the extrude axis aligns with X.
  const geom = useMemo(() => {
    const IN = 0.0254;
    const webHalf = 0.18 * IN;   // ~3/8" thick web
    const capHalf = 0.55 * IN;   // ~1-1/8" wide rounded cap
    const baseHalf = 0.45 * IN;  // flared base flashing
    const webH = 1.6 * IN;       // 1.6" tall web
    const capH = 0.35 * IN;      // rounded cap height
    const baseH = 0.05 * IN;     // base flange thickness

    const s = new THREE.Shape();
    s.moveTo(-baseHalf, 0);
    s.lineTo(-webHalf, baseH);
    s.lineTo(-webHalf, webH);
    s.bezierCurveTo(
      -capHalf, webH,
      -capHalf, webH + capH,
      0, webH + capH,
    );
    s.bezierCurveTo(
      capHalf, webH + capH,
      capHalf, webH,
      webHalf, webH,
    );
    s.lineTo(webHalf, baseH);
    s.lineTo(baseHalf, 0);
    s.lineTo(-baseHalf, 0);

    const g = new THREE.ExtrudeGeometry(s, {
      depth: effLen,
      bevelEnabled: false,
      curveSegments: 20,
      steps: 1,
    });
    g.translate(0, 0, -effLen / 2);
    g.rotateY(Math.PI / 2);
    g.computeVertexNormals();
    return g;
  }, [effLen]);

  const items: ReactNode[] = [];
  const seamColor = contrastAccent(color, 0.16);
  for (let i = 0; i < count; i++) {
    const z = start + i * step;
    items.push(
      <mesh key={i} position={[xOffset, 0.025, z]} geometry={geom} castShadow>
        <meshStandardMaterial color={seamColor} roughness={0.3} metalness={0.85} />
      </mesh>,
    );
  }
  return <>{items}</>;
}

/** Load the rake-trim STL once. STL units are millimeters; the profile lies
 *  in the X/Y plane and is extruded along Z (0..200mm). We convert mm→m,
 *  center on the cross-section origin with the top flange at Y=0, then stretch
 *  the Z extrude axis to match the rake length. */
function useRakeTrimGeometry(targetLenM: number, rakeSign: 1 | -1) {
  const raw = useMemo(() => createPartGeometry("rake_trim"), []);
  useEffect(() => () => raw.dispose(), [raw]);
  return useMemo(() => {
    if (!raw) return null;
    const IN = 0.0254;
    const g = raw.clone();
    // mm → meters (STL is modeled in mm)
    g.scale(0.001, 0.001, 0.001);
    g.computeBoundingBox();
    let bb = g.boundingBox!;
    // Scale the cross-section so the fascia face is 3" tall (top to bottom).
    const TARGET_PROFILE_H = 3 * IN;
    const profileH = bb.max.y - bb.min.y;
    const profScale = TARGET_PROFILE_H / Math.max(1e-6, profileH);
    g.scale(profScale, profScale, 1);
    g.computeBoundingBox();
    bb = g.boundingBox!;
    // Place top of profile (max Y in STL) at Y=0, center cross-section on X=0,
    // center extrude on Z=0.
    g.translate(
      -(bb.min.x + bb.max.x) / 2,
      -bb.max.y,
      -(bb.min.z + bb.max.z) / 2,
    );
    g.computeBoundingBox();
    const zExt = g.boundingBox!.max.z - g.boundingBox!.min.z;
    g.scale(1, 1, targetLenM / Math.max(1e-6, zExt));
    // Rotate so STL extrude axis (Z) becomes scene X (along slope).
    g.rotateY(-Math.PI / 2);
    g.computeVertexNormals();


    return g;
  }, [raw, targetLenM, rakeSign]);
}

/** Standing-seam gable rake trim, rendered from a supplied STL profile.
 *  Mounted along the rake edge of a slope, in the slope's local frame
 *  (X = along slope, Y = roof normal, Z = along ridge). */
function RakeTrim({
  slopeLen,
  length,
  eaveTrim = 0,
  eaveSign = 1,
  rakeSign,
  color,
  clipSign,
}: {
  slopeLen: number;
  length: number;
  eaveTrim?: number;
  eaveSign?: 1 | -1;
  rakeSign: 1 | -1;
  color: string;
  /** Override world-space clip plane normal direction (defaults to eaveSign).
   *  Use -eaveSign when this trim is rendered inside a parent that flips X in
   *  world space (e.g. the back-gable assembly's 180° Y rotation). */
  clipSign?: 1 | -1;
}) {
  const adjust = useContext(RakeTrimAdjustContext);
  const IN = 0.0254;
  // Extend each rake by 1.5" at the top (ridge end). In slope-local X, the
  // ridge sits at -eaveSign * slopeLen/2, so shifting center by -eaveSign * extension/2
  // grows the trim toward the ridge while keeping the eave end in place.
  const RIDGE_EXTEND = 1.5 * 0.0254;
  const effLen = Math.max(0.001, slopeLen - eaveTrim + RIDGE_EXTEND);
  const xOffset = -eaveSign * (eaveTrim + RIDGE_EXTEND) / 2 + adjust.x * IN;
  // Sit just above the panel surface (panel top sits ~+0.025 in slope frame),
  // raised an extra 2.75" per the default offset.
  const flangeY = 0.025 + 2.75 * IN + adjust.y * IN;
  // Positive z-adjust pushes the trim outboard regardless of which rake.
  const edgeZ = rakeSign * (length / 2 + adjust.z * IN);
  const geo = useRakeTrimGeometry(effLen, rakeSign);
  const trimColor = contrastAccent(color, 0.16);
  // Plumb cut at the ridge: clip with a vertical world plane through the ridge
  // (world X = 0), keeping only this slope's side. clipSign defaults to
  // eaveSign which matches the slope's world-X sign.
  const planeSign = clipSign ?? eaveSign;
  const clipPlanes = useMemo(
    () => [new THREE.Plane(new THREE.Vector3(planeSign, 0, 0), 0)],
    [planeSign],
  );
  // End cap covers ONLY the part of the trim above the roof panel surface
  // (the standing-seam-height step), not the fascia drop. Panel top sits at
  // slope-local Y ≈ 0.025; trim top sits at flangeY. In geo-local Y the trim
  // top is at 0, so clamp yMin to -(flangeY - 0.025).
  const PANEL_TOP_Y = 0.025;
  const cap = useMemo(() => {
    if (!geo) return null;
    geo.computeBoundingBox();
    const bb = geo.boundingBox!;
    const yMaxGeo = bb.max.y; // = 0 by construction
    const maxDepth = Math.max(0.001, flangeY - PANEL_TOP_Y);
    const yMin = Math.max(bb.min.y, yMaxGeo - maxDepth);
    const yMax = yMaxGeo;
    const zMin = bb.min.z;
    const zMax = bb.max.z - 0.5 * 0.0254; // trim 0.5" off the outboard (front) edge
    return {
      yCenter: (yMin + yMax) / 2,
      yHeight: Math.max(0.001, yMax - yMin),
      zCenter: (zMin + zMax) / 2,
      zDepth: Math.max(0.001, zMax - zMin),
    };
  }, [geo, flangeY]);
  if (!geo || !cap) return null;
  const capThickness = 0.06 * IN; // ~1/16" sheet-metal cap
  // Eave end of the trim (in slope-local X). Geometry is centered on x=0 with
  // length effLen, so the eave-end face sits at +eaveSign * effLen/2.
  const capX = xOffset + eaveSign * (effLen / 2 + capThickness / 2);
  return (
    <>
      <mesh
        position={[xOffset, flangeY, edgeZ]}
        geometry={geo}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color={trimColor}
          roughness={0.32}
          metalness={0.78}
          clippingPlanes={clipPlanes}
          clipShadows
        />
      </mesh>
      {/* Rectangular end cap closing off the eave end of the rake trim */}
      <mesh
        position={[capX, flangeY + cap.yCenter, edgeZ + cap.zCenter]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[capThickness, cap.yHeight, cap.zDepth]} />
        <meshStandardMaterial
          color={trimColor}
          roughness={0.32}
          metalness={0.78}
        />
      </mesh>
    </>
  );
}

/** Back-gable rake-trim assembly. Renders the same front-rake pieces
 *  (rakeSign=1) inside a group rotated 180° about world Y at the origin.
 *  This guarantees identical geometry, materials, clipping, and outboard
 *  offsets to the front — the back is a true mirror of the front. */
function BackRakeAssembly({
  width,
  length,
  slopeLen,
  eaveTrim,
  shiftX,
  shiftY,
  ridgeH,
  angle,
  roofColor,
}: {
  width: number;
  length: number;
  slopeLen: number;
  eaveTrim: number;
  shiftX: number;
  shiftY: number;
  ridgeH: number;
  angle: number;
  roofColor: string;
}) {
  // Subscribe so the toggle still triggers re-renders, but always render the
  // mirrored orientation so back matches front 1:1.
  useContext(BackRakeRotateContext);
  const userRot = useContext(BackRakeRotationContext);
  const DEG = Math.PI / 180;
  // Pivot at the back-gable center (world coordinates). After the inner
  // 180° Y-rotation, the back rake pieces sit around z = -length/2.
  const pivot: [number, number, number] = [0, ridgeH / 2 + shiftY, -length / 2];
  return (
    <group position={pivot} rotation={[userRot.x * DEG, userRot.y * DEG, userRot.z * DEG]}>
      <group position={[-pivot[0], -pivot[1], -pivot[2]]}>
        <group rotation={[0, Math.PI, 0]}>
          {/* Left slope (front-left geometry) — lands at back-right after rotation */}
          <group position={[-width / 4 - shiftX, ridgeH / 2 + shiftY, 0]} rotation={[0, 0, angle]}>
            <RakeTrim slopeLen={slopeLen} length={length} eaveTrim={eaveTrim} eaveSign={-1} rakeSign={1} color={roofColor} clipSign={1} />
          </group>
          {/* Right slope (front-right geometry) — lands at back-left after rotation */}
          <group position={[width / 4 + shiftX, ridgeH / 2 + shiftY, 0]} rotation={[0, 0, -angle]}>
            <RakeTrim slopeLen={slopeLen} length={length} eaveTrim={eaveTrim} eaveSign={1} rakeSign={1} color={roofColor} clipSign={-1} />
          </group>
        </group>
      </group>
    </group>
  );
}

/** Snow guards on standing-seam roof: small clamp-on guards in a zigzag
 *  pattern near the eave, one per seam at alternating up-slope heights. */
function SnowGuards({
  slopeLen,
  panelDepth,
  spacing = 12 * 0.0254,
  color,
  eaveSign = 1,
  roofType = "standing-seam",
}: {
  slopeLen: number;
  panelDepth: number;
  spacing?: number;
  color: string;
  eaveSign?: 1 | -1;
  roofType?: "standing-seam" | "metal";
}) {
  const IN = 0.0254;
  const positions = snowGuardPositions(panelDepth, roofType, spacing);
  // Two staggered rows up-slope from the eave
  const row1X = eaveSign * (slopeLen / 2 - 18 * IN);
  const row2X = eaveSign * (slopeLen / 2 - 26 * IN);


  // Decorative ogee silhouette in the Y (height) × X (across-seam width) plane.
  // Shape is symmetric: two arched feet on each side of a central seam slot,
  // rising to a 3-lobed ogee crest. Extruded along Z then rotated so the
  // plate faces down-slope (toward the eave).
  const { geometry, hubLen } = useMemo(() => {
    const W = 4.6 * IN;          // total width across the seam
    const H = 3.0 * IN;          // overall height
    const footH = 0.85 * IN;     // height of side feet at outer edge
    const shoulderZ = 1.45 * IN; // half-width of the ogee shoulders
    const shoulderY = 1.85 * IN; // height of the side shoulders
    const slotW = 1.16 * IN;     // width of central seam slot
    const slotH = 1.7 * IN;     // height of seam slot
    const archOver = 0.45 * IN;  // how high the slot's arch rises

    const s = new THREE.Shape();
    // bottom-left outer corner, going CCW
    s.moveTo(-W / 2, 0);
    s.lineTo(-slotW / 2, 0);
    s.lineTo(-slotW / 2, slotH);
    // arch over the seam slot
    s.quadraticCurveTo(0, slotH + archOver, slotW / 2, slotH);
    s.lineTo(slotW / 2, 0);
    s.lineTo(W / 2, 0);
    // up right outer edge to top of foot
    s.lineTo(W / 2, footH);
    // ogee curve from foot up to right shoulder lobe
    s.bezierCurveTo(
      W / 2, footH + 0.7 * IN,
      shoulderZ + 0.35 * IN, shoulderY - 0.1 * IN,
      shoulderZ, shoulderY,
    );
    // up & over to central peak
    s.bezierCurveTo(
      shoulderZ - 0.15 * IN, H,
      0.45 * IN, H,
      0, H - 0.05 * IN,
    );
    // mirror to left shoulder
    s.bezierCurveTo(
      -0.45 * IN, H,
      -shoulderZ + 0.15 * IN, H,
      -shoulderZ, shoulderY,
    );
    // down to left foot top
    s.bezierCurveTo(
      -shoulderZ - 0.35 * IN, shoulderY - 0.1 * IN,
      -W / 2, footH + 0.7 * IN,
      -W / 2, footH,
    );
    s.lineTo(-W / 2, 0);

    const depth = 0.55 * IN; // plate thickness (along up-slope)
    const geo = new THREE.ExtrudeGeometry(s, {
      depth,
      bevelEnabled: true,
      bevelThickness: 0.08 * IN,
      bevelSize: 0.08 * IN,
      bevelSegments: 4,
      curveSegments: 24,
    });
    // Center extrusion along its depth axis (Z)
    geo.translate(0, 0, -depth / 2);
    return { geometry: geo, hubLen: 1.4 * IN };
  }, [IN]);

  const mat = (
    <meshStandardMaterial color={color} roughness={0.42} metalness={0.55} />
  );

  const items: ReactNode[] = [];
  for (let i = 0; i < positions.length; i++) {
    const z = positions[i];
    const x = i % 2 === 0 ? row1X : row2X;

    items.push(
      <group key={i} position={[x, 0.026, z]}>
        {/* Rotate so the decorative plate faces down-slope toward the eave.
            Extrusion (+Z local) maps to up-slope on the roof. */}
        <group rotation={[0, eaveSign * Math.PI / 2, 0]}>
          <mesh castShadow receiveShadow geometry={geometry}>
            {mat}
          </mesh>
          {/* Cylindrical hub / mounting boss on the up-slope back face */}
          <mesh
            castShadow
            position={[0, 1.6 * IN, -hubLen / 2 - 0.25 * IN]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[0.55 * IN, 0.55 * IN, hubLen, 24]} />
            {mat}
          </mesh>
          {/* Small set-screw dimple on the hub */}
          <mesh
            position={[0.4 * IN, 1.6 * IN, -hubLen - 0.05 * IN]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[0.08 * IN, 0.08 * IN, 0.12 * IN, 12]} />
            <meshStandardMaterial color="#222" roughness={0.6} metalness={0.4} />
          </mesh>
        </group>
      </group>,
    );
  }
  return <>{items}</>;
}

/** Snow rail: STL-loaded continuous rail running along the roof length near
 *  the eave. Always rendered in the roofing material's color. */
export type SnowRailAdjust = {
  scale: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number }; // radians
  position: { x: number; y: number; z: number }; // inches
};
export const DEFAULT_SNOW_RAIL_ADJUST: SnowRailAdjust = {
  scale: { x: 1, y: 1, z: 1 },
  rotation: { x: 0, y: 0, z: 0 },
  position: { x: 0, y: 0, z: 0 },
};
export const SnowRailAdjustContext = createContext<SnowRailAdjust>(DEFAULT_SNOW_RAIL_ADJUST);

function SnowRail({
  slopeLen,
  panelDepth,
  color,
  eaveSign = 1,
}: {
  slopeLen: number;
  panelDepth: number;
  color: string;
  eaveSign?: 1 | -1;
}) {
  const IN = 0.0254;
  const adjust = useContext(SnowRailAdjustContext);
  const raw = useMemo(() => createPartGeometry("snowrail"), []);
  useEffect(() => () => raw.dispose(), [raw]);

  const geometry = useMemo(() => {
    if (!raw) return null;
    const g = raw.clone();
    g.computeBoundingBox();
    const bb = g.boundingBox!;
    const sx = bb.max.x - bb.min.x;
    const sy = bb.max.y - bb.min.y;
    const sz = bb.max.z - bb.min.z;
    // Center
    g.translate(-(bb.min.x + sx / 2), -(bb.min.y + sy / 2), -(bb.min.z + sz / 2));
    // STL axes: Y = long (length), X = across-slope width, Z = height.
    // Target: blade height ~3", base width keeps proportion, length = panelDepth.
    const targetHeight = 3 * IN;
    const crossScale = targetHeight / sz;
    // Always 16" shorter than the roof (8" inset on each end), centered.
    const targetLen = snowRailLength(panelDepth);
    const lenScale = targetLen / sy / Math.max(0.001, Math.abs(adjust.scale.y));
    g.scale(crossScale, lenScale, crossScale);
    g.computeVertexNormals();
    return g;
  }, [raw, panelDepth, adjust.scale.y]);
  if (!geometry) return null;

  // Position near eave, on the roof surface. Local frame: X = across-slope,
  // Y = surface normal, Z = along-ridge. Outer group: rotate STL into the
  // roof-surface frame. Inner group: user adjustments (scale + extra rotation).
  const x = eaveSign * (slopeLen / 2 - 26 * IN);
  // User-position offset is in inches; X applied along across-slope axis
  // (post-rotation that's the outer group's X), Y is roof-surface normal,
  // Z is along ridge.
  const px = eaveSign * (adjust.position.x * IN);
  const py = adjust.position.y * IN;
  const pz = adjust.position.z * IN;
  return (
    <group position={[x + px, 0.005 + py, pz]} rotation={[Math.PI / 2, 0, 0]} scale={[eaveSign, 1, 1]}>
      <group
        scale={[adjust.scale.x, adjust.scale.y, adjust.scale.z]}
        rotation={[adjust.rotation.x, adjust.rotation.y, adjust.rotation.z]}
      >
        <mesh castShadow receiveShadow geometry={geometry}>
          <meshStandardMaterial color={color} roughness={0.42} metalness={0.55} />
        </mesh>
      </group>
    </group>
  );
}

/** Load the shingle-caps STL once. STL units are mm; recenter so the cap sits
 *  with its base at local Y=0, centered on X (across the ridge) and Z (along
 *  the ridge), converted to scene meters. */
function useShingleCapGeometry() {
  const raw = useMemo(() => createPartGeometry("shingle_caps2"), []);
  useEffect(() => () => raw.dispose(), [raw]);
  return useMemo(() => {
    if (!raw) return null;
    const g = raw.clone();
    const MM_TO_M = 0.001 * 3;
    g.scale(MM_TO_M, MM_TO_M, MM_TO_M);
    g.computeBoundingBox();
    const bb = g.boundingBox!;
    // STL X (long axis) → scene Z (along ridge). STL Y → scene Y (up). STL Z → scene X (across ridge).
    // Recenter: X mid→0, Y min→0 (base on ridge), Z mid→0.
    g.translate(
      -(bb.min.x + bb.max.x) / 2,
      -bb.min.y,
      -(bb.min.z + bb.max.z) / 2,
    );
    // Remap axes: rotate so long X becomes Z.
    g.rotateY(Math.PI / 2);
    g.computeBoundingBox();
    // UVs from local X/Z for shingle texture mapping.
    const bb2 = g.boundingBox!;
    const sx = Math.max(1e-6, bb2.max.x - bb2.min.x);
    const sz = Math.max(1e-6, bb2.max.z - bb2.min.z);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const uvs = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      uvs[i * 2] = (pos.getX(i) - bb2.min.x) / sx;
      uvs[i * 2 + 1] = (pos.getZ(i) - bb2.min.z) / sz;
    }
    g.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    g.computeVertexNormals();
    return g;
  }, [raw]);
}

/** Shingle ridge cap: tile the STL cap unit along the ridge to cover ridgeLen. */
function ShingleRidgeCap({
  ridgeLen,
  ridgeH,
  color,
  matProps,
}: {
  ridgeLen: number;
  ridgeH: number;
  color: string;
  matProps: Record<string, unknown>;
}) {
  const geo = useShingleCapGeometry();
  const rotDeg = useContext(ShingleCapRotationContext);
  const capScale = useContext(ShingleCapScaleContext);
  const capOffset = useContext(ShingleCapOffsetContext);
  const capTexScale = useContext(ShingleCapTextureScaleContext);

  const baseSegLen = useMemo(() => {
    if (!geo) return 0;
    geo.computeBoundingBox();
    const bb = geo.boundingBox!;
    return bb.max.z - bb.min.z;
  }, [geo]);
  // Clip cap ends flush to the roof length along Z
  const clipPlanes = useMemo(
    () => [
      new THREE.Plane(new THREE.Vector3(0, 0, 1), ridgeLen / 2),
      new THREE.Plane(new THREE.Vector3(0, 0, -1), ridgeLen / 2),
    ],
    [ridgeLen],
  );
  const sx = Math.max(0.01, capScale.x);
  const sy = Math.max(0.01, capScale.y);
  const sRidge = sx;
  const segLen = Math.max(0.01, baseSegLen * sRidge);
  const tsx = Math.max(0.0001, capTexScale.x);
  const tsy = Math.max(0.0001, capTexScale.y);
  const tsz = Math.max(0, capTexScale.z);
  // Match the roof shingle tint/courses; X/Y sliders scale the visible
  // shingle pattern footprint on the caps (larger value => larger tiles).
  const baseShingleTex = useShingleTexture((0.3 * sx) / tsx, segLen / tsy);
  const shingleTex = useMemo(() => {
    const t = baseShingleTex.clone();
    t.center.set(0.5, 0.5);
    t.rotation = baseShingleTex.rotation + Math.PI / 2;
    t.needsUpdate = true;
    return t;
  }, [baseShingleTex]);
  const bumpMap = useLoader(THREE.TextureLoader, pebblesAsset.url) as THREE.Texture;
  const capBump = useMemo(() => {
    const t = bumpMap.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2 / tsx, 1.5 / tsy);
    t.anisotropy = 8;
    t.needsUpdate = true;
    return t;
  }, [bumpMap, tsx, tsy]);
  const capDiffuseMap = useLoader(THREE.TextureLoader, capPebblesAsset.url) as THREE.Texture;
  const capDiffuse = useMemo(() => {
    // Convert pebble texture to grayscale so the meshStandard `color` tint
    // (driven by the roof color in the sidebar) shows through cleanly while
    // preserving the pebble pattern/detail.
    const src = capDiffuseMap.image as HTMLImageElement | HTMLCanvasElement | ImageBitmap | undefined;
    let tex: THREE.Texture;
    if (src && typeof document !== "undefined") {
      const w = (src as HTMLImageElement).width || 1024;
      const h = (src as HTMLImageElement).height || 1024;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(src as CanvasImageSource, 0, 0, w, h);
      const img = ctx.getImageData(0, 0, w, h);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        // Lift midtones so the color tint reads as the selected color
        // rather than being darkened by the original brown pebble shade.
        const v = Math.min(255, y * 1.4 + 40);
        d[i] = d[i + 1] = d[i + 2] = v;
      }
      ctx.putImageData(img, 0, 0);
      tex = new THREE.CanvasTexture(canvas);
    } else {
      tex = capDiffuseMap.clone();
    }
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set((2 / tsx) * 15, (1.5 / tsy) * 15);
    tex.anisotropy = 8;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }, [capDiffuseMap, tsx, tsy]);
  if (!geo || baseSegLen <= 0) return null;
  const count = Math.max(1, Math.ceil(ridgeLen / segLen));
  const total = count * segLen;
  const startZ = -total / 2 + segLen / 2;
  const rot = (rotDeg * Math.PI) / 180;

  const items: ReactNode[] = [];
  for (let i = 0; i < count; i++) {
    items.push(
      <mesh
        key={`shingle-cap-${i}`}
        geometry={geo}
        position={[capOffset.x, ridgeH + 0.001 + capOffset.y, startZ + i * segLen + capOffset.z]}
        rotation={[0, 0, rot]}
        scale={[sx, sy, sRidge]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          key={`mat-${tsx.toFixed(3)}-${tsy.toFixed(3)}-${tsz.toFixed(3)}`}
          color={color}
          {...matProps}
          map={capDiffuse}
          bumpMap={capBump}
          bumpScale={0.5 * tsz}


          clippingPlanes={clipPlanes}
          clipShadows
        />
      </mesh>
    );
  }
  return <>{items}</>;
}





/** Sheet-metal ridge cap. Cross-section per side (from peak outward):
 *   4-11/16" along the roof pitch, 1/2" kink, 5" hem — mirrored at the peak.
 *  Runs the full length of the ridge. */
function MetalRidgeCap({
  ridgeLen,
  angle,
  color,
}: {
  ridgeLen: number;
  angle: number;
  color: string;
}) {
  const IN = 0.0254;
  const thick = 0.5 * IN;
  // [segment length in inches, extra angle offset (steeper kink)]
  const segs: Array<[number, number]> = [
    [4.6875, 0],
    [0.5, (12 * Math.PI) / 180],
    [5, 0],
  ];
  const items: ReactNode[] = [];
  const leftPts: Array<[number, number]> = [[0, 0]];
  const rightPts: Array<[number, number]> = [[0, 0]];
  for (const side of [-1, 1] as const) {
    let x = 0;
    let y = 0;
    segs.forEach(([segIn, kink], i) => {
      const a = angle + kink;
      const dx = -Math.cos(a) * side;
      const dy = -Math.sin(a);
      const segLen = segIn * IN;
      const cx = x + (dx * segLen) / 2;
      const cy = y + (dy * segLen) / 2;
      items.push(
        <mesh
          key={`cap-${side}-${i}`}
          position={[cx, cy, 0]}
          rotation={[0, 0, Math.atan2(dy, dx)]}
          castShadow
        >
          <boxGeometry args={[segLen, thick, ridgeLen]} />
          <meshStandardMaterial color={color} roughness={0.4} metalness={0.65} />
        </mesh>,
      );
      x += dx * segLen;
      y += dy * segLen;
      (side === -1 ? rightPts : leftPts).push([x, y]);
    });
  }

  // Flat end caps that close off the open ends of the ridge cap profile.
  const endShape = new THREE.Shape();
  const profile = [...leftPts.slice().reverse(), ...rightPts.slice(1)];
  endShape.moveTo(profile[0][0], profile[0][1] + thick / 2);
  for (let i = 1; i < profile.length; i++) {
    endShape.lineTo(profile[i][0], profile[i][1] + thick / 2);
  }
  for (let i = profile.length - 1; i >= 0; i--) {
    endShape.lineTo(profile[i][0], profile[i][1] - thick / 2);
  }
  endShape.closePath();

  for (const end of [-1, 1] as const) {
    items.push(
      <mesh
        key={`endcap-${end}`}
        position={[0, 0, (end * ridgeLen) / 2 + (end === 1 ? 0 : -thick)]}
        castShadow
      >
        <extrudeGeometry args={[endShape, { depth: thick, bevelEnabled: false }]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.65} side={THREE.DoubleSide} />
      </mesh>,
    );
  }

  return <>{items}</>;
}




/** Ag-panel metal roof: 36" coverage, 9" o.c. ribs ~3/4" tall, trapezoidal. */
function MetalRibs({
  slopeLen,
  panelDepth,
  color,
  eaveTrim = 0,
  eaveSign = 1,
}: {
  slopeLen: number;
  panelDepth: number;
  color: string;
  eaveTrim?: number;
  eaveSign?: 1 | -1;
}) {
  const spacing = 9 * 0.0254; // 9" on center
  const count = Math.max(2, Math.floor(panelDepth / spacing) + 1);
  const step = spacing;
  const start = -((count - 1) * step) / 2;
  const effLen = Math.max(0.001, slopeLen - eaveTrim);
  const xOffset = -eaveSign * eaveTrim / 2;

  const geom = useMemo(() => {
    const IN = 0.0254;
    const halfBase = 0.9 * IN;
    const halfTop = 0.32 * IN;
    const h = 0.75 * IN;
    const shoulder = 0.25 * IN;

    const s = new THREE.Shape();
    s.moveTo(-halfBase, 0);
    s.bezierCurveTo(
      -halfBase + shoulder * 0.2, 0,
      -halfTop - shoulder * 0.6, h - shoulder * 0.2,
      -halfTop, h,
    );
    s.quadraticCurveTo(0, h + 0.04 * IN, halfTop, h);
    s.bezierCurveTo(
      halfTop + shoulder * 0.6, h - shoulder * 0.2,
      halfBase - shoulder * 0.2, 0,
      halfBase, 0,
    );
    s.lineTo(-halfBase, 0);

    const g = new THREE.ExtrudeGeometry(s, {
      depth: effLen,
      bevelEnabled: false,
      curveSegments: 24,
      steps: 1,
    });
    g.translate(0, 0, -effLen / 2);
    g.rotateY(Math.PI / 2);
    g.computeVertexNormals();
    return g;
  }, [effLen]);

  const items = [];
  const ribColor = contrastAccent(color, 0.16);
  for (let i = 0; i < count; i++) {
    const z = start + i * step;
    items.push(
      <mesh key={`r-${i}`} position={[xOffset, 0.025, z]} geometry={geom} castShadow>
        <meshStandardMaterial color={ribColor} roughness={0.35} metalness={0.8} />
      </mesh>,
    );
  }

  const screwR = 0.35 * 0.0254;
  const screwH = 0.18 * 0.0254;
  const screwRowSpacing = 24 * 0.0254;
  const screwRows = Math.max(2, Math.round(effLen / screwRowSpacing));
  const rowStep = effLen / screwRows;
  const rowStart = -effLen / 2 + rowStep / 2 + xOffset;
  for (let i = 0; i < count - 1; i++) {
    const zFlat = start + i * step + 1.25 * 0.0254;
    for (let j = 0; j < screwRows; j++) {
      const x = rowStart + j * rowStep;
      items.push(
        <mesh
          key={`sc-${i}-${j}`}
          position={[x, 0.025 + screwH / 2, zFlat]}
          rotation={[0, Math.PI / 6, 0]}
          castShadow
        >
          <cylinderGeometry args={[screwR, screwR, screwH, 6]} />
          <meshStandardMaterial color={new THREE.Color(color).multiplyScalar(0.65)} roughness={0.45} metalness={0.75} />
        </mesh>,
      );
    }
  }
  return <>{items}</>;

}

/** Architectural shingle courses: staggered tabs with subtle shadow lines. */
function ShingleCourses({
  slopeLen,
  panelDepth,
  color,
}: {
  slopeLen: number;
  panelDepth: number;
  color: string;
}) {
  const courseH = 6 * 0.0254; // 6" exposure per course
  const count = Math.max(2, Math.floor(panelDepth / courseH));
  const step = panelDepth / count;
  const start = -panelDepth / 2 + step / 2;
  const tabW = 12 * 0.0254; // 12" tabs
  // Derived shadow that stays visible on both dark and light shingles
  const shadow = shadowAccent(color, 0.45);
  const highlight = contrastAccent(color, 0.12);
  const tabThick = 0.008; // raised tab thickness
  // Darken color slightly for shadow band
  const items: ReactNode[] = [];
  for (let i = 0; i < count; i++) {
    const z = start + i * step;
    // course slab (slightly raised)
    items.push(
      <mesh key={`c-${i}`} position={[0, 0.026 + tabThick / 2, z]} castShadow>
        <boxGeometry args={[slopeLen, tabThick, step * 0.95]} />
        <meshStandardMaterial color={color} roughness={0.95} />
      </mesh>,
    );
    // shadow line at bottom edge of course (thicker for visibility on dark roofs)
    items.push(
      <mesh key={`sh-${i}`} position={[0, 0.027 + tabThick, z - step / 2 + 0.004]}>
        <boxGeometry args={[slopeLen, 0.0015, 0.012]} />
        <meshStandardMaterial color={shadow} roughness={1} />
      </mesh>,
    );
    // highlight line at top edge of course — keeps courses readable on dark roofs
    items.push(
      <mesh key={`hl-${i}`} position={[0, 0.0272 + tabThick, z + step / 2 - 0.004]}>
        <boxGeometry args={[slopeLen, 0.0012, 0.005]} />
        <meshStandardMaterial color={highlight} roughness={0.9} />
      </mesh>,
    );
    // tab cutouts (staggered) - thicker darker vertical lines
    const offset = (i % 2) * (tabW / 2);
    const tabCount = Math.max(2, Math.floor(slopeLen / tabW));
    const tabStep = slopeLen / tabCount;
    const tabStart = -slopeLen / 2 + tabStep / 2 + offset;
    for (let j = 0; j < tabCount; j++) {
      const x = tabStart + j * tabStep;
      if (x < -slopeLen / 2 || x > slopeLen / 2) continue;
      items.push(
        <mesh key={`t-${i}-${j}`} position={[x, 0.027 + tabThick, z]}>
          <boxGeometry args={[0.01, 0.0015, step * 0.9]} />
          <meshStandardMaterial color={shadow} roughness={1} />
        </mesh>,
      );
    }
  }
  return <>{items}</>;
}

function Post({
  x,
  z,
  height,
  color,
}: {
  x: number;
  z: number;
  height: number;
  style: import("@/lib/pavilion-config").PostStyle;
  color: string;
}) {
  const thickness = 7.5 * 0.0254; // 8" square
  const vRep = Math.max(1, height / thickness);
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, height / 2, 0]} castShadow>
        <boxGeometry args={[thickness, height, thickness]} />
        <WoodMaterial
          color={color}
          roughness={0.8}
          category="post"
          vertical
          faceRepeats={[
            [1, vRep], // +x side
            [1, vRep], // -x side
            [1, 1],    // +y top
            [1, 1],    // -y bottom
            [1, vRep], // +z side
            [1, vRep], // -z side
          ]}
        />
      </mesh>
    </group>
  );
}

/** Manufacture the rounded steel base. Drawing Z is up; X/Y are its footprint.
 *  Scaled uniformly so the larger horizontal dimension equals `targetWidthM`. */
function usePostBaseGeometry(targetWidthM: number) {
  const raw = useMemo(() => createPartGeometry("post_base"), []);
  useEffect(() => () => raw.dispose(), [raw]);
  return useMemo(() => {
    if (!raw) return null;
    const g = raw.clone();
    g.computeBoundingBox();
    const bb = g.boundingBox!;
    // Recenter horizontally on origin, place bottom (min Z) at Y=0 after we
    // rotate Z-up → Y-up by swapping axes via geometry rotation below.
    g.translate(-(bb.min.x + bb.max.x) / 2, -(bb.min.y + bb.max.y) / 2, -bb.min.z);
    // Rotate so STL +Z (up) becomes scene +Y (up).
    g.rotateX(-Math.PI / 2);
    g.computeBoundingBox();
    const bb2 = g.boundingBox!;
    const xExt = bb2.max.x - bb2.min.x;
    const zExt = bb2.max.z - bb2.min.z;
    const horiz = Math.max(xExt, zExt);
    const s = targetWidthM / horiz;
    g.scale(s, s, s);
    g.computeVertexNormals();
    g.computeBoundingBox();
    // UVs from local X/Z for grain on the horizontal footprint.
    const bb3 = g.boundingBox!;
    const sx = Math.max(1e-6, bb3.max.x - bb3.min.x);
    const sz = Math.max(1e-6, bb3.max.z - bb3.min.z);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const uvs = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      uvs[i * 2] = (pos.getX(i) - bb3.min.x) / sx;
      uvs[i * 2 + 1] = (pos.getZ(i) - bb3.min.z) / sz;
    }
    g.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    return g;
  }, [raw, targetWidthM]);
}

function PostBase({ x, z, scale = 1 }: { x: number; z: number; scale?: number }) {
  const geo = usePostBaseGeometry(8.25 * 0.0254 * scale); // 8.25" wide × scale
  if (!geo) return null;
  return (
    <mesh position={[x, 0, z]} geometry={geo} castShadow receiveShadow>
      <meshStandardMaterial color="#202326" metalness={0.15} roughness={0.68} />
    </mesh>
  );
}


/** Load the corvel-brace STL once. STL units are inches; elbow corner is
 *  recentered to the local origin (horizontal leg in +X, vertical leg in -Y,
 *  thickness centered on Z), converted to scene meters, then uniformly
 *  scaled so the horizontal leg is `targetLenM` meters long. */
function useCorvelBraceGeometry(targetDiagonalM: number) {
  const raw = useMemo(() => createPartGeometry("corvel_brace_v2"), []);
  useEffect(() => () => raw.dispose(), [raw]);
  return useMemo(() => {
    if (!raw) return null;
    const g = raw.clone();
    g.computeBoundingBox();
    const bb = g.boundingBox!;
    // Inches → meters. Recenter so elbow corner sits at local origin with
    // horizontal leg in +X, vertical leg hanging in -Y, thickness centered Z.
    const IN_TO_M = 0.0254;
    g.translate(-bb.min.x, -bb.max.y, -(bb.min.z + bb.max.z) / 2);
    g.scale(IN_TO_M, IN_TO_M, IN_TO_M);
    g.computeBoundingBox();
    // Size from furthest-apart points: scale uniformly so the X/Y diagonal
    // (elbow tip to far horizontal tip) equals targetDiagonalM.
    const xExt = g.boundingBox!.max.x - g.boundingBox!.min.x;
    const yExt = g.boundingBox!.max.y - g.boundingBox!.min.y;
    const curDiag = Math.hypot(xExt, yExt);
    const s = targetDiagonalM / curDiag;
    g.scale(s, s, s);
    // Force brace thickness (Z) to exactly 5.5" regardless of STL proportions.
    g.computeBoundingBox();
    const curW = g.boundingBox!.max.z - g.boundingBox!.min.z;
    const targetW = 5.5 * 0.0254;
    g.scale(1, 1, targetW / curW);
    g.computeVertexNormals();
    g.computeBoundingBox();
    // UVs from local X/Y so the grain reads like a beam face.
    const bb2 = g.boundingBox!;
    const sx = Math.max(1e-6, bb2.max.x - bb2.min.x);
    const sy = Math.max(1e-6, bb2.max.y - bb2.min.y);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const uvs = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      uvs[i * 2] = (pos.getX(i) - bb2.min.x) / sx;
      uvs[i * 2 + 1] = (pos.getY(i) - bb2.min.y) / sy;
    }
    g.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    return g;
  }, [raw, targetDiagonalM]);
}

/** Load the user-supplied truss-plate STL. Recenters at origin, scales so the
 *  largest XY extent equals `targetSizeM`, and forces Z thickness to ~0.5". */
function usePlateGeometry(url: string, targetSizeM: number) {
  const raw = useMemo(() => createPartGeometry(url), [url]);
  useEffect(() => () => raw.dispose(), [raw]);
  return useMemo(() => {
    if (!raw) return null;
    const g = raw.clone();
    g.computeBoundingBox();
    let bb = g.boundingBox!;
    g.translate(-(bb.min.x + bb.max.x) / 2, -(bb.min.y + bb.max.y) / 2, -(bb.min.z + bb.max.z) / 2);
    g.computeBoundingBox();
    bb = g.boundingBox!;
    const xExt = bb.max.x - bb.min.x;
    const yExt = bb.max.y - bb.min.y;
    const maxXY = Math.max(xExt, yExt);
    const s = targetSizeM / maxXY;
    g.scale(s, s, s);
    // Force thickness to ~0.5" so it reads as a steel plate
    g.computeBoundingBox();
    const zExt = g.boundingBox!.max.z - g.boundingBox!.min.z;
    const targetZ = 0.5 * 0.0254;
    g.scale(1, 1, targetZ / Math.max(zExt, 1e-6));
    g.computeVertexNormals();
    return g;
  }, [raw, targetSizeM]);
}

function useTrussPlateVGeometry(targetSizeM: number) {
  return usePlateGeometry("truss_plateV2", targetSizeM);
}

function useWebPlateGeometry(targetSizeM: number) {
  return usePlateGeometry("truss_platewac", targetSizeM);
}

function usePeakPlateGeometry(targetSizeM: number) {
  return usePlateGeometry("truss_platepeak", targetSizeM);
}

function TrussPlateSTL({
  position,
  rotationZ = 0,
  mirror = false,
  sizeM,
  depth,
  offset = { x: 0, y: 0, z: 0 },
  rotation = { x: 0, y: 0, z: 0 },
  sizeScale = 1,
}: {
  position: [number, number];
  rotationZ?: number;
  mirror?: boolean;
  sizeM: number;
  depth: number;
  offset?: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
  sizeScale?: number;
}) {
  const geom = useTrussPlateVGeometry(sizeM);
  if (!geom) return null;
  // Apply true mirror by rotating the plate 180° about Y. Slider offsets/
  // rotations are authored in the un-mirrored (right-side) frame and then
  // mirrored along with the plate so both sides look identical.
  return (
    <group position={[position[0], position[1], 0]} rotation={[0, mirror ? Math.PI : 0, rotationZ]}>
      <group
        position={[offset.x, offset.y, offset.z]}
        rotation={[rotation.x, rotation.y, rotation.z]}
        scale={sizeScale}
      >
        {([1, -1] as const).map((face) => (
          <mesh
            key={face}
            geometry={geom}
            position={[0, 0, face * (depth / 2 + 0.5 * 0.0254 / 2)]}
            scale={[1, 1, face]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial color="#141414" roughness={0.4} metalness={0.85} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function WebPlateSTL({
  position,
  mirror = false,
  sizeM,
  depth,
  offset = { x: 0, y: 0, z: 0 },
  rotation = { x: 0, y: 0, z: 0 },
  sizeScale = 1,
}: {
  position: [number, number];
  mirror?: boolean;
  sizeM: number;
  depth: number;
  offset?: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
  sizeScale?: number;
}) {
  const geom = useWebPlateGeometry(sizeM);
  if (!geom) return null;
  return (
    <group position={[position[0], position[1], 0]} rotation={[0, mirror ? Math.PI : 0, 0]}>
      <group
        position={[offset.x, offset.y, offset.z]}
        rotation={[rotation.x, rotation.y, rotation.z]}
        scale={sizeScale}
      >
        {([1, -1] as const).map((face) => (
          <mesh
            key={face}
            geometry={geom}
            position={[0, 0, face * (depth / 2 + 0.5 * 0.0254 / 2)]}
            scale={[1, 1, face]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial color="#141414" roughness={0.4} metalness={0.85} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function PeakPlateSTL({
  position,
  sizeM,
  depth,
  offset = { x: 0, y: 0, z: 0 },
  rotation = { x: 0, y: 0, z: 0 },
  sizeScale = 1,
  faces = [1, -1],
}: {
  position: [number, number];
  sizeM: number;
  depth: number;
  offset?: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
  sizeScale?: number;
  /** Which sides of the truss to render the plate on. +1 = +Z, -1 = -Z. */
  faces?: ReadonlyArray<1 | -1>;
}) {
  const geom = usePeakPlateGeometry(sizeM);
  if (!geom) return null;
  return (
    <group position={[position[0], position[1], 0]}>
      {faces.map((face) => (
        <group
          key={face}
          position={[offset.x, offset.y, offset.z * face]}
          rotation={[rotation.x, rotation.y, rotation.z]}
          scale={sizeScale}
        >
          <mesh
            geometry={geom}
            position={[0, 0, face * (depth / 2 + 0.5 * 0.0254 / 2)]}
            scale={[1, 1, face]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial color="#141414" roughness={0.4} metalness={0.85} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

const LARGE_RUNTIME_SPAN_M = 21 * 0.3048;
const isLargeRuntimeSpan = (span: number) => span > LARGE_RUNTIME_SPAN_M;

function BeamBetween({
  start,
  end,
  thickness,
  depth,
  color,
  piece,
}: {
  start: [number, number];
  end: [number, number];
  thickness: number;
  depth: number;
  color: string;
  piece: string;
}) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const len = Math.hypot(dx, dy);
  const mid: [number, number, number] = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2, 0];
  const rot = Math.atan2(dy, dx) - Math.PI / 2;
  return (
    <mesh position={mid} rotation={[0, 0, rot]} castShadow receiveShadow>
      <boxGeometry args={[thickness, len, depth]} />
      <WoodMaterial color={color} category="truss" piece={piece} vertical />
    </mesh>
  );
}

function CurvedTimber({
  start,
  control,
  end,
  radius,
  color,
  piece,
}: {
  start: [number, number];
  control: [number, number];
  end: [number, number];
  radius: number;
  color: string;
  piece: string;
}) {
  const geom = useMemo(() => {
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(start[0], start[1], 0),
      new THREE.Vector3(control[0], control[1], 0),
      new THREE.Vector3(end[0], end[1], 0),
    );
    const g = new THREE.TubeGeometry(curve, 28, radius, 10, false);
    g.computeVertexNormals();
    return g;
  }, [start[0], start[1], control[0], control[1], end[0], end[1], radius]);
  return (
    <mesh geometry={geom} castShadow receiveShadow>
      <WoodMaterial color={color} category="truss" piece={piece} singleMaterial tileRepeat={[3, 0.8]} />
    </mesh>
  );
}

function SteelRectPlate({
  position,
  zPush,
  width,
  height,
  rotationZ = 0,
  faces = [1, -1],
}: {
  position: [number, number];
  zPush: number;
  width: number;
  height: number;
  rotationZ?: number;
  faces?: ReadonlyArray<1 | -1>;
}) {
  return (
    <>
      {faces.map((face) => (
        <mesh
          key={face}
          position={[position[0], position[1], face * zPush]}
          rotation={[0, 0, rotationZ]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[width, height, 0.5 * 0.0254]} />
          <meshStandardMaterial color="#141414" roughness={0.4} metalness={0.85} />
        </mesh>
      ))}
    </>
  );
}

function SteelVJointPlate({
  position,
  zPush,
  size,
  angle,
  faces = [1, -1],
}: {
  position: [number, number];
  zPush: number;
  size: number;
  angle: number;
  faces?: ReadonlyArray<1 | -1>;
}) {
  const strapW = size * 0.24;
  const strapL = size * 1.25;
  return (
    <>
      {faces.map((face) => (
        <group key={face} position={[position[0], position[1], face * zPush]}>
          {([-1, 1] as const).map((s) => (
            <mesh key={s} rotation={[0, 0, s * angle]} castShadow receiveShadow>
              <boxGeometry args={[strapW, strapL, 0.5 * 0.0254]} />
              <meshStandardMaterial color="#141414" roughness={0.4} metalness={0.85} />
            </mesh>
          ))}
        </group>
      ))}
    </>
  );
}

function RuntimeArchTruss({
  span,
  z,
  baseY,
  peakY,
  color,
  plates = false,
  seatLower = 0,
  tailStyle = "standard",
  isOuter = true,
  exteriorFace = 1,
}: {
  span: number;
  z: number;
  baseY: number;
  peakY: number;
  color: string;
  plates?: boolean;
  seatLower?: number;
  tailStyle?: "standard" | "scroll";
  isOuter?: boolean;
  exteriorFace?: 1 | -1;
}) {
  const IN = 0.0254;
  const profile = 6 * IN;
  const depth = 5.5 * IN;
  const half = span / 2;
  const rise = peakY - baseY;
  const pitchAngle = Math.atan2(rise, half);
  const tanA = Math.tan(pitchAngle);
  const tail = 12 * IN;
  const rafterY = (absX: number) => rise - tanA * absX;
  const kingBaseY = rise * 0.38;
  const kingTopY = rise - profile * 0.7;
  const zPush = depth / 2 + 0.25 * IN;
  const plateSize = profile * 2.25;

  return (
    <group name="runtime-arch-truss" position={[0, baseY, z]}>
      {([1, -1] as const).map((s) => (
        <PlumbRafter
          key={`rtc-${s}`}
          iy={rise}
          outerX={half + 4 * IN + tail}
          pitchAngle={pitchAngle}
          t={profile}
          depth={depth}
          side={s}
          color={color}
          seatX={half + 4 * IN}
          seatY={-seatLower}
          piece={`arch.runtime.rafter.${s === 1 ? "r" : "l"}`}
          tailStyle={tailStyle}
        />
      ))}
      <BeamBetween start={[0, kingBaseY]} end={[0, kingTopY]} thickness={profile} depth={depth} color={color} piece="arch.runtime.kingpin" />
      {([1, -1] as const).map((s) => {
        const heel: [number, number] = [s * (half - profile * 0.35), profile * 0.35];
        const archEnd: [number, number] = [s * profile * 0.62, kingBaseY];
        const ctrl: [number, number] = [s * half * 0.72, profile * 0.35];
        const strutStart: [number, number] = [s * half * 0.18, kingBaseY + profile * 0.12];
        const strutEndAbsX = half * 0.48;
        const strutEnd: [number, number] = [s * strutEndAbsX, rafterY(strutEndAbsX) - profile * 0.35];
        return (
          <group key={s}>
            <CurvedTimber start={heel} control={ctrl} end={archEnd} radius={profile * 0.42} color={color} piece={`arch.runtime.wing.${s === 1 ? "r" : "l"}`} />
            <BeamBetween start={strutStart} end={strutEnd} thickness={profile * 0.78} depth={depth} color={color} piece={`arch.runtime.strut.${s === 1 ? "r" : "l"}`} />
            {plates && (
              <>
                <SteelVJointPlate position={heel} zPush={zPush} size={plateSize} angle={pitchAngle * 0.55} />
                <SteelRectPlate position={archEnd} zPush={zPush} width={plateSize * 0.65} height={plateSize * 0.9} rotationZ={s * 0.12} />
                <SteelRectPlate position={strutEnd} zPush={zPush} width={plateSize * 0.58} height={plateSize * 0.92} rotationZ={s * pitchAngle} />
              </>
            )}
          </group>
        );
      })}
      {plates && isOuter && (
        <SteelRectPlate
          position={[0, rise - profile * 0.45]}
          zPush={zPush}
          width={plateSize * 0.85}
          height={plateSize * 1.05}
          faces={[exteriorFace]}
        />
      )}
    </group>
  );
}

function RuntimeHammerTruss({
  span,
  z,
  baseY,
  peakY,
  color,
  plates = false,
  seatLower = 0,
  tailStyle = "standard",
  showPeakPlate = true,
  peakPlateFace = 0,
}: {
  span: number;
  z: number;
  baseY: number;
  peakY: number;
  color: string;
  plates?: boolean;
  seatLower?: number;
  tailStyle?: "standard" | "scroll";
  showPeakPlate?: boolean;
  peakPlateFace?: 1 | -1 | 0;
}) {
  const IN = 0.0254;
  const profile = 6 * IN;
  const depth = 5.5 * IN;
  const half = span / 2;
  const rise = peakY - baseY;
  const pitchAngle = Math.atan2(rise, half);
  const tanA = Math.tan(pitchAngle);
  const tail = 12 * IN;
  const rafterY = (absX: number) => rise - tanA * absX;
  const collarY = rise * 0.52;
  const zPush = depth / 2 + 0.25 * IN;
  const plateSize = profile * 2.25;

  return (
    <group name="runtime-hammer-truss" position={[0, baseY, z]}>
      {([1, -1] as const).map((s) => (
        <PlumbRafter
          key={`hrtc-${s}`}
          iy={rise}
          outerX={half + 4 * IN + tail}
          pitchAngle={pitchAngle}
          t={profile}
          depth={depth}
          side={s}
          color={color}
          seatX={half + 4 * IN}
          seatY={-seatLower}
          piece={`hammer.runtime.rafter.${s === 1 ? "r" : "l"}`}
          tailStyle={tailStyle}
        />
      ))}
      <BeamBetween start={[-half * 0.18, collarY]} end={[half * 0.18, collarY]} thickness={profile} depth={depth} color={color} piece="hammer.runtime.toptie" />
      <BeamBetween start={[0, collarY]} end={[0, rise - profile * 0.6]} thickness={profile} depth={depth} color={color} piece="hammer.runtime.kingpost" />
      {([1, -1] as const).map((s) => {
        const outer: [number, number] = [s * (half - profile * 0.45), profile * 0.62];
        const inner: [number, number] = [s * half * 0.43, profile * 0.72];
        const princeTopAbsX = Math.abs(inner[0]);
        const princeTop: [number, number] = [inner[0], rafterY(princeTopAbsX) - profile * 0.45];
        const collarJoint: [number, number] = [s * profile * 0.65, collarY];
        const archCtrl: [number, number] = [s * half * 0.72, Math.max(profile * 0.25, outer[1] - profile * 0.18)];
        return (
          <group key={s}>
            <BeamBetween start={outer} end={inner} thickness={profile} depth={depth} color={color} piece={`hammer.runtime.beam.${s === 1 ? "r" : "l"}`} />
            <BeamBetween start={inner} end={princeTop} thickness={profile * 0.9} depth={depth} color={color} piece={`hammer.runtime.prince.${s === 1 ? "r" : "l"}`} />
            <BeamBetween start={inner} end={collarJoint} thickness={profile * 0.82} depth={depth} color={color} piece={`hammer.runtime.strut.${s === 1 ? "r" : "l"}`} />
            <BeamBetween start={[outer[0], 0]} end={outer} thickness={profile * 0.8} depth={depth} color={color} piece={`hammer.runtime.drop.${s === 1 ? "r" : "l"}`} />
            <CurvedTimber start={[outer[0], profile * 0.12]} control={archCtrl} end={inner} radius={profile * 0.35} color={color} piece={`hammer.runtime.corbel.${s === 1 ? "r" : "l"}`} />
            {plates && (
              <>
                <SteelVJointPlate position={outer} zPush={zPush} size={plateSize} angle={pitchAngle * 0.55} />
                <SteelRectPlate position={princeTop} zPush={zPush} width={plateSize * 0.58} height={plateSize} rotationZ={s * pitchAngle} />
              </>
            )}
          </group>
        );
      })}
      {plates && showPeakPlate && peakPlateFace !== 0 && (
        <SteelRectPlate
          position={[0, rise - profile * 0.45]}
          zPush={zPush}
          width={plateSize * 0.85}
          height={plateSize * 1.05}
          faces={[peakPlateFace]}
        />
      )}
    </group>
  );
}





function ArchedBrace({
  postX,
  postZ,
  toX,
  toZ,
  topY,
  postThick,
  beamThick,
  lengthM,
  color,
}: {
  postX: number;
  postZ: number;
  toX: number;
  toZ: number;
  topY: number;
  /** Post cross-section (m). Brace slides inward so its vertical leg sits
   *  flush against the inner face of the post. */
  postThick: number;
  /** Girder thickness (m). Brace drops so its horizontal leg sits flush
   *  against the underside of the girder. */
  beamThick: number;
  /** Target horizontal-leg length in meters. */
  lengthM: number;
  color: string;
}) {
  const geom = useCorvelBraceGeometry(lengthM);
  const dx = toX - postX;
  const dz = toZ - postZ;
  const hLen = Math.hypot(dx, dz) || 1;
  const dirX = dx / hLen;
  const dirZ = dz / hLen;
  // Snap: elbow corner sits at (post inner face, beam underside).
  const px = postX + dirX * (postThick / 2);
  const pz = postZ + dirZ * (postThick / 2);
  // Snap top of horizontal leg flush with the underside of the rafter (topY), lowered 3.2".
  const py = topY - 3.2 * 0.0254;
  const rotY = Math.atan2(-dz, dx);
  if (!geom) return null;
  return (
    <mesh
      geometry={geom}
      position={[px, py, pz]}
      rotation={[0, rotY, 0]}
      castShadow

    >
      <WoodMaterial color={color} category="beam" rotation={Math.PI + Math.PI / 4 + Math.PI / 2} singleMaterial />
    </mesh>
  );
}

/** Rafter with a perpendicular cut at the peak (inner) end and either a
 *  plumb (vertical) cut or a decorative scroll cut at the outer tail end. */
function PlumbRafter({
  iy,
  outerX,
  pitchAngle,
  t,
  depth,
  side,
  color,
  seatX,
  seatY = 0,
  piece,
  tailStyle = "standard",
}: {
  iy: number;
  outerX: number;
  pitchAngle: number;
  t: number;
  depth: number;
  side: 1 | -1;
  color: string;
  seatX?: number;
  seatY?: number;
  piece?: string;
  tailStyle?: "standard" | "scroll";
}) {
  const scrollGeom = useScrollCutRafterGeometry(outerX / Math.cos(pitchAngle), t, depth);
  const geom = useMemo(() => {
    const sinA = Math.sin(pitchAngle);
    const cosA = Math.cos(pitchAngle);
    const tanA = sinA / cosA;
    const sTop = (outerX - (sinA * t) / 2) / cosA;
    const sBot = (outerX + (sinA * t) / 2) / cosA;
    const inTopY = iy + t / (2 * cosA);
    const inBotY = iy - t / (2 * cosA);
    const outTopY = iy + (cosA * t) / 2 - sTop * sinA;
    const outBotY = iy - (cosA * t) / 2 - sBot * sinA;

    // Build path in positive-x space; mirror for side === -1 at the end.
    const shape = new THREE.Shape();
    shape.moveTo(0, inTopY);

    // Scroll cut: decorative concave quarter-arc carved into the UNDERSIDE
    // of the tail only. Top edge and outer face stay exactly where the
    // standard plumb cut puts them, so the truss/rafter envelope and seat
    // position don't shift when the option is toggled.
    const scrollLen = tailStyle === "scroll"
      ? Math.min(t * 1.6, outerX * 0.5)
      : 0;
    if (tailStyle === "scroll") {
      // Top edge: straight, all the way to the outer face (unchanged).
      shape.lineTo(outerX, outTopY);
      // Outer (tip) face: full height — same as standard plumb cut.
      shape.lineTo(outerX, outBotY);
      // Concave quarter-arc carved into the underside, sweeping from the
      // outer-bottom corner up and inward to meet the original bottom edge
      // a distance `scrollLen` inboard of the tip.
      const Bx = outerX - scrollLen;
      const By = inBotY - tanA * Bx;
      // Ellipse center at (Bx, outBotY): horizontal radius = scrollLen,
      // vertical radius = (By - outBotY). Sweep CCW from angle 0 (outer-bottom
      // corner at (Bx+scrollLen, outBotY) = (outerX, outBotY)) to π/2
      // (top at (Bx, outBotY + (By-outBotY)) = (Bx, By)).
      shape.absellipse(Bx, outBotY, scrollLen, By - outBotY, 0, Math.PI / 2, false, 0);
    } else {
      shape.lineTo(outerX, outTopY);
      shape.lineTo(outerX, outBotY);
    }


    // Birdsmouth notch (only meaningful when seat is inboard of the tail cut).
    const notchSeatY = seatY + 0.75 * 0.0254;
    const tailCutInnerX = outerX - scrollLen;
    if (seatX != null && seatX < tailCutInnerX) {
      const yBotAtSeat = inBotY - tanA * seatX;
      if (yBotAtSeat < notchSeatY) {
        const seatInnerAbs = (inBotY - notchSeatY) / tanA;
        if (seatInnerAbs < seatX && seatInnerAbs > 0) {
          shape.lineTo(seatX, yBotAtSeat);
          shape.lineTo(seatX, notchSeatY);
          shape.lineTo(seatInnerAbs, notchSeatY);
        }
      }
    }
    shape.lineTo(0, inBotY);
    shape.closePath();

    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
    g.translate(0, 0, -depth / 2);
    if (side === -1) {
      g.scale(-1, 1, 1);
      // Mirror flips triangle winding → re-flip so normals face outward.
      const idx = g.getIndex();
      if (idx) {
        const arr = idx.array as Uint16Array | Uint32Array;
        for (let i = 0; i < arr.length; i += 3) {
          const tmp = arr[i];
          arr[i] = arr[i + 2];
          arr[i + 2] = tmp;
        }
        idx.needsUpdate = true;
      } else {
        // Swap triangle vertex positions to fix winding, and swap UVs
        // so the texture orientation matches the +X side (no mirrored grain).
        const pos = g.attributes.position.array as Float32Array;
        const uv = g.attributes.uv?.array as Float32Array | undefined;
        for (let i = 0; i < pos.length; i += 9) {
          for (let k = 0; k < 3; k++) {
            const a = i + k;
            const b = i + 6 + k;
            const tmp = pos[a]; pos[a] = pos[b]; pos[b] = tmp;
          }
          if (uv) {
            const ui = (i / 3) * 2;
            for (let k = 0; k < 2; k++) {
              const a = ui + k;
              const b = ui + 4 + k;
              const tmp = uv[a]; uv[a] = uv[b]; uv[b] = tmp;
            }
          }
        }
        // Flip U so the mirrored geometry samples the same grain direction.
        if (uv) {
          for (let i = 0; i < uv.length; i += 2) {
            uv[i] = 1 - uv[i];
          }
        }
      }
      g.computeVertexNormals();
    }
    return g;
  }, [iy, outerX, pitchAngle, t, depth, side, seatX, seatY, tailStyle]);
  if (tailStyle === "scroll") {
    // Render the uploaded scroll-cut rafter STL in place of the procedural shape.
    // Peak/top-edge of the STL is at (0,0); pivot at the rafter's inner-top
    // corner (matches PlumbRafter's local frame), then mirror + rotate down.
    const inTopY = iy + t / (2 * Math.cos(pitchAngle));
    return (
      <group
        position={[0, inTopY, 0]}
        rotation={[0, 0, side * -pitchAngle]}
        scale={[side, 1, 1]}
      >
        <mesh geometry={scrollGeom} castShadow receiveShadow>
          <WoodMaterial color={color} rotation={-Math.PI / 2} category="rafter" piece={piece} singleMaterial />
        </mesh>
      </group>
    );
  }
  return (
    <mesh geometry={geom} castShadow receiveShadow>
      <WoodMaterial color={color} rotation={side * pitchAngle - Math.PI / 2} category="rafter" piece={piece} singleMaterial />
    </mesh>
  );
}


/** Decorative black-iron truss plate with bolts, mounted to both faces of a
 *  truss member at the given joint. Position is in the truss's local XY plane;
 *  `depth` is the truss thickness (Z). */
function TrussPlate({
  position,
  rotation = 0,
  size,
  depth,
  bolts = 4,
}: {
  position: [number, number];
  rotation?: number;
  size: [number, number]; // width, height in meters
  depth: number;
  bolts?: 2 | 4 | 6;
}) {
  const [w, h] = size;
  const t = 0.006; // 6mm plate thickness
  const r = Math.min(w, h) * 0.15;
  // Rounded rectangle shape
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    const x0 = -w / 2, y0 = -h / 2, x1 = w / 2, y1 = h / 2;
    s.moveTo(x0 + r, y0);
    s.lineTo(x1 - r, y0);
    s.quadraticCurveTo(x1, y0, x1, y0 + r);
    s.lineTo(x1, y1 - r);
    s.quadraticCurveTo(x1, y1, x1 - r, y1);
    s.lineTo(x0 + r, y1);
    s.quadraticCurveTo(x0, y1, x0, y1 - r);
    s.lineTo(x0, y0 + r);
    s.quadraticCurveTo(x0, y0, x0 + r, y0);
    return s;
  }, [w, h, r]);
  const geom = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: true, bevelSize: 0.001, bevelThickness: 0.001, bevelSegments: 1 });
    g.translate(0, 0, -t / 2);
    return g;
  }, [shape]);

  // Bolt layout: 2 = vertical pair, 4 = square, 6 = 2x3 grid.
  const boltPositions = useMemo(() => {
    const px = w * 0.32;
    const py = h * 0.32;
    if (bolts === 2) return [[0, py], [0, -py]] as [number, number][];
    if (bolts === 6)
      return [
        [-px, py], [0, py], [px, py],
        [-px, -py], [0, -py], [px, -py],
      ] as [number, number][];
    return [
      [-px, py], [px, py], [-px, -py], [px, -py],
    ] as [number, number][];
  }, [w, h, bolts]);

  return (
    <group position={[position[0], position[1], 0]} rotation={[0, 0, rotation]}>
      {([1, -1] as const).map((face) => (
        <group key={face} position={[0, 0, face * (depth / 2 + 0.0005)]}>
          <mesh geometry={geom} castShadow receiveShadow>
            <meshStandardMaterial color="#1a1a1a" roughness={0.45} metalness={0.85} />
          </mesh>
          {boltPositions.map(([bx, by], i) => (
            <mesh key={i} position={[bx, by, face * (t / 2 + 0.001)]} rotation={[Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={[Math.min(w, h) * 0.06, Math.min(w, h) * 0.06, 0.004, 12]} />
              <meshStandardMaterial color="#2a2a2a" roughness={0.4} metalness={0.9} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/** Decorative strap-style joint plate: a black metal hub with rectangular
 *  arms extending along each connecting member, with a bolt at each arm end.
 *  Renders on both faces of the truss member (front and back). */
function StrapPlate({
  position,
  arms,
  depth,
  hubRadius,
}: {
  position: [number, number];
  /** Each arm: angle in radians (0 = +X, math convention), length from hub
   *  center to the tip, and width (perpendicular to the arm). */
  arms: { angle: number; length: number; width: number }[];
  depth: number;
  /** Radius of the central hub disc that joins the arms. */
  hubRadius: number;
}) {
  const t = 0.008; // 8mm plate thickness
  // Build one arm shape: rounded rectangle from x=-hubRadius to x=length,
  // height = width, with full pill caps.
  const armGeoms = useMemo(() => {
    return arms.map((arm) => {
      const w = arm.width;
      const r = w / 2;
      const x0 = -hubRadius;
      const x1 = arm.length;
      const s = new THREE.Shape();
      s.moveTo(x0 + r * 0.2, -w / 2);
      s.lineTo(x1 - r, -w / 2);
      s.quadraticCurveTo(x1, -w / 2, x1, -w / 2 + r * 0.7);
      s.lineTo(x1, w / 2 - r * 0.7);
      s.quadraticCurveTo(x1, w / 2, x1 - r, w / 2);
      s.lineTo(x0 + r * 0.2, w / 2);
      s.quadraticCurveTo(x0, w / 2, x0, w / 2 - r * 0.4);
      s.lineTo(x0, -w / 2 + r * 0.4);
      s.quadraticCurveTo(x0, -w / 2, x0 + r * 0.2, -w / 2);
      const g = new THREE.ExtrudeGeometry(s, {
        depth: t,
        bevelEnabled: true,
        bevelSize: 0.0015,
        bevelThickness: 0.0015,
        bevelSegments: 1,
      });
      g.translate(0, 0, -t / 2);
      return g;
    });
  }, [arms, hubRadius]);

  // Central hub disc, hides the arm root corners
  const hubGeom = useMemo(() => {
    const s = new THREE.Shape();
    s.absarc(0, 0, hubRadius, 0, Math.PI * 2, false);
    const g = new THREE.ExtrudeGeometry(s, {
      depth: t,
      bevelEnabled: true,
      bevelSize: 0.0015,
      bevelThickness: 0.0015,
      bevelSegments: 1,
    });
    g.translate(0, 0, -t / 2);
    return g;
  }, [hubRadius]);

  return (
    <group position={[position[0], position[1], 0]}>
      {([1, -1] as const).map((face) => (
        <group key={face} position={[0, 0, face * (depth / 2 + 0.0006)]}>
          <mesh geometry={hubGeom} castShadow receiveShadow>
            <meshStandardMaterial color="#141414" roughness={0.4} metalness={0.85} />
          </mesh>
          {arms.map((arm, i) => (
            <group key={i} rotation={[0, 0, arm.angle]}>
              <mesh geometry={armGeoms[i]} castShadow receiveShadow>
                <meshStandardMaterial color="#141414" roughness={0.4} metalness={0.85} />
              </mesh>
              {/* Bolt near the tip */}
              <mesh
                position={[arm.length - arm.width * 0.45, 0, face * (t / 2 + 0.0012)]}
                rotation={[Math.PI / 2, 0, 0]}
                castShadow
              >
                <cylinderGeometry args={[arm.width * 0.16, arm.width * 0.16, 0.005, 14]} />
                <meshStandardMaterial color="#2a2a2a" roughness={0.35} metalness={0.95} />
              </mesh>
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}

/** King-truss "V plate" — STL-driven metal plate placed on both faces of the
 *  truss at peak / heel / web joints. The STL is recentered on load so
 *  `position` refers to the joint center; `bisectorAngle` rotates the plate
 *  so its modeled "opening" axis (assumed +Y in the STL frame) points along
 *  the bisector of the two joined members. `sizeScale` allows per-joint
 *  resizing without re-exporting the STL. */
function KingVPlate({
  position,
  depth,
  bisectorAngle,
  sizeScale = 1,
  piece,
  url = "truss_plateV2",
}: {
  position: [number, number];
  depth: number;
  /** Radians; direction the V opening should point (0 = +X). */
  bisectorAngle: number;
  sizeScale?: number;
  piece: string;
  url?: string;
}) {
  const geom = useMemo(() => { const g=createPartGeometry(url);g.scale(.0254,.0254,.0254);g.center();return g; }, [url]);
  useEffect(() => () => geom.dispose(), [geom]);
  if (!geom) return null;
  // STL was modeled with the V opening along +Y. Rotate so +Y aligns with the
  // requested bisectorAngle: needed Z-rotation = bisectorAngle − π/2.
  const rotZ = bisectorAngle - Math.PI / 2;
  return (
    <group position={[position[0], position[1], 0]} rotation={[0, 0, rotZ]} scale={[sizeScale, sizeScale, sizeScale]}>
      {([1, -1] as const).map((face) => (
        <mesh
          key={face}
          geometry={geom}
          position={[0, 0, face * (depth / 2 + 0.0006)]}
          rotation={face === 1 ? [0, 0, 0] : [0, Math.PI, 0]}
          castShadow
          receiveShadow
          userData={{ pieceKey: `piece:${piece}`, pieceLabel: piece }}
        >
          <meshStandardMaterial color="#141414" roughness={0.4} metalness={0.85} />
        </mesh>
      ))}
    </group>
  );
}





/** Curved arch truss spanning across the gable end. */
function ArchTruss({
  span,
  z,
  baseY,
  peakY,
  color,
  plates = false,
  seatLower = 0,
  tailStyle = "standard",
  archPlateOffset = { x: 0, y: 0, z: 0 },
  archPlateRotation = { x: 0, y: 0, z: 0 },
  archPlateSizeScale = { x: 1, y: 1, z: 1 },
  simplePlateOffset = { x: 0, y: 0, z: 0 },
  simplePlateRotation = { x: 0, y: 0, z: 0 },
  simplePlateSizeScale = { x: 1, y: 1, z: 1 },
  topPlateOffset = { x: 0, y: 0, z: 0 },
  topPlateRotation = { x: 0, y: 0, z: 0 },
  topPlateSizeScale = { x: 1, y: 1, z: 1 },
  webPlate2Offset = { x: 0, y: 0, z: 0 },
  webPlate2Rotation = { x: 0, y: 0, z: 0 },
  webPlate2SizeScale = { x: 1, y: 1, z: 1 },
  isOuter = true,
  exteriorFace = 1,
}: {
  span: number;
  z: number;
  baseY: number;
  peakY: number;
  color: string;
  plates?: boolean;
  /** Distance to lower the rafter seat below the truss base (meters).
   *  Used when the truss is lifted to keep the birdsmouth shallow. */
  seatLower?: number;
  tailStyle?: "standard" | "scroll";
  /** Decorative metal plate offset (meters), mirrored on the right side. */
  archPlateOffset?: { x: number; y: number; z: number };
  archPlateRotation?: { x: number; y: number; z: number };
  archPlateSizeScale?: { x: number; y: number; z: number };
  simplePlateOffset?: { x: number; y: number; z: number };
  simplePlateRotation?: { x: number; y: number; z: number };
  simplePlateSizeScale?: { x: number; y: number; z: number };
  topPlateOffset?: { x: number; y: number; z: number };
  topPlateRotation?: { x: number; y: number; z: number };
  topPlateSizeScale?: { x: number; y: number; z: number };
  webPlate2Offset?: { x: number; y: number; z: number };
  webPlate2Rotation?: { x: number; y: number; z: number };
  webPlate2SizeScale?: { x: number; y: number; z: number };
  /** Whether this is one of the two outer (end) trusses. The top plate only renders on outer trusses. */
  isOuter?: boolean;
  /** Exterior side for end truss plates: +1 = +Z face, -1 = -Z face. */
  exteriorFace?: 1 | -1;
}) {

  // King-post truss with a collar tie partway up, two struts from the tie
  // beam center out to the collar/rafter joint, and a short king post above
  // the collar — matching the heavy-timber reference photo.
  const memberT = 6 * 0.0254;
  const rise = peakY - baseY;
  const half = span / 2;
  const pitchAngle = Math.atan2(rise, half);
  const chordLen = Math.sqrt(half * half + rise * rise);
  // Birdsmouth tail: rafter extends past the wall plate forming an eave.
  const tail = 12 * 0.0254;
  void chordLen;

  // Collar tie sits ~62% of the way up the rise.
  const collarT = 0.62;
  const collarY = rise * collarT;
  const collarHalf = half * (1 - collarT); // where rafter is at that height
  const collarLen = collarHalf * 2;

  // Strut from tie-beam center area up to where the collar meets the rafter.
  function strut(side: 1 | -1) {
    const tieX = side * half * 0.18;
    const end = new THREE.Vector3(side * collarHalf, collarY, 0);
    const start = new THREE.Vector3(tieX, 0, 0);
    const mid = start.clone().add(end).multiplyScalar(0.5);
    const dir = end.clone().sub(start);
    const len = dir.length();
    const rot = Math.atan2(dir.y, dir.x) - Math.PI / 2;
    return (
      <mesh key={`st-${side}`} position={mid.toArray()} rotation={[0, 0, rot]} castShadow>
        <boxGeometry args={[memberT * 0.75, len, memberT * 0.75]} />
        <WoodMaterial color={color} category="truss" piece={`arch.strut.${side === 1 ? "r" : "l"}`} />
      </mesh>
    );
  }

  // Curved corbel brace at each post (heavy arch under the tie beam).
  function corbel(side: 1 | -1) {
    const postDrop = Math.min(rise * 0.9, span * 0.28);
    const reach = span * 0.22;
    const start = new THREE.Vector3(side * half, -postDrop, 0);
    const end = new THREE.Vector3(side * (half - reach), -memberT / 2, 0);
    const ctrl = new THREE.Vector3(side * half, -memberT / 2, 0);
    const curve = new THREE.QuadraticBezierCurve3(start, ctrl, end);
    const geom = new THREE.TubeGeometry(curve, 24, memberT * 0.45, 10, false);
    return (
      <mesh key={`cb-${side}`} geometry={geom} castShadow>
        <WoodMaterial
          color={color}
          category="truss"
          piece={`arch.corbel.${side === 1 ? "r" : "l"}`}
          singleMaterial
          /* Tube UV: U = along curve length, V = wraps around cross-section.
             Stretch U so grain runs cleanly along the brace on every facet
             (including the bottom). Tighten V toward 1 tile so the wrap-around
             doesn't create perpendicular grain bands on the bottom face. */
          faceRepeats={[[2.5, 0.35]]}
        />
      </mesh>
    );
  }

  const kingH = rise - collarY; // king post sits above the collar tie

  // Arch King: only the top rafter chords are kept. All other members
  // (tie beam, collar, kingpost, struts, corbel braces) are removed.
  void kingH; void collarLen; void strut; void corbel;
  const wingL = useSingleHammerPieceGeom("arch_truss_wing_l", true);
  const wingR = useSingleHammerPieceGeom("arch_truss_wing_r", true);
  const kingpin = useSingleHammerPieceGeom("arch_kingpin", true);
  const strutL = useSingleHammerPieceGeom("arch_truss_strut_l", true);
  const strutR = useSingleHammerPieceGeom("arch_truss_strut_r", true);
  const plateL = useSingleHammerPieceGeom("arch_plate_l", true);
  const simplePlate = useSingleHammerPieceGeom("simple_plate", true);
  const topPlate = useSingleHammerPieceGeom("top_plate", true);
  const webPlate2 = useSingleHammerPieceGeom("web_plate_2", true);
  return (
    <group name="arch-truss" position={[0, baseY, z]}>
      {/* Top chords (rafters): match the side rafter size/length exactly */}
      {[1, -1].map((s) => {
        const IN = 0.0254;
        return (
          <PlumbRafter
            key={`tc-${s}`}
            iy={rise}
            outerX={half + 4 * IN + tail}
            pitchAngle={pitchAngle}
            t={6 * IN}
            depth={5.5 * IN}
            side={s as 1 | -1}
            color={color}
            seatX={half + 4 * IN}
            seatY={-seatLower}
            piece={`arch.rafter.${s === 1 ? "r" : "l"}`}
            tailStyle={tailStyle}
          />
        );
      })}
      {/* Left wing — bottom arch (STL, inches → meters in loader) */}
      {wingL && (
        <mesh geometry={wingL.geom} castShadow receiveShadow>
          <WoodMaterial
            color={color}
            category="truss"
            piece="arch.wing.l"
            singleMaterial
            rotation={wingL.axis}
          />
        </mesh>
      )}
      {/* Right wing — bottom arch (STL, inches → meters in loader) */}
      {wingR && (
        <mesh geometry={wingR.geom} castShadow receiveShadow>
          <WoodMaterial
            color={color}
            category="truss"
            piece="arch.wing.r"
            singleMaterial
            rotation={wingR.axis}
          />
        </mesh>
      )}
      {/* King pin — central vertical post (STL, inches → meters in loader) */}
      {kingpin && (
        <mesh geometry={kingpin.geom} castShadow receiveShadow>
          <WoodMaterial
            color={color}
            category="truss"
            piece="arch.kingpin"
            singleMaterial
            rotation={kingpin.axis}
          />
        </mesh>
      )}
      {/* Left strut — diagonal brace (STL, inches → meters in loader) */}
      {strutL && (
        <mesh geometry={strutL.geom} castShadow receiveShadow>
          <WoodMaterial
            color={color}
            category="truss"
            piece="arch.strut.l"
            singleMaterial
            rotation={strutL.axis}
          />
        </mesh>
      )}
      {/* Right strut — diagonal brace (STL, inches → meters in loader) */}
      {strutR && (
        <mesh geometry={strutR.geom} castShadow receiveShadow>
          <WoodMaterial
            color={color}
            category="truss"
            piece="arch.strut.r"
            singleMaterial
            rotation={strutR.axis}
          />
        </mesh>
      )}
      {/* Decorative metal plates — left/right (right is mirrored from left).
          Position/rotation/scale are slider-driven from the admin Plates panel
          and authored in the left (un-mirrored) frame; right mirrors via −X. */}
      {plates && plateL && (() => {
        const IN = 0.0254;
        const timberDepth = 5.5 * IN;   // rafter/strut profile depth
        const plateThick = 0.5 * IN;     // plate STL thickness (same as hammer plates)
        const zPush = timberDepth / 2 + plateThick / 2;
        return (
          <group name="arch-plates">
            {([1, -1] as const).map((s) =>
              // For each side L/R, render a plate on BOTH Z faces of the timber.
              ([1, -1] as const).map((face) => (
                <group
                  key={`arch-plate-${s}-${face}`}
                  position={[s * archPlateOffset.x, archPlateOffset.y, archPlateOffset.z + face * zPush]}
                  rotation={[archPlateRotation.x, s === -1 ? -archPlateRotation.y : archPlateRotation.y, s === -1 ? -archPlateRotation.z : archPlateRotation.z]}
                  scale={[s * archPlateSizeScale.x, archPlateSizeScale.y, face * archPlateSizeScale.z]}
                >
                  <mesh geometry={plateL.geom} castShadow receiveShadow>
                    <meshStandardMaterial color="#141414" roughness={0.4} metalness={0.85} />
                  </mesh>
                </group>
              )),
            )}
          </group>
        );
      })()}
      {/* Simple decorative metal plate — mirrored L/R, slider-driven, both Z faces. */}
      {plates && simplePlate && (() => {
        const IN = 0.0254;
        const timberDepth = 5.5 * IN;
        const plateThick = 0.5 * IN;
        const zPush = timberDepth / 2 + plateThick / 2;
        return (
          <group name="arch-simple-plates">
            {([1, -1] as const).map((s) =>
              ([1, -1] as const).map((face) => (
                <group
                  key={`simple-plate-${s}-${face}`}
                  position={[s * simplePlateOffset.x, simplePlateOffset.y, simplePlateOffset.z + face * zPush]}
                  rotation={[simplePlateRotation.x, s === -1 ? -simplePlateRotation.y : simplePlateRotation.y, s === -1 ? -simplePlateRotation.z : simplePlateRotation.z]}
                  scale={[s * simplePlateSizeScale.x, simplePlateSizeScale.y, face * simplePlateSizeScale.z]}
                >
                  <mesh geometry={simplePlate.geom} castShadow receiveShadow>
                    <meshStandardMaterial color="#141414" roughness={0.4} metalness={0.85} />
                  </mesh>
                </group>
              )),
            )}
          </group>
        );
      })()}
      {/* Top decorative metal plate — end trusses only, exterior face only. */}
      {plates && topPlate && isOuter && (() => {
        const IN = 0.0254;
        const timberDepth = 5.5 * IN;
        const plateThick = 0.5 * IN;
        const zPush = timberDepth / 2 + plateThick / 2;
        const face = exteriorFace;
        return (
          <group name="arch-top-plates">
            <group
              position={[topPlateOffset.x, topPlateOffset.y, topPlateOffset.z * face + face * zPush]}
              rotation={[topPlateRotation.x, topPlateRotation.y, topPlateRotation.z]}
              scale={[topPlateSizeScale.x, topPlateSizeScale.y, face * topPlateSizeScale.z]}
            >
              <mesh geometry={topPlate.geom} castShadow receiveShadow>
                <meshStandardMaterial color="#141414" roughness={0.4} metalness={0.85} />
              </mesh>
            </group>
          </group>
        );
      })()}
      {/* Web plate 2 — one plate on each Z face of the truss, every truss. */}
      {plates && webPlate2 && (() => {
        const IN = 0.0254;
        const timberDepth = 5.5 * IN;
        const plateThick = 0.5 * IN;
        const zPush = timberDepth / 2 + plateThick / 2;
        return (
          <group name="arch-web-plate-2">
            {([1, -1] as const).map((face) => (
              <group
                key={`web-plate-2-${face}`}
                position={[webPlate2Offset.x, webPlate2Offset.y, webPlate2Offset.z + face * zPush]}
                rotation={[webPlate2Rotation.x, webPlate2Rotation.y, webPlate2Rotation.z]}
                scale={[webPlate2SizeScale.x, webPlate2SizeScale.y, face * webPlate2SizeScale.z]}
              >
                <mesh geometry={webPlate2.geom} castShadow receiveShadow>
                  <meshStandardMaterial color="#141414" roughness={0.4} metalness={0.85} />
                </mesh>
              </group>
            ))}
          </group>
        );
      })()}
    </group>
  );
}

/** Load dedicated 20'-truss piece STLs and return them keyed by splitter id.
 *  Each STL is modeled in inches in a common truss-local frame; we just
 *  convert to meters and compute a 2D principal-axis angle (X/Y) so the
 *  WoodMaterial grain runs along the piece's long edge — same convention
 *  the splitter uses for the auto-partitioned buckets. */
function useHammer20PieceGeoms(enabled: boolean): Partial<Record<Hammer20PieceKey, { geom: THREE.BufferGeometry; axis: number }>> {
  const loaded=useMemo(()=>{const result:Partial<Record<Hammer20PieceKey,{geom:THREE.BufferGeometry;axis:number}>>={};if(enabled)for(const [key,id]of Object.entries(HAMMER20_PIECE_STLS)){const geom=createPartGeometry(id);geom.scale(.0254,.0254,.0254);geom.computeBoundingBox();const size=geom.boundingBox!.getSize(new THREE.Vector3());result[key as Hammer20PieceKey]={geom,axis:size.y>size.x?Math.PI/2:0};}return result;},[enabled]);
  useEffect(()=>()=>Object.values(loaded).forEach(p=>p.geom.dispose()),[loaded]);return loaded;
}

/** Load a single STL (inches, truss-local frame) and return its geom + a
 *  principal-axis angle so WoodMaterial's grain runs along its long edge.
 *  Mirrors the per-piece processing inside useHammer20PieceGeoms. */
function useSingleHammerPieceGeom(url: string, enabled: boolean): { geom: THREE.BufferGeometry; axis: number } | null {
  const loaded=useMemo(()=>{if(!enabled)return null;const geom=createPartGeometry(url);geom.scale(.0254,.0254,.0254);geom.computeBoundingBox();const size=geom.boundingBox!.getSize(new THREE.Vector3());return {geom,axis:size.y>size.x?Math.PI/2:0};},[url,enabled]);
  useEffect(()=>()=>loaded?.geom.dispose(),[loaded]);
  return loaded;
}


/** Hammer-beam-truss STL split into addressable sub-pieces by spatial region
 *  of each triangle centroid. STL units are inches; X = span, Y = vertical,
 *  Z = thickness. We scale X uniformly with Y to preserve the modeled pitch
 *  (so the STL's own rafters stay at the designed 8/12 slope), then partition
 *  triangles into tie / kingpost / strut.l|r / corbel.l|r so each piece can
 *  carry its own grain-rotation override. */
function useHammerTrussGeometries(spanM: number, riseM: number, uniformProfile55: boolean = false, useDedicated20Stl: boolean = false) {
  const parts=useMemo(()=>{const width=spanM<13*.3048?12:spanM<15*.3048?14:spanM<18*.3048?16:20;const members=createHammerMembers(width);const keys:Hammer20PieceKey[]=['tieL','tieR','kingpost','princeL','princeR','topTie','corbelL','corbelR'];const geoms:Partial<Record<Hammer20PieceKey,THREE.BufferGeometry>>={},axisAngles:Partial<Record<Hammer20PieceKey,number>>={};members.forEach((m,i)=>{if(i<8){geoms[keys[i]]=m.geometry;axisAngles[keys[i]]=i>=2&&i<=4?Math.PI/2:0;}else m.geometry.dispose();});return {geoms,axisAngles};},[spanM]);useEffect(()=>()=>Object.values(parts.geoms).forEach(g=>g.dispose()),[parts]);return parts;
}

/** Hammer beam truss: body geometry comes from the supplied STL (split into
 *  individually addressable pieces); rafters (top chords) render
 *  programmatically so they match the rest of the roof at the 8/12 pitch. */
function HammerTruss({
  span,
  z,
  baseY,
  peakY,
  color,
  plates = false,
  seatLower = 0,
  tailStyle = "standard",
  yOffset = 0,
  scaleX = 1,
  scaleY = 1,
  scaleZ = 1,
  corbelScale = { x: 1, y: 1, z: 1 },
  corbelOffset = { x: 0, y: 0, z: 0 },
  corbelRotation = { x: 0, y: 0, z: 0 },
  plateOffset = { x: 0, y: 0, z: 0 },
  plateRotation = { x: 0, y: 0, z: 0 },
  plateSizeScale = 1,
  webPlateOffset = { x: 0, y: 0, z: 0 },
  webPlateRotation = { x: 0, y: 0, z: 0 },
  webPlateSizeScale = 1,
  vPlateSurfaceInset = 0,
  webPlateSurfaceInset = 0,
  peakPlateOffset = { x: 0, y: 0, z: 0 },
  peakPlateRotation = { x: 0, y: 0, z: 0 },
  peakPlateSizeScale = 1,
  peakPlateSurfaceInset = 0,
  showPeakPlate = true,
  peakPlateFace = 0,
  pieceOffsets,
  pieceScales,
  uniformProfile55 = false,
  useDedicated20Stl = false,
  borrowAll20Pieces = false,
  plateExtraOffsets,
  bodyHidden = false,
  groupOffset = { x: 0, y: 0, z: 0 },
}: {
  span: number;
  z: number;
  baseY: number;
  peakY: number;
  color: string;
  plates?: boolean;
  /** Distance to lower the rafter seat below the truss base (meters). */
  seatLower?: number;
  tailStyle?: "standard" | "scroll";
  /** Additional vertical offset for the truss body (meters). */
  yOffset?: number;
  /** Per-axis scale multipliers applied to the truss body only. */
  scaleX?: number;
  scaleY?: number;
  scaleZ?: number;
  /** Per-axis scale multipliers for the curved king-post corbel braces. */
  corbelScale?: { x: number; y: number; z: number };
  /** Per-axis position offset (meters) added to each corbel brace. */
  corbelOffset?: { x: number; y: number; z: number };
  /** Per-axis rotation (radians) added to each corbel brace. */
  corbelRotation?: { x: number; y: number; z: number };
  /** Per-axis offset (m) for the STL heel plates. */
  plateOffset?: { x: number; y: number; z: number };
  /** Per-axis rotation (rad) for the STL heel plates. */
  plateRotation?: { x: number; y: number; z: number };
  /** Uniform size multiplier for the STL heel plates. */
  plateSizeScale?: number;
  /** Per-axis offset (m) for the Web plate. */
  webPlateOffset?: { x: number; y: number; z: number };
  /** Per-axis rotation (rad) for the Web plate. */
  webPlateRotation?: { x: number; y: number; z: number };
  /** Uniform size multiplier for the Web plate. */
  webPlateSizeScale?: number;
  /** Extra outward inset (m) added to plate Z to close any gap to timber surface. */
  vPlateSurfaceInset?: number;
  webPlateSurfaceInset?: number;
  /** Per-axis offset (m) for the Peak plate. */
  peakPlateOffset?: { x: number; y: number; z: number };
  /** Per-axis rotation (rad) for the Peak plate. */
  peakPlateRotation?: { x: number; y: number; z: number };
  /** Uniform size multiplier for the Peak plate. */
  peakPlateSizeScale?: number;
  /** Extra outward inset (m) for the Peak plate Z. */
  peakPlateSurfaceInset?: number;
  /** When false, the apex peak plate is omitted (used for middle trusses). */
  showPeakPlate?: boolean;
  /** Which face to render the peak plate on: +1 = +Z side, -1 = -Z side, 0 = none. */
  peakPlateFace?: 1 | -1 | 0;
  /** Per-piece position offsets (m) keyed by piece id (e.g. "hammer.tie"). */
  pieceOffsets?: Record<string, { x: number; y: number; z: number }>;
  /** Per-piece scale multipliers keyed by piece id. */
  pieceScales?: Record<string, { x: number; y: number; z: number }>;
  /** When true, every truss member's cross-section is forced to 5.5″ × 5.5″. */
  uniformProfile55?: boolean;
  /** When true, render the supplied 20' STL as one complete mesh. */
  useDedicated20Stl?: boolean;
  /** When true, every body piece (kingpost, ties, princes, struts, corbels, drops, post)
   *  borrows the hand-modeled 20′ STL geometry and shrinks via sxFit to the actual span.
   *  Rafters and plates still use the live span so 5.5″×5.5″ profiles stay correct. */
  borrowAll20Pieces?: boolean;
  /** Per-individual-plate extra world-space offsets (m). 14′ admin tuning. */
  plateExtraOffsets?: TrussPlateExtraOffsets;
  /** When true, hides the STL body, corbel braces, and plates — keeps only the rafters. */
  bodyHidden?: boolean;
  /** Per-axis offset (m) applied to the entire truss group (20′ tuning). */
  groupOffset?: { x: number; y: number; z: number };
}) {
  const IN = 0.0254;
  const memberT = (uniformProfile55 ? 5.5 : 6) * IN;
  const half = span / 2;
  const rise = peakY - baseY;
  const pitchAngle = Math.atan2(rise, half);
  const tail = 12 * IN;
  const uses20ftStl = useDedicated20Stl || span > 18 * 12 * IN;
  const parts = useHammerTrussGeometries(span, rise, uniformProfile55, useDedicated20Stl);
  // Always load the 20' piece STLs so smaller pavilions can borrow the
  // hand-modeled king post (the rest of the splitter pieces are still used
  // unless this truss is itself the 20' build).
  const pieceOverrides = useHammer20PieceGeoms(true);
  // 12'-only dedicated king-post STL. When the pavilion is ~12' wide, swap in
  // this hand-modeled king beam (authored at 12' span — no sxFit shrink).
  // Truss span at 12' width is ~11' after post-offset trim, so match anything
  // between 10' and 13'.
  const is12ftSpan = !uses20ftStl && span < 13 * 12 * IN && span > 10 * 12 * IN;
  const king12Raw = useSingleHammerPieceGeom("king_beam_12", is12ftSpan);
  // The uploaded 12' king beam is authored with its origin offset from center
  // and below the truss frame. Center X/Z and put the bottom at Y = 0 so it
  // lands visibly in the truss-local frame.
  const king12 = useMemo(() => {
    if (!king12Raw) return null;
    const g = king12Raw.geom.clone();
    g.computeBoundingBox();
    const bb = g.boundingBox!;
    g.translate(
      -(bb.min.x + bb.max.x) / 2,
      -bb.min.y,
      -(bb.min.z + bb.max.z) / 2,
    );
    g.computeBoundingBox();
    return { geom: g, axis: king12Raw.axis };
  }, [king12Raw]);
  // Top-tie beam: the 20′ STL is reused on every width and shrunk along its
  // length axis via sxFit so 12′/14′/16′ pavilions all show it at the
  // correct span (5.5″×5.5″ cross-section preserved).



  // Single proportional unit scale for the entire hammer-beam style
  // (truss members, corbel braces, decorative plates). Baseline = 16 ft span,
  // so every element grows or shrinks together as the pavilion size changes.
  const BASELINE_SPAN_M = 16 * 12 * IN;
  const unitScale = span / BASELINE_SPAN_M;

  const pieceMap: Array<{ key: "tieL" | "tieR" | "kingpost" | "post" | "strutL" | "strutR" | "corbelL" | "corbelR" | "dropL" | "dropR" | "princeL" | "princeR"; piece: string }> = [
    { key: "tieL",     piece: "hammer.tie.l" },
    { key: "tieR",     piece: "hammer.tie.r" },
    { key: "kingpost", piece: "hammer.kingpost" },
    { key: "post",     piece: "hammer.post" },
    { key: "strutL",   piece: "hammer.strut.l" },
    { key: "strutR",   piece: "hammer.strut.r" },
    { key: "corbelL",  piece: "hammer.corbel.l" },
    { key: "corbelR",  piece: "hammer.corbel.r" },
    { key: "dropL",    piece: "hammer.drop.l" },
    { key: "dropR",    piece: "hammer.drop.r" },
    { key: "princeL",  piece: "hammer.prince.l" },
    { key: "princeR",  piece: "hammer.prince.r" },
  ];

  // King-post corbel brace: STL-modeled L-brace placed between the king post
  // and the underside of the principal rafter. The brace's "horizontal" leg
  // aligns with the rafter slope; its other leg sits against the king post.
  const cosA = Math.cos(pitchAngle);
  const profileT = 6 * IN;
  const braceDiagonal = half * 0.55;
  const corbelGeom = useCorvelBraceGeometry(braceDiagonal);
  const kingBrace = (side: 1 | -1) => {
    if (!corbelGeom) return null;
    const kingHalfWidth = 5 * IN; // matches kingBand
    const ex = side * kingHalfWidth;
    // Elbow sits at the kingpost side face, just under the rafter underside.
    const ey = rise - (Math.abs(ex) / half) * rise - profileT / (2 * cosA);
    // Per-piece offset/scale: hammer.corbel.l/r sliders control the visible
    // curved corbel brace at the corresponding side.
    const pieceKey = `hammer.corbel.${side === 1 ? "r" : "l"}`;
    const pOff = pieceOffsets?.[pieceKey] ?? { x: 0, y: 0, z: 0 };
    const pSc = pieceScales?.[pieceKey] ?? { x: 1, y: 1, z: 1 };
    return (
      <group
        key={`hkb-${side}`}
        position={[ex + side * corbelOffset.x + side * pOff.x, ey + corbelOffset.y + pOff.y, corbelOffset.z + pOff.z]}
        rotation={[corbelRotation.x, side * corbelRotation.y, side * corbelRotation.z]}
        scale={[corbelScale.x * pSc.x, corbelScale.y * pSc.y, corbelScale.z * pSc.z]}
      >
        <mesh
          geometry={corbelGeom}
          rotation={[0, 0, side === 1 ? -pitchAngle : pitchAngle]}
          scale={[side, 1, 1]}
          castShadow
          receiveShadow
        >
          <WoodMaterial color={color} category="truss" piece={`hammer.kingbrace.${side === 1 ? "r" : "l"}`} singleMaterial />
        </mesh>
      </group>
    );
  };

  return (
    <group name="hammer-truss" position={[0, baseY, z]}>

      {!bodyHidden && (
      <group position={[groupOffset.x, yOffset + groupOffset.y, groupOffset.z]} scale={[scaleX, scaleY, scaleZ]}>
        {parts && pieceMap.map(({ key, piece }) => {
          // Prefer a dedicated hand-modeled piece STL if one has been
          // registered for the 20' truss — the user is migrating from the
          // auto-split STL to individual pieces, one at a time.
          // 20' uses only hand-modeled piece STLs — the old auto-split
          // truss is disabled. Skip any piece without a dedicated override.
          // These pieces always use the hand-modeled 20' STL on every width —
          // the splitter version is never rendered for them, so the old tie /
          // prince shapes don't appear on 16′ etc.
          const sharedFrom20: Array<typeof key> = borrowAll20Pieces
            ? ["kingpost", "tieL", "tieR", "princeL", "princeR", "strutL", "strutR", "corbelL", "corbelR", "dropL", "dropR", "post"]
            : ["kingpost", "tieL", "tieR", "princeL", "princeR"];
          const isShared = sharedFrom20.includes(key);
          // 12'-only king-post: when present, use the dedicated 12' STL instead
          // of the shrunk 20' kingpost — and skip sxFit so it renders at its
          // authored size.
          const use12King = key === "kingpost" && is12ftSpan && !!king12;
          const override = use12King
            ? king12!
            : (uses20ftStl || isShared) ? pieceOverrides[key] : undefined;
          const geom = use12King ? king12!.geom : ((uses20ftStl || isShared) ? override?.geom : parts.geoms[key]);
          if (!geom) return null;
          // Make grain run parallel to the beam's long edge. WoodMaterial's
          // default rotation is π/2 (horizontal grain along U); subtracting
          // the piece's principal-axis angle rotates the texture so the
          // grain follows that axis.
          const axis = override?.axis ?? parts.axisAngles[key] ?? 0;
          const grainRot = Math.PI / 2 - axis;
          const off = pieceOffsets?.[piece] ?? { x: 0, y: 0, z: 0 };
          const psc = pieceScales?.[piece] ?? { x: 1, y: 1, z: 1 };
          // Each tie half (tieL/tieR) is controlled by its own slider so they
          // move and scale independently.
          // Scale around each piece's own centroid so beams grow/shrink in
          // place instead of being pushed away from the truss origin. Without
          // this pivot, a piece offset from center (e.g. prince beams at ~half
          // the span) only translates under scale and barely appears to resize.
          if (!geom.boundingBox) geom.computeBoundingBox();
          const bb = geom.boundingBox!;
          const cx = (bb.min.x + bb.max.x) / 2;
          const cy = (bb.min.y + bb.max.y) / 2;
          const cz = (bb.min.z + bb.max.z) / 2;
          // The hand-modeled 20′ piece STLs are authored at 20′ span. When we
          // borrow them on smaller widths (12/14/16), shrink only each piece's
          // PRINCIPAL (length) axis so its 5.5″×5.5″ cross-section is preserved
          // — vertical members (kingpost, princes) keep their X width, horizontal
          // members (ties) keep their Y/Z cross-section. Centroid X is still
          // repositioned proportionally so pieces land at the actual span.
          const SPAN_REF_M = 20 * 12 * IN;
          const sxFit = use12King ? 1 : ((isShared && !uses20ftStl) ? (span / SPAN_REF_M) : 1);

          // Classify by PCA axis: |cos| > |sin| means the piece is more
          // horizontal than vertical → length runs along X. Otherwise along Y.
          const lengthIsX = Math.abs(Math.cos(axis)) >= Math.abs(Math.sin(axis));
          const sLenX = lengthIsX ? sxFit : 1;
          const sLenY = lengthIsX ? 1 : sxFit;
          return (
            <group
              key={piece}
              position={[cx * sxFit + off.x, cy + off.y, cz + off.z]}
              scale={[psc.x * sLenX, psc.y * sLenY, psc.z]}
            >
              <mesh geometry={geom} position={[-cx, -cy, -cz]} castShadow receiveShadow>
                <WoodMaterial color={color} category="truss" piece={piece} rotation={grainRot} singleMaterial />
              </mesh>
            </group>
          );
        })}
        {HAMMER20_EXTRA_PIECES.map(({ key, piece }) => {
          const override = pieceOverrides[key];
          if (!override) return null;
          const { geom, axis } = override;
          const grainRot = Math.PI / 2 - axis;
          const off = pieceOffsets?.[piece] ?? { x: 0, y: 0, z: 0 };
          const psc = pieceScales?.[piece] ?? { x: 1, y: 1, z: 1 };
          if (!geom.boundingBox) geom.computeBoundingBox();
          const bb = geom.boundingBox!;
          const cx = (bb.min.x + bb.max.x) / 2;
          const cy = (bb.min.y + bb.max.y) / 2;
          const cz = (bb.min.z + bb.max.z) / 2;
          // The 20′ extras are authored at 20′ span; shrink only the principal
          // (length) axis on smaller widths so the 5.5″×5.5″ cross-section
          // is preserved.
          const SPAN_REF_M = 20 * 12 * IN;
          const sxFit = span < SPAN_REF_M ? span / SPAN_REF_M : 1;
          const lengthIsX = Math.abs(Math.cos(axis)) >= Math.abs(Math.sin(axis));
          const sLenX = lengthIsX ? sxFit : 1;
          const sLenY = lengthIsX ? 1 : sxFit;


          return (
            <group
              key={piece}
              position={[cx * sxFit + off.x, cy + off.y, cz + off.z]}
              scale={[psc.x * sLenX, psc.y * sLenY, psc.z]}
            >
              <mesh geometry={geom} position={[-cx, -cy, -cz]} castShadow receiveShadow>
                <WoodMaterial color={color} category="truss" piece={piece} rotation={grainRot} singleMaterial />
              </mesh>
            </group>
          );
        })}
        {kingBrace(1)}
        {kingBrace(-1)}
      </group>
      )}
      {/* Principal rafters (top chords) — rendered for all spans, including the 20' STL. */}
      {!bodyHidden && [1, -1].map((s) => (
        <PlumbRafter
          key={`tc-${s}`}
          iy={rise}
          outerX={half + 4 * IN + tail}
          pitchAngle={pitchAngle}
          t={memberT}
          depth={memberT}
          side={s as 1 | -1}
          color={color}
          seatX={half + 4 * IN}
          seatY={-seatLower}
          piece={`hammer.rafter.${s === 1 ? "r" : "l"}`}
          tailStyle={tailStyle}
        />
      ))}
      {plates && (
        <group name="hammer-plates" position={[groupOffset.x, groupOffset.y, groupOffset.z]}>

          {(() => {
        const profile = 6 * IN;
        const vThick = profile + vPlateSurfaceInset * 2;
        const webThick = profile + webPlateSurfaceInset * 2;
        const peakThick = profile + peakPlateSurfaceInset * 2;
        // Decorative plates are locked to the 16'-wide pavilion size so
        // every width shows the same plate. (No unitScale multiplier.)
        const plateSizeM = profile * 2.4;
        // Hammer-beam outer joint (post / hammer beam / rafter foot).
        const hj = (s: 1 | -1) => [s * (half - profile * 0.25), profile * 0.55] as [number, number];
        return (
          <>
            {/* Hammer-beam outer joints (post / hammer beam / rafter foot) — STL plate */}
            {([1, -1] as const).map((s) => {
              const [jx, jy] = hj(s);
              const vExtra = s === 1 ? plateExtraOffsets?.vR : plateExtraOffsets?.vL;
              const wExtra = s === 1 ? plateExtraOffsets?.wR : plateExtraOffsets?.wL;
              return (
                <group key={`hhb-${s}`}>
                  <group position={[vExtra?.x ?? 0, vExtra?.y ?? 0, vExtra?.z ?? 0]}>
                    <TrussPlateSTL
                      position={[jx, jy]}
                      depth={vThick}
                      sizeM={plateSizeM}
                      mirror={s === -1}
                      offset={plateOffset}
                      rotation={plateRotation}
                      sizeScale={plateSizeScale}
                    />
                  </group>
                  <group position={[wExtra?.x ?? 0, wExtra?.y ?? 0, wExtra?.z ?? 0]}>
                    <WebPlateSTL
                      position={[jx, jy]}
                      depth={webThick}
                      sizeM={plateSizeM}
                      mirror={s === -1}
                      offset={webPlateOffset}
                      rotation={webPlateRotation}
                      sizeScale={webPlateSizeScale}
                    />
                  </group>
                </group>
              );
            })}
            {/* Peak plate at the king-post apex — end trusses, outward face only */}
            {showPeakPlate && peakPlateFace !== 0 && (
              <group position={[
                plateExtraOffsets?.peak.x ?? 0,
                plateExtraOffsets?.peak.y ?? 0,
                plateExtraOffsets?.peak.z ?? 0,
              ]}>
                <PeakPlateSTL
                  position={[0, rise]}
                  depth={peakThick}
                  sizeM={plateSizeM}
                  offset={peakPlateOffset}
                  rotation={peakPlateRotation}
                  sizeScale={peakPlateSizeScale}
                  faces={[peakPlateFace]}
                />
              </group>
            )}
          </>
        );
      })()}
        </group>
      )}
    </group>
  );
}

/** Classic king-post truss: tie beam, two rafters, central king post,
 *  and two diagonal struts from the king post base out to the rafters. */
function KingTruss({
  span,
  memberHeightIn = 6,
  z,
  baseY,
  peakY,
  color,
  plates = false,
  seatLower = 0,
  tailStyle = "standard",
  peakPlateOffset = { x: 0, y: 0, z: 0 },
  peakPlateRotation = { x: 0, y: 0, z: 0 },
  peakPlateSizeScale = { x: 1, y: 1, z: 1 },
  heelPlateOffset = { x: 0, y: 0, z: 0 },
  heelPlateRotation = { x: 0, y: 0, z: 0 },
  heelPlateSizeScale = { x: 1, y: 1, z: 1 },
  webJointPlateOffset = { x: 0, y: 0, z: 0 },
  webJointPlateRotation = { x: 0, y: 0, z: 0 },
  webJointPlateSizeScale = { x: 1, y: 1, z: 1 },
  heelPlate2Offset = { x: 0, y: 0, z: 0 },
  heelPlate2Rotation = { x: 0, y: 0, z: 0 },
  heelPlate2SizeScale = { x: 1, y: 1, z: 1 },
  isOuter = false,
  peakPlateFace = 0,
}: {
  span: number;
  memberHeightIn?: number;
  z: number;
  baseY: number;
  peakY: number;
  color: string;
  plates?: boolean;
  /** Distance to lower the rafter seat below the truss base (meters).
   *  Used when the truss is lifted to keep the birdsmouth shallow. */
  seatLower?: number;
  tailStyle?: "standard" | "scroll";
  peakPlateOffset?: { x: number; y: number; z: number };
  peakPlateRotation?: { x: number; y: number; z: number };
  peakPlateSizeScale?: { x: number; y: number; z: number };
  heelPlateOffset?: { x: number; y: number; z: number };
  heelPlateRotation?: { x: number; y: number; z: number };
  heelPlateSizeScale?: { x: number; y: number; z: number };
  webJointPlateOffset?: { x: number; y: number; z: number };
  webJointPlateRotation?: { x: number; y: number; z: number };
  webJointPlateSizeScale?: { x: number; y: number; z: number };
  heelPlate2Offset?: { x: number; y: number; z: number };
  heelPlate2Rotation?: { x: number; y: number; z: number };
  heelPlate2SizeScale?: { x: number; y: number; z: number };
  isOuter?: boolean;
  peakPlateFace?: 1 | -1 | 0;
}) {
  // Dimensions from blueprint (3 1/2" x 7 1/4" timbers).
  const IN = 0.0254; // 1 inch in meters
  const thick = 5.5 * IN;   // Z depth (truss thickness)
  const profile = memberHeightIn * IN; // member height in elevation


  // King post sits 1mm inside the tie/rafter plane; struts sit a further 1mm
  // behind the king post to prevent z-fighting at the joint.
  const inset = 0.001;
  const kingThick = thick - 2 * inset;
  const strutThick = kingThick - 2 * inset;
  const strutProfile = (memberHeightIn - 0.5) * IN;
  const half = span / 2;
  const rise = peakY - baseY;
  const pitchAngle = Math.atan2(rise, half);
  const tail = 12 * 0.0254;
  const is12ftSpan = span < 13 * 12 * IN && span > 10 * 12 * IN;
  const king12Raw = useSingleHammerPieceGeom("king_beam_12", is12ftSpan);
  // King-truss plate geometries (loaded once, mirrored arch-style across faces).
  const peakPlateGeom = useSingleHammerPieceGeom("king_peak_plate", plates);
  const heelPlateGeom = useSingleHammerPieceGeom("truss_plateV2", plates);
  const webPlateGeom  = useSingleHammerPieceGeom("king_web_plate", plates);
  const heelPlate2Geom = useSingleHammerPieceGeom("king_heel_plate2", plates);
  // Geometry-local bounding-box centers so rotation pivots around each plate's own center.
  const centerOf = (g: THREE.BufferGeometry | undefined | null): [number, number, number] => {
    if (!g) return [0, 0, 0];
    if (!g.boundingBox) g.computeBoundingBox();
    const bb = g.boundingBox!;
    return [(bb.min.x + bb.max.x) / 2, (bb.min.y + bb.max.y) / 2, (bb.min.z + bb.max.z) / 2];
  };
  const peakPlateCenter = useMemo(() => centerOf(peakPlateGeom?.geom), [peakPlateGeom]);
  const heelPlateCenter = useMemo(() => centerOf(heelPlateGeom?.geom), [heelPlateGeom]);
  const webPlateCenter  = useMemo(() => centerOf(webPlateGeom?.geom),  [webPlateGeom]);
  const heelPlate2Center = useMemo(() => centerOf(heelPlate2Geom?.geom), [heelPlate2Geom]);
  const king12 = useMemo(() => {
    if (!king12Raw) return null;
    const g = king12Raw.geom.clone();
    g.computeBoundingBox();
    const bb = g.boundingBox!;
    g.translate(
      -(bb.min.x + bb.max.x) / 2,
      -bb.min.y,
      -(bb.min.z + bb.max.z) / 2,
    );
    g.computeBoundingBox();
    return g;
  }, [king12Raw]);

  // Tie beam: bottom is dropped `tieDrop` below the girder top; height matches
  // the rafter profile (cut from the top). King post and struts sit on the
  // resulting tie-beam top.
  const tieDrop = 2.25 * 0.0254; // raised 1" from prior 3.25"
  const tieBotY = -tieDrop;
  const tieTopY = tieBotY + profile;
  const tieMidY = tieBotY + profile / 2;

  // King post runs from the top of the (lowered) tie beam up to the underside
  // of the rafters at the peak (rafter underside at x=0 is rise - profile/(2*cos)).
  const cosA = Math.cos(pitchAngle);
  const rafterBottomAtZero = rise - profile / (2 * cosA);
  const kingH = rafterBottomAtZero - tieTopY;

  // Strut bisects the 90° corner between the tie beam (horizontal) and the
  // king post (vertical), running at exactly 45°.
  function strut(side: 1 | -1) {
    const tanA = Math.sin(pitchAngle) / cosA;
    // Start at the upper-outer corner of the (raised) tie beam / king post junction.
    const sx = side * profile / 2;
    const sy = tieTopY;
    // Bottom is fixed at (sx, sy). Top lands on the rafter centerline,
    // shifted 6" outward along the rafter from the 45° intersection point.
    const IN_ = 0.0254;
    const absX45 = (rise - sy + profile / 2) / (1 + tanA);
    const absX = absX45 + 6 * IN_;
    const end = new THREE.Vector3(side * absX, rise - tanA * absX, 0);
    const start = new THREE.Vector3(sx, sy, 0);
    const mid = start.clone().add(end).multiplyScalar(0.5);
    const dir = end.clone().sub(start);
    const len = dir.length();
    const rot = Math.atan2(dir.y, dir.x) - Math.PI / 2;
    return (
      <mesh key={`ks-${side}`} position={mid.toArray()} rotation={[0, 0, rot]} castShadow>
        <boxGeometry args={[strutProfile, len, strutThick]} />
        <WoodMaterial color={color} vertical category="truss" piece={`king.strut.${side === 1 ? "r" : "l"}`} />
      </mesh>
    );
  }

  return (
    <group name="king-truss" position={[0, baseY, z]}>

      {/* Tie beam — extends out over the girder; the TOP edge is trimmed at
          the rafter pitch so it tucks under the rafter, while the bottom
          continues straight out past the girder for a clean tail. */}
      {(() => {
        const IN_ = 0.0254;
        const halfOut = half + 4 * IN_; // extend to outer face of girder
        const tanA = Math.sin(pitchAngle) / cosA;
        // x where the rafter underside meets the tie-beam top (world tieTopY).
        const xTop = Math.max(0, (rafterBottomAtZero - tieTopY) / tanA);
        const xTopClamped = Math.min(xTop, halfOut - 0.01);
        // Rectangular bottom; sloped top from the rafter-meet point out to the
        // outer end so the tie doesn't stick up past the rafter.
        const shape = new THREE.Shape();
        shape.moveTo(-halfOut, -profile / 2);
        shape.lineTo(halfOut, -profile / 2);
        shape.lineTo(halfOut, -profile / 2 + 0.001);
        shape.lineTo(xTopClamped, profile / 2);
        shape.lineTo(-xTopClamped, profile / 2);
        shape.lineTo(-halfOut, -profile / 2 + 0.001);
        shape.lineTo(-halfOut, -profile / 2);
        const geom = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false });
        geom.translate(0, 0, -thick / 2);
        return (
          <mesh position={[0, tieMidY, -0.001]} geometry={geom} castShadow receiveShadow>
            <WoodMaterial color={color} category="truss" piece="king.tie" singleMaterial />
          </mesh>
        );
      })()}



      {/* Rafters: birdsmouth seats on the outer face of the girder beam
          (girder is 8" wide, centered on `half`), so seat extends 4" past `half`. */}
      {[1, -1].map((s) => (
        <PlumbRafter
          key={`kr-${s}`}
          iy={rise}
          outerX={half + 4 * IN + tail}
          pitchAngle={pitchAngle}
          t={profile}
          depth={thick}

          side={s as 1 | -1}
          color={color}
          seatX={half + 4 * IN}
          seatY={-seatLower}
          piece={`king.rafter.${s === 1 ? "r" : "l"}`}
          tailStyle={tailStyle}
        />
      ))}

      {/* King post: from top of (raised) tie beam up to peak */}
      <mesh position={[0, tieTopY + kingH / 2, 0]} castShadow>
        <boxGeometry args={[profile, kingH, kingThick]} />
        <WoodMaterial color={color} vertical category="truss" piece="king.kingpost" />
      </mesh>




      {strut(1)}
      {strut(-1)}
      {plates && (() => {
        const plateThick = 0.5 * IN;
        const zPush = thick / 2 + plateThick / 2;
        // Joint anchors in truss-local meters.
        const peakAnchor: [number, number] = [0, rise - profile * 0.5];
        const heelAnchorAt = (s: 1 | -1): [number, number] => [s * (half - profile * 0.25), tieTopY - profile * 0.1];
        const webAnchorAt = (s: 1 | -1): [number, number] => {
          const tanA = Math.sin(pitchAngle) / cosA;
          const absX45 = (rise - tieTopY + profile / 2) / (1 + tanA);
          const absX = absX45 + 6 * IN;
          return [s * absX, rise - tanA * absX - profile * 0.05];
        };
        const plateMat = (
          <meshStandardMaterial color="#141414" roughness={0.4} metalness={0.85} />
        );
        // Large-span King plates (24/28/32′): reuse the same STL plate branch
        // as 16/20′ — the anchors below are parametric on span/pitch/profile,
        // so plates land on the correct joints at every width. The prior
        // procedural runtime branch has been removed because it produced
        // detached box plates that didn't match the STL plate set.
        void isLargeRuntimeSpan;
        return (
          <group name="king-plates">
            {/* Peak plate — outer end trusses only, pavilion-outside face only. Rotates around plate's own center. */}
            {isOuter && peakPlateFace !== 0 && peakPlateGeom && ([peakPlateFace] as const).map((face) => {
              const [cx, cy, cz] = peakPlateCenter;
              return (
                <group
                  key={`king-peak-${face}`}
                  position={[
                    peakAnchor[0] + peakPlateOffset.x + cx,
                    peakAnchor[1] + peakPlateOffset.y + cy,
                    peakPlateOffset.z + face * zPush + face * cz,
                  ]}
                >
                  <group
                    rotation={[peakPlateRotation.x, peakPlateRotation.y, peakPlateRotation.z]}
                    scale={[peakPlateSizeScale.x, peakPlateSizeScale.y, face * peakPlateSizeScale.z]}
                  >
                    <mesh
                      geometry={peakPlateGeom.geom}
                      position={[-cx, -cy, -cz]}
                      castShadow
                      receiveShadow
                      userData={{ pieceKey: "piece:king.plate.peak", pieceLabel: "king.plate.peak" }}
                    >{plateMat}</mesh>
                  </group>
                </group>
              );
            })}
            {/* Heel plates — L/R mirror × 2 faces. Rotates around plate's own center. */}
            {heelPlateGeom && ([1, -1] as const).map((s) =>
              ([1, -1] as const).map((face) => {
                const anchor = heelAnchorAt(s);
                const [cx, cy, cz] = heelPlateCenter;
                return (
                  <group
                    key={`king-heel-${s}-${face}`}
                    position={[
                      anchor[0] + s * heelPlateOffset.x + s * cx,
                      anchor[1] + heelPlateOffset.y + cy,
                      heelPlateOffset.z + face * zPush + face * cz,
                    ]}
                  >
                    <group
                      rotation={[
                        heelPlateRotation.x,
                        s === -1 ? -heelPlateRotation.y : heelPlateRotation.y,
                        s === -1 ? -heelPlateRotation.z : heelPlateRotation.z,
                      ]}
                      scale={[
                        s * heelPlateSizeScale.x,
                        heelPlateSizeScale.y,
                        face * heelPlateSizeScale.z,
                      ]}
                    >
                      <mesh
                        geometry={heelPlateGeom.geom}
                        position={[-cx, -cy, -cz]}
                        castShadow
                        receiveShadow
                        userData={{ pieceKey: `piece:king.plate.heel.${s === 1 ? "r" : "l"}`, pieceLabel: `king.plate.heel.${s === 1 ? "r" : "l"}` }}
                      >{plateMat}</mesh>
                    </group>
                  </group>
                );
              })
            )}
            {/* Heel plate 2 — second L/R mirrored pair × 2 faces, stacked on the heel joints. */}
            {heelPlate2Geom && ([1, -1] as const).map((s) =>
              ([1, -1] as const).map((face) => {
                const anchor = heelAnchorAt(s);
                const [cx, cy, cz] = heelPlate2Center;
                return (
                  <group
                    key={`king-heel2-${s}-${face}`}
                    position={[
                      anchor[0] + s * heelPlate2Offset.x + s * cx,
                      anchor[1] + heelPlate2Offset.y + cy,
                      heelPlate2Offset.z + face * zPush + face * cz,
                    ]}
                  >
                    <group
                      rotation={[
                        heelPlate2Rotation.x,
                        s === -1 ? -heelPlate2Rotation.y : heelPlate2Rotation.y,
                        s === -1 ? -heelPlate2Rotation.z : heelPlate2Rotation.z,
                      ]}
                      scale={[
                        s * heelPlate2SizeScale.x,
                        heelPlate2SizeScale.y,
                        face * heelPlate2SizeScale.z,
                      ]}
                    >
                      <mesh
                        geometry={heelPlate2Geom.geom}
                        position={[-cx, -cy, -cz]}
                        castShadow
                        receiveShadow
                        userData={{ pieceKey: `piece:king.plate.heel2.${s === 1 ? "r" : "l"}`, pieceLabel: `king.plate.heel2.${s === 1 ? "r" : "l"}` }}
                      >{plateMat}</mesh>
                    </group>
                  </group>
                );
              })
            )}
            {/* Web (strut-to-rafter) plate — single pair, two faces only (like peak). Rotates around plate's own center. */}
            {webPlateGeom && ([1, -1] as const).map((face) => {
              const anchor = webAnchorAt(1);
              const [cx, cy, cz] = webPlateCenter;
              return (
                <group
                  key={`king-web-${face}`}
                  position={[
                    anchor[0] + webJointPlateOffset.x + cx,
                    anchor[1] + webJointPlateOffset.y + cy,
                    webJointPlateOffset.z + face * zPush + face * cz,
                  ]}
                >
                  <group
                    rotation={[webJointPlateRotation.x, webJointPlateRotation.y, webJointPlateRotation.z]}
                    scale={[webJointPlateSizeScale.x, webJointPlateSizeScale.y, face * webJointPlateSizeScale.z]}
                  >
                    <mesh
                      geometry={webPlateGeom.geom}
                      position={[-cx, -cy, -cz]}
                      castShadow
                      receiveShadow
                      userData={{ pieceKey: "piece:king.plate.web", pieceLabel: "king.plate.web" }}
                    >{plateMat}</mesh>
                  </group>
                </group>
              );
            })}
          </group>
        );
      })()}



    </group>
  );
}





export type ScrollCapRotation = { x: number; y: number; z: number };
export const DEFAULT_SCROLL_CAP_ROTATION: ScrollCapRotation = { x: 0, y: Math.PI, z: 0 };

export const ShingleCapRotationContext = createContext<number>(0);
export type ShingleCapScale = { x: number; y: number; z: number };
export const DEFAULT_SHINGLE_CAP_SCALE: ShingleCapScale = { x: 1, y: 1, z: 1 };
export const ShingleCapScaleContext = createContext<ShingleCapScale>(DEFAULT_SHINGLE_CAP_SCALE);
export type ShingleCapOffset = { x: number; y: number; z: number };
export const DEFAULT_SHINGLE_CAP_OFFSET: ShingleCapOffset = { x: 0, y: 0, z: 0 };
export const ShingleCapOffsetContext = createContext<ShingleCapOffset>(DEFAULT_SHINGLE_CAP_OFFSET);
export type ShingleCapTextureScale = { x: number; y: number; z: number };
// x,y scale the pebble bump texture footprint (UV s/t); z scales bump depth.
export const DEFAULT_SHINGLE_CAP_TEXTURE_SCALE: ShingleCapTextureScale = { x: 1, y: 1, z: 1 };
export const ShingleCapTextureScaleContext = createContext<ShingleCapTextureScale>(DEFAULT_SHINGLE_CAP_TEXTURE_SCALE);


export function Pavilion({ config, showRoof = true, showTrusses = true, showFrame = true, showRafters = true, grainAdjust, grainPieces, grainFaces, handPeeledRandom = DEFAULT_HAND_PEELED_RANDOM, scrollCapRotation = DEFAULT_SCROLL_CAP_ROTATION, rakeTrimAdjust = DEFAULT_RAKE_TRIM_ADJUST, metalRakeTrimAdjust = DEFAULT_METAL_RAKE_TRIM_ADJUST, backRakeRotate = DEFAULT_BACK_RAKE_ROTATE, backRakeRotation = DEFAULT_BACK_RAKE_ROTATION, shingleScale = 1, shingleContrast = 1.55, shingleBrightness = 0.92, shingleSaturate = 1.05, shingleBumpScale = 1.2, shingleRoughness = 0.95, shingleCapRotation = 0, shingleCapScale = DEFAULT_SHINGLE_CAP_SCALE, shingleCapOffset = DEFAULT_SHINGLE_CAP_OFFSET, shingleCapTextureScale = DEFAULT_SHINGLE_CAP_TEXTURE_SCALE, hammerYOffset = 0, hammerScale = { x: 1, y: 1, z: 1 }, hammerGroupOffset = { x: 0, y: 0, z: 0 }, hammerCorbelScale = { x: 1, y: 1, z: 1 }, hammerCorbelOffset = { x: 0, y: 0, z: 0 }, hammerCorbelRotation = { x: 0, y: 0, z: 0 }, hammerPieceOffsets, hammerPieceScales, hammerUniformProfile55 = false, hammer12Glb = HAMMER12_GLB_DEFAULT_ADJUST, hammer14Glb = HAMMER14_GLB_DEFAULT_ADJUST, hammer16Glb = HAMMER16_GLB_DEFAULT_ADJUST, hammer20Glb = HAMMER20_GLB_DEFAULT_ADJUST, plateOffset = { x: 0, y: 0, z: 0 }, plateRotation = { x: 0, y: 0, z: 0 }, plateSizeScale = 1, webPlateOffset = { x: 0, y: 0, z: 0 }, webPlateRotation = { x: 0, y: 0, z: 0 }, webPlateSizeScale = 1, vPlateSurfaceInset = 0, webPlateSurfaceInset = 0, peakPlateOffset = { x: 0, y: 0, z: 0 }, peakPlateRotation = { x: 0, y: 0, z: 0 }, peakPlateSizeScale = 1, peakPlateSurfaceInset = 0, archPlateOffset = { x: 0, y: 0, z: 0 }, archPlateRotation = { x: 0, y: 0, z: 0 }, archPlateSizeScale = { x: 1, y: 1, z: 1 }, simplePlateOffset = { x: 0, y: 0, z: 0 }, simplePlateRotation = { x: 0, y: 0, z: 0 }, simplePlateSizeScale = { x: 1, y: 1, z: 1 }, topPlateOffset = { x: 0, y: 0, z: 0 }, topPlateRotation = { x: 0, y: 0, z: 0 }, topPlateSizeScale = { x: 1, y: 1, z: 1 }, webPlate2Offset = { x: 0, y: 0, z: 0 }, webPlate2Rotation = { x: 0, y: 0, z: 0 }, webPlate2SizeScale = { x: 1, y: 1, z: 1 }, kingPeakPlateOffset = { x: 0, y: 0, z: 0 }, kingPeakPlateRotation = { x: 0, y: 0, z: 0 }, kingPeakPlateSizeScale = { x: 1, y: 1, z: 1 }, kingHeelPlateOffset = { x: 0, y: 0, z: 0 }, kingHeelPlateRotation = { x: 0, y: 0, z: 0 }, kingHeelPlateSizeScale = { x: 1, y: 1, z: 1 }, kingWebPlateOffset = { x: 0, y: 0, z: 0 }, kingWebPlateRotation = { x: 0, y: 0, z: 0 }, kingWebPlateSizeScale = { x: 1, y: 1, z: 1 }, kingHeelPlate2Offset = { x: 0, y: 0, z: 0 }, kingHeelPlate2Rotation = { x: 0, y: 0, z: 0 }, kingHeelPlate2SizeScale = { x: 1, y: 1, z: 1 }, trussPlateExtraOffsets, pavilionStain = null, deckStain = null, stainOpacity = 0.9, stainDarkness = 0.3, rawBeamColor = NATURAL_PINE_BEAM, rawDeckColor = NATURAL_PINE_DECK, roofOnlyLiftIn = 0, onRootMount, onGrainPick, pieceAdjusts }: { config: PavilionConfig; showRoof?: boolean; showTrusses?: boolean; showFrame?: boolean; showRafters?: boolean; grainAdjust?: GrainAdjust; grainPieces?: GrainPieceAdjust; grainFaces?: GrainFaceAdjust; handPeeledRandom?: HandPeeledRandom; scrollCapRotation?: ScrollCapRotation; rakeTrimAdjust?: RakeTrimAdjust; metalRakeTrimAdjust?: RakeTrimAdjust; backRakeRotate?: boolean; backRakeRotation?: BackRakeRotation; shingleScale?: number; shingleContrast?: number; shingleBrightness?: number; shingleSaturate?: number; shingleBumpScale?: number; shingleRoughness?: number; shingleCapRotation?: number; shingleCapScale?: ShingleCapScale; shingleCapOffset?: ShingleCapOffset; shingleCapTextureScale?: ShingleCapTextureScale; hammerYOffset?: number; hammerScale?: { x: number; y: number; z: number }; hammerGroupOffset?: { x: number; y: number; z: number }; hammerCorbelScale?: { x: number; y: number; z: number }; hammerCorbelOffset?: { x: number; y: number; z: number }; hammerCorbelRotation?: { x: number; y: number; z: number }; hammerPieceOffsets?: Record<string, { x: number; y: number; z: number }>; hammerPieceScales?: Record<string, { x: number; y: number; z: number }>; hammerUniformProfile55?: boolean; hammer12Glb?: Hammer12Adjust; hammer14Glb?: Hammer14Adjust; hammer16Glb?: Hammer16Adjust; hammer20Glb?: Hammer20Adjust; plateOffset?: { x: number; y: number; z: number }; plateRotation?: { x: number; y: number; z: number }; plateSizeScale?: number; webPlateOffset?: { x: number; y: number; z: number }; webPlateRotation?: { x: number; y: number; z: number }; webPlateSizeScale?: number; vPlateSurfaceInset?: number; webPlateSurfaceInset?: number; peakPlateOffset?: { x: number; y: number; z: number }; peakPlateRotation?: { x: number; y: number; z: number }; peakPlateSizeScale?: number; peakPlateSurfaceInset?: number; archPlateOffset?: { x: number; y: number; z: number }; archPlateRotation?: { x: number; y: number; z: number }; archPlateSizeScale?: { x: number; y: number; z: number }; simplePlateOffset?: { x: number; y: number; z: number }; simplePlateRotation?: { x: number; y: number; z: number }; simplePlateSizeScale?: { x: number; y: number; z: number }; topPlateOffset?: { x: number; y: number; z: number }; topPlateRotation?: { x: number; y: number; z: number }; topPlateSizeScale?: { x: number; y: number; z: number }; webPlate2Offset?: { x: number; y: number; z: number }; webPlate2Rotation?: { x: number; y: number; z: number }; webPlate2SizeScale?: { x: number; y: number; z: number }; kingPeakPlateOffset?: { x: number; y: number; z: number }; kingPeakPlateRotation?: { x: number; y: number; z: number }; kingPeakPlateSizeScale?: { x: number; y: number; z: number }; kingHeelPlateOffset?: { x: number; y: number; z: number }; kingHeelPlateRotation?: { x: number; y: number; z: number }; kingHeelPlateSizeScale?: { x: number; y: number; z: number }; kingWebPlateOffset?: { x: number; y: number; z: number }; kingWebPlateRotation?: { x: number; y: number; z: number }; kingWebPlateSizeScale?: { x: number; y: number; z: number }; kingHeelPlate2Offset?: { x: number; y: number; z: number }; kingHeelPlate2Rotation?: { x: number; y: number; z: number }; kingHeelPlate2SizeScale?: { x: number; y: number; z: number }; trussPlateExtraOffsets?: TrussPlateExtraOffsets; pavilionStain?: string | null; deckStain?: string | null; stainOpacity?: number; stainDarkness?: number; rawBeamColor?: string; rawDeckColor?: string; roofOnlyLiftIn?: number; onRootMount?: (g: THREE.Group | null) => void; onGrainPick?: (key: string, label: string) => void; pieceAdjusts?: Record<string, PieceAdjust> }) {
  const pavRootRef = useRef<THREE.Group | null>(null);

  // Species stays Eastern White Pine; the selected finish changes tooling relief.

  // Stain tuning: opacity = how much stain shows vs raw wood; darkness = how much to darken.
  const wood = useMemo(() => {
    const base = rawBeamColor;
    if (!pavilionStain) return base;
    const c = new THREE.Color(pavilionStain).lerp(new THREE.Color("#ffffff"), 1 - stainOpacity).multiplyScalar(1 - stainDarkness);
    return "#" + c.getHexString();
  }, [pavilionStain, stainOpacity, stainDarkness, rawBeamColor]);

  const roofMat = useRoofMat(config.roofId);
  const roofColor = roofMat.hex;
  const roofType = roofMat.type;

  // config.length = center-to-center distance between end posts along Z
  // (i.e. how far apart the vertical beams are). config.width remains
  // outside-to-outside between perimeter posts on the X axis.
  const frame = expandedFrame(config.width, config.length);
  const layout = pavilionStations(config.width, config.length);
  const POST_THICK = 7.5 * 0.0254; // matches Post geometry (8" square)
  const postOffset = 0.15;
  const w = config.width * FT + 2 * postOffset - POST_THICK; // X
  const l = config.length * FT + 2 * postOffset; // Z — post centers at ±config.length*FT/2
  // Girder beams: 8" x 8", resting on top of the posts.
  const beamWidth = ((frame?.girderIn[0] ?? 8) - 0.5) * 0.0254;
  const beamT = ((frame?.girderIn[1] ?? 8) - 0.5) * 0.0254; // 8 inches
  // `config.height` is the distance from the ground to the TOP of the
  // vertical post + girder assembly (i.e. top of girder beam). Subtract the
  // girder thickness so the post (vertical beam) terminates at that height.
  const h = config.height * FT - beamT;
  const scrollEnd = useScrollEndGeometry(beamT);
  const girderOverhang = 14 * 0.0254;
  const girderLen = l - postOffset * 2 + girderOverhang * 2 - 1 * 0.0254;
  const girderAssetUrl = "scroll_cut_girder_beam";
  const girderGeom = useGirderBeamGeometry(beamWidth, girderLen, girderAssetUrl);
  const girderCap = useGirderCapGeometry(beamWidth);
  const showGirderCaps = girderLen > 400 * 0.0254;

  const corners: [number, number][] = [
    [-w / 2 + postOffset, -l / 2 + postOffset],
    [w / 2 - postOffset, -l / 2 + postOffset],
    [-w / 2 + postOffset, l / 2 - postOffset],
    [w / 2 - postOffset, l / 2 - postOffset],
  ];

  const centerPosts: [number, number][] = layout.postZ.slice(1, -1).flatMap(z => [
    [-w / 2 + postOffset, z * FT] as [number, number],
    [w / 2 - postOffset, z * FT] as [number, number],
  ]);
  const trussPosts = centerPosts.filter(([,z]) => layout.trussZ.some(t => Math.abs(t * FT - z) < 0.001));
  // The 20×36 takeoff specifies 14 braces: quarter-point posts are unbraced.
  const bracedPosts = frame?.braces === 14 && frame.posts === 10 ? trussPosts : centerPosts;

  // Top beams (ring)
  const beamY = h + beamT / 2; // bottom of beam sits on top of post

  // Roof — pitch shared by trusses and roof slopes (8/12).
  const pitch = config.roof === "flat" ? 0.05 : 8 / 12;
  const overhang = 18 * 0.0254; // 18" gable-rake overhang (length direction)
  const trussSpan = w - postOffset * 2;
  // Peak height above the wall beam, set by truss span at the shared pitch.
  const ridgeH = config.roof === "flat" ? 0.15 : (trussSpan / 2) * pitch;
  // Side-eave overhang: roof terminates flush with the rafter tail's plumb
  // cut (girder outer face + 12" rafter tail = 16" past `half`).
  const rafterTailOffset = 16 * 0.0254; // 4" girder half-width + 12" tail
  const widthOverhang = config.roof === "flat"
    ? overhang
    : rafterTailOffset - postOffset;
  const roofFullWidth = w + widthOverhang * 2;
  // Lift roof so its underside sits on top of the truss/rafter top edges.
  // Rafters seat on top of the girder (lift = beamT/2 above beamY), and the
  // rafter top edge is rafterT / cos(angle) above the rafter seat.
  // Sheet profiles describe the King package; alternate styles retain their authored geometry.
  const rafterHeightIn = frame && (config.truss === "king" || config.truss === "none") ? frame.rafterIn[1] : 6;
  const rafterT = rafterHeightIn * 0.0254;
  const slopeLen = Math.hypot(1, pitch);
  // Raise the trusses + rafters as one piece so the birdsmouth notch can be
  // shallower while still seating on top of the girder. ~2" lift.
  const TRUSS_LIFT = config.roof === "flat" ? 0 : 4 * 0.0254;
  // Drop the whole roof + truss assembly by 3/4" without changing the
  // birdsmouth depth (seatLower stays the same relative to the truss group).
  const ROOF_DROP = 2.25 * 0.0254;
  // Slider-only roof+decking lift (inches → meters). Lifts ONLY the roof slabs
  // (gable/hip/flat), leaving trusses, rafters, ridge, fascia, and framing put.
  const ROOF_ONLY_LIFT = roofOnlyLiftIn * 0.0254;
  const roofLift = config.roof === "flat" ? 0 : beamT / 2 + TRUSS_LIFT + (rafterT * slopeLen) / 2;
  const roofEaveY = config.roof === "flat" ? 0 : ridgeH - (roofFullWidth / 2) * pitch + roofLift; // relative to beamY
  const roofRidgeH = config.roof === "flat" ? 0.15 : ridgeH + roofLift - roofEaveY;

  return (
   <WoodFinishContext.Provider value={config.woodId}>
   <HandPeeledRandomContext.Provider value={handPeeledRandom}>
   <ShingleScaleContext.Provider value={shingleScale}>
   <ShingleContrastContext.Provider value={shingleContrast}>
   <PureWhiteShinglesContext.Provider value={roofMat.id === "pure-white"}>
   <ShingleBrightnessContext.Provider value={shingleBrightness}>
   <ShingleSaturateContext.Provider value={shingleSaturate}>
   <ShingleBumpScaleContext.Provider value={shingleBumpScale}>
   <ShingleRoughnessContext.Provider value={shingleRoughness}>
   <NaturalDeckContext.Provider value={!deckStain}>
   <DeckStainContext.Provider value={deckStain ? "#" + new THREE.Color(deckStain).lerp(new THREE.Color("#ffffff"), 1 - stainOpacity).multiplyScalar(1 - stainDarkness).getHexString() : rawDeckColor}>

   <ShingleCapRotationContext.Provider value={shingleCapRotation}>
   <ShingleCapScaleContext.Provider value={shingleCapScale}>
   <ShingleCapOffsetContext.Provider value={shingleCapOffset}>
   <ShingleCapTextureScaleContext.Provider value={shingleCapTextureScale}>

   <BackRakeRotateContext.Provider value={backRakeRotate}>
   <BackRakeRotationContext.Provider value={backRakeRotation}>
   <RakeTrimAdjustContext.Provider value={roofMat.type === "metal" ? metalRakeTrimAdjust : rakeTrimAdjust}>
    <GrainAdjustContext.Provider value={grainAdjust ?? {}}>
    <GrainPieceContext.Provider value={grainPieces ?? {}}>
    <GrainFaceContext.Provider value={grainFaces ?? {}}>
    <group
      ref={(g) => { pavRootRef.current = g; onRootMount?.(g); }}
      name="pavilion-root"
      onClick={onGrainPick ? (e: any) => {
        const m = e?.object?.material;
        const mat = Array.isArray(m) ? m[e.face?.materialIndex ?? 0] : m;
        const key = mat?.userData?.grainKey;
        if (!key) return;
        e.stopPropagation();
        if (typeof window !== "undefined") (window as any).__lastPavilionPickedObject = e.object;
        onGrainPick(key, mat?.userData?.grainLabel ?? key);
      } : undefined}
    >
      <PieceAdjuster
        rootRef={pavRootRef}
        adjusts={(() => {
          const src = pieceAdjusts ?? {};
          // Rafter pieces are only adjustable when scroll-cut tails are
          // selected. With standard tails, rafter positions stay baked.
          const filtered: Record<string, PieceAdjust> = {};
          for (const k of Object.keys(src)) {
            const bare = k.replace(/^(piece:|cat:)/, "");
            if (config.rafterTail !== "scroll" && (/\.rafter\.(l|r)$/.test(bare) || bare === "side.collar")) continue;
            filtered[k] = src[k];
          }
          // Mirror the in-between "side.rafter.l/r" adjust onto each truss
          // style's own top-chord rafters so the truss-mounted rafters move
          // with the center rafters. Style keys win if explicitly set.
          for (const side of ["l", "r"] as const) {
            const srcKey = `side.rafter.${side}`;
            const adj = filtered[srcKey];
            if (!adj) continue;
            for (const style of ["hammer", "king", "arch"]) {
              const tk = `${style}.rafter.${side}`;
              if (!filtered[tk]) filtered[tk] = adj;
            }
          }
          return filtered;
        })()}

        // NOTE: do NOT include config.rafterTail here. Toggling scroll-cut
        // tails must not invalidate the baseline cache for non-rafter pieces
        // (arch truss, hammer, king, plates). If it did, the next frame would
        // re-capture the already-mutated mesh position as the new "original",
        // and re-applying offsets would shift/scale those pieces incorrectly.
        cacheKey={`${config.width}x${config.length}|${config.roof}|${config.truss}`}
      />



      {showFrame && (
        <>
          {/* Posts */}
          {corners.map(([x, z], i) => (
            <Post key={i} x={x} z={z} height={h} style={config.post} color={wood} />
          ))}

          {/* Post bases */}
          {corners.map(([x, z], i) => (
            <PostBase key={`pb-${i}`} x={x} z={z} />
          ))}

          {/* Center posts (length > 16') */}
          {centerPosts.map(([x, z], i) => (
            <Post key={`cp-${i}`} x={x} z={z} height={h} style="square" color={wood} />
          ))}
          {centerPosts.map(([x, z], i) => (
            <PostBase key={`cpb-${i}`} x={x} z={z} />
          ))}


          {/* Arched braces */}
          {config.post === "brace" &&
            (() => {
              // Target diagonal (furthest tip to furthest tip). Default 51"
              // preserves the previous visual size; scale slider multiplies it.
              const braceDiagM = (51 * 0.0254) * (config.braceScale ?? 1);
              // Underside of the rafter at the eave: girder top + truss lift - roof drop.
              const rafterBottomY = beamY + beamT / 2 + TRUSS_LIFT - ROOF_DROP + 1 * 0.0254;
              return corners.flatMap(([x, z], i) => [
                // Hide the gable-end (truss-plane) corbel braces on BOTH
                // gable ends when the truss is the Arched King.
                config.truss === "arch" ? null : (

                <ArchedBrace
                  key={`bx-${i}`}
                  postX={x}
                  postZ={z}
                  toX={-x}
                  toZ={z}
                  topY={rafterBottomY}
                  postThick={POST_THICK}
                  beamThick={beamT}
                  lengthM={braceDiagM}
                  color={wood}
                />),
                <ArchedBrace
                  key={`bz-${i}`}
                  postX={x}
                  postZ={z}
                  toX={x}
                  toZ={-z}
                  topY={rafterBottomY}
                  postThick={POST_THICK}
                  beamThick={beamT}
                  lengthM={braceDiagM}
                  color={wood}
                />,
              ]).concat(
                bracedPosts.flatMap(([x, z], i) => [
                  <ArchedBrace
                    key={`cbz+-${i}`}
                    postX={x}
                    postZ={z}
                    toX={x}
                    toZ={z + 1}
                    topY={rafterBottomY}
                    postThick={POST_THICK}
                    beamThick={beamT}
                    lengthM={braceDiagM}
                    color={wood}
                  />,
                  <ArchedBrace
                    key={`cbz--${i}`}
                    postX={x}
                    postZ={z}
                    toX={x}
                    toZ={z - 1}
                    topY={rafterBottomY}
                    postThick={POST_THICK}
                    beamThick={beamT}
                    lengthM={braceDiagM}
                    color={wood}
                  />,
                ])
              );
            })()}



          {/* Middle-truss corbel braces — render at the center posts flanking
              the middle truss whenever one exists (length >= 26'), so the
              middle truss matches the front/back trusses. Skipped when posts
              are already in "brace" style (those center posts get braces from
              the block above). */}
          {config.length >= 26 && config.post !== "brace" && centerPosts.length > 0 && (() => {
            const braceDiagM = (51 * 0.0254) * (config.braceScale ?? 1);
            const rafterBottomY = beamY + beamT / 2 + TRUSS_LIFT - ROOF_DROP + 1 * 0.0254;
            return bracedPosts.flatMap(([x, z], i) => [
              <ArchedBrace
                key={`mtb+-${i}`}
                postX={x}
                postZ={z}
                toX={x}
                toZ={z + 1}
                topY={rafterBottomY}
                postThick={POST_THICK}
                beamThick={beamT}
                lengthM={braceDiagM}
                color={wood}
              />,
              <ArchedBrace
                key={`mtb--${i}`}
                postX={x}
                postZ={z}
                toX={x}
                toZ={z - 1}
                topY={rafterBottomY}
                postThick={POST_THICK}
                beamThick={beamT}
                lengthM={braceDiagM}
                color={wood}
              />,
            ]);
          })()}

          {/* Middle-truss WIDTH-direction corbel braces — mirror the
              front/back gable braces (lines ~4227) at the center posts so
              the middle truss has the same corbel support. Hammer & King
              only (Arch hides its gable corbels by design). Length >= 28'. */}
          {layout.trussZ.length > 2 && trussPosts.length > 0 &&
            (config.truss === "hammer" || config.truss === "king") &&
            (() => {
              const braceDiagM = (51 * 0.0254) * (config.braceScale ?? 1);
              const rafterBottomY = beamY + beamT / 2 + TRUSS_LIFT - ROOF_DROP + 1 * 0.0254;
              return trussPosts.map(([x, z], i) => (
                <ArchedBrace
                  key={`mtbw-${i}`}
                  postX={x}
                  postZ={z}
                  toX={-x}
                  toZ={z}
                  topY={rafterBottomY}
                  postThick={POST_THICK}
                  beamThick={beamT}
                  lengthM={braceDiagM}
                  color={wood}
                />
              ));
            })()}

        </>
      )}


      {/* Decorative trusses spaced ~4 ft on center along the length */}
      {showTrusses && config.truss !== "none" &&
        (() => {
          const usable = l - postOffset * 2;
          // Two end trusses for short pavilions; add a single middle truss
          // (3 total) once the pavilion reaches 26 ft or longer.
          const bays = layout.trussZ.length - 1;
          const count = bays + 1;
          const step = usable / bays;
          const z0 = -l / 2 + postOffset;
          return Array.from({ length: count }, (_, i) => {
            if (config.hideBackTruss && i === count - 1) return null;
            const zEnd = z0 + step * i;
            // Truss is lifted by TRUSS_LIFT; rafter seat is lowered by the same
            // amount so it still rests on top of the girder beam.
            const trussBase = beamY + beamT / 2 + TRUSS_LIFT - ROOF_DROP;
            const common = {
              span: trussSpan,
              z: zEnd,
              baseY: trussBase,
              peakY: trussBase + ridgeH,
              color: wood,
              plates: config.trussPlates,
              seatLower: TRUSS_LIFT,
              tailStyle: config.rafterTail,
            };
            if (config.truss === "arch") {
              if (isLargeRuntimeSpan(common.span)) {
                return <RuntimeArchTruss key={`rat-${i}`} {...common} plates={config.trussPlates} isOuter={i === 0 || i === count - 1} exteriorFace={i === 0 ? -1 : 1} />;
              }
              return <ArchTruss key={`at-${i}`} {...common} plates={config.trussPlates} archPlateOffset={archPlateOffset} archPlateRotation={archPlateRotation} archPlateSizeScale={archPlateSizeScale} simplePlateOffset={simplePlateOffset} simplePlateRotation={simplePlateRotation} simplePlateSizeScale={simplePlateSizeScale} topPlateOffset={topPlateOffset} topPlateRotation={topPlateRotation} topPlateSizeScale={topPlateSizeScale} webPlate2Offset={webPlate2Offset} webPlate2Rotation={webPlate2Rotation} webPlate2SizeScale={webPlate2SizeScale} isOuter={i === 0 || i === count - 1} exteriorFace={i === 0 ? -1 : 1} />;
            }
            if (config.truss === "hammer") {
              if (isLargeRuntimeSpan(common.span)) {
                return <RuntimeHammerTruss key={`rht-${i}`} {...common} plates={config.trussPlates} showPeakPlate={i === 0 || i === count - 1} peakPlateFace={i === 0 ? -1 : i === count - 1 ? 1 : 0} />;
              }
              // Every hand-modeled hammer GLB auto-fits its widest horizontal
              // axis to the requested `span`, so widths above 20′ (24/28/32)
              // safely reuse the 20′ GLB stretched to the larger pavilion span
              // instead of falling through to the older procedural truss which
              // was never calibrated past ~16′.
              if (
                config.width === 12 ||
                config.width === 14 ||
                config.width === 16 ||
                config.width >= 20
              ) {
                const GlbTruss =
                  config.width === 12 ? Hammer12Truss :
                  config.width === 14 ? Hammer14Truss :
                  config.width === 16 ? Hammer16Truss :
                  Hammer20Truss; // 20, 24, 28, 32 → largest hand-modeled truss, auto-fit
                const glbAdjust =
                  config.width === 12 ? hammer12Glb :
                  config.width === 14 ? hammer14Glb :
                  config.width === 16 ? hammer16Glb :
                  hammer20Glb;
                return (
                  <group key={`hglb-${i}`}>
                    <GlbTruss span={common.span} z={common.z} baseY={common.baseY} color={common.color} adjust={glbAdjust as any} />
                    {config.trussPlates && (
                      <HammerTruss
                        {...common}
                        bodyHidden
                        plateOffset={plateOffset}
                        plateRotation={plateRotation}
                        plateSizeScale={plateSizeScale}
                        webPlateOffset={webPlateOffset}
                        webPlateRotation={webPlateRotation}
                        webPlateSizeScale={webPlateSizeScale}
                        vPlateSurfaceInset={vPlateSurfaceInset}
                        webPlateSurfaceInset={webPlateSurfaceInset}
                        peakPlateOffset={peakPlateOffset}
                        peakPlateRotation={peakPlateRotation}
                        peakPlateSizeScale={peakPlateSizeScale}
                        peakPlateSurfaceInset={peakPlateSurfaceInset}
                        plateExtraOffsets={trussPlateExtraOffsets}
                        showPeakPlate={i === 0 || i === count - 1}
                        peakPlateFace={i === 0 ? -1 : i === count - 1 ? 1 : 0}
                      />
                    )}
                  </group>
                );
              }
              return <HammerTruss key={`ht-${i}`} {...common} yOffset={hammerYOffset} scaleX={hammerScale.x} scaleY={hammerScale.y} scaleZ={hammerScale.z} groupOffset={hammerGroupOffset} corbelScale={hammerCorbelScale} corbelOffset={hammerCorbelOffset} corbelRotation={hammerCorbelRotation} pieceOffsets={hammerPieceOffsets} pieceScales={hammerPieceScales} uniformProfile55={hammerUniformProfile55} useDedicated20Stl={config.width === 20} borrowAll20Pieces={false} plateOffset={plateOffset} plateRotation={plateRotation} plateSizeScale={plateSizeScale} webPlateOffset={webPlateOffset} webPlateRotation={webPlateRotation} webPlateSizeScale={webPlateSizeScale} vPlateSurfaceInset={vPlateSurfaceInset} webPlateSurfaceInset={webPlateSurfaceInset} peakPlateOffset={peakPlateOffset} peakPlateRotation={peakPlateRotation} peakPlateSizeScale={peakPlateSizeScale} peakPlateSurfaceInset={peakPlateSurfaceInset} plateExtraOffsets={trussPlateExtraOffsets} showPeakPlate={i === 0 || i === count - 1} peakPlateFace={i === 0 ? -1 : i === count - 1 ? 1 : 0} />;
            }
            return <KingTruss key={`kt-${i}`} {...common} memberHeightIn={rafterHeightIn} peakPlateOffset={kingPeakPlateOffset} peakPlateRotation={kingPeakPlateRotation} peakPlateSizeScale={kingPeakPlateSizeScale} heelPlateOffset={kingHeelPlateOffset} heelPlateRotation={kingHeelPlateRotation} heelPlateSizeScale={kingHeelPlateSizeScale} webJointPlateOffset={kingWebPlateOffset} webJointPlateRotation={kingWebPlateRotation} webJointPlateSizeScale={kingWebPlateSizeScale} heelPlate2Offset={kingHeelPlate2Offset} heelPlate2Rotation={kingHeelPlate2Rotation} heelPlate2SizeScale={kingHeelPlate2SizeScale} isOuter={i === 0 || i === count - 1} peakPlateFace={i === 0 ? -1 : i === count - 1 ? 1 : 0} />;
          });
        })()}

      {/* Rafters at ~4 ft on center along the length, matching truss rafters */}
      {showTrusses && showRafters && config.roof !== "flat" &&
        (() => {
          const IN = 0.0254;
          const thick = 5.5 * IN;
          const profile = rafterT;
          // Compute truss positions (must match the truss loop above) and
          // evenly distribute rafters at ~4 ft on center within each bay
          // between trusses, so spacing is uniform up to the outside trusses.
          const half = trussSpan / 2;
          const tail = 12 * IN;
          const rise = ridgeH;
          const pitchAngle = Math.atan2(rise, half);
          const baseY = beamY + beamT / 2 + TRUSS_LIFT - ROOF_DROP;
          const rafterZs = layout.rafterZ.map(z => z * FT);
          // Collar tie: 84" long for the 10' pavilion. Derive height on the
          // rafter from the requested length so the ends touch the rafters.
          const collarSize = (frame?.collarIn[1] ?? 6) * IN;
          const cutDx = collarSize / Math.tan(pitchAngle);
          // Finished bevels stay inside the listed stock length.
          const collarLen = frame ? frame.collarStockFt * FT - cutDx : 84 * IN;
          // rafter inner-face x at height y = half * (1 - y/rise)
          // collar half-length at midheight = collarLen/2 ⇒ collarT = 1 - (collarLen/2)/half
          const collarT = Math.min(0.9, Math.max(0.1, 1 - (collarLen / 2) / half));
          const collarY = rise * collarT - 3.5 * IN;
          // Angled end cut parallel to rafter slope: top end is shorter,
          // bottom end is longer (rafter rises moving inward).
          const halfTop = (collarLen - cutDx) / 2;
          const halfBot = (collarLen + cutDx) / 2;
          const hh = collarSize / 2;
          const collarShape = new THREE.Shape();
          collarShape.moveTo(-halfBot, -hh);
          collarShape.lineTo(halfBot, -hh);
          collarShape.lineTo(halfTop, hh);
          collarShape.lineTo(-halfTop, hh);
          collarShape.lineTo(-halfBot, -hh);
          const collarGeom = new THREE.ExtrudeGeometry(collarShape, {
            depth: collarSize,
            bevelEnabled: false,
          });
          collarGeom.translate(0, 0, -collarSize / 2);
          return rafterZs.map((z, i) => (
            <group key={`rf-${i}`} position={[0, baseY, z]}>
              {[1, -1].map((s) => (
                <PlumbRafter
                  key={`r-${s}`}
                  iy={rise}
                  outerX={half + 4 * IN + tail}
                  pitchAngle={pitchAngle}
                  t={profile}
                  depth={thick}
                  side={s as 1 | -1}
                  color={wood}
                  seatX={half + 4 * IN}
                  seatY={-TRUSS_LIFT}
                  piece={`side.rafter.${s === 1 ? "r" : "l"}`}
                  tailStyle={config.rafterTail}
                />
              ))}
              {/* 6x6 collar tie with rafter-angle end cuts */}
              <mesh position={[0, collarY, 0]} geometry={collarGeom} castShadow receiveShadow>
                <WoodMaterial color={wood} category="truss" piece="side.collar" singleMaterial />
              </mesh>
            </group>
          ));
        })()}

      {/* Gable-end fascia (rake board) — looks like a rafter but only 2" thick,
          mounted flush with the outside face of the roof on each gable end. */}
      {showTrusses && config.roof === "gable" && config.gableFascia && (() => {
        const IN = 0.0254;
        const fasciaDepth = 2 * IN; // 2" wide along Z
        const profile = rafterT;
        const half = trussSpan / 2;
        const tail = config.gableOverhang ? 12 * IN : 0;
        const rise = ridgeH;
        const pitchAngle = Math.atan2(rise, half);
        const baseY = beamY + beamT / 2 + TRUSS_LIFT - ROOF_DROP + 0.25 * IN;
        const roofLength = l - postOffset * 2 + (config.gableOverhang ? 18 * IN * 2 : 0);
        // Outside face of fascia flush with gable end of roof.
        const zOuter = roofLength / 2;
        return [1, -1].map((zSide) => {
          const zCenter = zSide * (zOuter - fasciaDepth / 2);
          return (
            <group key={`fascia-${zSide}`} position={[0, baseY, zCenter]}>
              {[1, -1].map((s) => (
                <PlumbRafter
                  key={`fr-${s}`}
                  iy={rise}
                  outerX={half + 4 * IN + tail}
                  pitchAngle={pitchAngle}
                  t={profile}
                  depth={fasciaDepth}
                  side={s as 1 | -1}
                  color={wood}
                  piece={`side.rafter.${s === 1 ? "r" : "l"}`}
                  tailStyle={config.rafterTail}
                />
              ))}
            </group>
          );
        });
      })()}



      {/* Top beams along length (Z) on each side — extend 8" past each end post,
          with a decorative scroll cut at each end (top reveal + concave quarter
          arc down to the bottom edge). */}
      {showFrame && (() => {
        const renderBeam = (xPos: number) => (
          <group position={[xPos, beamY, 0]} rotation={[0, -Math.PI / 2, 0]} scale={[1, beamT / beamWidth, 1]}>
            <mesh geometry={girderGeom} castShadow>
              <WoodMaterial color={wood} roughness={0.8} category="beam" rotation={Math.PI * 1.5} singleMaterial />
            </mesh>
            {showGirderCaps && girderCap && (
              <>
                <mesh geometry={girderCap.geometry} position={[girderLen / 2, 0, 0]} castShadow>
                  <WoodMaterial color={wood} roughness={0.8} category="beam" rotation={Math.PI * 1.5} singleMaterial />
                </mesh>
                <mesh geometry={girderCap.geometry} position={[-girderLen / 2, 0, 0]} rotation={[0, Math.PI, 0]} castShadow>
                  <WoodMaterial color={wood} roughness={0.8} category="beam" rotation={Math.PI * 1.5} singleMaterial />
                </mesh>
              </>
            )}
          </group>
        );
        return (
          <>
            {renderBeam(-w / 2 + postOffset)}
            {renderBeam(w / 2 - postOffset)}
          </>
        );
      })()}
      {/* End cross beams removed — truss tie beams sit in this location */}

      {/* Ridge pole: 3.5" x 7.25", runs along Z between the inside faces of
          the end (interior) trusses, top flush with the peak. */}
      {showTrusses && config.roof === "gable" && config.truss !== "none" && !config.hideBackTruss && (() => {
        const IN = 0.0254;
        const ridgeW = frame ? (frame.ridgeIn[0] - 0.5) * IN : 3.5 * IN;   // X
        const ridgeH_ = frame ? (frame.ridgeIn[1] - 0.75) * IN : 7.25 * IN; // Y
        const trussThick = 5.5 * IN;
        const usable = l - postOffset * 2;
        const ridgeLen = usable - trussThick; // inside face to inside face
        const peakY = beamY + beamT / 2 + TRUSS_LIFT - ROOF_DROP + ridgeH;
        return (
          <mesh position={[0, peakY - ridgeH_ / 2 + rafterT / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[ridgeW, ridgeH_, ridgeLen]} />
            <WoodMaterial color={wood} category="beam" piece="ridge" />
          </mesh>
        );
      })()}

      {/* Roof */}
      {showRoof && config.roof === "gable" && (
        <GableRoof
          width={roofFullWidth}
          length={snowRoofLength(config)}
          baseY={beamY + roofEaveY - ROOF_DROP + 0.0381 + ROOF_ONLY_LIFT}
          ridgeH={roofRidgeH}
          wood={wood}
          roofColor={roofColor}
          roofType={roofType}
          spliceOffsetZ={config.gableOverhang ? 18 * 0.0254 : 0}
          snowGuards={config.snowGuards && (roofType === "standing-seam" || roofType === "metal")}
          snowRail={!!config.snowRail && (roofType === "standing-seam" || roofType === "metal")}
        />
      )}
      {showRoof && config.roof === "hip" && (
        <HipRoof
          width={roofFullWidth}
          length={l - postOffset * 2 + 18 * 0.0254 * 2}
          baseY={beamY + roofEaveY - ROOF_DROP + 0.0381 + ROOF_ONLY_LIFT}
          ridgeH={roofRidgeH}
          roofColor={roofColor}
          roofType={roofType}
        />
      )}
      {showRoof && config.roof === "flat" && (
        <FlatRoof
          width={roofFullWidth}
          length={l - postOffset * 2 + 18 * 0.0254 * 2}
          baseY={beamY + beamT / 2 + 0.0381 + ROOF_ONLY_LIFT}
          thickness={0.18}
          roofColor={roofColor}
          roofType={roofType}
          wood={wood}
        />
      )}
    </group>
    </GrainFaceContext.Provider>
   </GrainPieceContext.Provider>
   </GrainAdjustContext.Provider>
  </RakeTrimAdjustContext.Provider>
  </BackRakeRotationContext.Provider>
  </BackRakeRotateContext.Provider>
  </ShingleCapTextureScaleContext.Provider>
  </ShingleCapOffsetContext.Provider>
  </ShingleCapScaleContext.Provider>
  </ShingleCapRotationContext.Provider>
   </DeckStainContext.Provider>
   </NaturalDeckContext.Provider>
   </ShingleRoughnessContext.Provider>
  </ShingleBumpScaleContext.Provider>
  </ShingleSaturateContext.Provider>
  </ShingleBrightnessContext.Provider>
  </PureWhiteShinglesContext.Provider>
  </ShingleContrastContext.Provider>
  </ShingleScaleContext.Provider>
  </HandPeeledRandomContext.Provider>
  </WoodFinishContext.Provider>
  );
}

function GableRoof({
  width,
  length,
  baseY,
  ridgeH,
  wood,
  roofColor,
  roofType,
  spliceOffsetZ = 0,
  snowGuards = false,
  snowRail = false,
}: {
  width: number;
  length: number;
  baseY: number;
  ridgeH: number;
  wood: string;
  roofColor: string;
  roofType: string;
  spliceOffsetZ?: number;
  snowGuards?: boolean;
  snowRail?: boolean;
}) {
  const baseSlope = Math.sqrt((width / 2) ** 2 + ridgeH ** 2);
  const angle = Math.atan2(ridgeH, width / 2);
  const EAVE_EXTEND = 1 * 0.0254; // extend roof 1" down the rafter tail
  const slopeLen = baseSlope + EAVE_EXTEND;
  const shiftX = (EAVE_EXTEND / 2) * Math.cos(angle);
  const shiftY = -(EAVE_EXTEND / 2) * Math.sin(angle);

  const slabThick = roofType === "shingle" ? 0.05 - 0.0254 : 0.05;
  // Trim the top edge of the slab at the eave so the eave face is plumb
  // (vertical in world space) — matches the rafter tail's plumb cut.
  const eaveTrim = slabThick * Math.tan(angle);
  const makePanelGeom = (eaveSign: 1 | -1) => {
    const s = new THREE.Shape();
    // ridge corner on -eaveSign side, eave corner on +eaveSign side
    const rX = -eaveSign * slopeLen / 2;
    const eX = eaveSign * slopeLen / 2;
    const eTopX = eaveSign * (slopeLen / 2 - eaveTrim);
    s.moveTo(rX, -slabThick / 2);   // ridge bottom
    s.lineTo(eX, -slabThick / 2);   // eave bottom
    s.lineTo(eTopX, slabThick / 2); // eave top (plumb cut)
    s.lineTo(rX, slabThick / 2);    // ridge top
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: length, bevelEnabled: false });
    g.translate(0, 0, -length / 2);
    return g;
  };
  const rightPanelGeom = useMemo(() => makePanelGeom(1), [slopeLen, slabThick, eaveTrim, length]);
  const leftPanelGeom = useMemo(() => makePanelGeom(-1), [slopeLen, slabThick, eaveTrim, length]);
  const matProps = roofMaterialProps(roofType);
  const shingleTex = useShingleTexture(slopeLen, length);
  // Right slope gets a 180°-rotated copy of the shingle texture so the
  // tile pattern reads differently from the left slope.
  const shingleTexRight = useMemo(() => {
    const t = shingleTex.clone();
    t.center.set(0.5, 0.5);
    t.rotation = shingleTex.rotation + Math.PI;
    t.needsUpdate = true;
    return t;
  }, [shingleTex]);

  // Texture has ~10 plank seams per tile. To get 6" seam spacing in world,
  // one tile must cover 10 * 6" = 60" = 1.524 m along the seam-crossing axis.
  // After the +PI/2 rotation in useUndersideTexture, seams run along the
  // length axis and are spaced along the slope axis (U).
  const PLANK_TILE_M = 3.048; // 10 planks * 8"
  const undersideTex = useUndersideTexture(
    Math.max(1, slopeLen / PLANK_TILE_M),
    Math.max(1, length / PLANK_TILE_M),
    0,
    0,
    0,
  );
  const isShingle = roofType === "shingle";
  const shingleBumpScale = useContext(ShingleBumpScaleContext);
  const shingleRoughness = useContext(ShingleRoughnessContext);
  const deckColor = useContext(DeckStainContext);
  return (
    <group position={[0, baseY, 0]}>
      {/* Left slope */}
      <group position={[-width / 4 - shiftX, ridgeH / 2 + shiftY, 0]} rotation={[0, 0, angle]}>
        <mesh castShadow geometry={leftPanelGeom}>
          <meshStandardMaterial
            key={isShingle ? "shingle" : "plain"}
            color={roofColor}
            {...matProps}
            map={isShingle ? shingleTex : null}
            bumpMap={isShingle ? shingleTex : null}
            bumpScale={isShingle ? shingleBumpScale : 0}
            roughness={isShingle ? shingleRoughness : matProps.roughness}
          />

        </mesh>
        <mesh position={[0, -0.026, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[slopeLen, length]} />
          <meshStandardMaterial map={undersideTex} color={deckColor} roughness={0.85} side={THREE.DoubleSide} />
        </mesh>
        {roofType === "standing-seam" && (
          <SeamRidges slopeLen={slopeLen} panelDepth={length} color={roofColor} eaveTrim={eaveTrim} eaveSign={-1} />
        )}
        {(roofType === "standing-seam" || roofType === "metal") && snowGuards && (
          <SnowGuards slopeLen={slopeLen} panelDepth={length} color={roofColor} eaveSign={-1} roofType={roofType as "standing-seam" | "metal"} />
        )}
        {snowRail && (roofType === "standing-seam" || roofType === "metal") && (
          <SnowRail slopeLen={slopeLen} panelDepth={length} color={roofColor} eaveSign={-1} />
        )}
        {roofType === "metal" && (
          <MetalRibs slopeLen={slopeLen} panelDepth={length} color={roofColor} eaveTrim={eaveTrim} eaveSign={-1} />
        )}
        {(roofType === "standing-seam" || roofType === "metal") && (
          <RakeTrim slopeLen={slopeLen} length={length} eaveTrim={eaveTrim} eaveSign={-1} rakeSign={1} color={roofColor} />
        )}
      </group>
      {/* Right slope */}
      <group position={[width / 4 + shiftX, ridgeH / 2 + shiftY, 0]} rotation={[0, 0, -angle]}>
        <mesh castShadow geometry={rightPanelGeom}>
          <meshStandardMaterial
            key={isShingle ? "shingle" : "plain"}
            color={roofColor}
            {...matProps}
            map={isShingle ? shingleTex : null}
            bumpMap={isShingle ? shingleTex : null}
            bumpScale={isShingle ? shingleBumpScale : 0}
            roughness={isShingle ? shingleRoughness : matProps.roughness}
          />

        </mesh>
        <mesh position={[0, -0.026, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[slopeLen, length]} />
          <meshStandardMaterial map={undersideTex} color={deckColor} roughness={0.85} side={THREE.DoubleSide} />
        </mesh>
        {roofType === "standing-seam" && (
          <SeamRidges slopeLen={slopeLen} panelDepth={length} color={roofColor} eaveTrim={eaveTrim} eaveSign={1} />
        )}
        {(roofType === "standing-seam" || roofType === "metal") && snowGuards && (
          <SnowGuards slopeLen={slopeLen} panelDepth={length} color={roofColor} eaveSign={1} roofType={roofType as "standing-seam" | "metal"} />
        )}
        {snowRail && (roofType === "standing-seam" || roofType === "metal") && (
          <SnowRail slopeLen={slopeLen} panelDepth={length} color={roofColor} eaveSign={1} />
        )}
        {roofType === "metal" && (
          <MetalRibs slopeLen={slopeLen} panelDepth={length} color={roofColor} eaveTrim={eaveTrim} eaveSign={1} />
        )}
        {(roofType === "standing-seam" || roofType === "metal") && (
          <RakeTrim slopeLen={slopeLen} length={length} eaveTrim={eaveTrim} eaveSign={1} rakeSign={1} color={roofColor} />
        )}
      </group>

      {/* Back-gable rake-trim assembly. The two back rakes are rendered here as
       *  one rigid unit so they can be rotated 180° about the back-gable
       *  vertical centerline (z = -length/2) when BackRakeRotateContext is on. */}
      {(roofType === "standing-seam" || roofType === "metal") && (
        <BackRakeAssembly
          width={width}
          length={length}
          slopeLen={slopeLen}
          eaveTrim={eaveTrim}
          shiftX={shiftX}
          shiftY={shiftY}
          ridgeH={ridgeH}
          angle={angle}
          roofColor={roofColor}
        />
      )}


      {/* Metal ridge cap along the peak */}
      {(roofType === "metal" || roofType === "standing-seam") && (
        <group position={[0, ridgeH + (roofType === "metal" ? 0.06 : 0.0854), 0]}>
          <MetalRidgeCap ridgeLen={length} angle={angle} color={roofColor} />
        </group>
      )}

      {/* Shingle ridge cap: STL of cap-shingle saddles, tiled along the ridge. */}
      {isShingle && (
        <ShingleRidgeCap
          ridgeLen={length}
          ridgeH={ridgeH}
          color={roofColor}
          matProps={matProps}
        />
      )}
      

      {/* Gable ends left open so the trusses are exposed on both ends */}
    </group>
  );
}

function GableEnd({
  width,
  ridgeH,
  z,
  wood,
}: {
  width: number;
  ridgeH: number;
  z: number;
  wood: string;
}) {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-width / 2, 0);
    s.lineTo(width / 2, 0);
    s.lineTo(0, ridgeH);
    s.lineTo(-width / 2, 0);
    return s;
  }, [width, ridgeH]);
  return (
    <mesh position={[0, 0, z]} rotation={[0, 0, 0]}>
      <extrudeGeometry args={[shape, { depth: 0.04, bevelEnabled: false }]} />
      <WoodMaterial color={wood} side={THREE.DoubleSide} category="plank" />
    </mesh>
  );
}

function HipRoof({
  width,
  length,
  baseY,
  ridgeH,
  roofColor,
  roofType,
}: {
  width: number;
  length: number;
  baseY: number;
  ridgeH: number;
  roofColor: string;
  roofType: string;
}) {
  const ridgeLen = Math.max(0.1, length - width);
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const w = width / 2;
    const l = length / 2;
    const r = ridgeLen / 2;
    const v = new Float32Array([
      -w, 0, -l,
       w, 0, -l,
       w, 0,  l,
      -w, 0,  l,
      -r, ridgeH, 0,
       r, ridgeH, 0,
    ]);
    // Planar UVs from XZ so a tileable texture maps cleanly.
    const uv = new Float32Array([
      0, 0,
      1, 0,
      1, 1,
      0, 1,
      0.5, 0.5,
      0.5, 0.5,
    ]);
    const idx = [
      0, 1, 5, 0, 5, 4,
      2, 3, 4, 2, 4, 5,
      3, 0, 4,
      1, 2, 5,
    ];
    g.setAttribute("position", new THREE.BufferAttribute(v, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, [width, length, ridgeH, ridgeLen]);
  const matProps = roofMaterialProps(roofType);
  const isShingle = roofType === "shingle";
  const shingleBumpScale = useContext(ShingleBumpScaleContext);
  const shingleRoughness = useContext(ShingleRoughnessContext);
  const deckColor = useContext(DeckStainContext);
  const shingleTex = useShingleTexture(width, length);

  const hipAngle = Math.atan2(ridgeH, width / 2);
  const PLANK_TILE_M = 3.048; // 10 planks * 8"
  const undersideTex = useUndersideTexture(
    Math.max(1, width / PLANK_TILE_M),
    Math.max(1, length / PLANK_TILE_M),
  );
  return (
    <group position={[0, baseY, 0]}>
      <mesh geometry={geom} castShadow>
        <meshStandardMaterial
          key={isShingle ? "shingle" : "plain"}
          color={roofColor}
          {...matProps}
          side={THREE.DoubleSide}
          map={isShingle ? shingleTex : null}
          bumpMap={isShingle ? shingleTex : null}
          bumpScale={isShingle ? shingleBumpScale : 0}
            roughness={isShingle ? shingleRoughness : matProps.roughness}
        />
      </mesh>
      {/* Underside wood planks (rendered just below the roof shell, back-faces only) */}
      <mesh geometry={geom} position={[0, -0.03, 0]}>
        <meshStandardMaterial map={undersideTex} color={deckColor} roughness={0.85} side={THREE.BackSide} />
      </mesh>
      {(roofType === "metal" || roofType === "standing-seam") && (
        <group position={[0, ridgeH + (roofType === "metal" ? 0.06 : 0.0854), 0]}>
          <MetalRidgeCap ridgeLen={ridgeLen} angle={hipAngle} color={roofColor} />
        </group>
      )}
    </group>
  );
}


function FlatRoof({
  width,
  length,
  baseY,
  thickness,
  roofColor,
  roofType,
  wood,
}: {
  width: number;
  length: number;
  baseY: number;
  thickness: number;
  roofColor: string;
  roofType: string;
  wood: string;
}) {
  const matProps = roofMaterialProps(roofType);
  const isShingle = roofType === "shingle";
  const shingleBumpScale = useContext(ShingleBumpScaleContext);
  const shingleRoughness = useContext(ShingleRoughnessContext);
  const deckColor = useContext(DeckStainContext);
  const shingleTex = useShingleTexture(width - 0.05, length - 0.05);

  const PLANK_TILE_M = 3.048; // 10 planks * 8"
  const undersideTex = useUndersideTexture(
    Math.max(1, width / PLANK_TILE_M),
    Math.max(1, length / PLANK_TILE_M),
  );
  return (
    <group position={[0, baseY, 0]}>
      <mesh position={[0, thickness / 2, 0]} castShadow>
        <boxGeometry args={[width, thickness, length]} />
        <WoodMaterial color={wood} category="beam" />
      </mesh>
      <mesh position={[0, -0.002, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[width, length]} />
        <meshStandardMaterial map={undersideTex} color={deckColor} roughness={0.85} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, thickness + 0.01, 0]}>
        <boxGeometry args={[width - 0.05, 0.02, length - 0.05]} />
        <meshStandardMaterial
          key={isShingle ? "shingle" : "plain"}
          color={roofColor}
          {...matProps}
          map={isShingle ? shingleTex : null}
          bumpMap={isShingle ? shingleTex : null}
          bumpScale={isShingle ? shingleBumpScale : 0}
            roughness={isShingle ? shingleRoughness : matProps.roughness}
        />

      </mesh>
      {roofType === "standing-seam" && (
        <group position={[0, thickness + 0.03, 0]}>
          <SeamRidges slopeLen={width - 0.05} panelDepth={length - 0.05} color={roofColor} />
        </group>
      )}
      {roofType === "metal" && (
        <group position={[0, thickness + 0.03, 0]}>
          <MetalRibs slopeLen={width - 0.05} panelDepth={length - 0.05} color={roofColor} />
        </group>
      )}
    </group>
  );
}
