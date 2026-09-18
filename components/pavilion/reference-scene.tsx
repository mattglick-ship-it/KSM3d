"use client";
import {expandedFrame} from '@/lib/pavilion-layout';
import {NATURAL_PINE_BEAM,NATURAL_PINE_DECK,NATURAL_PINE_BEAM_KEY,NATURAL_PINE_DECK_KEY} from '@/lib/natural-pine';
import {useContext} from 'react';
import {DefaultsContext} from './published-settings';
import { PAVILION_BAKED_DEFAULTS } from '@/lib/pavilionBakedDefaults';
import type { SceneInputs } from './designer-model';
function useBakedValue<T>(key:string,initial:T|(()=>T)): [T, import('react').Dispatch<import('react').SetStateAction<T>>] {
 const raw=useContext(DefaultsContext)[key];const value=raw===undefined?(typeof initial==='function'?(initial as ()=>T)():initial):JSON.parse(raw);
 return [value,()=>{}];
}
import { lazy, useMemo, useState } from "react";
import { ROOF_MATERIALS, type PavilionConfig } from "@/lib/pavilion-config";
import { type GrainCategory, DEFAULT_RAKE_TRIM_ADJUST, DEFAULT_METAL_RAKE_TRIM_ADJUST, DEFAULT_HAND_PEELED_RANDOM, type RakeTrimAdjust, type TrussPlateExtraOffsets, type HandPeeledRandom, SnowRailAdjustContext } from "@/components/pavilion/Pavilion3D";
import { type PieceAdjust } from "@/components/pavilion/PieceAdjuster";
import { HAMMER20_BAKED_OFFSETS_IN, HAMMER20_BAKED_SCALES } from "@/components/pavilion/hammer20Baked";
import { HAMMER16_BAKED_PIECE_ADJUSTS, HAMMER16_BAKED_PLATE_OFFSETS_IN } from "@/components/pavilion/hammer16Baked";
import { HAMMER12_BAKED_PIECE_ADJUSTS, HAMMER12_BAKED_PIECE_OFFSETS_IN, HAMMER12_BAKED_PIECE_SCALES, HAMMER12_BAKED_PLATE_OFFSETS_IN, HAMMER12_BAKED_SCALE } from "@/components/pavilion/hammer12Baked";
import { HAMMER14_BAKED_PIECE_ADJUSTS, HAMMER14_BAKED_PIECE_OFFSETS_IN, HAMMER14_BAKED_PIECE_SCALES, HAMMER14_BAKED_PLATE_OFFSETS_IN, HAMMER14_BAKED_SCALE } from "@/components/pavilion/hammer14Baked";
import { HAMMER20_BAKED_GROUP_OFFSET_IN, HAMMER20_BAKED_PIECE_ADJUSTS_FULL, HAMMER20_BAKED_PIECE_OFFSETS_IN, HAMMER20_BAKED_PIECE_SCALES, HAMMER20_BAKED_SCALE_V } from "@/components/pavilion/hammer20BakedFull";

const Scene = lazy(() =>
  import("@/components/pavilion/Scene").then((m) => ({ default: m.Scene })),
);
type PlacementItem = "sofa" | "table" | "egg" | "dining" | "patio";
const POST_THICK_IN = 7.5;
const POST_HALF_IN = POST_THICK_IN / 2;
const PLACEMENT_FOOTPRINTS_IN: Record<PlacementItem, { x: number; z: number }> = {
  sofa: { x: 96, z: 48 },
  table: { x: 72, z: 60 },
  egg: { x: 48, z: 48 },
  dining: { x: 72, z: 38 },
  patio: { x: 96, z: 84 },
};
function placementBoundsFor(config: PavilionConfig, item: PlacementItem, rotationDeg: number) {
  const insideX = Math.max(0, (config.width * 12) / 2 - POST_THICK_IN);
  const insideZ = Math.max(0, (config.length * 12) / 2 - POST_HALF_IN);
  const footprint = PLACEMENT_FOOTPRINTS_IN[item];
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const halfX = (footprint.x / 2) * cos + (footprint.z / 2) * sin;
  const halfZ = (footprint.x / 2) * sin + (footprint.z / 2) * cos;
  return {
    maxX: Math.max(0, insideX - halfX),
    maxZ: Math.max(0, insideZ - halfZ),
  };
}
function clampPlacementOffset(offset: { x: number; z: number }, bounds: { maxX: number; maxZ: number }) {
  return {
    x: Math.max(-bounds.maxX, Math.min(bounds.maxX, offset.x)),
    z: Math.max(-bounds.maxZ, Math.min(bounds.maxZ, offset.z)),
  };
}
export function ReferenceScene(props:SceneInputs){
const config = props.config;
const [roofOnlyLiftByWidth, setRoofOnlyLiftByWidth] = useBakedValue<Record<number, number>>(
    "pav.roofOnlyLiftByWidth.v2-baked",
    { 16: -0.75 },
  );
const [showTrusses, setShowTrusses] = useBakedValue("pav.showTrusses", true);
const [showFrame, setShowFrame] = useBakedValue("pav.showFrame", true);
const [showRafters, setShowRafters] = useBakedValue("pav.showRafters", true);
const [padTileScale, setPadTileScale] = useBakedValue("pav.padTileScale", 1);
const sofaOffset = props.furnitureLayout.sectional;
const sofaRotationDeg = props.furnitureLayout.sectional.rotation;
const tableOffset = props.furnitureLayout.picnic;
const tableRotationDeg = props.furnitureLayout.picnic.rotation;
const eggOffset = props.furnitureLayout.grill;
const eggRotationDeg = props.furnitureLayout.grill.rotation;
const tvCorner = props.tv.corner;
const tvHeightFt = props.tv.height;
const diningOffset = props.furnitureLayout.dining;
const diningRotationDeg = props.furnitureLayout.dining.rotation;
const patioOffset = props.furnitureLayout.patio;
const patioRotationDeg = props.furnitureLayout.patio.rotation;
const [stainOpacity, setStainOpacity] = useBakedValue<number>("pav.stainOpacity.v1", 0.9);
const [stainDarkness, setStainDarkness] = useBakedValue<number>("pav.stainDarkness.v1", 0.3);
const [snowRailScale, setSnowRailScale] = useBakedValue<{ x: number; y: number; z: number }>(
    "pav.snowRailScale.v3-ss-baked", { x: 0.457, y: 1.026, z: 0.497 });
const [snowRailRotationDeg, setSnowRailRotationDeg] = useBakedValue<{ x: number; y: number; z: number }>(
    "pav.snowRailRotationDeg.v3-ss-baked", { x: 180, y: 0, z: 0 });
const [snowRailPositionIn, setSnowRailPositionIn] = useBakedValue<{ x: number; y: number; z: number }>(
    "pav.snowRailPositionIn.v3-ss-baked", { x: 7.2, y: 3.45, z: 0 });
const [cloudSpread, setCloudSpread] = useBakedValue<number>("pav.cloudSpread.v1", 1);
const [cloudConcentration, setCloudConcentration] = useBakedValue<number>("pav.cloudConcentration.v1", 1);
const [cloudHeight, setCloudHeight] = useBakedValue<number>("pav.cloudHeight.v1", 0);
const D2R = Math.PI / 180;
const GRAIN_CATEGORY_DEFAULTS: Record<GrainCategory, number> = {
    post: 0,
    beam: 0,
    rafter: -114,
    truss: 0,
    brace: 14,
    plank: 0,
  };
const [grainCategoryDeg, setGrainCategoryDeg] = useBakedValue<Record<GrainCategory, number>>(
    "pav.grainCategoryDeg.v1",
    GRAIN_CATEGORY_DEFAULTS,
  );
const grainAdjust: Record<GrainCategory, number> = {
    post: (grainCategoryDeg.post ?? 0) * D2R,
    beam: (grainCategoryDeg.beam ?? 0) * D2R,
    rafter: (grainCategoryDeg.rafter ?? 0) * D2R,
    truss: (grainCategoryDeg.truss ?? 0) * D2R,
    brace: (grainCategoryDeg.brace ?? 0) * D2R,
    plank: (grainCategoryDeg.plank ?? 0) * D2R,
  };
const HAMMER_GRAIN_DEFAULTS: Record<string, number> = {
    "hammer.tie.l": 0,
    "hammer.tie.r": 0,
    "hammer.kingpost": 180,
    "hammer.post": 90,
    "hammer.strut.l": 20,
    "hammer.strut.r": -28,
    "hammer.corbel.l": -7,
    "hammer.corbel.r": -1,
    "hammer.drop.l": 90,
    "hammer.drop.r": -24,
    "hammer.prince.l": 0,
    "hammer.prince.r": 0,

    "hammer.rafter.l": 0,
    "hammer.rafter.r": 46,
  };
const baseHammerYOffsetIn = -4.75;
const baseHammerScale = { x: 1.02, y: 1.02, z: 1 };
const HAMMER12_GLB_SCALE_DEFAULT = { x: 1.24, y: 1.24, z: 1.24 };
const HAMMER12_GLB_OFFSET_DEFAULT = { x: 0, y: -11.75, z: -0.25 };
const HAMMER12_GLB_ROTATION_DEFAULT = { x: 0, y: 0, z: 0 };
const [hammer12GlbScale, setHammer12GlbScale] = useBakedValue(
    "pav.hammer12GlbScale.v2",
    HAMMER12_GLB_SCALE_DEFAULT,
  );
const [hammer12GlbOffsetIn, setHammer12GlbOffsetIn] = useBakedValue(
    "pav.hammer12GlbOffsetIn.v2",
    HAMMER12_GLB_OFFSET_DEFAULT,
  );
const [hammer12GlbRotationDeg, setHammer12GlbRotationDeg] = useBakedValue(
    "pav.hammer12GlbRotationDeg.v2",
    HAMMER12_GLB_ROTATION_DEFAULT,
  );
const hammer12GlbAdjust = useMemo(() => ({
    scale: hammer12GlbScale,
    offset: {
      x: hammer12GlbOffsetIn.x * 0.0254,
      y: hammer12GlbOffsetIn.y * 0.0254,
      z: hammer12GlbOffsetIn.z * 0.0254,
    },
    rotation: {
      x: (hammer12GlbRotationDeg.x * Math.PI) / 180,
      y: (hammer12GlbRotationDeg.y * Math.PI) / 180,
      z: (hammer12GlbRotationDeg.z * Math.PI) / 180,
    },
  }), [hammer12GlbScale, hammer12GlbOffsetIn, hammer12GlbRotationDeg]);
const HAMMER14_GLB_SCALE_DEFAULT = { x: 1.2, y: 1.2, z: 1.2 };
const HAMMER14_GLB_OFFSET_DEFAULT = { x: 0, y: -12, z: 0 };
const HAMMER14_GLB_ROTATION_DEFAULT = { x: 0, y: 0, z: 0 };
const [hammer14GlbScale, setHammer14GlbScale] = useBakedValue(
    "pav.hammer14GlbScale.v2",
    HAMMER14_GLB_SCALE_DEFAULT,
  );
const [hammer14GlbOffsetIn, setHammer14GlbOffsetIn] = useBakedValue(
    "pav.hammer14GlbOffsetIn.v2",
    HAMMER14_GLB_OFFSET_DEFAULT,
  );
const [hammer14GlbRotationDeg, setHammer14GlbRotationDeg] = useBakedValue(
    "pav.hammer14GlbRotationDeg.v2",
    HAMMER14_GLB_ROTATION_DEFAULT,
  );
const hammer14GlbAdjust = useMemo(() => ({
    scale: hammer14GlbScale,
    offset: {
      x: hammer14GlbOffsetIn.x * 0.0254,
      y: hammer14GlbOffsetIn.y * 0.0254,
      z: hammer14GlbOffsetIn.z * 0.0254,
    },
    rotation: {
      x: (hammer14GlbRotationDeg.x * Math.PI) / 180,
      y: (hammer14GlbRotationDeg.y * Math.PI) / 180,
      z: (hammer14GlbRotationDeg.z * Math.PI) / 180,
    },
  }), [hammer14GlbScale, hammer14GlbOffsetIn, hammer14GlbRotationDeg]);
const HAMMER16_GLB_SCALE_DEFAULT = { x: 1.17, y: 1.17, z: 1.17 };
const HAMMER16_GLB_OFFSET_DEFAULT = { x: 0, y: -12.5, z: 0.125 };
const HAMMER16_GLB_ROTATION_DEFAULT = { x: 0, y: 0, z: 0 };
const [hammer16GlbScale, setHammer16GlbScale] = useBakedValue(
    "pav.hammer16GlbScale.v2",
    HAMMER16_GLB_SCALE_DEFAULT,
  );
const [hammer16GlbOffsetIn, setHammer16GlbOffsetIn] = useBakedValue(
    "pav.hammer16GlbOffsetIn.v2",
    HAMMER16_GLB_OFFSET_DEFAULT,
  );
const [hammer16GlbRotationDeg, setHammer16GlbRotationDeg] = useBakedValue(
    "pav.hammer16GlbRotationDeg.v2",
    HAMMER16_GLB_ROTATION_DEFAULT,
  );
const hammer16GlbAdjust = useMemo(() => ({
    scale: hammer16GlbScale,
    offset: {
      x: hammer16GlbOffsetIn.x * 0.0254,
      y: hammer16GlbOffsetIn.y * 0.0254,
      z: hammer16GlbOffsetIn.z * 0.0254,
    },
    rotation: {
      x: (hammer16GlbRotationDeg.x * Math.PI) / 180,
      y: (hammer16GlbRotationDeg.y * Math.PI) / 180,
      z: (hammer16GlbRotationDeg.z * Math.PI) / 180,
    },
  }), [hammer16GlbScale, hammer16GlbOffsetIn, hammer16GlbRotationDeg]);
const HAMMER20_GLB_SCALE_DEFAULT = { x: 1.137, y: 1.137, z: 1.137 };
const HAMMER20_GLB_OFFSET_DEFAULT = { x: 0, y: -12.5, z: 0.0625 };
const HAMMER20_GLB_ROTATION_DEFAULT = { x: 0, y: 0, z: 0 };
const [hammer20GlbScale, setHammer20GlbScale] = useBakedValue(
    "pav.hammer20GlbScale.v2",
    HAMMER20_GLB_SCALE_DEFAULT,
  );
const [hammer20GlbOffsetIn, setHammer20GlbOffsetIn] = useBakedValue(
    "pav.hammer20GlbOffsetIn.v2",
    HAMMER20_GLB_OFFSET_DEFAULT,
  );
const [hammer20GlbRotationDeg, setHammer20GlbRotationDeg] = useBakedValue(
    "pav.hammer20GlbRotationDeg.v2",
    HAMMER20_GLB_ROTATION_DEFAULT,
  );
const hammer20GlbAdjust = useMemo(() => ({
    scale: hammer20GlbScale,
    offset: {
      x: hammer20GlbOffsetIn.x * 0.0254,
      y: hammer20GlbOffsetIn.y * 0.0254,
      z: hammer20GlbOffsetIn.z * 0.0254,
    },
    rotation: {
      x: (hammer20GlbRotationDeg.x * Math.PI) / 180,
      y: (hammer20GlbRotationDeg.y * Math.PI) / 180,
      z: (hammer20GlbRotationDeg.z * Math.PI) / 180,
    },
  }), [hammer20GlbScale, hammer20GlbOffsetIn, hammer20GlbRotationDeg]);
const is14Wide = config.width === 14;
const is12Wide = config.width === 12;
const is16Wide = config.width === 16;
const is20Wide = config.width === 20;
const hammerYOffsetIn = is20Wide ? -3.0 : baseHammerYOffsetIn;
const HAMMER16_FROM_14_SCALE_FACTOR = 16 / 14;
const hammerScale = is14Wide
    ? { ...HAMMER14_BAKED_SCALE }
    : is12Wide
      ? { ...HAMMER12_BAKED_SCALE }
      : is16Wide
        ? {
            x: HAMMER14_BAKED_SCALE.x * HAMMER16_FROM_14_SCALE_FACTOR,
            y: HAMMER14_BAKED_SCALE.y * HAMMER16_FROM_14_SCALE_FACTOR,
            z: HAMMER14_BAKED_SCALE.z * HAMMER16_FROM_14_SCALE_FACTOR,
          }
        : is20Wide
          ? { ...HAMMER20_BAKED_SCALE_V }
          : baseHammerScale;
const HAMMER_PIECES: Array<{ id: string; label: string }> = [
    { id: "hammer.tie.l", label: "Tie beam L" },
    { id: "hammer.tie.r", label: "Tie beam R" },
    { id: "hammer.toptie", label: "Top tie beam" },
    { id: "hammer.kingpost", label: "King post" },
    { id: "hammer.post", label: "Post (stub)" },
    { id: "hammer.strut.l", label: "Strut L" },
    { id: "hammer.strut.r", label: "Strut R" },
    { id: "hammer.corbel.l", label: "Corbel L" },
    { id: "hammer.corbel.r", label: "Corbel R" },
    { id: "hammer.drop.l", label: "Drop post L" },
    { id: "hammer.drop.r", label: "Drop post R" },
    { id: "hammer.prince.l", label: "Prince beam L" },
    { id: "hammer.prince.r", label: "Prince beam R" },
  ];
const HAMMER12_OFFSETS_DEFAULT: Record<string, { x: number; y: number; z: number }> = {
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
const HAMMER12_SCALES_DEFAULT: Record<string, { x: number; y: number; z: number }> = {
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
const [hammer12PieceOffsetsIn, setHammer12PieceOffsetsIn] = useBakedValue<Record<string, { x: number; y: number; z: number }>>(
    "pav.hammer12PieceOffsetsIn.v5-baked",
    { ...HAMMER12_OFFSETS_DEFAULT, ...HAMMER12_BAKED_PIECE_OFFSETS_IN },
  );
const [hammer12PieceScales, setHammer12PieceScales] = useBakedValue<Record<string, { x: number; y: number; z: number }>>(
    "pav.hammer12PieceScales.v5-baked",
    { ...HAMMER12_SCALES_DEFAULT, ...HAMMER12_BAKED_PIECE_SCALES },
  );
const HAMMER20_ZERO: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 };
const HAMMER20_UNIT: { x: number; y: number; z: number } = { x: 1, y: 1, z: 1 };
const HAMMER20_OFFSETS_DEFAULT: Record<string, { x: number; y: number; z: number }> = {
    ...Object.fromEntries(HAMMER_PIECES.map((p) => [p.id, { ...HAMMER20_ZERO }])),
    ...HAMMER20_BAKED_OFFSETS_IN,
  };
const HAMMER20_SCALES_DEFAULT: Record<string, { x: number; y: number; z: number }> = {
    ...Object.fromEntries(HAMMER_PIECES.map((p) => [p.id, { ...HAMMER20_UNIT }])),
    ...HAMMER20_BAKED_SCALES,
  };
const [hammerPieceOffsetsByWidth, setHammerPieceOffsetsByWidth] = useBakedValue<Record<string, Record<string, { x: number; y: number; z: number }>>>(
    "pav.hammerPieceOffsetsByWidth.v1",
    {},
  );
const [hammerPieceScalesByWidth, setHammerPieceScalesByWidth] = useBakedValue<Record<string, Record<string, { x: number; y: number; z: number }>>>(
    "pav.hammerPieceScalesByWidth.v1",
    {},
  );
const hammerWidthKey = String(config.width);
const otherWidthOffsetsIn = hammerPieceOffsetsByWidth[hammerWidthKey] ?? HAMMER20_OFFSETS_DEFAULT;
const otherWidthScales = hammerPieceScalesByWidth[hammerWidthKey] ?? HAMMER20_SCALES_DEFAULT;
const activePieceOffsetsIn = is14Wide ? HAMMER14_BAKED_PIECE_OFFSETS_IN : is12Wide ? hammer12PieceOffsetsIn : is16Wide ? HAMMER14_BAKED_PIECE_OFFSETS_IN : is20Wide ? HAMMER20_BAKED_PIECE_OFFSETS_IN : otherWidthOffsetsIn;
const activePieceScales = is14Wide ? HAMMER14_BAKED_PIECE_SCALES : is12Wide ? hammer12PieceScales : is16Wide ? HAMMER14_BAKED_PIECE_SCALES : is20Wide ? HAMMER20_BAKED_PIECE_SCALES : otherWidthScales;
const adjustedPieceOffsetsIn = activePieceOffsetsIn ?? null;
const hammerPieceOffsets = adjustedPieceOffsetsIn
    ? Object.fromEntries(
        Object.entries(adjustedPieceOffsetsIn).map(([k, v]) => [k, { x: v.x * 0.0254, y: v.y * 0.0254, z: v.z * 0.0254 }]),
      )
    : undefined;
const hammerPieceScales = activePieceScales ?? undefined;
const hammerUniformProfile55 = !is20Wide;
const hammerCorbelScale = hammerUniformProfile55 ? { x: 1, y: 1, z: 1 } : { x: 0.7, y: 0.7, z: 0.95 };
const hammerCorbelOffset = { x: -50.5, y: -19.5, z: 0 };
const hammerCorbelRotation = { x: 0, y: 0, z: 33 };
const hammerKingbraceGrainDeg = -133;
const plateOffsetIn = { x: -6.25, y: 0.75, z: 0 };
const plateRotationDeg = { x: 0, y: -180, z: 0 };
const plateSizeScale = 1.06;
const webPlateOffsetIn = { x: -45.75, y: 25.25, z: 0 };
const webPlateRotationDeg = { x: 0, y: -180, z: 0 };
const webPlateSizeScale = 1.49;
const vPlateSurfaceInsetIn = -0.35;
const webPlateSurfaceInsetIn = -1.3;
const peakPlateOffsetIn = { x: 0, y: -3.5, z: 0 };
const peakPlateRotationDeg = { x: 0, y: 0, z: 0 };
const peakPlateSizeScale = 1;
const peakPlateSurfaceInsetIn = -0.15;
type V3 = { x: number; y: number; z: number };
type PerWidth<T> = Partial<Record<"12" | "14" | "16" | "20" | "24" | "28" | "32", T>> & Record<"12" | "14" | "16" | "20", T>;
const ARCH_PLATE_OFFSET_DEFAULT_IN: PerWidth<V3> = {
    "12": { x: 48,    y: -123,    z: 0 },
    "14": { x: 44.5,  y: -128.5,  z: 0 },
    "16": { x: 20.25, y: -117.25, z: 0 },
    "20": { x: 10,    y: -127.25, z: 0 },
  };
const ARCH_PLATE_ROTATION_DEFAULT_DEG: PerWidth<V3> = {
    "12": { x: 0, y: 0, z: 1 }, "14": { x: 0, y: 0, z: 1 },
    "16": { x: 0, y: 0, z: 1 }, "20": { x: 0, y: 0, z: 1 },
  };
const ARCH_PLATE_SIZE_SCALE_DEFAULT: PerWidth<V3> = {
    "12": { x: 0.95, y: 0.95, z: 1 },
    "14": { x: 1,    y: 1,    z: 1 },
    "16": { x: 0.91, y: 0.91, z: 1 },
    "20": { x: 1,    y: 1,    z: 1 },
  };
const SIMPLE_PLATE_OFFSET_DEFAULT_IN: PerWidth<V3> = {
    "12": { x: 10.5, y: -115,    z: 0 },
    "14": { x: 17.5, y: -150.5,  z: 0 },
    "16": { x: 14,   y: -144.5,  z: 0 },
    "20": { x: 6.75, y: -133.75, z: 0 },
  };
const SIMPLE_PLATE_ROTATION_DEFAULT_DEG: PerWidth<V3> = {
    "12": { x: 0, y: 0, z: 2 }, "14": { x: 0, y: 0, z: 3 },
    "16": { x: 0, y: 0, z: 3 }, "20": { x: 0, y: 0, z: 3 },
  };
const SIMPLE_PLATE_SIZE_SCALE_DEFAULT: PerWidth<V3> = {
    "12": { x: 0.97, y: 1.05, z: 1 },
    "14": { x: 1.19, y: 1.35, z: 1 },
    "16": { x: 1.21, y: 1.35, z: 1 },
    "20": { x: 1.19, y: 1.35, z: 1 },
  };
const TOP_PLATE_OFFSET_DEFAULT_IN: PerWidth<V3> = {
    "12": { x: 77.5, y: -108.25, z: 0 },
    "14": { x: 77.5, y: -100.25, z: 0 },
    "16": { x: 77.5, y: -92.25,  z: 0 },
    "20": { x: 77.5, y: -76.25,  z: 0 },
  };
const TOP_PLATE_ROTATION_DEFAULT_DEG: PerWidth<V3> = {
    "12": { x: 0, y: 0, z: 0 }, "14": { x: 0, y: 0, z: 0 },
    "16": { x: 0, y: 0, z: 0 }, "20": { x: 0, y: 0, z: 0 },
  };
const TOP_PLATE_SIZE_SCALE_DEFAULT: PerWidth<V3> = {
    "12": { x: 1.05, y: 1.05, z: 1 }, "14": { x: 1.05, y: 1.05, z: 1 },
    "16": { x: 1.05, y: 1.05, z: 1 }, "20": { x: 1.05, y: 1.05, z: 1 },
  };
const WEB_PLATE_2_OFFSET_DEFAULT_IN: PerWidth<V3> = {
    "12": { x: 42.5,  y: -132.75, z: 0 },
    "14": { x: 46.25, y: -148.25, z: 0 },
    "16": { x: 42,    y: -127,    z: 0 },
    "20": { x: 46.25, y: -138.25, z: 0 },
  };
const WEB_PLATE_2_ROTATION_DEFAULT_DEG: PerWidth<V3> = {
    "12": { x: 0, y: 0, z: 0 }, "14": { x: 0, y: 0, z: 0 },
    "16": { x: 0, y: 0, z: 0 }, "20": { x: 0, y: 0, z: 0 },
  };
const WEB_PLATE_2_SIZE_SCALE_DEFAULT: PerWidth<V3> = {
    "12": { x: 1.06, y: 1.06, z: 1 },
    "14": { x: 1.15, y: 1.18, z: 1 },
    "16": { x: 1.05, y: 1.05, z: 1 },
    "20": { x: 1.15, y: 1.18, z: 1 },
  };
const KING_PEAK_PLATE_OFFSET_DEFAULT_IN: PerWidth<V3> = {
    "12": { x: 73.75, y: -143.5, z: 0 }, "14": { x: 73.75, y: -143.5, z: 0 },
    "16": { x: 73.75, y: -143.5, z: 0 }, "20": { x: 73.75, y: -143.5, z: 0 },
    "24": { x: 73.75, y: -143.5, z: 0 },
    "28": { x: 73.75, y: -143.5, z: 0 },
    "32": { x: 73.75, y: -143.5, z: 0 },
  };
const KING_PEAK_PLATE_ROTATION_DEFAULT_DEG: PerWidth<V3> = {
    "12": { x: 0, y: 0, z: 0 }, "14": { x: 0, y: 0, z: 0 },
    "16": { x: 0, y: 0, z: 0 }, "20": { x: 0, y: 0, z: 0 },
    "24": { x: 0, y: 0, z: 0 },
    "28": { x: 0, y: 0, z: 0 },
    "32": { x: 0, y: 0, z: 0 },
  };
const KING_PEAK_PLATE_SIZE_SCALE_DEFAULT: PerWidth<V3> = {
    "12": { x: 1, y: 1, z: 1 }, "14": { x: 1, y: 1, z: 1 },
    "16": { x: 1, y: 1, z: 1 }, "20": { x: 1, y: 1, z: 1 },
    "24": { x: 1, y: 1, z: 1 },
    "28": { x: 1, y: 1, z: 1 },
    "32": { x: 1, y: 1, z: 1 },
  };
const KING_HEEL_PLATE_OFFSET_DEFAULT_IN: PerWidth<V3> = {
    "12": { x: -0.75,  y: -117, z: 0 },
    "14": { x: -24.5,  y: -117, z: 0 },
    "16": { x: -48.75, y: -117, z: 0 },
    "20": { x: -96,    y: -117, z: 0 },
    "24": { x: -144.5, y: -117, z: 0 },
    "28": { x: -192.75, y: -117, z: 0 },
    "32": { x: -240, y: -117, z: 0 },
  };
const KING_HEEL_PLATE_ROTATION_DEFAULT_DEG: PerWidth<V3> = {
    "12": { x: 0, y: 0, z: 0 }, "14": { x: 0, y: 0, z: 0 },
    "16": { x: 0, y: 0, z: 0 }, "20": { x: 0, y: 0, z: 0 },
    "24": { x: 0, y: 0, z: 0 },
    "28": { x: 0, y: 0, z: 0 },
    "32": { x: 0, y: 0, z: 0 },
  };
const KING_HEEL_PLATE_SIZE_SCALE_DEFAULT: PerWidth<V3> = {
    "12": { x: 1, y: 1, z: 1 }, "14": { x: 1, y: 1, z: 1 },
    "16": { x: 1, y: 1, z: 1 }, "20": { x: 1, y: 1, z: 1 },
    "24": { x: 1, y: 1, z: 1 },
    "28": { x: 1, y: 1, z: 1 },
    "32": { x: 1, y: 1, z: 1 },
  };
const KING_HEEL_PLATE2_OFFSET_DEFAULT_IN: PerWidth<V3> = {
    "12": { x: -83.75,  y: -107.25, z: 0 },
    "14": { x: -100.5,  y: -102.75, z: 0 },
    "16": { x: -116.5,  y: -98.5,   z: 0 },
    "20": { x: -150.25, y: -88.75,  z: 0 },
    "24": { x: -184.75, y: -78.75,  z: 0 },
    "28": { x: -217.75, y: -69.75,  z: 0 },
    "32": { x: -250.5, y: -61,  z: 0 },
  };
const KING_HEEL_PLATE2_ROTATION_DEFAULT_DEG: PerWidth<V3> = {
    "12": { x: 0, y: 0, z: -3 }, "14": { x: 0, y: 0, z: -5 },
    "16": { x: 0, y: 0, z: -5 }, "20": { x: 0, y: 0, z: -6 },
    "24": { x: 0, y: 0, z: -8 },
    "28": { x: 0, y: 0, z: -9 },
    "32": { x: 0, y: 0, z: -9 },
  };
const KING_HEEL_PLATE2_SIZE_SCALE_DEFAULT: PerWidth<V3> = {
    "12": { x: 1,    y: 1,    z: 1 },
    "14": { x: 1.05, y: 1.05, z: 1 },
    "16": { x: 1.07, y: 1.07, z: 1 },
    "20": { x: 1.1,  y: 1.1,  z: 1 },
    "24": { x: 1.1,  y: 1.1,  z: 1 },
    "28": { x: 1.1,  y: 1.1,  z: 1 },
    "32": { x: 1.1,  y: 1.1,  z: 1 },
  };
const KING_WEB_PLATE_OFFSET_DEFAULT_IN: PerWidth<V3> = {
    "12": { x: -19.5,  y: -164.25, z: 0 },
    "14": { x: -24,    y: -169,    z: 0 },
    "16": { x: -29,    y: -173.75, z: 0 },
    "20": { x: -38.75, y: -183.5,  z: 0 },
    "24": { x: -48.25, y: -193,    z: 0 },
    "28": { x: -57.75, y: -202,    z: 0 },
    "32": { x: -67.5, y: -211.75, z: 0 },
  };
const KING_WEB_PLATE_ROTATION_DEFAULT_DEG: PerWidth<V3> = {
    "12": { x: 0, y: 0, z: 0 }, "14": { x: 0, y: 0, z: 0 },
    "16": { x: 0, y: 0, z: 0 }, "20": { x: 0, y: 0, z: 0 },
    "24": { x: 0, y: 0, z: 0 },
    "28": { x: 0, y: 0, z: 0 },
    "32": { x: 0, y: 0, z: 0 },
  };
const KING_WEB_PLATE_SIZE_SCALE_DEFAULT: PerWidth<V3> = {
    "12": { x: 1.13, y: 1.13, z: 1 },
    "14": { x: 1.13, y: 1.13, z: 1 },
    "16": { x: 1.1,  y: 1.21, z: 1 },
    "20": { x: 1.01, y: 1.15, z: 1 },
    "24": { x: 1.01, y: 1.15, z: 1 },
    "28": { x: 1.01, y: 1.15, z: 1 },
    "32": { x: 1.01, y: 1.15, z: 1 },
  };
const platesWidthKey = String(config.width);
function usePerWidthPlate<T>(storageKey: string, defMap: Record<string, T>) {
    // Strict per-width default. If missing, inherit from 20' (closest baked
    // anchor for newer wider sizes like 24/28/32), then fall back to 14'.
    const strictDefault = defMap[platesWidthKey];
    const fallback = (strictDefault ?? defMap["20"] ?? defMap["14"]) as T;
    const [byWidth, setByWidth] = useBakedValue<Record<string, T>>(storageKey, { ...defMap });
    const value = byWidth[platesWidthKey] ?? fallback;
    const setValue = (next: T | ((prev: T) => T)) => {
      setByWidth((prev) => {
        const cur = prev[platesWidthKey] ?? fallback;
        const v = typeof next === "function" ? (next as (p: T) => T)(cur) : next;
        return { ...prev, [platesWidthKey]: v };
      });
    };
    const copyFromTo = (fromKey: string, toKeys: string[]) => {
      setByWidth((prev) => {
        const src = prev[fromKey] ?? (defMap[fromKey] ?? fallback);
        const next = { ...prev };
        for (const k of toKeys) next[k] = src;
        return next;
      });
    };
    return [value, setValue, copyFromTo] as const;
  }
const [archPlateOffsetIn, setArchPlateOffsetIn] = usePerWidthPlate<{ x: number; y: number; z: number }>(
    "pav.archPlateOffsetIn.byWidth.v2-baked", ARCH_PLATE_OFFSET_DEFAULT_IN,
  );
const [archPlateRotationDeg, setArchPlateRotationDeg] = usePerWidthPlate<{ x: number; y: number; z: number }>(
    "pav.archPlateRotationDeg.byWidth.v2-baked", ARCH_PLATE_ROTATION_DEFAULT_DEG,
  );
const [archPlateSizeScaleRaw, setArchPlateSizeScale] = usePerWidthPlate<{ x: number; y: number; z: number } | number>(
    "pav.archPlateSizeScale.byWidth.v2-baked", ARCH_PLATE_SIZE_SCALE_DEFAULT,
  );
const archPlateSizeScale = typeof archPlateSizeScaleRaw === "number"
    ? { x: archPlateSizeScaleRaw, y: archPlateSizeScaleRaw, z: archPlateSizeScaleRaw }
    : archPlateSizeScaleRaw;
const [simplePlateOffsetIn, setSimplePlateOffsetIn] = usePerWidthPlate<{ x: number; y: number; z: number }>(
    "pav.simplePlateOffsetIn.byWidth.v2-baked", SIMPLE_PLATE_OFFSET_DEFAULT_IN,
  );
const [simplePlateRotationDeg, setSimplePlateRotationDeg] = usePerWidthPlate<{ x: number; y: number; z: number }>(
    "pav.simplePlateRotationDeg.byWidth.v2-baked", SIMPLE_PLATE_ROTATION_DEFAULT_DEG,
  );
const [simplePlateSizeScaleRaw, setSimplePlateSizeScale] = usePerWidthPlate<{ x: number; y: number; z: number } | number>(
    "pav.simplePlateSizeScale.byWidth.v2-baked", SIMPLE_PLATE_SIZE_SCALE_DEFAULT,
  );
const simplePlateSizeScale = typeof simplePlateSizeScaleRaw === "number"
    ? { x: simplePlateSizeScaleRaw, y: simplePlateSizeScaleRaw, z: simplePlateSizeScaleRaw }
    : simplePlateSizeScaleRaw;
const [topPlateOffsetIn, setTopPlateOffsetIn] = usePerWidthPlate<{ x: number; y: number; z: number }>(
    "pav.topPlateOffsetIn.byWidth.v2-baked", TOP_PLATE_OFFSET_DEFAULT_IN,
  );
const [topPlateRotationDeg, setTopPlateRotationDeg] = usePerWidthPlate<{ x: number; y: number; z: number }>(
    "pav.topPlateRotationDeg.byWidth.v2-baked", TOP_PLATE_ROTATION_DEFAULT_DEG,
  );
const [topPlateSizeScaleRaw, setTopPlateSizeScale] = usePerWidthPlate<{ x: number; y: number; z: number } | number>(
    "pav.topPlateSizeScale.byWidth.v2-baked", TOP_PLATE_SIZE_SCALE_DEFAULT,
  );
const topPlateSizeScale = typeof topPlateSizeScaleRaw === "number"
    ? { x: topPlateSizeScaleRaw, y: topPlateSizeScaleRaw, z: topPlateSizeScaleRaw }
    : topPlateSizeScaleRaw;
const [webPlate2OffsetIn, setWebPlate2OffsetIn] = usePerWidthPlate<{ x: number; y: number; z: number }>(
    "pav.webPlate2OffsetIn.byWidth.v2-baked", WEB_PLATE_2_OFFSET_DEFAULT_IN,
  );
const [webPlate2RotationDeg, setWebPlate2RotationDeg] = usePerWidthPlate<{ x: number; y: number; z: number }>(
    "pav.webPlate2RotationDeg.byWidth.v2-baked", WEB_PLATE_2_ROTATION_DEFAULT_DEG,
  );
const [webPlate2SizeScaleRaw, setWebPlate2SizeScale] = usePerWidthPlate<{ x: number; y: number; z: number } | number>(
    "pav.webPlate2SizeScale.byWidth.v2-baked", WEB_PLATE_2_SIZE_SCALE_DEFAULT,
  );
const webPlate2SizeScale = typeof webPlate2SizeScaleRaw === "number"
    ? { x: webPlate2SizeScaleRaw, y: webPlate2SizeScaleRaw, z: webPlate2SizeScaleRaw }
    : webPlate2SizeScaleRaw;
const [kingPeakPlateOffsetIn, setKingPeakPlateOffsetIn, copyKingPeakPlateOffsetIn] = usePerWidthPlate<{ x: number; y: number; z: number }>(
    "pav.kingPeakPlateOffsetIn.byWidth.v4-baked", KING_PEAK_PLATE_OFFSET_DEFAULT_IN,
  );
const [kingPeakPlateRotationDeg, setKingPeakPlateRotationDeg, copyKingPeakPlateRotationDeg] = usePerWidthPlate<{ x: number; y: number; z: number }>(
    "pav.kingPeakPlateRotationDeg.byWidth.v4-baked", KING_PEAK_PLATE_ROTATION_DEFAULT_DEG,
  );
const [kingPeakPlateSizeScaleRaw, setKingPeakPlateSizeScale, copyKingPeakPlateSizeScale] = usePerWidthPlate<{ x: number; y: number; z: number } | number>(
    "pav.kingPeakPlateSizeScale.byWidth.v4-baked", KING_PEAK_PLATE_SIZE_SCALE_DEFAULT,
  );
const kingPeakPlateSizeScale = typeof kingPeakPlateSizeScaleRaw === "number"
    ? { x: kingPeakPlateSizeScaleRaw, y: kingPeakPlateSizeScaleRaw, z: kingPeakPlateSizeScaleRaw }
    : kingPeakPlateSizeScaleRaw;
const [kingHeelPlateOffsetIn, setKingHeelPlateOffsetIn, copyKingHeelPlateOffsetIn] = usePerWidthPlate<{ x: number; y: number; z: number }>(
    "pav.kingHeelPlateOffsetIn.byWidth.v4-baked", KING_HEEL_PLATE_OFFSET_DEFAULT_IN,
  );
const [kingHeelPlateRotationDeg, setKingHeelPlateRotationDeg, copyKingHeelPlateRotationDeg] = usePerWidthPlate<{ x: number; y: number; z: number }>(
    "pav.kingHeelPlateRotationDeg.byWidth.v4-baked", KING_HEEL_PLATE_ROTATION_DEFAULT_DEG,
  );
const [kingHeelPlateSizeScaleRaw, setKingHeelPlateSizeScale, copyKingHeelPlateSizeScale] = usePerWidthPlate<{ x: number; y: number; z: number } | number>(
    "pav.kingHeelPlateSizeScale.byWidth.v4-baked", KING_HEEL_PLATE_SIZE_SCALE_DEFAULT,
  );
const kingHeelPlateSizeScale = typeof kingHeelPlateSizeScaleRaw === "number"
    ? { x: kingHeelPlateSizeScaleRaw, y: kingHeelPlateSizeScaleRaw, z: kingHeelPlateSizeScaleRaw }
    : kingHeelPlateSizeScaleRaw;
const [kingWebPlateOffsetIn, setKingWebPlateOffsetIn, copyKingWebPlateOffsetIn] = usePerWidthPlate<{ x: number; y: number; z: number }>(
    "pav.kingWebPlateOffsetIn.byWidth.v4-baked", KING_WEB_PLATE_OFFSET_DEFAULT_IN,
  );
const [kingWebPlateRotationDeg, setKingWebPlateRotationDeg, copyKingWebPlateRotationDeg] = usePerWidthPlate<{ x: number; y: number; z: number }>(
    "pav.kingWebPlateRotationDeg.byWidth.v4-baked", KING_WEB_PLATE_ROTATION_DEFAULT_DEG,
  );
const [kingWebPlateSizeScaleRaw, setKingWebPlateSizeScale, copyKingWebPlateSizeScale] = usePerWidthPlate<{ x: number; y: number; z: number } | number>(
    "pav.kingWebPlateSizeScale.byWidth.v4-baked", KING_WEB_PLATE_SIZE_SCALE_DEFAULT,
  );
const kingWebPlateSizeScale = typeof kingWebPlateSizeScaleRaw === "number"
    ? { x: kingWebPlateSizeScaleRaw, y: kingWebPlateSizeScaleRaw, z: kingWebPlateSizeScaleRaw }
    : kingWebPlateSizeScaleRaw;
const [kingHeelPlate2OffsetIn, setKingHeelPlate2OffsetIn, copyKingHeelPlate2OffsetIn] = usePerWidthPlate<{ x: number; y: number; z: number }>(
    "pav.kingHeelPlate2OffsetIn.byWidth.v4-baked", KING_HEEL_PLATE2_OFFSET_DEFAULT_IN,
  );
const [kingHeelPlate2RotationDeg, setKingHeelPlate2RotationDeg, copyKingHeelPlate2RotationDeg] = usePerWidthPlate<{ x: number; y: number; z: number }>(
    "pav.kingHeelPlate2RotationDeg.byWidth.v4-baked", KING_HEEL_PLATE2_ROTATION_DEFAULT_DEG,
  );
const [kingHeelPlate2SizeScaleRaw, setKingHeelPlate2SizeScale, copyKingHeelPlate2SizeScale] = usePerWidthPlate<{ x: number; y: number; z: number } | number>(
    "pav.kingHeelPlate2SizeScale.byWidth.v4-baked", KING_HEEL_PLATE2_SIZE_SCALE_DEFAULT,
  );
const kingHeelPlate2SizeScale = typeof kingHeelPlate2SizeScaleRaw === "number"
    ? { x: kingHeelPlate2SizeScaleRaw, y: kingHeelPlate2SizeScaleRaw, z: kingHeelPlate2SizeScaleRaw }
    : kingHeelPlate2SizeScaleRaw;
type PlateXYZ = { x: number; y: number; z: number };
const PLATE_OFFSETS_DEFAULT: Record<"vL" | "vR" | "wL" | "wR" | "peak", PlateXYZ> = {
    vL:   { x: 0,    y: 0,     z: 0 },
    vR:   { x: 0,    y: 0,     z: 0 },
    wL:   { x: -8.5, y: -6.25, z: 0 },
    wR:   { x: 8.5,  y: -6.25, z: 0 },
    peak: { x: 0,    y: 0,     z: 0 },
  };
const [plate14OffsetsIn, setPlate14OffsetsIn] = useBakedValue<
    Record<"vL" | "vR" | "wL" | "wR" | "peak", PlateXYZ>
  >("pav.plate14OffsetsIn.v3-baked", { ...PLATE_OFFSETS_DEFAULT, ...HAMMER14_BAKED_PLATE_OFFSETS_IN });
const PLATE20_OFFSETS_DEFAULT: Record<"vL" | "vR" | "wL" | "wR" | "peak", PlateXYZ> = {
    vL:   { x: 0,      y: 0,    z: 0 },
    vR:   { x: 0,      y: 0,    z: 0 },
    wL:   { x: 11.25,  y: 7.75, z: 0 },
    wR:   { x: -10.75, y: 7.75, z: 0 },
    peak: { x: 0,      y: 0,    z: 0 },
  };
const [plate20OffsetsIn, setPlate20OffsetsIn] = useBakedValue<
    Record<"vL" | "vR" | "wL" | "wR" | "peak", PlateXYZ>
  >("pav.plate20OffsetsIn.v5-baked", PLATE20_OFFSETS_DEFAULT);
const activePlateOffsetsIn = is12Wide
    ? HAMMER12_BAKED_PLATE_OFFSETS_IN
    : is20Wide
      ? plate20OffsetsIn
      : is16Wide
        ? HAMMER16_BAKED_PLATE_OFFSETS_IN
        : is14Wide
          ? plate14OffsetsIn
          : HAMMER14_BAKED_PLATE_OFFSETS_IN;
const trussPlateExtraOffsets: TrussPlateExtraOffsets | undefined = is14Wide || is12Wide || is16Wide || is20Wide
    ? {
        vL:   { x: activePlateOffsetsIn.vL.x   * 0.0254, y: activePlateOffsetsIn.vL.y   * 0.0254, z: activePlateOffsetsIn.vL.z   * 0.0254 },
        vR:   { x: activePlateOffsetsIn.vR.x   * 0.0254, y: activePlateOffsetsIn.vR.y   * 0.0254, z: activePlateOffsetsIn.vR.z   * 0.0254 },
        wL:   { x: activePlateOffsetsIn.wL.x   * 0.0254, y: activePlateOffsetsIn.wL.y   * 0.0254, z: activePlateOffsetsIn.wL.z   * 0.0254 },
        wR:   { x: activePlateOffsetsIn.wR.x   * 0.0254, y: activePlateOffsetsIn.wR.y   * 0.0254, z: activePlateOffsetsIn.wR.z   * 0.0254 },
        peak: { x: activePlateOffsetsIn.peak.x * 0.0254, y: activePlateOffsetsIn.peak.y * 0.0254, z: activePlateOffsetsIn.peak.z * 0.0254 },
      }
    : undefined;
const GRAIN_PIECE_DEFAULTS_DEG: Record<string, number> = {
    "hammer.kingbrace.l": hammerKingbraceGrainDeg,
    "hammer.kingbrace.r": hammerKingbraceGrainDeg,
    "side.rafter.l": 0,
    "side.rafter.r": 47,
    "king.tie": 0,
    "king.kingpost": 0,
    "king.strut.l": -5,
    "king.strut.r": -30,
    "king.rafter.l": 0,
    "king.rafter.r": 46,
    ...HAMMER_GRAIN_DEFAULTS,
  };
const [grainPieceDeg, setGrainPieceDeg] = useBakedValue<Record<string, number>>(
    "pav.grainPieceDeg.v1",
    GRAIN_PIECE_DEFAULTS_DEG,
  );
const [grainFaceDeg, setGrainFaceDeg] = useBakedValue<Record<string, number[]>>(
    "pav.grainFaceDeg.v1",
    {},
  );
const grainPieces: Record<string, number> = Object.fromEntries(
    Object.keys(GRAIN_PIECE_DEFAULTS_DEG).map((id) => [
      id,
      (grainPieceDeg[id] ?? GRAIN_PIECE_DEFAULTS_DEG[id] ?? 0) * D2R,
    ]),
  );
const grainFaces: Record<string, number[]> = useMemo(
    () => Object.fromEntries(
      Object.entries(grainFaceDeg).map(([id, arr]) => [id, arr.map((d) => (d ?? 0) * D2R)]),
    ),
    [grainFaceDeg],
  );
const [handPeeledRandom, setHandPeeledRandom] = useBakedValue<HandPeeledRandom>(
    "pav.handPeeledRandom.v1",
    DEFAULT_HAND_PEELED_RANDOM,
  );
const [rakeTrimAdjust, setRakeTrimAdjust] = useBakedValue<RakeTrimAdjust>("pav.rakeTrimAdjust", DEFAULT_RAKE_TRIM_ADJUST);
const [metalRakeTrimAdjust, setMetalRakeTrimAdjust] = useBakedValue<RakeTrimAdjust>("pav.metalRakeTrimAdjust", DEFAULT_METAL_RAKE_TRIM_ADJUST);
const [grassDensity, setGrassDensity] = useBakedValue<number>("pav.grassDensity", 1);
const [grassTint, setGrassTint] = useBakedValue<string>("pav.grassTint", "#c8cfb8");
const [grassTexture, setGrassTexture] = useBakedValue<number>("pav.grassTexture", 1);
const [rawBeamColor] = useBakedValue<string>(NATURAL_PINE_BEAM_KEY, NATURAL_PINE_BEAM);
const [rawDeckColor, setRawDeckColor] = useBakedValue<string>(NATURAL_PINE_DECK_KEY, NATURAL_PINE_DECK);
const SCROLL_COLLAR_BAKE: Record<string, PieceAdjust> = {
    "side.collar": { off: { x: 0, y: 0, z: -0.25 }, ext: { xp: 0, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 }, scl: { x: 1.03, y: 1, z: 0.94 } },
  };
const SCROLL20_RAFTER_IDENTITY: PieceAdjust = {
    off: { x: 0, y: 0, z: 0 },
    ext: { xp: 0, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 },
    rot: { x: 0, y: 0, z: 0 },
    scl: { x: 1, y: 1, z: 1 },
  };
const SCROLL20_RAFTER_BAKE_HAMMER: Record<string, PieceAdjust> = {
    "side.rafter.l":   { ...SCROLL20_RAFTER_IDENTITY },
    "side.rafter.r":   { ...SCROLL20_RAFTER_IDENTITY },
    "hammer.rafter.l": { ...SCROLL20_RAFTER_IDENTITY },
    "hammer.rafter.r": { ...SCROLL20_RAFTER_IDENTITY },
  };
const SCROLL20_RAFTER_BAKE_KING: Record<string, PieceAdjust> = {
    "side.rafter.l": { ...SCROLL20_RAFTER_IDENTITY },
    "side.rafter.r": { ...SCROLL20_RAFTER_IDENTITY },
    "king.rafter.l": { ...SCROLL20_RAFTER_IDENTITY },
    "king.rafter.r": { ...SCROLL20_RAFTER_IDENTITY },
  };
const SCROLL20_RAFTER_BAKE_ARCH: Record<string, PieceAdjust> = {
    "side.rafter.l": { ...SCROLL20_RAFTER_IDENTITY },
    "side.rafter.r": { ...SCROLL20_RAFTER_IDENTITY },
    "arch.rafter.l": { ...SCROLL20_RAFTER_IDENTITY },
    "arch.rafter.r": { ...SCROLL20_RAFTER_IDENTITY },
  };
const SCROLL14_RAFTER_BAKE_HAMMER: Record<string, PieceAdjust> = {
    "side.rafter.l":   { off: { x: -1.75, y: 0, z: 0 }, ext: { xp: 6.75, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 }, scl: { x: 0.91, y: 1, z: 1 } },
    "side.rafter.r":   { off: { x:  1.75, y: 0, z: 0 }, ext: { xp: 6.75, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 }, scl: { x: 0.91, y: 1, z: 1 } },
    "hammer.rafter.r": { off: { x:  1.75, y: 0, z: 0 }, ext: { xp: 6.75, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 }, scl: { x: 0.91, y: 1, z: 1 } },
  };
const SCROLL14_RAFTER_BAKE_KING: Record<string, PieceAdjust> = {
    "side.rafter.l": { off: { x: -1.75, y: 0, z: 0 }, ext: { xp: 6.75, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 }, scl: { x: 0.91, y: 1, z: 1 } },
    "side.rafter.r": { off: { x:  1.75, y: 0, z: 0 }, ext: { xp: 0, xn: 6.75, yp: 0, yn: 0, zp: 0, zn: 0 }, scl: { x: 0.91, y: 1, z: 1 } },
    "king.rafter.l": { off: { x: -1.75, y: 0, z: 0 }, ext: { xp: 6.75, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 }, scl: { x: 0.91, y: 1, z: 1 } },
    "king.rafter.r": { off: { x:  1.75, y: 0, z: 0 }, ext: { xp: 0, xn: 6.75, yp: 0, yn: 0, zp: 0, zn: 0 }, scl: { x: 0.91, y: 1, z: 1 } },
  };
const SCROLL14_RAFTER_BAKE_ARCH: Record<string, PieceAdjust> = {
    "side.rafter.l": { off: { x: -1.75, y: 0, z: 0 }, ext: { xp: 6.75, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 }, scl: { x: 0.91, y: 1, z: 1 } },
    "side.rafter.r": { off: { x:  1.75, y: 0, z: 0 }, ext: { xp: 6.75, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 }, scl: { x: 0.91, y: 1, z: 1 } },
    "arch.rafter.r": { off: { x:  1.75, y: 0, z: 0 }, ext: { xp: 6.75, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 }, scl: { x: 0.91, y: 1, z: 1 } },
  };
const [pieceAdjustsByWidth, setPieceAdjustsByWidth] = useBakedValue<Record<string, Record<string, PieceAdjust>>>(
    "pav.pieceAdjustsByWidth.v24-hammer14scrollmatcharch",
    {

      "20": { ...(HAMMER20_BAKED_PIECE_ADJUSTS_FULL as Record<string, PieceAdjust>), ...SCROLL20_RAFTER_BAKE_HAMMER, ...SCROLL_COLLAR_BAKE },
      "12": { ...HAMMER12_BAKED_PIECE_ADJUSTS, ...SCROLL_COLLAR_BAKE },
      "14": { ...HAMMER14_BAKED_PIECE_ADJUSTS, ...SCROLL14_RAFTER_BAKE_HAMMER, ...SCROLL_COLLAR_BAKE },
      "16": { ...HAMMER16_BAKED_PIECE_ADJUSTS, ...SCROLL_COLLAR_BAKE },
      "king-20": { ...SCROLL20_RAFTER_BAKE_KING, ...SCROLL_COLLAR_BAKE },
      "king-12": { ...SCROLL_COLLAR_BAKE },
      "king-14": { ...SCROLL14_RAFTER_BAKE_KING, ...SCROLL_COLLAR_BAKE },
      "king-16": { ...SCROLL_COLLAR_BAKE },
    },
  );
const EXT0 = { xp: 0, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 };
const ARCH_PIECE_ADJUSTS_BAKED: Record<string, Record<string, PieceAdjust>> = {
    "12": {
      "arch.kingpin": { off: { x: -2,     y: 8,      z: -2.75 }, ext: EXT0, scl: { x: 1.32, y: 1.18, z: 0.89 } },
      "arch.strut.l": { off: { x: 6.406,  y: 19.5,   z: -2.75 }, ext: EXT0, scl: { x: 1.47, y: 1.47, z: 0.96 } },
      "arch.strut.r": { off: { x: -6.5,   y: 19.529, z: -2.75 }, ext: EXT0, scl: { x: 1.47, y: 1.47, z: 0.96 } },
      "arch.wing.l":  { off: { x: -8.631, y: 31.25,  z: -2.75 }, ext: EXT0, scl: { x: 1.35, y: 1.62, z: 0.97 } },
      "arch.wing.r":  { off: { x: 7.75,   y: 31.25,  z: -2.75 }, ext: EXT0, scl: { x: 1.35, y: 1.62, z: 0.97 } },
    },
    "14": {
      "arch.kingpin": { off: { x: -2,     y: 12.5,   z: -3    }, ext: EXT0, scl: { x: 1.24, y: 1.37, z: 0.98 } },
      "arch.strut.l": { off: { x: 4.896,  y: 22.226, z: -2.75 }, ext: EXT0, scl: { x: 1.52, y: 1.52, z: 0.95 } },
      "arch.strut.r": { off: { x: -5,     y: 22.258, z: -2.75 }, ext: EXT0, scl: { x: 1.52, y: 1.52, z: 0.95 } },
      "arch.wing.l":  { off: { x: -13.25, y: 32.5,   z: -2.75 }, ext: EXT0, scl: { x: 1.44, y: 1.44, z: 0.99 } },
      "arch.wing.r":  { off: { x: 11.25,  y: 32.75,  z: -2.75 }, ext: EXT0, scl: { x: 1.44, y: 1.44, z: 0.99 } },
    },
    "16": {
      "arch.corbel.l": { off: { x: 0,      y: 0,      z: 0     }, ext: EXT0, scl: { x: 1,    y: 1,    z: 1    }, hidden: true },
      "arch.kingpin":  { off: { x: -2,     y: 15.75,  z: -2.75 }, ext: EXT0, scl: { x: 1.27, y: 1.4,  z: 0.92 } },
      "arch.strut.l":  { off: { x: 1.5,    y: 27.955, z: -2.75 }, ext: EXT0, scl: { x: 1.73, y: 1.73, z: 0.9  } },
      "arch.strut.r":  { off: { x: -1.646, y: 28,     z: -2.75 }, ext: EXT0, scl: { x: 1.73, y: 1.73, z: 0.9  } },
      "arch.wing.l":   { off: { x: -17.25, y: 35.25,  z: -2.75 }, ext: EXT0, scl: { x: 1.48, y: 1.48, z: 0.93 } },
      "arch.wing.r":   { off: { x: 15.25,  y: 35.25,  z: -2.75 }, ext: EXT0, scl: { x: 1.48, y: 1.48, z: 0.93 } },
    },
    "20": {
      "arch.kingpin": { off: { x: -2,     y: 25.25, z: -2.75 }, ext: EXT0, scl: { x: 1.32, y: 1.73, z: 0.89 } },
      "arch.strut.l": { off: { x: -2.75,  y: 37,    z: -2.75 }, ext: EXT0, scl: { x: 1.68, y: 1.68, z: 0.96 } },
      "arch.strut.r": { off: { x: 2.75,   y: 37,    z: -2.75 }, ext: EXT0, scl: { x: 1.68, y: 1.68, z: 0.96 } },
      "arch.wing.l":  { off: { x: -24.75, y: 39.5,  z: -2.75 }, ext: EXT0, scl: { x: 1.9,  y: 1.9,  z: 0.98 } },
      "arch.wing.r":  { off: { x: 24.75,  y: 39.5,  z: -2.75 }, ext: EXT0, scl: { x: 1.9,  y: 1.9,  z: 0.98 } },
      // Scroll-cut tail rafters at 20' follow the regular rafter pose — no
      // bake-in offsets here.

    },
  };
const ARCH_PIECE_ADJUSTS_DEFAULT: Record<string, PieceAdjust> = ARCH_PIECE_ADJUSTS_BAKED["20"];
const [archPieceAdjustsByWidth, setArchPieceAdjustsByWidth] = useBakedValue<Record<string, Record<string, PieceAdjust>>>(
    "pav.archPieceAdjustsByWidth.v14-runtime-large-widths",
    {
      "12": { ...ARCH_PIECE_ADJUSTS_BAKED["12"], ...SCROLL_COLLAR_BAKE },
      "14": { ...ARCH_PIECE_ADJUSTS_BAKED["14"], ...SCROLL14_RAFTER_BAKE_ARCH, ...SCROLL_COLLAR_BAKE },
      "16": { ...ARCH_PIECE_ADJUSTS_BAKED["16"], ...SCROLL_COLLAR_BAKE },
      "20": { ...ARCH_PIECE_ADJUSTS_BAKED["20"], ...SCROLL20_RAFTER_BAKE_ARCH, ...SCROLL_COLLAR_BAKE },
    },
  );
const widthKey = String(config.width);
const isKingTruss = config.truss === "king";
const pieceAdjustsKey = isKingTruss ? `king-${widthKey}` : widthKey;
const pieceAdjusts = config.truss === "arch"
    ? (archPieceAdjustsByWidth[widthKey] ?? (expandedFrame(config.width,config.length)?.runtimeTruss ? {} : ARCH_PIECE_ADJUSTS_DEFAULT))
    : isKingTruss
      ? (pieceAdjustsByWidth[pieceAdjustsKey] ?? {})
      : is12Wide
        ? HAMMER12_BAKED_PIECE_ADJUSTS
        : (pieceAdjustsByWidth[widthKey]
            ?? (is20Wide
              ? (HAMMER20_BAKED_PIECE_ADJUSTS_FULL as Record<string, PieceAdjust>)
              : is16Wide
                ? HAMMER16_BAKED_PIECE_ADJUSTS
                : is14Wide
                  ? HAMMER14_BAKED_PIECE_ADJUSTS
                  : {}));
const [shingleScale] = useState(0.34);
const [shingleContrast] = useState(1.45);
const [shingleBrightness] = useState(1.9);
const [shingleSaturate] = useState(0.85);
const [shingleBumpScale] = useState(1.25);
const [shingleRoughness] = useState(1);
const shingleCapRotation = 90;
const shingleCapScale = { x: 2.55, y: 2.55, z: 2.39 };
const shingleCapOffset = { x: 0.17, y: -0.035, z: -0.26 };
const shingleCapTextureScale = { x: 0.1321, y: 0.0071, z: 1.1439 };
const roofMat = ROOF_MATERIALS.find((r) => r.id === config.roofId)!;
const sofaBounds = placementBoundsFor(config, "sofa", sofaRotationDeg);
const tableBounds = placementBoundsFor(config, "table", tableRotationDeg);
const eggBounds = placementBoundsFor(config, "egg", eggRotationDeg);
const diningBounds = placementBoundsFor(config, "dining", diningRotationDeg);
const patioBounds = placementBoundsFor(config, "patio", patioRotationDeg);
const clampedSofaOffset = clampPlacementOffset(sofaOffset, sofaBounds);
const clampedTableOffset = clampPlacementOffset(tableOffset, tableBounds);
const clampedEggOffset = clampPlacementOffset(eggOffset, eggBounds);
const clampedDiningOffset = clampPlacementOffset(diningOffset, diningBounds);
const clampedPatioOffset = clampPlacementOffset(patioOffset, patioBounds);
const METAL_SNOW_RAIL_ADJUST = useMemo(() => ({
    scale: { x: 0.457, y: 1.018, z: 0.494 },
    rotation: { x: 180 * Math.PI / 180, y: 0, z: 0 },
    position: { x: 7.2, y: 2.3, z: 0 },
  }), []);
const snowRailAdjust = useMemo(() => {
    if (roofMat.type !== "standing-seam") return METAL_SNOW_RAIL_ADJUST;
    return {
      scale: snowRailScale,
      rotation: {
        x: snowRailRotationDeg.x * Math.PI / 180,
        y: snowRailRotationDeg.y * Math.PI / 180,
        z: snowRailRotationDeg.z * Math.PI / 180,
      },
      position: snowRailPositionIn,
    };
  }, [roofMat.type, snowRailScale, snowRailRotationDeg, snowRailPositionIn, METAL_SNOW_RAIL_ADJUST]);
return <SnowRailAdjustContext.Provider value={snowRailAdjust}><Scene showDimensions={props.showDimensions} padTileScale={padTileScale} measureEnabled={props.measureEnabled} config={config} view={props.view} allowUnderside={true} showRoof={props.showRoof} showTrusses={showTrusses} showFrame={showFrame} showRafters={showRafters} showPad={props.showPad} showTable={props.showTable} showSectional={props.showSectional} showEgg={props.showEgg} eggOffset={{ x: clampedEggOffset.x * 0.0254, z: clampedEggOffset.z * 0.0254 }} eggRotation={eggRotationDeg * Math.PI / 180} showTv={props.showTv} tvCorner={tvCorner} tvHeightFt={Math.max(5, Math.min(config.height - 2, tvHeightFt))} showDining={props.showDining} diningOffset={{ x: clampedDiningOffset.x * 0.0254, z: clampedDiningOffset.z * 0.0254 }} diningRotation={diningRotationDeg * Math.PI / 180} showPatio={props.showPatio} patioOffset={{ x: clampedPatioOffset.x * 0.0254, z: clampedPatioOffset.z * 0.0254 }} patioRotation={patioRotationDeg * Math.PI / 180} sofaOffset={{ x: clampedSofaOffset.x * 0.0254, z: clampedSofaOffset.z * 0.0254 }} sofaRotation={sofaRotationDeg * Math.PI / 180} tableOffset={{ x: clampedTableOffset.x * 0.0254, z: clampedTableOffset.z * 0.0254 }} tableRotation={tableRotationDeg * Math.PI / 180} tableStain={props.tableStain} deckStain={props.deckStain} stainOpacity={stainOpacity} stainDarkness={stainDarkness} grainAdjust={grainAdjust} grainPieces={grainPieces} grainFaces={grainFaces} handPeeledRandom={handPeeledRandom} rakeTrimAdjust={rakeTrimAdjust} metalRakeTrimAdjust={metalRakeTrimAdjust} shingleScale={shingleScale} shingleContrast={shingleContrast} shingleBrightness={shingleBrightness} shingleSaturate={shingleSaturate} shingleBumpScale={shingleBumpScale} shingleRoughness={shingleRoughness} shingleCapRotation={shingleCapRotation} shingleCapScale={shingleCapScale} shingleCapOffset={shingleCapOffset} shingleCapTextureScale={shingleCapTextureScale} hammerYOffset={hammerYOffsetIn * 0.0254} hammerScale={hammerScale} hammerGroupOffset={is20Wide ? { x: HAMMER20_BAKED_GROUP_OFFSET_IN.x * 0.0254, y: HAMMER20_BAKED_GROUP_OFFSET_IN.y * 0.0254, z: HAMMER20_BAKED_GROUP_OFFSET_IN.z * 0.0254 } : { x: 0, y: 0, z: 0 }} hammerCorbelScale={hammerCorbelScale} hammerCorbelOffset={{ x: hammerCorbelOffset.x * 0.0254, y: hammerCorbelOffset.y * 0.0254, z: hammerCorbelOffset.z * 0.0254 }} hammerCorbelRotation={{ x: hammerCorbelRotation.x * Math.PI / 180, y: hammerCorbelRotation.y * Math.PI / 180, z: hammerCorbelRotation.z * Math.PI / 180 }} hammerPieceOffsets={hammerPieceOffsets} hammerPieceScales={hammerPieceScales} hammerUniformProfile55={hammerUniformProfile55} hammer12Glb={hammer12GlbAdjust} hammer14Glb={hammer14GlbAdjust} hammer16Glb={hammer16GlbAdjust} hammer20Glb={hammer20GlbAdjust} plateOffset={{ x: plateOffsetIn.x * 0.0254, y: plateOffsetIn.y * 0.0254, z: plateOffsetIn.z * 0.0254 }} plateRotation={{ x: plateRotationDeg.x * Math.PI / 180, y: plateRotationDeg.y * Math.PI / 180, z: plateRotationDeg.z * Math.PI / 180 }} plateSizeScale={plateSizeScale} webPlateOffset={{ x: webPlateOffsetIn.x * 0.0254, y: webPlateOffsetIn.y * 0.0254, z: webPlateOffsetIn.z * 0.0254 }} webPlateRotation={{ x: webPlateRotationDeg.x * Math.PI / 180, y: webPlateRotationDeg.y * Math.PI / 180, z: webPlateRotationDeg.z * Math.PI / 180 }} webPlateSizeScale={webPlateSizeScale} vPlateSurfaceInset={vPlateSurfaceInsetIn * 0.0254} webPlateSurfaceInset={webPlateSurfaceInsetIn * 0.0254} peakPlateOffset={{ x: peakPlateOffsetIn.x * 0.0254, y: peakPlateOffsetIn.y * 0.0254, z: peakPlateOffsetIn.z * 0.0254 }} peakPlateRotation={{ x: peakPlateRotationDeg.x * Math.PI / 180, y: peakPlateRotationDeg.y * Math.PI / 180, z: peakPlateRotationDeg.z * Math.PI / 180 }} peakPlateSizeScale={peakPlateSizeScale} peakPlateSurfaceInset={peakPlateSurfaceInsetIn * 0.0254} archPlateOffset={{ x: archPlateOffsetIn.x * 0.0254, y: archPlateOffsetIn.y * 0.0254, z: archPlateOffsetIn.z * 0.0254 }} archPlateRotation={{ x: archPlateRotationDeg.x * Math.PI / 180, y: archPlateRotationDeg.y * Math.PI / 180, z: archPlateRotationDeg.z * Math.PI / 180 }} archPlateSizeScale={archPlateSizeScale} simplePlateOffset={{ x: simplePlateOffsetIn.x * 0.0254, y: simplePlateOffsetIn.y * 0.0254, z: simplePlateOffsetIn.z * 0.0254 }} simplePlateRotation={{ x: simplePlateRotationDeg.x * Math.PI / 180, y: simplePlateRotationDeg.y * Math.PI / 180, z: simplePlateRotationDeg.z * Math.PI / 180 }} simplePlateSizeScale={simplePlateSizeScale} topPlateOffset={{ x: topPlateOffsetIn.x * 0.0254, y: topPlateOffsetIn.y * 0.0254, z: topPlateOffsetIn.z * 0.0254 }} topPlateRotation={{ x: topPlateRotationDeg.x * Math.PI / 180, y: topPlateRotationDeg.y * Math.PI / 180, z: topPlateRotationDeg.z * Math.PI / 180 }} topPlateSizeScale={topPlateSizeScale} webPlate2Offset={{ x: webPlate2OffsetIn.x * 0.0254, y: webPlate2OffsetIn.y * 0.0254, z: webPlate2OffsetIn.z * 0.0254 }} webPlate2Rotation={{ x: webPlate2RotationDeg.x * Math.PI / 180, y: webPlate2RotationDeg.y * Math.PI / 180, z: webPlate2RotationDeg.z * Math.PI / 180 }} webPlate2SizeScale={webPlate2SizeScale} kingPeakPlateOffset={{ x: kingPeakPlateOffsetIn.x * 0.0254, y: kingPeakPlateOffsetIn.y * 0.0254, z: kingPeakPlateOffsetIn.z * 0.0254 }} kingPeakPlateRotation={{ x: kingPeakPlateRotationDeg.x * Math.PI / 180, y: kingPeakPlateRotationDeg.y * Math.PI / 180, z: kingPeakPlateRotationDeg.z * Math.PI / 180 }} kingPeakPlateSizeScale={kingPeakPlateSizeScale} kingHeelPlateOffset={{ x: kingHeelPlateOffsetIn.x * 0.0254, y: kingHeelPlateOffsetIn.y * 0.0254, z: kingHeelPlateOffsetIn.z * 0.0254 }} kingHeelPlateRotation={{ x: kingHeelPlateRotationDeg.x * Math.PI / 180, y: kingHeelPlateRotationDeg.y * Math.PI / 180, z: kingHeelPlateRotationDeg.z * Math.PI / 180 }} kingHeelPlateSizeScale={kingHeelPlateSizeScale} kingWebPlateOffset={{ x: kingWebPlateOffsetIn.x * 0.0254, y: kingWebPlateOffsetIn.y * 0.0254, z: kingWebPlateOffsetIn.z * 0.0254 }} kingWebPlateRotation={{ x: kingWebPlateRotationDeg.x * Math.PI / 180, y: kingWebPlateRotationDeg.y * Math.PI / 180, z: kingWebPlateRotationDeg.z * Math.PI / 180 }} kingWebPlateSizeScale={kingWebPlateSizeScale} kingHeelPlate2Offset={{ x: kingHeelPlate2OffsetIn.x * 0.0254, y: kingHeelPlate2OffsetIn.y * 0.0254, z: kingHeelPlate2OffsetIn.z * 0.0254 }} kingHeelPlate2Rotation={{ x: kingHeelPlate2RotationDeg.x * Math.PI / 180, y: kingHeelPlate2RotationDeg.y * Math.PI / 180, z: kingHeelPlate2RotationDeg.z * Math.PI / 180 }} kingHeelPlate2SizeScale={kingHeelPlate2SizeScale} trussPlateExtraOffsets={trussPlateExtraOffsets}  grassDensity={grassDensity} grassTint={grassTint} grassTexture={grassTexture} rawBeamColor={rawBeamColor} rawDeckColor={rawDeckColor} roofOnlyLiftIn={config.truss === "hammer" && config.width <= 16 ? (roofOnlyLiftByWidth[config.width] ?? 0) : 0} pieceAdjusts={pieceAdjusts} cloudSpread={cloudSpread} cloudConcentration={cloudConcentration} cloudHeight={cloudHeight} showBackyard={props.showBackyard}  /></SnowRailAdjustContext.Provider>;
}
