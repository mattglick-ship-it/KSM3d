"use client";
import {NATURAL_PINE_BEAM,NATURAL_PINE_DECK,NATURAL_PINE_BEAM_KEY,NATURAL_PINE_DECK_KEY} from '@/lib/natural-pine';
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
const useServerFn = <T,>(fn:T):T => fn;
import { publishPavilionDefaults } from "@/lib/pavilion-defaults.functions";
import { loadPricing } from "@/lib/pricing/store";
import { createContext, lazy, Suspense, useContext, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { exportPiecesAsStlZip, exportFirstHammerTrussAsStl, exportFirstHammerTrussAsGlb, exportFirstHammerTrussAsObj, exportFirstArchTrussAsGlb, exportFirstKingTrussAsGlb, exportFirstTrussAsLowPolyStl, exportFullPavilionAsGlb } from "@/components/pavilion/exportPieces";
import ksmLogo from "@/assets/ksm-logo.png.asset.json";
import {
  DEFAULT_CONFIG,
  PAVILION_SIZES,
  
  RAFTER_TAILS,
  ROOF_MATERIALS,
  ROOF_MATERIAL_TYPES,
  ROOF_STYLES,
  TRUSS_STYLES,
  WOOD_FINISHES,
  estimatePrice,
  isCallForQuote,
  sizeKey,
  type PavilionConfig,
} from "@/lib/pavilion-config";
import { RangeSlider } from "@/components/pavilion/Slider";
import { Switch } from "@/components/ui/switch";
import { PricePanel } from "@/components/pavilion/PricePanel";
import { QuoteDialog } from "@/components/pavilion/QuoteDialog";

import type { ViewPreset } from "@/components/pavilion/Scene";
import { TRUSS_PIECES, type GrainCategory, DEFAULT_RAKE_TRIM_ADJUST, DEFAULT_METAL_RAKE_TRIM_ADJUST, DEFAULT_BACK_RAKE_ROTATION, DEFAULT_HAND_PEELED_RANDOM, type RakeTrimAdjust, type BackRakeRotation, type TrussPlateExtraOffsets, type HandPeeledRandom, SnowRailAdjustContext, DEFAULT_SNOW_RAIL_ADJUST } from "@/components/pavilion/Pavilion3D";
import { PieceAdjustPanel, ZERO_PIECE_ADJUST, type PieceAdjust } from "@/components/pavilion/PieceAdjustPanel";
import { SceneLoadingBar } from "@/components/pavilion/SceneLoadingBar";
import { PieceAdjustsTable } from "@/components/pavilion/PieceAdjustsTable";
import { AllCoordinatesTable } from "@/components/pavilion/AllCoordinatesTable";
import { ScrollCutRafterCoordinatesTable } from "@/components/pavilion/ScrollCutRafterCoordinatesTable";
import finishSmoothAsset from "@/assets/finish_Smooth.jpg.asset.json";
import finishRoughAsset from "@/assets/finish_Rough.jpg.asset.json";
import finishHandPeeledAsset from "@/assets/finish_Hand-Peeled.jpg.asset.json";
import finishHatchetAsset from "@/assets/finish_Hatchet_Hand-Peeled.jpg.asset.json";

const FINISH_IMAGES: Record<string, string> = {
  "smooth": finishSmoothAsset.url,
  "rough-sawn": finishRoughAsset.url,
  "hand-peeled": finishHandPeeledAsset.url,
  "hatchet-hand-peeled": finishHatchetAsset.url,
};
import { HAMMER20_BAKED_OFFSETS_IN, HAMMER20_BAKED_SCALES, HAMMER20_BAKED_PIECE_ADJUSTS } from "@/components/pavilion/hammer20Baked";
import {
  HAMMER16_BAKED_PIECE_ADJUSTS,
  HAMMER16_BAKED_PIECE_OFFSETS_IN,
  HAMMER16_BAKED_PIECE_SCALES,
  HAMMER16_BAKED_PLATE_OFFSETS_IN,
  HAMMER16_BAKED_SCALE,
} from "@/components/pavilion/hammer16Baked";
import {
  HAMMER12_BAKED_PIECE_ADJUSTS,
  HAMMER12_BAKED_PIECE_OFFSETS_IN,
  HAMMER12_BAKED_PIECE_SCALES,
  HAMMER12_BAKED_PLATE_OFFSETS_IN,
  HAMMER12_BAKED_SCALE,
} from "@/components/pavilion/hammer12Baked";
import {
  HAMMER14_BAKED_PIECE_ADJUSTS,
  HAMMER14_BAKED_PIECE_OFFSETS_IN,
  HAMMER14_BAKED_PIECE_SCALES,
  HAMMER14_BAKED_PLATE_OFFSETS_IN,
  HAMMER14_BAKED_SCALE,
} from "@/components/pavilion/hammer14Baked";
import {
  HAMMER20_BAKED_GROUP_OFFSET_IN,
  HAMMER20_BAKED_PIECE_ADJUSTS_FULL,
  HAMMER20_BAKED_PIECE_OFFSETS_IN,
  HAMMER20_BAKED_PIECE_SCALES,
  HAMMER20_BAKED_PLATE_OFFSETS_IN,
  HAMMER20_BAKED_SCALE_V,
} from "@/components/pavilion/hammer20BakedFull";

import { cn } from "@/lib/utils";
import { usePersistedState, withoutUndo } from "@/hooks/use-persisted-state";

const Scene = lazy(() =>
  import("@/components/pavilion/Scene").then((m) => ({ default: m.Scene })),
);

export type ConfiguratorMode = "customer" | "admin";
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

export type AdminPanel = "main" | "scene" | "hammer" | "plates" | "grain";

export function Configurator({
  mode,
  adminPanel,
}: {
  mode: ConfiguratorMode;
  adminPanel?: AdminPanel;
}) {
  const isAdmin = mode === "admin";
  const panel: AdminPanel = isAdmin ? adminPanel ?? "main" : "main";
  const showCustomer = panel === "main";
  const showScene = isAdmin && panel === "scene";
  const showHammer = isAdmin && panel === "hammer";
  const showPlates = isAdmin && panel === "plates";
  const showGrain = isAdmin && panel === "grain";
  const [config, setConfig] = usePersistedState<PavilionConfig>("pav.config.v3-baked-16x20king-noplates", DEFAULT_CONFIG);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [view, setView] = useState<ViewPreset>("3d");
  const [mobilePriceOpen, setMobilePriceOpen] = useState(false);
  const mobilePriceRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!mobilePriceOpen) return;
    const handler = (e: PointerEvent) => {
      const el = mobilePriceRef.current;
      if (el && !el.contains(e.target as Node)) setMobilePriceOpen(false);
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [mobilePriceOpen]);
  const [leftCollapsed, setLeftCollapsed] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches,
  );
  const [rightCollapsed, setRightCollapsed] = useState(isAdmin);
  const [mobileHeight, setMobileHeight] = useState<number>(() =>
    typeof window !== "undefined" ? Math.round(window.innerHeight / 3) : 280,
  );
  const mobileDragStartRef = useRef<{ y: number; h: number } | null>(null);
  const [mobileDragging, setMobileDragging] = useState(false);
  const [mobileCat, setMobileCat] = useState<string>("Size");
  const MOBILE_CATS: { id: string; index: string; label: string }[] = [
    { id: "Size", index: "01", label: "Size" },
    { id: "Trusses & Rafters", index: "02", label: "Trusses" },
    { id: "Timber Finish", index: "03", label: "Finish" },
    { id: "STAIN COLORS", index: "04", label: "Stain" },
    { id: "Roofing", index: "05", label: "Roofing" },
    { id: "Add-Ons", index: "06", label: "Add-Ons" },
  ];
  const [showRoof, setShowRoof] = usePersistedState("pav.showRoof.v2", true);
  // Per-width roof-only lift (inches). Lifts the roof slabs (and decking)
  // without moving trusses, rafters, ridge, fascia, or framing.
  const [roofOnlyLiftByWidth, setRoofOnlyLiftByWidth] = usePersistedState<Record<number, number>>(
    "pav.roofOnlyLiftByWidth.v2-baked",
    { 16: -0.75 },
  );

  const [showTrusses, setShowTrusses] = usePersistedState("pav.showTrusses", true);
  const [showFrame, setShowFrame] = usePersistedState("pav.showFrame", true);
  const [showRafters, setShowRafters] = usePersistedState("pav.showRafters", true);
  const [showPad, setShowPad] = usePersistedState("pav.showPad", true);
  const [showBackyard, setShowBackyard] = usePersistedState("pav.showBackyard", true);
  const [padTileScale, setPadTileScale] = usePersistedState("pav.padTileScale", 1);
  const [showTable, setShowTable] = usePersistedState("pav.showTable", true);
  const [showSectional, setShowSectional] = usePersistedState("pav.showSectional", false);
  const [sofaOffset, setSofaOffset] = usePersistedState<{ x: number; z: number }>("pav.sofaOffset", { x: 0, z: 0 });
  const [sofaRotationDeg, setSofaRotationDeg] = usePersistedState<number>("pav.sofaRotDeg", 0);
  const [tableOffset, setTableOffset] = usePersistedState<{ x: number; z: number }>("pav.tableOffset", { x: 0, z: 0 });
  const [tableRotationDeg, setTableRotationDeg] = usePersistedState<number>("pav.tableRotDeg", 0);
  const [showEgg, setShowEgg] = usePersistedState("pav.showEgg", false);
  const [eggOffset, setEggOffset] = usePersistedState<{ x: number; z: number }>("pav.eggOffset", { x: 0, z: 0 });
  const [eggRotationDeg, setEggRotationDeg] = usePersistedState<number>("pav.eggRotDeg", 0);
  const [showTv, setShowTv] = usePersistedState("pav.showTv", false);
  const [tvCorner, setTvCorner] = usePersistedState<"fl" | "fr" | "br" | "bl">("pav.tvCorner", "fl");
  const [tvHeightFt, setTvHeightFt] = usePersistedState<number>("pav.tvHeightFt", 6);
  const [showDining, setShowDining] = usePersistedState("pav.showDining", false);
  const [diningOffset, setDiningOffset] = usePersistedState<{ x: number; z: number }>("pav.diningOffset", { x: 0, z: 0 });
  const [diningRotationDeg, setDiningRotationDeg] = usePersistedState<number>("pav.diningRotDeg", 0);
  const [showPatio, setShowPatio] = usePersistedState("pav.showPatio", false);
  const [patioOffset, setPatioOffset] = usePersistedState<{ x: number; z: number }>("pav.patioOffset", { x: 0, z: 0 });
  const [patioRotationDeg, setPatioRotationDeg] = usePersistedState<number>("pav.patioRotDeg", 0);
  const [openPlacement, setOpenPlacement] = useState<null | PlacementItem>(null);
  const [furnitureOpen, setFurnitureOpen] = useState(false);
  // On customer mount: force roof+rafters on, all furniture off (per request).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (mode === "customer") {
      setShowRoof(true);
      setShowRafters(true);
      setShowSectional(false);
      setShowEgg(false);
      setShowDining(false);
      setShowPatio(false);
      setShowTv(false);
      setFurnitureOpen(false);
    }
  }, [mode]);
  const [tableStain, setTableStain] = usePersistedState<string | null>("pav.tableStain.v2-baked", null);
  const [deckStain, setDeckStain] = usePersistedState<string | null>("pav.deckStain.v2-baked", null);
  const [stainOpacity, setStainOpacity] = usePersistedState<number>("pav.stainOpacity.v1", 0.9);
  const [stainDarkness, setStainDarkness] = usePersistedState<number>("pav.stainDarkness.v1", 0.3);
  const [projectName, setProjectName] = usePersistedState("pav.projectName", "Custom Pavilion · Untitled");
  const [notes, setNotes] = usePersistedState("pav.notes", "");
  const [snowRailScale, setSnowRailScale] = usePersistedState<{ x: number; y: number; z: number }>(
    "pav.snowRailScale.v3-ss-baked", { x: 0.457, y: 1.026, z: 0.497 });
  const [snowRailRotationDeg, setSnowRailRotationDeg] = usePersistedState<{ x: number; y: number; z: number }>(
    "pav.snowRailRotationDeg.v3-ss-baked", { x: 180, y: 0, z: 0 });
  const [snowRailPositionIn, setSnowRailPositionIn] = usePersistedState<{ x: number; y: number; z: number }>(
    "pav.snowRailPositionIn.v3-ss-baked", { x: 7.2, y: 3.45, z: 0 });
  const [cloudSpread, setCloudSpread] = usePersistedState<number>("pav.cloudSpread.v1", 1);
  const [cloudConcentration, setCloudConcentration] = usePersistedState<number>("pav.cloudConcentration.v1", 1);
  const [cloudHeight, setCloudHeight] = usePersistedState<number>("pav.cloudHeight.v1", 0);



  const [texturedOpen, setTexturedOpen] = useState<"metal" | "standing-seam" | null>(null);
  const D2R = Math.PI / 180;
  // Grain rotation presets (degrees) per category — now user-adjustable in admin.
  const GRAIN_CATEGORY_DEFAULTS: Record<GrainCategory, number> = {
    post: 0,
    beam: 0,
    rafter: -114,
    truss: 0,
    brace: 14,
    plank: 0,
  };
  const [grainCategoryDeg, setGrainCategoryDeg] = usePersistedState<Record<GrainCategory, number>>(
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
  // Per-piece grain rotations (degrees) — user-adjustable in admin.
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

  // Locked hammer-beam body transform (frozen presets, not user-adjustable).
  const baseHammerYOffsetIn = -4.75;
  const baseHammerScale = { x: 1.02, y: 1.02, z: 1 };
  // Per-14'-wide hammer truss scale — seeded from baked truth so the slider
  // matches what's rendered. Key bumped to drop stale localStorage values.
  const HAMMER14_SCALE_DEFAULT = { ...HAMMER14_BAKED_SCALE };
  const [hammer14Scale, setHammer14Scale] = usePersistedState("pav.hammer14Scale.v3-baked", HAMMER14_SCALE_DEFAULT);
  // Per-12'-wide hammer truss scale — seeded from baked truth.
  const HAMMER12_SCALE_DEFAULT = { ...HAMMER12_BAKED_SCALE };
  const [hammer12Scale, setHammer12Scale] = usePersistedState("pav.hammer12Scale.v2-baked", HAMMER12_SCALE_DEFAULT);
  // Per-20'-wide hammer truss scale adjustment.
  const HAMMER20_SCALE_DEFAULT = { x: 1.23, y: 1, z: 1 };
  const [hammer20Scale, setHammer20Scale] = usePersistedState("pav.hammer20Scale.v2", HAMMER20_SCALE_DEFAULT);
  // Per-20'-wide hammer truss group position offset (inches).
  const HAMMER20_GROUP_OFFSET_DEFAULT = { x: 0, y: 0, z: 0 };
  const [hammer20GroupOffsetIn, setHammer20GroupOffsetIn] = usePersistedState(
    "pav.hammer20GroupOffsetIn.v1",
    HAMMER20_GROUP_OFFSET_DEFAULT,
  );
  // Per-12'-wide GLB-truss adjustment (replaces the procedural hammer truss
  // at 12′ width). Scale is a multiplier on top of the auto-fit-to-span
  // base scale; offset is in inches; rotation is in degrees.
  const HAMMER12_GLB_SCALE_DEFAULT = { x: 1.24, y: 1.24, z: 1.24 };
  const HAMMER12_GLB_OFFSET_DEFAULT = { x: 0, y: -11.75, z: -0.25 };
  const HAMMER12_GLB_ROTATION_DEFAULT = { x: 0, y: 0, z: 0 };
  const [hammer12GlbScale, setHammer12GlbScale] = usePersistedState(
    "pav.hammer12GlbScale.v2",
    HAMMER12_GLB_SCALE_DEFAULT,
  );
  const [hammer12GlbOffsetIn, setHammer12GlbOffsetIn] = usePersistedState(
    "pav.hammer12GlbOffsetIn.v2",
    HAMMER12_GLB_OFFSET_DEFAULT,
  );
  const [hammer12GlbRotationDeg, setHammer12GlbRotationDeg] = usePersistedState(
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
  // Per-14'-wide GLB-truss adjustment (same shape as 12').
  const HAMMER14_GLB_SCALE_DEFAULT = { x: 1.2, y: 1.2, z: 1.2 };
  const HAMMER14_GLB_OFFSET_DEFAULT = { x: 0, y: -12, z: 0 };
  const HAMMER14_GLB_ROTATION_DEFAULT = { x: 0, y: 0, z: 0 };
  const [hammer14GlbScale, setHammer14GlbScale] = usePersistedState(
    "pav.hammer14GlbScale.v2",
    HAMMER14_GLB_SCALE_DEFAULT,
  );
  const [hammer14GlbOffsetIn, setHammer14GlbOffsetIn] = usePersistedState(
    "pav.hammer14GlbOffsetIn.v2",
    HAMMER14_GLB_OFFSET_DEFAULT,
  );
  const [hammer14GlbRotationDeg, setHammer14GlbRotationDeg] = usePersistedState(
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
  // Per-16'-wide GLB-truss adjustment (same shape as 12'/14').
  const HAMMER16_GLB_SCALE_DEFAULT = { x: 1.17, y: 1.17, z: 1.17 };
  const HAMMER16_GLB_OFFSET_DEFAULT = { x: 0, y: -12.5, z: 0.125 };
  const HAMMER16_GLB_ROTATION_DEFAULT = { x: 0, y: 0, z: 0 };
  const [hammer16GlbScale, setHammer16GlbScale] = usePersistedState(
    "pav.hammer16GlbScale.v2",
    HAMMER16_GLB_SCALE_DEFAULT,
  );
  const [hammer16GlbOffsetIn, setHammer16GlbOffsetIn] = usePersistedState(
    "pav.hammer16GlbOffsetIn.v2",
    HAMMER16_GLB_OFFSET_DEFAULT,
  );
  const [hammer16GlbRotationDeg, setHammer16GlbRotationDeg] = usePersistedState(
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
  // Per-20'-wide GLB-truss adjustment (same shape as 12'/14'/16').
  const HAMMER20_GLB_SCALE_DEFAULT = { x: 1.137, y: 1.137, z: 1.137 };
  const HAMMER20_GLB_OFFSET_DEFAULT = { x: 0, y: -12.5, z: 0.0625 };
  const HAMMER20_GLB_ROTATION_DEFAULT = { x: 0, y: 0, z: 0 };
  const [hammer20GlbScale, setHammer20GlbScale] = usePersistedState(
    "pav.hammer20GlbScale.v2",
    HAMMER20_GLB_SCALE_DEFAULT,
  );
  const [hammer20GlbOffsetIn, setHammer20GlbOffsetIn] = usePersistedState(
    "pav.hammer20GlbOffsetIn.v2",
    HAMMER20_GLB_OFFSET_DEFAULT,
  );
  const [hammer20GlbRotationDeg, setHammer20GlbRotationDeg] = usePersistedState(
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
  const isBakedHammerWidth = is12Wide || is14Wide || is16Wide || is20Wide;
  // The dedicated 20′ hammer STL sits slightly lower than the generated rafters;
  // lift only that width to close the ~1.75″ rafter/body seam gaps.
  const hammerYOffsetIn = is20Wide ? -3.0 : baseHammerYOffsetIn;
  // Truss plates toggle is user-controlled at every width.

  // 16′ reuses the 14′ truss geometry scaled up uniformly by 16/14.
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
  // Per-piece position offsets (inches) for hammer-beam pieces, 14' only.
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
  // Baked-in default offsets/scales (inches / ×). These are the canonical
  // starting positions for every slider on first load and on Reset.
  const HAMMER14_OFFSETS_DEFAULT: Record<string, { x: number; y: number; z: number }> = {
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
  const HAMMER14_SCALES_DEFAULT: Record<string, { x: number; y: number; z: number }> = {
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
  // 12'-wide baked-in offsets/scales — finalized values, no longer slider-tunable.
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
  // Seed admin-state defaults from baked truth so sliders show what's actually
  // rendered. Key bumped to discard any stale localStorage from prior sessions.
  const [hammer14PieceOffsetsIn, setHammer14PieceOffsetsIn] = usePersistedState<Record<string, { x: number; y: number; z: number }>>(
    "pav.hammer14PieceOffsetsIn.v6-baked",
    { ...HAMMER14_OFFSETS_DEFAULT, ...HAMMER14_BAKED_PIECE_OFFSETS_IN },
  );
  const [hammer14PieceScales, setHammer14PieceScales] = usePersistedState<Record<string, { x: number; y: number; z: number }>>(
    "pav.hammer14PieceScales.v6-baked",
    { ...HAMMER14_SCALES_DEFAULT, ...HAMMER14_BAKED_PIECE_SCALES },
  );
  const [hammer12PieceOffsetsIn, setHammer12PieceOffsetsIn] = usePersistedState<Record<string, { x: number; y: number; z: number }>>(
    "pav.hammer12PieceOffsetsIn.v5-baked",
    { ...HAMMER12_OFFSETS_DEFAULT, ...HAMMER12_BAKED_PIECE_OFFSETS_IN },
  );
  const [hammer12PieceScales, setHammer12PieceScales] = usePersistedState<Record<string, { x: number; y: number; z: number }>>(
    "pav.hammer12PieceScales.v5-baked",
    { ...HAMMER12_SCALES_DEFAULT, ...HAMMER12_BAKED_PIECE_SCALES },
  );
  // 20' values — zero by default so the two co-located mesh groups (body +
  // king/prince partition) stay perfectly aligned. Sliders can still nudge.
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
  const [hammer20PieceOffsetsIn, setHammer20PieceOffsetsIn] = usePersistedState<Record<string, { x: number; y: number; z: number }>>(
    "pav.hammer20PieceOffsetsIn.v3-toptie",
    HAMMER20_OFFSETS_DEFAULT,
  );
  const [hammer20PieceScales, setHammer20PieceScales] = usePersistedState<Record<string, { x: number; y: number; z: number }>>(
    "pav.hammer20PieceScales.v3-toptie",
    HAMMER20_SCALES_DEFAULT,
  );
  // Per-width persisted maps for per-piece offsets/scales (widths other than
  // 12/14/20). Each pavilion width gets its own bucket so adjusting a piece
  // on one size never bleeds into another.
  const [hammerPieceOffsetsByWidth, setHammerPieceOffsetsByWidth] = usePersistedState<Record<string, Record<string, { x: number; y: number; z: number }>>>(
    "pav.hammerPieceOffsetsByWidth.v1",
    {},
  );
  const [hammerPieceScalesByWidth, setHammerPieceScalesByWidth] = usePersistedState<Record<string, Record<string, { x: number; y: number; z: number }>>>(
    "pav.hammerPieceScalesByWidth.v1",
    {},
  );
  const hammerWidthKey = String(config.width);
  
  const otherWidthOffsetsIn = hammerPieceOffsetsByWidth[hammerWidthKey] ?? HAMMER20_OFFSETS_DEFAULT;
  const otherWidthScales = hammerPieceScalesByWidth[hammerWidthKey] ?? HAMMER20_SCALES_DEFAULT;
  const setOtherWidthOffsetsIn = (
    updater: React.SetStateAction<Record<string, { x: number; y: number; z: number }>>,
  ) =>
    setHammerPieceOffsetsByWidth((s) => {
      const prev = s[hammerWidthKey] ?? HAMMER20_OFFSETS_DEFAULT;
      const next = typeof updater === "function" ? (updater as (p: typeof prev) => typeof prev)(prev) : updater;
      return { ...s, [hammerWidthKey]: next };
    });
  const setOtherWidthScales = (
    updater: React.SetStateAction<Record<string, { x: number; y: number; z: number }>>,
  ) =>
    setHammerPieceScalesByWidth((s) => {
      const prev = s[hammerWidthKey] ?? HAMMER20_SCALES_DEFAULT;
      const next = typeof updater === "function" ? (updater as (p: typeof prev) => typeof prev)(prev) : updater;
      return { ...s, [hammerWidthKey]: next };
    });

  // Baked widths must render exactly from their baked constants; do not layer
  // any extra runtime offsets on top of those files.
  // For widths other than 12/14/20, use the per-width store; 20' keeps its
  // dedicated state; 12'/14' keep theirs. Each size adjusts independently.
  const activePieceOffsetsIn = is14Wide ? HAMMER14_BAKED_PIECE_OFFSETS_IN : is12Wide ? hammer12PieceOffsetsIn : is16Wide ? HAMMER14_BAKED_PIECE_OFFSETS_IN : is20Wide ? HAMMER20_BAKED_PIECE_OFFSETS_IN : otherWidthOffsetsIn;
  const activePieceScales = is14Wide ? HAMMER14_BAKED_PIECE_SCALES : is12Wide ? hammer12PieceScales : is16Wide ? HAMMER14_BAKED_PIECE_SCALES : is20Wide ? HAMMER20_BAKED_PIECE_SCALES : otherWidthScales;
  // Route slider writes to the SAME store the active width reads from, so
  // adjusting on 12'/14'/20' never bleeds into another width's saved values.
  const setActivePieceOffsetsIn = is14Wide
    ? setHammer14PieceOffsetsIn
    : is12Wide
      ? setHammer12PieceOffsetsIn
      : is20Wide
        ? setHammer20PieceOffsetsIn
        : setOtherWidthOffsetsIn;
  const setActivePieceScales = is14Wide
    ? setHammer14PieceScales
    : is12Wide
      ? setHammer12PieceScales
      : is20Wide
        ? setHammer20PieceScales
        : setOtherWidthScales;
  const adjustedPieceOffsetsIn = activePieceOffsetsIn ?? null;
  const hammerPieceOffsets = adjustedPieceOffsetsIn
    ? Object.fromEntries(
        Object.entries(adjustedPieceOffsetsIn).map(([k, v]) => [k, { x: v.x * 0.0254, y: v.y * 0.0254, z: v.z * 0.0254 }]),
      )
    : undefined;
  const hammerPieceScales = activePieceScales ?? undefined;
  // Per-piece lock: when locked, position/scale sliders for that piece are disabled.
  const [hammer14PieceLocked, setHammer14PieceLocked] = usePersistedState<Record<string, boolean>>(
    "pav.hammer14PieceLocked",
    Object.fromEntries(HAMMER_PIECES.map((p) => [p.id, true])),
  );
  const [hammer12PieceLocked, setHammer12PieceLocked] = usePersistedState<Record<string, boolean>>(
    "pav.hammer12PieceLocked",
    Object.fromEntries(HAMMER_PIECES.map((p) => [p.id, true])),
  );
  const [hammer20PieceLocked, setHammer20PieceLocked] = usePersistedState<Record<string, boolean>>(
    "pav.hammer20PieceLocked.v2-unlocked",
    Object.fromEntries(HAMMER_PIECES.map((p) => [p.id, false])),
  );
  // Per-piece slider range multiplier — lets each piece extend its slider
  // travel (1× / 2× / 5× / 10×) without losing fine-grained control on others.
  const [hammer20PieceRangeMult, setHammer20PieceRangeMult] = usePersistedState<Record<string, number>>(
    "pav.hammer20PieceRangeMult.v1",
    Object.fromEntries(HAMMER_PIECES.map((p) => [p.id, 1])),
  );
  // Master lock for every 20′ coordinate (group scale/position + per-piece
  // position/scale). When true the admin sliders for 20′ are disabled. The
  // "Lock & Save 20′" button sets this and publishes the current snapshot.
  const [lock20All, setLock20All] = usePersistedState<boolean>("pav.lock20All.v1", false);
  const [lock20Saving, setLock20Saving] = useState(false);
  const publishDefaults20 = useServerFn(publishPavilionDefaults);
  const handleLockAndSave20 = async () => {
    setLock20Saving(true);
    try {
      setLock20All(true);
      // Give React a tick to flush the lock write into localStorage.
      await new Promise((r) => setTimeout(r, 50));
      const payload: Record<string, string> = {};
      if (typeof window !== "undefined") {
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i);
          if (!k || !k.startsWith("pav.")) continue;
          const v = window.localStorage.getItem(k);
          if (typeof v === "string") payload[k] = v;
        }
      }
      await publishDefaults20({ data: { data: payload } });
      toast.success("20′ coordinates locked & saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setLock20Saving(false);
    }
  };

  /** Builds a TS snippet of the current 20′ piece offsets/scales + per-piece
   *  adjusts and copies it to the clipboard, ready to paste into
   *  src/components/pavilion/hammer20Baked.ts so it becomes the in-code
   *  default for every fresh browser. */
  const handleCopy20AsCode = async () => {
    try {
      const fmtVec = (v: { x: number; y: number; z: number }) =>
        `{ x: ${+v.x.toFixed(4)}, y: ${+v.y.toFixed(4)}, z: ${+v.z.toFixed(4)} }`;
      const fmtMap = (m: Record<string, { x: number; y: number; z: number }>) => {
        const entries = Object.entries(m)
          .filter(([, v]) => v && (v.x !== 0 || v.y !== 0 || v.z !== 0 || /Scales/.test("")))
          .map(([k, v]) => `  ${JSON.stringify(k)}: ${fmtVec(v)},`)
          .join("\n");
        return entries ? `{\n${entries}\n}` : `{}`;
      };
      const fmtScales = (m: Record<string, { x: number; y: number; z: number }>) => {
        const entries = Object.entries(m)
          .filter(([, v]) => v && (v.x !== 1 || v.y !== 1 || v.z !== 1))
          .map(([k, v]) => `  ${JSON.stringify(k)}: ${fmtVec(v)},`)
          .join("\n");
        return entries ? `{\n${entries}\n}` : `{}`;
      };
      const offsets = fmtMap(hammer20PieceOffsetsIn);
      const scales = fmtScales(hammer20PieceScales);
      const adjusts20 = pieceAdjustsByWidth["20"] ?? {};
      const adjustsJson = JSON.stringify(adjusts20, null, 2);
      const snippet =
`// Generated by "Copy 20′ as code" — paste into src/components/pavilion/hammer20Baked.ts
export const HAMMER20_BAKED_OFFSETS_IN: Record<string, Vec3> = ${offsets};

export const HAMMER20_BAKED_SCALES: Record<string, Vec3> = ${scales};

export const HAMMER20_BAKED_PIECE_ADJUSTS: Record<string, unknown> = ${adjustsJson};
`;
      await navigator.clipboard.writeText(snippet);
      toast.success("20′ coordinates copied as code — paste into hammer20Baked.ts");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Copy failed");
    }
  };

  // 12′ / 14′ / 16′: force every hammer-truss member to a uniform 5.5″ × 5.5″ section.
  const hammerUniformProfile55 = !is20Wide;
  // When uniform 5.5″ is on, don't post-scale the truss group or king-brace —
  // any scale ≠ 1 here would multiply through to the cross-section and break
  // the 5.5″ × 5.5″ guarantee.
  const hammerCorbelScale = hammerUniformProfile55 ? { x: 1, y: 1, z: 1 } : { x: 0.7, y: 0.7, z: 0.95 };
  const hammerCorbelOffset = { x: -50.5, y: -19.5, z: 0 };
  const hammerCorbelRotation = { x: 0, y: 0, z: 33 };
  const hammerKingbraceGrainDeg = -133;
  // V-Style truss plate transform — locked preset (do not expose as UI).
  const plateOffsetIn = { x: -6.25, y: 0.75, z: 0 };
  const plateRotationDeg = { x: 0, y: -180, z: 0 };
  const plateSizeScale = 1.06;
  // Web-plate transform — adjustable via sliders.
  // Web plate transform locked to fixed preset — no UI.
  const webPlateOffsetIn = { x: -45.75, y: 25.25, z: 0 };
  const webPlateRotationDeg = { x: 0, y: -180, z: 0 };
  const webPlateSizeScale = 1.49;
  const vPlateSurfaceInsetIn = -0.35;
  const webPlateSurfaceInsetIn = -1.3;
  // Peak-plate transform — locked to fixed presets.
  const peakPlateOffsetIn = { x: 0, y: -3.5, z: 0 };
  const peakPlateRotationDeg = { x: 0, y: 0, z: 0 };
  const peakPlateSizeScale = 1;
  const peakPlateSurfaceInsetIn = -0.15;
  // Arch-truss decorative metal plate transforms — slider-driven. Authored in
  // the left (un-mirrored) frame; the right side mirrors automatically.
  // Per-width scoping: each pavilion size (12/14/16/20) keeps its own copy so
  // tuning one width never bleeds into another. The active value below is
  // read from the map for the currently-selected width.
  // Per-width baked defaults — values come from the documented coordinate
  // layout the user maintains. Edits here ARE the source of truth; do not
  // overwrite from the UI without intending to publish a new baseline.
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

  // King-truss plates (peak / heel / web)
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
  // Fall back to the 20′ bake (closest calibrated anchor) for uncalibrated
  // large widths like 24/28/32; drop to 14′ only if 20′ is also missing.
  const pw = <T,>(m: Record<string, T>): T => (m[platesWidthKey] ?? m["20"] ?? m["14"]) as T;
  function usePerWidthPlate<T>(storageKey: string, defMap: Record<string, T>) {
    // Strict per-width default. If missing, inherit from 20' (closest baked
    // anchor for newer wider sizes like 24/28/32), then fall back to 14'.
    const strictDefault = defMap[platesWidthKey];
    const fallback = (strictDefault ?? defMap["20"] ?? defMap["14"]) as T;
    const [byWidth, setByWidth] = usePersistedState<Record<string, T>>(storageKey, { ...defMap });
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

  // -------- King-truss plates: peak / heel / web --------
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
  // 14'-only per-individual-plate position offsets (inches). World-space nudge
  // applied on top of the baked plate transforms so each plate can be tuned.
  type PlateXYZ = { x: number; y: number; z: number };
  const PLATE_OFFSETS_DEFAULT: Record<"vL" | "vR" | "wL" | "wR" | "peak", PlateXYZ> = {
    vL:   { x: 0,    y: 0,     z: 0 },
    vR:   { x: 0,    y: 0,     z: 0 },
    wL:   { x: -8.5, y: -6.25, z: 0 },
    wR:   { x: 8.5,  y: -6.25, z: 0 },
    peak: { x: 0,    y: 0,     z: 0 },
  };
  const [plate14OffsetsIn, setPlate14OffsetsIn] = usePersistedState<
    Record<"vL" | "vR" | "wL" | "wR" | "peak", PlateXYZ>
  >("pav.plate14OffsetsIn.v3-baked", { ...PLATE_OFFSETS_DEFAULT, ...HAMMER14_BAKED_PLATE_OFFSETS_IN });
  // 12'-only plate offsets — baked-in finalized values (sliders removed).
  const PLATE12_OFFSETS_DEFAULT: Record<"vL" | "vR" | "wL" | "wR" | "peak", PlateXYZ> = {
    vL:   { x: 0,  y: 0,  z: 0 },
    vR:   { x: 0,  y: 0,  z: 0 },
    wL:   { x: -9, y: -6, z: 0 },
    wR:   { x: 9,  y: -6, z: 0 },
    peak: { x: 0,  y: 0,  z: 0 },
  };
  const [plate12OffsetsIn, setPlate12OffsetsIn] = usePersistedState<
    Record<"vL" | "vR" | "wL" | "wR" | "peak", PlateXYZ>
  >("pav.plate12OffsetsIn.v3-baked", { ...PLATE12_OFFSETS_DEFAULT, ...HAMMER12_BAKED_PLATE_OFFSETS_IN });
  // 20'-only plate offsets — start from the 16' nudges (which are authored
  // in inches and applied on top of the shared hj/webPlateOffset anchors).
  // Use A1.10 sliders to fine-tune.
  const PLATE20_OFFSETS_DEFAULT: Record<"vL" | "vR" | "wL" | "wR" | "peak", PlateXYZ> = {
    vL:   { x: 0,      y: 0,    z: 0 },
    vR:   { x: 0,      y: 0,    z: 0 },
    wL:   { x: 11.25,  y: 7.75, z: 0 },
    wR:   { x: -10.75, y: 7.75, z: 0 },
    peak: { x: 0,      y: 0,    z: 0 },
  };
  const [plate20OffsetsIn, setPlate20OffsetsIn] = usePersistedState<
    Record<"vL" | "vR" | "wL" | "wR" | "peak", PlateXYZ>
  >("pav.plate20OffsetsIn.v5-baked", PLATE20_OFFSETS_DEFAULT);
  // 16'-only plate offsets — defaults match the prior shared 14' nudges so
  // existing 16' pavilions look identical until an admin tweaks them.
  const PLATE16_OFFSETS_DEFAULT: Record<"vL" | "vR" | "wL" | "wR" | "peak", PlateXYZ> = {
    vL:   { x: 0,    y: 0,     z: 0 },
    vR:   { x: 0,    y: 0,     z: 0 },
    wL:   { x: -8.5, y: -6.25, z: 0 },
    wR:   { x: 8.5,  y: -6.25, z: 0 },
    peak: { x: 0,    y: 0,     z: 0 },
  };
  const [plate16OffsetsIn, setPlate16OffsetsIn] = usePersistedState<
    Record<"vL" | "vR" | "wL" | "wR" | "peak", PlateXYZ>
  >("pav.plate16OffsetsIn.v2-baked", { ...PLATE16_OFFSETS_DEFAULT, ...HAMMER16_BAKED_PLATE_OFFSETS_IN });
  const activePlateOffsetsIn = is12Wide
    ? HAMMER12_BAKED_PLATE_OFFSETS_IN
    : is20Wide
      ? plate20OffsetsIn
      : is16Wide
        ? HAMMER16_BAKED_PLATE_OFFSETS_IN
        : is14Wide
          ? plate14OffsetsIn
          : HAMMER14_BAKED_PLATE_OFFSETS_IN;
  const setActivePlateOffsetsIn = is12Wide
    ? setPlate12OffsetsIn
    : is20Wide
      ? setPlate20OffsetsIn
      : is16Wide
        ? setPlate16OffsetsIn
        : setPlate14OffsetsIn;
  const activePlateOffsetsDefault = is12Wide
    ? PLATE12_OFFSETS_DEFAULT
    : is20Wide
      ? PLATE20_OFFSETS_DEFAULT
      : is16Wide
        ? PLATE16_OFFSETS_DEFAULT
        : PLATE_OFFSETS_DEFAULT;
  const activePlateLabel = is12Wide ? "12′" : is20Wide ? "20′" : is16Wide ? "16′" : "14′";
  const trussPlateExtraOffsets: TrussPlateExtraOffsets | undefined = is14Wide || is12Wide || is16Wide || is20Wide
    ? {
        vL:   { x: activePlateOffsetsIn.vL.x   * 0.0254, y: activePlateOffsetsIn.vL.y   * 0.0254, z: activePlateOffsetsIn.vL.z   * 0.0254 },
        vR:   { x: activePlateOffsetsIn.vR.x   * 0.0254, y: activePlateOffsetsIn.vR.y   * 0.0254, z: activePlateOffsetsIn.vR.z   * 0.0254 },
        wL:   { x: activePlateOffsetsIn.wL.x   * 0.0254, y: activePlateOffsetsIn.wL.y   * 0.0254, z: activePlateOffsetsIn.wL.z   * 0.0254 },
        wR:   { x: activePlateOffsetsIn.wR.x   * 0.0254, y: activePlateOffsetsIn.wR.y   * 0.0254, z: activePlateOffsetsIn.wR.z   * 0.0254 },
        peak: { x: activePlateOffsetsIn.peak.x * 0.0254, y: activePlateOffsetsIn.peak.y * 0.0254, z: activePlateOffsetsIn.peak.z * 0.0254 },
      }
    : undefined;

  const PLATE_LABELS: Array<{ id: "vL" | "vR" | "wL" | "wR" | "peak"; label: string }> = [
    { id: "vL",   label: "V-Plate L"  },
    { id: "vR",   label: "V-Plate R"  },
    { id: "wL",   label: "Web Plate L" },
    { id: "wR",   label: "Web Plate R" },
    { id: "peak", label: "Peak Plate"  },
  ];
  // Persist per-axis lock state so unlocked sliders stay unlocked across refresh.
  type PlateLocks = Record<"vL" | "vR" | "wL" | "wR" | "peak", { x: boolean; y: boolean; z: boolean }>;
  const PLATE_LOCKS_DEFAULT: PlateLocks = {
    vL:   { x: true, y: true, z: true },
    vR:   { x: true, y: true, z: true },
    wL:   { x: true, y: true, z: true },
    wR:   { x: true, y: true, z: true },
    peak: { x: true, y: true, z: true },
  };
  const [plate14Locks, setPlate14Locks] = usePersistedState<PlateLocks>(
    "pav.plate14Locks.v1",
    PLATE_LOCKS_DEFAULT,
  );
  // Base per-piece grain defaults (degrees).
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
  const [grainPieceDeg, setGrainPieceDeg] = usePersistedState<Record<string, number>>(
    "pav.grainPieceDeg.v1",
    GRAIN_PIECE_DEFAULTS_DEG,
  );
  // Per-face grain overrides (degrees), keyed by piece id → 6 face values.
  const [grainFaceDeg, setGrainFaceDeg] = usePersistedState<Record<string, number[]>>(
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

  // Global hand-peeled randomization controls.
  const [handPeeledRandom, setHandPeeledRandom] = usePersistedState<HandPeeledRandom>(
    "pav.handPeeledRandom.v1",
    DEFAULT_HAND_PEELED_RANDOM,
  );

  const handleGrainPick = (key: string, label: string) => {
    setLastGrainPick(label);
    if (key.startsWith("face:")) {
      // face:{id}:{faceIndex}
      const rest = key.slice(5);
      const lastColon = rest.lastIndexOf(":");
      if (lastColon < 0) return;
      const id = rest.slice(0, lastColon);
      const faceIdx = parseInt(rest.slice(lastColon + 1), 10);
      if (!id || Number.isNaN(faceIdx)) return;
      setGrainFaceDeg((s) => {
        const arr = (s[id] ?? [0, 0, 0, 0, 0, 0]).slice();
        while (arr.length < 6) arr.push(0);
        arr[faceIdx] = ((arr[faceIdx] ?? 0) + 90) % 360;
        return { ...s, [id]: arr };
      });
    } else if (key.startsWith("piece:")) {
      const id = key.slice(6);
      setGrainPieceDeg((s) => {
        const cur = s[id] ?? GRAIN_PIECE_DEFAULTS_DEG[id] ?? 0;
        return { ...s, [id]: ((cur + 90) % 360 + 360) % 360 };
      });
    } else if (key.startsWith("cat:")) {
      const cat = key.slice(4) as GrainCategory;
      setGrainCategoryDeg((s) => {
        const cur = s[cat] ?? 0;
        return { ...s, [cat]: ((cur + 90) % 360 + 360) % 360 };
      });
    }
  };

  const [rakeTrimAdjust, setRakeTrimAdjust] = usePersistedState<RakeTrimAdjust>("pav.rakeTrimAdjust", DEFAULT_RAKE_TRIM_ADJUST);
  const [metalRakeTrimAdjust, setMetalRakeTrimAdjust] = usePersistedState<RakeTrimAdjust>("pav.metalRakeTrimAdjust", DEFAULT_METAL_RAKE_TRIM_ADJUST);
  const [grassDensity, setGrassDensity] = usePersistedState<number>("pav.grassDensity", 1);
  const [grassTint, setGrassTint] = usePersistedState<string>("pav.grassTint", "#c8cfb8");
  
  const [grassTexture, setGrassTexture] = usePersistedState<number>("pav.grassTexture", 1);
  const [rawBeamColor, setRawBeamColor] = usePersistedState<string>(NATURAL_PINE_BEAM_KEY, NATURAL_PINE_BEAM);
  const [rawDeckColor, setRawDeckColor] = usePersistedState<string>(NATURAL_PINE_DECK_KEY, NATURAL_PINE_DECK);
  const [grainPickMode, setGrainPickMode] = useState(false);
  const [selectPickMode, setSelectPickMode] = useState(false);
  const [pieceEditEnabled, setPieceEditEnabled] = usePersistedState<boolean>("pav.pieceEditEnabled", false);
  const [measureEnabled, setMeasureEnabled] = useState<boolean>(false);
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [lastGrainPick, setLastGrainPick] = useState<string | null>(null);

  // Per-piece adjust panel (move + per-side extend). Keyed by full pieceKey
  // (e.g. "piece:hammer.kingbrace.l" or "cat:post"). Stored per width.
  const [pieceAdjustKey, setPieceAdjustKey] = useState<string | null>(null);
  const [pieceAdjustLabel, setPieceAdjustLabel] = useState<string>("");
  // Stack of recently deleted (hidden) pieces so the panel can offer Undo.
  const [deletedHistory, setDeletedHistory] = useState<
    Array<{ entries: Array<{ key: string; prev: PieceAdjust | undefined }> }>
  >([]);

  const [pieceAdjustEnabled, setPieceAdjustEnabled] = usePersistedState<boolean>("pav.pieceAdjustEnabled.v2", true);
  const [pieceAdjustLinkTwin, setPieceAdjustLinkTwin] = usePersistedState<boolean>("pav.pieceAdjustLinkTwin.v1", false);
  // Auto-mirror mode: when ON, edits to any right-side (.r / _r / right)
  // piece are automatically mirrored to its left twin (X-flipped). Edits to
  // the left side are NOT auto-mirrored — the right side is the "source of
  // truth" while this is enabled.
  const [autoMirrorRtoL, setAutoMirrorRtoL] = usePersistedState<boolean>("pav.autoMirrorRtoL.v1", false);
  const isRightId = (k: string) => /(^|[._-])(r|right)($|[._-])/i.test(k);
  const toLeftTwinId = (k: string) =>
    k
      .replace(/(^|[._-])right($|[._-])/i, (_, a, b) => `${a}left${b}`)
      .replace(/(^|[._-])r($|[._-])/i, (_, a, b) => `${a}l${b}`);
  // Scroll-cut tail rafter bake for 20'-wide pavilions. Mirrors the arch 20'
  // bake (see ARCH_PIECE_ADJUSTS_BAKED["20"] below) so hammer, king, and arch
  // styles all share the same scroll-cut rafter positioning/scale at 20'.
  // Pavilion3D filters these out unless rafterTail === "scroll".
  const SCROLL_COLLAR_BAKE: Record<string, PieceAdjust> = {
    "side.collar": { off: { x: 0, y: 0, z: -0.25 }, ext: { xp: 0, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 }, scl: { x: 1.03, y: 1, z: 0.94 } },
  };
  // 20'-wide scroll-cut rafters follow the regular rafter position/scale
  // (no offsets, no extensions, identity scale) so the scroll-cut tail simply
  // replaces the rafter mesh without repositioning it. Baked explicitly so
  // any stale saved values get overwritten by the seed.
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



  // Matched to SCROLL14_RAFTER_BAKE_ARCH so 14′ hammer-beam scroll tails are
  // identical to 14′ arch-truss scroll tails.
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
  const KING14_SCROLL_RAFTER_KEYS = new Set(Object.keys(SCROLL14_RAFTER_BAKE_KING));



  const SCROLL14_RAFTER_BAKE_ARCH: Record<string, PieceAdjust> = {
    "side.rafter.l": { off: { x: -1.75, y: 0, z: 0 }, ext: { xp: 6.75, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 }, scl: { x: 0.91, y: 1, z: 1 } },
    "side.rafter.r": { off: { x:  1.75, y: 0, z: 0 }, ext: { xp: 6.75, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 }, scl: { x: 0.91, y: 1, z: 1 } },
    "arch.rafter.r": { off: { x:  1.75, y: 0, z: 0 }, ext: { xp: 6.75, xn: 0, yp: 0, yn: 0, zp: 0, zn: 0 }, scl: { x: 0.91, y: 1, z: 1 } },
  };

  const [pieceAdjustsByWidth, setPieceAdjustsByWidth] = usePersistedState<Record<string, Record<string, PieceAdjust>>>(
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


  // Arch King Truss piece adjustments are stored per-width so that edits in
  // one pavilion size don't bleed into the others. Per-width values are baked
  // from the on-screen Coordinates Sheet; bump the version when changing
  // seeded defaults so returning users pick up the new bake.
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
  // Fall back to the 20′ bake (the closest calibrated width) for any width
  // that hasn't been individually baked. Previously fell back to 14′, which
  // left large pavilions (24/28/32) with severely mispositioned arch pieces.
  const ARCH_PIECE_ADJUSTS_DEFAULT: Record<string, PieceAdjust> = ARCH_PIECE_ADJUSTS_BAKED["20"];
  const [archPieceAdjustsByWidth, setArchPieceAdjustsByWidth] = usePersistedState<Record<string, Record<string, PieceAdjust>>>(
    "pav.archPieceAdjustsByWidth.v14-runtime-large-widths",
    {
      "12": { ...ARCH_PIECE_ADJUSTS_BAKED["12"], ...SCROLL_COLLAR_BAKE },
      "14": { ...ARCH_PIECE_ADJUSTS_BAKED["14"], ...SCROLL14_RAFTER_BAKE_ARCH, ...SCROLL_COLLAR_BAKE },
      "16": { ...ARCH_PIECE_ADJUSTS_BAKED["16"], ...SCROLL_COLLAR_BAKE },
      "20": { ...ARCH_PIECE_ADJUSTS_BAKED["20"], ...SCROLL20_RAFTER_BAKE_ARCH, ...SCROLL_COLLAR_BAKE },
    },
  );




  const widthKey = String(config.width);
  // Scope king-truss piece adjusts to their own storage key so editing king
  // pieces doesn't overwrite the hammer-truss baked defaults for the same
  // width (and vice versa). Arch uses its own dedicated state already.
  const isKingTruss = config.truss === "king";
  const pieceAdjustsKey = isKingTruss ? `king-${widthKey}` : widthKey;
  // Note: 14′ King scroll-tail rafters are seeded via the usePersistedState
  // default (SCROLL14_RAFTER_BAKE_KING) but are NOT locked — admins can
  // freely adjust them and the edits persist normally.

  // 12′ stays baked-in and locked. 14′/16′/20′ are click-to-adjust, each
  // with its own per-width adjust map persisted under widthKey.
  const pieceAdjusts = config.truss === "arch"
    ? (archPieceAdjustsByWidth[widthKey] ?? ARCH_PIECE_ADJUSTS_DEFAULT)
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

  const currentPieceAdjust = pieceAdjustKey ? (pieceAdjusts[pieceAdjustKey] ?? ZERO_PIECE_ADJUST) : ZERO_PIECE_ADJUST;
  // Tracks the piece the user most recently nudged via the adjust panel.
  // Used by the "Copy" button so the OTHER side mirrors whichever twin you
  // were just editing — regardless of which panel is currently open.
  const lastEditedPieceKeyRef = useRef<string | null>(null);
  const updatePieceAdjust = (key: string, next: PieceAdjust, opts?: { fromUserEdit?: boolean }) => {
    if (opts?.fromUserEdit) lastEditedPieceKeyRef.current = key;
    const mirrorTwin = (inner: Record<string, PieceAdjust>) => {
      if (autoMirrorRtoL && opts?.fromUserEdit && isRightId(key)) {
        const twin = toLeftTwinId(key);
        if (twin !== key) {
          inner[twin] = {
            off: { x: -next.off.x, y: next.off.y, z: next.off.z },
            ext: {
              xp: next.ext.xn, xn: next.ext.xp,
              yp: next.ext.yp, yn: next.ext.yn,
              zp: next.ext.zp, zn: next.ext.zn,
            },
            scl: next.scl ? { ...next.scl } : { x: 1, y: 1, z: 1 },
            hidden: !!next.hidden,
          };
        }
      }
      return inner;
    };
    if (config.truss === "arch") {
      setArchPieceAdjustsByWidth((prev) => {
        const inner = mirrorTwin({ ...(prev[widthKey] ?? ARCH_PIECE_ADJUSTS_DEFAULT), [key]: next });
        return { ...prev, [widthKey]: inner };
      });
      return;
    }
    setPieceAdjustsByWidth((prev) => {
      const inner = mirrorTwin({ ...(prev[pieceAdjustsKey] ?? {}), [key]: next });
      return { ...prev, [pieceAdjustsKey]: inner };
    });

  };
  const resetPieceAdjust = (key: string) => {
    if (config.truss === "arch") {
      setArchPieceAdjustsByWidth((prev) => {
        const inner = { ...(prev[widthKey] ?? ARCH_PIECE_ADJUSTS_DEFAULT) };
        delete inner[key];
        return { ...prev, [widthKey]: inner };
      });
      return;
    }
    setPieceAdjustsByWidth((prev) => {
      const inner = { ...(prev[pieceAdjustsKey] ?? {}) };
      delete inner[key];
      return { ...prev, [pieceAdjustsKey]: inner };
    });

  };


  // When a piece is selected by clicking in the 3D view, open its details
  // accordion, scroll it into view, and flash a highlight ring.
  useEffect(() => {
    if (!selectedPieceId) return;
    const el = document.getElementById(`piece-row-${selectedPieceId}`) as HTMLDetailsElement | null;
    if (!el) return;
    el.open = true;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-brand", "ring-offset-1");
    const t = window.setTimeout(() => {
      el.classList.remove("ring-2", "ring-brand", "ring-offset-1");
    }, 1600);
    return () => window.clearTimeout(t);
  }, [selectedPieceId]);

  const selectedPieceObjectRef = useRef<THREE.Object3D | null>(null);
  const handleSelectPick = (key: string, label: string, object?: THREE.Object3D) => {
    selectedPieceObjectRef.current = object ?? (typeof window !== "undefined" ? ((window as any).__lastPavilionPickedObject as THREE.Object3D | undefined) ?? null : null);
    setLastGrainPick(label);
    // Resolve the underlying pieceKey for the per-piece adjust panel.
    // grainKey shape is `face:<pieceKey>:<faceIdx>` or `piece:<id>` or `cat:<id>`.
    let pieceKey: string | null = null;
    let id: string | null = null;
    if (key.startsWith("face:")) {
      const rest = key.slice(5);
      const lastColon = rest.lastIndexOf(":");
      pieceKey = lastColon > 0 ? rest.slice(0, lastColon) : rest;
    } else if (key.startsWith("piece:") || key.startsWith("cat:")) {
      pieceKey = key;
    }
    // Frame pieces (posts/beams/ridge/plank) aren't user-adjustable via click
    // on shorter pavilions. For 28'+ long pavilions, allow editing frame
    // pieces too so the longer girders, beams, and ridge can be tuned.
    // Rafters (including king.rafter.*) ARE clickable so trusses can be edited
    // piece-by-piece directly in the 3D view.
    const allowFrameEdit = config.length >= 28;
    const isFrameOrRafter = (k: string | null): boolean => {
      if (!k) return false;
      if (allowFrameEdit) return false;
      if (k === "cat:post" || k === "cat:beam" || k === "cat:plank") return true;
      const id = k.startsWith("piece:") ? k.slice(6) : k;
      if (id === "ridge") return true;
      return false;
    };

    if (isFrameOrRafter(pieceKey)) {
      return;
    }
    if (pieceKey) {
      // Click opens the per-piece adjust panel. Deletion-on-click is disabled
      // to prevent accidental removal — previously-hidden pieces (saved per
      // width) remain hidden until explicitly restored via the panel's Reset.
      setPieceAdjustKey(pieceKey);
      setPieceAdjustLabel(label);
    }
    if (pieceKey?.startsWith("piece:")) id = pieceKey.slice(6);
    if (id && !id.startsWith("cat:")) {
      setSelectedPieceId(null);
      setTimeout(() => setSelectedPieceId(id!), 0);
    }
  };

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
  const pavilionRootRef = useRef<THREE.Group | null>(null);
  const [exporting, setExporting] = useState(false);

  // Cmd/Ctrl+D — duplicate the currently selected piece. Each press clones
  // the first mesh matching the selected pieceKey, offsets it ~6" in world
  // +X so it's visible, and attaches it as a sibling of the source mesh.
  // Cmd/Ctrl+Shift+D undoes the most recent duplicate. Duplicates are
  // session-only (cleared on reload).
  const duplicatesRef = useRef<THREE.Object3D[]>([]);
  useEffect(() => {
    if (mode !== "admin") return;
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || e.key.toLowerCase() !== "d") return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || target?.isContentEditable) return;
      e.preventDefault();
      // Shift+Cmd+D → remove last duplicate.
      if (e.shiftKey) {
        const last = duplicatesRef.current.pop();
        if (last && last.parent) {
          last.parent.remove(last);
          toast.success("Removed last duplicate");
        }
        return;
      }
      const root = pavilionRootRef.current;
      const key = pieceAdjustKey;
      if (!root || !key) {
        toast.error("Select a piece first (click it in the 3D view)");
        return;
      }
      const bareKey = key.replace(/^(piece:|cat:)/, "");
      const materialPieceKey = (m: THREE.Mesh): string | undefined => {
        const mat = Array.isArray(m.material) ? m.material[0] : m.material;
        return (mat as any)?.userData?.pieceKey;
      };
      const matchesSelectedKey = (m: THREE.Mesh): boolean => {
        const pk = materialPieceKey(m);
        return !!pk && (pk === key || pk.replace(/^(piece:|cat:)/, "") === bareKey);
      };
      const isUnderRoot = (obj: THREE.Object3D): boolean => {
        let cur: THREE.Object3D | null = obj;
        while (cur) {
          if (cur === root) return true;
          cur = cur.parent;
        }
        return false;
      };
      let source: THREE.Mesh | null = null;
      const picked = selectedPieceObjectRef.current as THREE.Mesh | null;
      if (picked && (picked as any).isMesh && isUnderRoot(picked) && matchesSelectedKey(picked)) {
        source = picked;
      }
      root.traverse((obj) => {
        if (source) return;
        const m = obj as THREE.Mesh;
        if (!(m as any).isMesh) return;
        if (matchesSelectedKey(m)) {
          source = m;
        }
      });
      if (!source) {
        toast.error("Couldn't find that piece in the scene");
        return;
      }
      const src = source as THREE.Mesh;
      const clone = src.clone(true) as THREE.Mesh;
      // Give the clone a UNIQUE pieceKey so it can be clicked/selected and
      // adjusted independently of the original (PieceAdjuster keys lookups by
      // the material's pieceKey). Clone every material so userData doesn't leak
      // back into the source mesh.
      const dupIndex = duplicatesRef.current.length + 1;
      const dupKey = `${key}__dup${dupIndex}`;
      const selectableDupKey = dupKey.startsWith("piece:") || dupKey.startsWith("cat:") ? dupKey : `piece:${dupKey}`;
      const makeDuplicateMaterial = (mat: THREE.Material) => {
        const newMat = mat.clone();
        const originalLabel = (mat.userData as any)?.grainLabel ?? pieceAdjustLabel ?? bareKey;
        newMat.userData = {
          ...(mat.userData ?? {}),
          pieceKey: selectableDupKey,
          duplicateOf: key,
          grainKey: selectableDupKey,
          grainLabel: `${originalLabel} copy ${dupIndex}`,
        };
        return newMat;
      };
      clone.material = Array.isArray(src.material)
        ? src.material.map(makeDuplicateMaterial)
        : makeDuplicateMaterial(src.material);
      clone.userData = { pieceKey: selectableDupKey, duplicateOf: key };
      clone.traverse((obj) => {
        const ud = obj.userData as Record<string, unknown>;
        delete ud.__paOrigPos;
        delete ud.__paOrigScale;
        delete ud.__paOrigQuat;
        delete ud.__paBbox;
        delete ud.__paLastWritten;
        delete ud.__paHiddenByUs;
        obj.visible = true;
        obj.matrixAutoUpdate = true;
        obj.matrixWorldNeedsUpdate = true;
      });
      // Offset 2" per duplicate in world +Z, converted into the parent's local
      // space. NOTE: Vector3.transformDirection() normalizes the result and
      // would drop the 2-inch magnitude — use a rotation-only matrix and
      // applyMatrix4 to preserve length.
      const parent = src.parent ?? root;
      parent.updateWorldMatrix(true, false);
      const offsetInches = 2 * (duplicatesRef.current.length + 1);
      const worldOffset = new THREE.Vector3(0, 0, offsetInches * 0.0254);
      const parentQuat = new THREE.Quaternion();
      const parentScale = new THREE.Vector3();
      parent.matrixWorld.decompose(new THREE.Vector3(), parentQuat, parentScale);
      const localOffset = worldOffset.clone().applyQuaternion(parentQuat.invert());
      // Undo parent scale so the offset reads as world-space inches.
      localOffset.x /= Math.abs(parentScale.x) > 1e-6 ? parentScale.x : 1;
      localOffset.y /= Math.abs(parentScale.y) > 1e-6 ? parentScale.y : 1;
      localOffset.z /= Math.abs(parentScale.z) > 1e-6 ? parentScale.z : 1;
      clone.position.copy(src.position).add(localOffset);

      parent.add(clone);
      clone.updateMatrixWorld(true);
      duplicatesRef.current.push(clone);
      setPieceAdjustKey(selectableDupKey);
      setPieceAdjustLabel(`${pieceAdjustLabel || bareKey} copy ${dupIndex}`);
      toast.success(`Duplicated ${pieceAdjustLabel || bareKey}`);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, pieceAdjustKey, pieceAdjustLabel]);

  const handleExportPieces = async () => {
    const root = pavilionRootRef.current;
    if (!root) {
      toast.error("Pavilion isn't ready yet");
      return;
    }
    try {
      setExporting(true);
      const count = await exportPiecesAsStlZip(root, "pavilion-pieces.zip");
      toast.success(`Exported ${count} pieces as STL`);
    } catch (err) {
      console.error(err);
      toast.error("STL export failed");
    } finally {
      setExporting(false);
    }
  };

  const handleExportTruss = async () => {
    const root = pavilionRootRef.current;
    if (!root) {
      toast.error("Pavilion isn't ready yet");
      return;
    }
    try {
      setExporting(true);
      const widthFt = Math.round(config.width);
      const count = await exportFirstHammerTrussAsStl(
        root,
        `hammer-truss-${widthFt}ft.stl`,
      );
      toast.success(`Exported truss as 1 STL (${count} pieces merged)`);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Truss STL export failed");
    } finally {
      setExporting(false);
    }
  };

  const handleExportTrussGlb = async () => {
    const root = pavilionRootRef.current;
    if (!root) {
      toast.error("Pavilion isn't ready yet");
      return;
    }
    try {
      setExporting(true);
      const widthFt = Math.round(config.width);
      const count = await exportFirstHammerTrussAsGlb(
        root,
        `hammer-truss-${widthFt}ft.glb`,
      );
      toast.success(`Exported truss as 1 GLB (${count} pieces merged)`);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Truss GLB export failed");
    } finally {
      setExporting(false);
    }
  };

  const handleExportArchTrussGlb = async () => {
    const root = pavilionRootRef.current;
    if (!root) {
      toast.error("Pavilion isn't ready yet");
      return;
    }
    try {
      setExporting(true);
      const widthFt = Math.round(config.width);
      const count = await exportFirstArchTrussAsGlb(
        root,
        `arch-truss-${widthFt}ft.glb`,
      );
      toast.success(`Exported arch truss as 1 GLB (${count} pieces merged)`);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Arch truss GLB export failed");
    } finally {
      setExporting(false);
    }
  };

  const handleExportKingTrussGlb = async () => {
    const root = pavilionRootRef.current;
    if (!root) {
      toast.error("Pavilion isn't ready yet");
      return;
    }
    try {
      setExporting(true);
      const widthFt = Math.round(config.width);
      const count = await exportFirstKingTrussAsGlb(
        root,
        `king-truss-${widthFt}ft.glb`,
      );
      toast.success(`Exported king truss as 1 GLB (${count} pieces merged)`);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "King truss GLB export failed");
    } finally {
      setExporting(false);
    }
  };

  const handleExportFullPavilionGlb = async () => {
    const root = pavilionRootRef.current;
    if (!root) {
      toast.error("Pavilion isn't ready yet");
      return;
    }
    try {
      setExporting(true);
      const widthFt = Math.round(config.width);
      const lengthFt = Math.round(config.length);
      const truss = (config.truss || "truss").toLowerCase();
      const count = await exportFullPavilionAsGlb(
        root,
        `pavilion-${widthFt}x${lengthFt}-${truss}.glb`,
      );
      toast.success(`Exported full pavilion as GLB (${count} meshes)`);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Pavilion GLB export failed");
    } finally {
      setExporting(false);
    }
  };


  const handleExportTrussObj = async () => {
    const root = pavilionRootRef.current;
    if (!root) {
      toast.error("Pavilion isn't ready yet");
      return;
    }
    try {
      setExporting(true);
      const widthFt = Math.round(config.width);
      const count = await exportFirstHammerTrussAsObj(
        root,
        `hammer-truss-${widthFt}ft.obj`,
      );
      toast.success(`Exported truss as 1 OBJ (${count} pieces merged)`);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Truss OBJ export failed");
    } finally {
      setExporting(false);
    }
  };

  const handleExportTrussLowPolyStl = async () => {
    const root = pavilionRootRef.current;
    if (!root) {
      toast.error("Pavilion isn't ready yet");
      return;
    }
    try {
      setExporting(true);
      const widthFt = Math.round(config.width);
      const res = await exportFirstTrussAsLowPolyStl(
        root,
        `${config.truss}-truss-${widthFt}ft-lowpoly.stl`,
        0.25,
      );
      toast.success(
        `Exported ${res.groupName} low-poly STL — ${res.trianglesBefore.toLocaleString()} → ${res.trianglesAfter.toLocaleString()} tris (${res.pieces} pieces)`,
      );
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Low-poly STL export failed");
    } finally {
      setExporting(false);
    }
  };






  const set = <K extends keyof PavilionConfig>(k: K, v: PavilionConfig[K]) =>
    setConfig((c) => ({ ...c, [k]: v }));

  // Widths over 20' require decorative truss plates — force them on.
  const trussPlatesRequired = config.width > 20;
  useEffect(() => {
    if (trussPlatesRequired && !config.trussPlates) {
      setConfig((c) => ({ ...c, trussPlates: true }));
    }
  }, [trussPlatesRequired, config.trussPlates]);

  const basePrice = useMemo(() => estimatePrice(config), [config]);
  const price = basePrice;
  const area = config.width * config.length;
  const wood = WOOD_FINISHES.find((w) => w.id === config.woodId)!;
  const roofMat = ROOF_MATERIALS.find((r) => r.id === config.roofId)!;
  const roofLabel = ROOF_STYLES.find((r) => r.id === config.roof)!.name;
  const trussLabel = TRUSS_STYLES.find((t) => t.id === config.truss)?.name ?? "";
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
  

  // Snow rail transform sliders only edit the standing-seam rail.
  // Metal-roof snow rail is frozen at the baked values below.
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


  return (
    <SnowRailAdjustContext.Provider value={snowRailAdjust}>
    <div className={cn("flex w-full bg-canvas font-sans text-ink overflow-hidden", mode === "admin" ? "h-full" : "h-screen")}>
      <Toaster position="bottom-left" />
      {/* Left Sidebar */}
      {leftCollapsed && (
        <div className="md:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2">
          <button
            onClick={() => setLeftCollapsed(false)}
            className="px-6 py-3 rounded-full bg-ink text-white shadow-2xl text-sm font-semibold uppercase tracking-widest"
            aria-label="Open editor"
          >
            {isAdmin ? "Editor" : "Design"}
          </button>
          {!isAdmin && (
            <button
              onClick={async () => {
                setQuoteOpen(true);
                toast.success("Opening quote form…");
              }}
              className="px-6 py-3 rounded-full bg-brand text-brand-foreground shadow-2xl text-sm font-semibold uppercase tracking-widest"
              aria-label="Save quote"
            >
              Quote
            </button>
          )}

        </div>
      )}
      {leftCollapsed ? (
        <aside className="hidden md:flex w-10 shrink-0 border-r border-ui-border bg-white flex-col items-center pt-4 z-10">
          <button
            onClick={() => setLeftCollapsed(false)}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-ui-border/30 text-ink/60"
            aria-label="Expand editor"
            title="Expand editor"
          >
            ›
          </button>
        </aside>
      ) : (
      <aside
        ref={(el) => {
          if (!el) return;
          (window as any).__pavAsideEl = el;
        }}
        style={{ height: `${mobileHeight}px`, transition: mobileDragging ? 'none' : 'height 200ms ease' }}
        className="w-full md:w-96 shrink-0 border-r border-ui-border bg-white flex flex-col z-30 overflow-y-auto fixed md:static bottom-0 left-0 right-0 rounded-t-2xl md:rounded-none shadow-2xl md:shadow-none touch-pan-y md:h-auto md:max-h-none md:!h-auto"
      >
        <button
          onClick={() => setLeftCollapsed(true)}
          onTouchStart={(e) => {
            mobileDragStartRef.current = { y: e.touches[0].clientY, h: mobileHeight };
            setMobileDragging(true);
          }}
          onTouchMove={(e) => {
            if (!mobileDragStartRef.current) return;
            const dy = e.touches[0].clientY - mobileDragStartRef.current.y;
            const maxH = Math.round(window.innerHeight * 0.95);
            const next = Math.max(40, Math.min(maxH, mobileDragStartRef.current.h - dy));
            setMobileHeight(next);
          }}
          onTouchEnd={() => {
            setMobileDragging(false);
            // Close only if dragged nearly all the way down
            if (mobileHeight < 100) {
              setLeftCollapsed(true);
              setMobileHeight(Math.round(window.innerHeight / 3));
            }
            mobileDragStartRef.current = null;
          }}
          className="md:hidden sticky top-0 z-40 w-full h-12 flex flex-col items-center justify-center rounded-t-2xl bg-ink text-white shadow-lg leading-none touch-none"
          aria-label="Drag to resize — swipe down to close"
          title="Drag up to expand, down to shrink or close"
        >
          <span className="block w-10 h-1 rounded-full bg-white/40 mb-1" />
          <span className="text-xl">▾</span>
        </button>




        <div className="hidden md:flex p-6 border-b border-ui-border items-start justify-between gap-2">
          <div>
            <h2 className="font-serif text-xl">
              {isAdmin ? "Editor" : "Design Your Pavilion"}
            </h2>
            <p className="text-[10px] text-ink/50 uppercase tracking-widest mt-1">
              {isAdmin ? "Admin · Heritage Series v1.0" : "\n"}
            </p>
          </div>
          <button
            onClick={() => setLeftCollapsed(true)}
            className="w-11 h-11 md:w-7 md:h-7 flex items-center justify-center rounded-full md:rounded bg-ink/5 md:bg-transparent hover:bg-ui-border/30 text-ink text-xl md:text-base shrink-0"
            aria-label="Collapse editor"
            title="Collapse"
          >

            ‹
          </button>
        </div>



        {showCustomer && (
          <div className="md:hidden sticky top-12 z-30 bg-white border-b border-ui-border">
            <div className="flex gap-2 overflow-x-auto px-3 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {MOBILE_CATS.map((c) => {
                const active = mobileCat === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setMobileCat(c.id)}
                    className={cn(
                      "shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap transition-colors",
                      active
                        ? "bg-ink text-white border-ink"
                        : "bg-white text-ink/70 border-ui-border hover:text-ink hover:border-ink/40",
                    )}
                  >
                    <span className={cn(
                      "inline-flex items-center justify-center size-4 rounded-full text-[9px] tabular-nums",
                      active ? "bg-white/20 text-white" : "bg-brand/10 text-brand",
                    )}>{c.index}</span>
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="px-6 divide-y divide-ui-border [&>section]:py-8 [&>section:first-child]:pt-6 md:[&>section.hidden]:block">
          <MobileCategoryContext.Provider value={showCustomer ? mobileCat : null}>
          {showCustomer && (<>
          <Section title="Size" index="01" mobileCatId="Size">

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink/50 mb-1.5">
                Footprint (W × L)
              </p>
              <SizeDropdown config={config} setConfig={setConfig} mode={mode} />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink/50 mb-1.5">
                Post Height
              </p>
              <div className="grid grid-cols-3 gap-2">
                {[8, 9, 10].map((h) => {
                  const active = config.height === h;
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => set("height", h)}
                      className={cn(
                        "px-2 py-2 rounded-md text-[10px] font-semibold uppercase tracking-wider transition-colors border leading-tight text-center",
                        active
                          ? "bg-brand text-white border-brand"
                          : "bg-white text-ink/70 border-ui-border hover:text-ink hover:border-ink/40",
                      )}
                    >
                      {h}′
                    </button>
                  );
                })}
              </div>
            </div>
          </Section>





          <Section title="Trusses & Rafters" index="02" mobileCatId="Trusses & Rafters">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink/50 mb-2">
                Truss Style
              </p>
              <div className="grid grid-cols-3 gap-2">
                {TRUSS_STYLES.map((t) => {
                  const active = config.truss === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => set("truss", t.id)}
                      className={cn(
                        "px-2 py-2 rounded-md text-[10px] font-semibold uppercase tracking-wider transition-colors border leading-tight text-center",
                        active
                          ? "bg-brand text-white border-brand"
                          : "bg-white text-ink/70 border-ui-border hover:text-ink hover:border-ink/40",
                      )}
                    >
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink/50 mb-2">
                Upgrades
              </p>
              {(() => {
                const upgrades: Array<{
                  id: string;
                  label: string;
                  desc: string;
                  pressed: boolean;
                  disabled?: boolean;
                  onToggle: () => void;
                }> = [
                  {
                    id: "trussPlates",
                    label: "Decorative Truss Plates",
                    desc: trussPlatesRequired
                      ? "Required on pavilions wider than 20′"
                      : "Powder-coated metal plates with bolts at joints",
                    pressed: !!config.trussPlates || trussPlatesRequired,
                    disabled: trussPlatesRequired,
                    onToggle: () => {
                      if (trussPlatesRequired) return;
                      set("trussPlates", !config.trussPlates);
                    },
                  },
                  {
                    id: "scrollCut",
                    label: "Scroll Cut Tail",
                    desc: "Decorative scroll-cut rafter tail end",
                    pressed: config.rafterTail === "scroll",
                    onToggle: () =>
                      set("rafterTail", config.rafterTail === "scroll" ? "standard" : "scroll"),
                  },
                  {
                    id: "gableFascia",
                    label: "Gable Faceboard",
                    desc: "Gable-end rake fascia board",
                    pressed: !!config.gableFascia,
                    disabled: config.roof !== "gable",
                    onToggle: () => set("gableFascia", !config.gableFascia),
                  },
                ];
                const visibleUpgrades = upgrades;
                return (
                  <div className="space-y-2">
                    {isAdmin && (
                      <label className="w-full flex items-start justify-between gap-3 rounded-md border border-ui-border bg-white px-3 py-2.5 transition-colors hover:border-brand/30 cursor-pointer">
                        <span className="flex-1">
                          <span className="block text-[11px] font-medium text-ink/80">Hide Back Truss &amp; Ridge</span>
                          <span className="block text-[10px] text-ink/50">Remove the rear hammer-beam truss and the ridge pole (for pavilions against a wall)</span>
                        </span>
                        <Switch
                          checked={!!config.hideBackTruss}
                          onCheckedChange={(v) => set("hideBackTruss", v)}
                          className="mt-0.5 shrink-0"
                        />
                      </label>
                    )}
                    {isAdmin && (
                      <label className="w-full flex items-start justify-between gap-3 rounded-md border border-ui-border bg-white px-3 py-2.5 transition-colors hover:border-brand/30 cursor-pointer">
                        <span className="flex-1">
                          <span className="block text-[11px] font-medium text-ink/80">Click-to-Edit Pieces</span>
                          <span className="block text-[10px] text-ink/50">When on, clicking a component opens its adjust panel. Turn off to prevent accidental edits.</span>
                        </span>
                        <Switch
                          checked={pieceEditEnabled}
                          onCheckedChange={(v) => { setPieceEditEnabled(v); if (!v) setPieceAdjustKey(null); }}
                          className="mt-0.5 shrink-0"
                        />
                      </label>
                    )}
                    {visibleUpgrades.map((u) => (

                      <button
                        key={u.id}
                        type="button"
                        aria-pressed={u.pressed}
                        disabled={u.disabled}
                        onClick={u.onToggle}
                        className={cn(
                          "w-full text-left flex items-start justify-between gap-3 rounded-md border px-3 py-2.5 transition-colors",
                          u.pressed
                            ? "border-brand bg-brand/5"
                            : "border-ui-border bg-white hover:border-brand/30",
                          u.disabled && "opacity-50 cursor-not-allowed",
                        )}
                      >
                        <span className="flex-1">
                          <span
                            className={cn(
                              "block text-[11px] font-medium",
                              u.pressed ? "text-brand" : "text-ink/80",
                            )}
                          >
                            {u.label}
                          </span>
                          <span className="block text-[10px] text-ink/50">{u.desc}</span>
                        </span>
                        <span
                          className={cn(
                            "mt-0.5 text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded",
                            u.pressed
                              ? "bg-brand text-brand-foreground"
                              : "bg-slate-100 text-ink/50",
                          )}
                        >
                          {u.pressed ? "Added" : "Add"}
                        </span>
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>
          </Section>








          <Section title="Timber Finish" index="03" mobileCatId="Timber Finish">
            <div className="grid grid-cols-2 gap-2">
              {WOOD_FINISHES.map((w) => {
                const active = config.woodId === w.id;
                const img = FINISH_IMAGES[w.id];
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => set("woodId", w.id)}
                    className={cn(
                      "px-2 py-2 rounded-md text-[10px] font-semibold uppercase tracking-wider transition-colors border leading-tight text-center flex flex-col items-center gap-2",
                      active
                        ? "bg-brand text-white border-brand"
                        : "bg-white text-ink/70 border-ui-border hover:text-ink hover:border-ink/40",
                    )}
                  >
                    {img && (
                      <img
                        src={img}
                        alt={w.name}
                        className="w-full h-14 object-cover rounded-sm border border-black/10"
                      />
                    )}
                    <span>{w.name}</span>
                  </button>
                );
              })}
            </div>
          </Section>

          <Section title="STAIN COLORS" index="04" mobileCatId="STAIN COLORS">
            {(() => {
              const STAIN_OPTIONS = [
                { name: "Old Lathe", hex: "#7a6a55" },
                { name: "Barn Brown", hex: "#5a3a25" },
                { name: "Medium Gray", hex: "#8a8478" },
                { name: "Sunset", hex: "#b87045" },
                { name: "White", hex: "#e8e0d2" },
                { name: "Light Gray", hex: "#b4ada1" },
                { name: "Cedar", hex: "#b07a4a" },
                { name: "Rustic Cedar", hex: "#8a4a2a" },
                { name: "Black", hex: "#15120e" },
                { name: "Cappuccino", hex: "#5e4530" },
                { name: "Early American", hex: "#6b4423" },
                { name: "Clear", hex: "#f5ecd9" },
              ];
              const renderPicker = (
                label: string,
                value: string | null,
                onChange: (hex: string | null) => void,
              ) => (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-ink/50 mb-2">
                    {label}
                  </p>
                  <div className="grid grid-cols-6 gap-x-2 gap-y-3">
                    <button
                      type="button"
                      onClick={() => onChange(null)}
                      className="flex flex-col items-center gap-1 group"
                    >
                      <span
                        className={cn(
                          "size-9 rounded-full border flex items-center justify-center text-[8px] font-semibold uppercase tracking-wider transition-all",
                          value === null
                            ? "border-brand bg-brand/10 text-brand ring-2 ring-offset-2 ring-brand"
                            : "border-ui-border text-ink/60 group-hover:border-ink/40",
                        )}
                      >
                        None
                      </span>
                      <span className="text-[9px] text-ink/70 leading-tight text-center">Unfinished</span>
                    </button>
                    {STAIN_OPTIONS.map((s) => {
                      const active = value?.toLowerCase() === s.hex.toLowerCase();
                      return (
                        <button
                          key={s.name}
                          type="button"
                          onClick={() => onChange(s.hex)}
                          className="flex flex-col items-center gap-1 group"
                        >
                          <span
                            className={cn(
                              "size-9 rounded-full border shadow-sm transition-all",
                              active
                                ? "ring-2 ring-offset-2 ring-brand border-brand"
                                : "border-ui-border group-hover:scale-110",
                            )}
                            style={{ background: s.hex }}
                          />
                          <span className="text-[9px] text-ink/70 leading-tight text-center">{s.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
              return (
                <div className="space-y-5">
                  {renderPicker("Beam Stain", tableStain, setTableStain)}
                  {renderPicker("Roof Deckboard Stain", deckStain, setDeckStain)}
                  {mode === "admin" && (
                    <p className="text-[10px] text-ink/40 italic pt-2 border-t border-ui-border">Stain tuning, raw colors & grass live in Scene Adjustments below.</p>
                  )}
                </div>
              );
            })()}
          </Section>



          <Section title="Roofing" index="05" mobileCatId="Roofing">
            {(() => {
              const renderSwatch = (r: typeof ROOF_MATERIALS[number]) => {
                const active = config.roofId === r.id;
                const isGalvalume = r.id === "metal-galvalume" || r.id === "ss-galvalume";
                return (
                  <button
                    key={r.id}
                    onClick={() => set("roofId", r.id)}
                    title={r.name}
                    className="flex flex-col items-center gap-1 group"
                  >
                    <span
                      className={cn(
                        "size-9 rounded-full cursor-pointer shadow-sm transition-all flex items-center justify-center",
                        active && "ring-2 ring-offset-2 ring-brand",
                      )}
                      style={{ backgroundColor: r.hex }}
                    >
                      {isGalvalume && (
                        <span className="text-[8px] font-semibold text-ink/80 leading-none">
                          Galv
                        </span>
                      )}
                    </span>
                    <span className="text-[9px] text-ink/70 leading-tight text-center">{r.name}</span>
                  </button>
                );
              };
              const activeType = roofMat.type;
              const items = ROOF_MATERIALS.filter((r) => r.type === activeType && !r.textured);
              const texturedItems = ROOF_MATERIALS.filter((r) => r.type === activeType && r.textured);
              const showTextured = activeType === "metal" || activeType === "standing-seam";
              const texturedActiveHere = texturedItems.some((r) => r.id === config.roofId);
              const isOpen = showTextured && (texturedOpen === activeType || texturedActiveHere);
              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-2">
                    {ROOF_MATERIAL_TYPES.map((t) => {
                      const selected = activeType === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            if (activeType === t.id) return;
                            const first = ROOF_MATERIALS.find((r) => r.type === t.id && !r.textured);
                            if (first) set("roofId", first.id);
                          }}
                          className={cn(
                            "px-2 py-2 rounded-md text-[10px] font-semibold uppercase tracking-wider transition-colors border leading-tight text-center",
                            selected
                              ? "bg-brand text-white border-brand"
                              : "bg-white text-ink/70 border-ui-border hover:text-ink hover:border-ink/40",
                          )}
                        >
                          {t.name}
                        </button>
                      );
                    })}
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink/50">
                        {ROOF_MATERIAL_TYPES.find((t) => t.id === activeType)?.name} Colors
                      </p>
                      {showTextured && (
                        <button
                          type="button"
                          onClick={() =>
                            setTexturedOpen((cur) => (cur === activeType ? null : (activeType as "metal" | "standing-seam")))
                          }
                          className="text-[10px] font-semibold uppercase tracking-wider text-ink/40 hover:text-ink/80 transition-colors"
                        >
                          {isOpen ? "− Textured Metal" : "+ Textured Metal"}
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-6 gap-x-2 gap-y-3">{items.map(renderSwatch)}</div>
                    {isOpen && (
                      <div className="mt-3 pl-3 border-l-2 border-ui-border">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-ink/50 mb-2">
                          Textured Metal
                        </p>
                        <div className="grid grid-cols-6 gap-x-2 gap-y-3">{texturedItems.map(renderSwatch)}</div>
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-ink/60">{roofMat.name}</p>
                </div>
              );
            })()}
          </Section>


          <Section title="Add-Ons" index="06" mobileCatId="Add-Ons">
            {(() => {
              const metalLike = roofMat.type === "standing-seam" || roofMat.type === "metal";
              return (
                <>
            <label
              className={cn(
                "flex items-start justify-between gap-3 cursor-pointer",
                !metalLike && "opacity-40 cursor-not-allowed",
              )}
            >
              <span className="min-w-0">
                <span className="block text-[12px] font-medium text-ink">Snow Guards</span>
                <span className="block text-[10px] text-ink/50 mt-0.5">
                  Color matched guards in a staggered pattern.
                  Available on standard metal and standing seam roof.

                </span>
              </span>
              <Switch
                checked={config.snowGuards && metalLike}
                disabled={!metalLike}
                onCheckedChange={(v) => { set("snowGuards", v); if (v) set("snowRail", false); }}
                className="mt-0.5 shrink-0"
              />
            </label>
            <label
              className={cn(
                "flex items-start justify-between gap-3 cursor-pointer mt-4",
                !metalLike && "opacity-40 cursor-not-allowed",
              )}
            >
              <span className="min-w-0">
                <span className="block text-[12px] font-medium text-ink">Snow Rail</span>
                <span className="block text-[10px] text-ink/50 mt-0.5">
                  Continuous snow-retention rail along the eaves.
                  Available on metal and standing-seam roofs.
                </span>
              </span>
              <Switch
                checked={!!config.snowRail && metalLike}
                disabled={!metalLike}
                onCheckedChange={(v) => { set("snowRail", v); if (v) set("snowGuards", false); }}
                className="mt-0.5 shrink-0"
              />
            </label>
                </>
              );
            })()}
            {isAdmin && config.snowRail && roofMat.type === "standing-seam" && (
              <div className="mt-3 space-y-3 rounded-md border border-ink/10 bg-ink/[0.02] p-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-ink/60">Snow Rail Transform</p>
                  <button
                    type="button"
                    onClick={() => { setSnowRailScale({ x: 1, y: 1, z: 1 }); setSnowRailRotationDeg({ x: 0, y: 0, z: 0 }); setSnowRailPositionIn({ x: 0, y: 0, z: 0 }); }}
                    className="text-[10px] text-ink/50 hover:text-ink/80 underline"
                  >
                    Reset
                  </button>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] uppercase tracking-wider text-ink/50">Position (in)</p>
                  <RangeSlider label="X" value={snowRailPositionIn.x} min={-60} max={60} step={0.05} unit="″" lockable={false} defaultLocked={false} onChange={(v) => setSnowRailPositionIn((s) => ({ ...s, x: v }))} />
                  <RangeSlider label="Y" value={snowRailPositionIn.y} min={-60} max={60} step={0.05} unit="″" lockable={false} defaultLocked={false} onChange={(v) => setSnowRailPositionIn((s) => ({ ...s, y: v }))} />
                  <RangeSlider label="Z" value={snowRailPositionIn.z} min={-240} max={240} step={0.05} unit="″" lockable={false} defaultLocked={false} onChange={(v) => setSnowRailPositionIn((s) => ({ ...s, z: v }))} />

                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] uppercase tracking-wider text-ink/50">Scale</p>
                  <RangeSlider label="X" value={snowRailScale.x} min={0.1} max={5} step={0.001} unit="x" lockable={false} defaultLocked={false} onChange={(v) => setSnowRailScale((s) => ({ ...s, x: v }))} />
                  <RangeSlider label="Y" value={snowRailScale.y} min={0.1} max={5} step={0.001} unit="x" lockable={false} defaultLocked={false} onChange={(v) => setSnowRailScale((s) => ({ ...s, y: v }))} />
                  <RangeSlider label="Z" value={snowRailScale.z} min={0.1} max={5} step={0.001} unit="x" lockable={false} defaultLocked={false} onChange={(v) => setSnowRailScale((s) => ({ ...s, z: v }))} />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] uppercase tracking-wider text-ink/50">Rotation</p>
                  <RangeSlider label="X" value={snowRailRotationDeg.x} min={-180} max={180} step={0.1} unit="°" lockable={false} defaultLocked={false} onChange={(v) => setSnowRailRotationDeg((s) => ({ ...s, x: v }))} />
                  <RangeSlider label="Y" value={snowRailRotationDeg.y} min={-180} max={180} step={0.1} unit="°" lockable={false} defaultLocked={false} onChange={(v) => setSnowRailRotationDeg((s) => ({ ...s, y: v }))} />
                  <RangeSlider label="Z" value={snowRailRotationDeg.z} min={-180} max={180} step={0.1} unit="°" lockable={false} defaultLocked={false} onChange={(v) => setSnowRailRotationDeg((s) => ({ ...s, z: v }))} />
                </div>
              </div>
            )}
          </Section>
          </>)}






          {isAdmin && (
            <>
              {showScene && (
              <Section title="Scene Adjustments" index="A1.0">
                <div className="space-y-6">

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink/50">Raw Wood Colors</p>
                      <button
                        type="button"
                        onClick={() => { setRawBeamColor("#d5b489"); setRawDeckColor("#ffffff"); }}
                        className="text-[10px] text-ink/50 hover:text-ink/80 underline"
                      >
                        Reset
                      </button>
                    </div>
                    {[
                      { label: "Beams (unstained)", value: rawBeamColor, set: setRawBeamColor },
                      { label: "Deckboard (unstained)", value: rawDeckColor, set: setRawDeckColor },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center justify-between text-xs gap-2">
                        <label className="text-ink/70">{row.label}</label>
                        <div className="flex items-center gap-2">
                          <span className="font-medium tabular-nums uppercase text-[11px]">{row.value}</span>
                          <input
                            type="color"
                            value={row.value}
                            onChange={(e) => row.set(e.target.value)}
                            className="h-6 w-8 cursor-pointer rounded border border-ui-border bg-white"
                            aria-label={row.label}
                          />
                        </div>
                      </div>
                    ))}
                    <p className="text-[10px] text-ink/40 italic">Tints applied to bare wood when no stain is selected.</p>
                  </div>

                  <div className="space-y-3 pt-3 border-t border-ui-border">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink/50">Stain Tuning</p>
                      <button
                        type="button"
                        onClick={() => { setStainOpacity(0.9); setStainDarkness(0.3); }}
                        className="text-[10px] text-ink/50 hover:text-ink/80 underline"
                      >
                        Reset
                      </button>
                  </div>

                  <div className="space-y-3 pt-3 border-t border-ui-border">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink/50">Clouds</p>
                      <button
                        type="button"
                        onClick={() => { setCloudSpread(1); setCloudConcentration(1); setCloudHeight(0); }}
                        className="text-[10px] text-ink/50 hover:text-ink/80 underline"
                      >
                        Reset
                      </button>
                    </div>
                    <RangeSlider label="Dispersion" min={0.2} max={4} step={0.05} unit="×" value={Number(cloudSpread.toFixed(2))} onChange={setCloudSpread} lockable={false} defaultLocked={false} />
                    <RangeSlider label="Concentration" min={0.1} max={4} step={0.05} unit="×" value={Number(cloudConcentration.toFixed(2))} onChange={setCloudConcentration} lockable={false} defaultLocked={false} />
                    <RangeSlider label="Height" min={-30} max={60} step={0.5} unit="m" value={Number(cloudHeight.toFixed(1))} onChange={setCloudHeight} lockable={false} defaultLocked={false} />
                  </div>

                    <RangeSlider label="Opacity" min={0} max={1} step={0.01} value={stainOpacity} onChange={setStainOpacity} unit="" lockable={false} defaultLocked={false} />
                    <RangeSlider label="Darkness" min={0} max={1} step={0.01} value={stainDarkness} onChange={setStainDarkness} unit="" lockable={false} defaultLocked={false} />
                    <p className="text-[10px] text-ink/40 italic">Saved as the customer default.</p>
                  </div>

                  {config.truss === "hammer" && (() => {
                    const currentLift = roofOnlyLiftByWidth[config.width] ?? 0;
                    return (
                      <div className="space-y-3 pt-3 border-t border-ui-border">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink/50">
                            Roof Height ({config.width}′ wide, Hammer Beam)
                          </p>
                          <button
                            type="button"
                            onClick={() => setRoofOnlyLiftByWidth((m) => ({ ...m, [config.width]: 0 }))}
                            className="text-[10px] text-ink/50 hover:text-ink/80 underline"
                          >
                            Reset
                          </button>
                        </div>
                        <RangeSlider
                          label="Raise / Lower Roof"
                          min={-12}
                          max={12}
                          step={0.0625}
                          unit={'"'}
                          value={Number(currentLift.toFixed(4))}
                          onChange={(v) => setRoofOnlyLiftByWidth((m) => ({ ...m, [config.width]: v }))}
                          lockable={false}
                          defaultLocked={false}
                        />
                        <p className="text-[10px] text-ink/40 italic">
                          Lifts only the roof + decking for the {config.width}′ Hammer Beam pavilion. Trusses, rafters, and framing stay put.
                        </p>
                      </div>
                    );
                  })()}


                  <div className="space-y-3 pt-3 border-t border-ui-border">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink/50">Grass</p>
                      <button
                        type="button"
                        onClick={() => { setGrassDensity(1); setGrassTint("#c8cfb8"); setGrassTexture(1); }}
                        className="text-[10px] text-ink/50 hover:text-ink/80 underline"
                      >
                        Reset
                      </button>
                    </div>
                    <RangeSlider label="Density" min={0.25} max={3} step={0.05} unit="×" value={Number(grassDensity.toFixed(2))} onChange={setGrassDensity} lockable={false} defaultLocked={false} />
                    <RangeSlider label="Texture" min={0} max={2.5} step={0.05} unit="×" value={Number(grassTexture.toFixed(2))} onChange={setGrassTexture} lockable={false} defaultLocked={false} />
                    <div className="flex items-center justify-between text-xs gap-2">
                      <label className="text-ink/70">Tint</label>
                      <div className="flex items-center gap-2">
                        <span className="font-medium tabular-nums uppercase text-[11px]">{grassTint}</span>
                        <input
                          type="color"
                          value={grassTint}
                          onChange={(e) => setGrassTint(e.target.value)}
                          className="h-6 w-8 cursor-pointer rounded border border-ui-border bg-white"
                          aria-label="Grass tint color"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </Section>
              )}
              {/* Coordinates table — always available when hammer truss is shown, even for baked widths. */}
              {showHammer && (
                <Section title={`Hammer Truss Coordinates Table (${is20Wide ? "20′" : `${config.width}′`})`} index="A1.7b">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <PieceAdjustsTable
                      widthLabel={`${config.width}′ wide`}
                      adjusts={pieceAdjusts}
                      pieceOffsetsIn={activePieceOffsetsIn}
                      pieceScales={activePieceScales}
                      plateOffsetsIn={activePlateOffsetsIn}
                      trussScale={hammerScale}
                    />
                    <AllCoordinatesTable />
                    <ScrollCutRafterCoordinatesTable />
                  </div>
                </Section>
              )}
              {/* 12′, 14′, 16′, and 20′ hammer truss piece positions are baked-in — sliders removed. */}
              {showHammer && !isBakedHammerWidth && (
                <Section title={`Hammer Truss Piece Positions & Scale (${is20Wide ? "20′" : `${config.width}′`} only)`} index="A1.8">

                  {is20Wide && (
                    <div className="mb-2 flex items-center justify-between gap-2 rounded border border-ui-border bg-ink/[0.02] p-2">
                      <div className="text-[11px] text-ink/70">
                        {lock20All
                          ? "🔒 All 20′ coordinates are locked."
                          : "Lock every 20′ coordinate (group + per-piece) and publish as defaults."}
                      </div>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={handleCopy20AsCode}
                          className="text-[11px] px-2.5 py-1 rounded border border-ui-border text-ink/70 hover:text-ink"
                          title="Copy current 20′ offsets/scales/adjusts as a TS snippet to paste into hammer20Baked.ts"
                        >
                          Copy 20′ as code
                        </button>
                        {lock20All ? (
                          <button
                            type="button"
                            onClick={() => setLock20All(false)}
                            className="text-[11px] px-2.5 py-1 rounded border border-ui-border text-ink/70 hover:text-ink"
                          >
                            Unlock
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={handleLockAndSave20}
                            disabled={lock20Saving}
                            className="text-[11px] px-2.5 py-1 rounded border border-brand bg-brand text-white hover:opacity-90 disabled:opacity-60"
                          >
                            {lock20Saving ? "Saving…" : "Lock & Save 20′"}
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {(() => {
                    const hiddenEntries = Object.entries(pieceAdjusts).filter(([, a]) => a?.hidden);
                    if (hiddenEntries.length === 0) return null;
                    const restoreOne = (key: string) => {
                      const a = pieceAdjusts[key];
                      if (!a) return;
                      const rest: PieceAdjust = { off: a.off, ext: a.ext };
                      const isZero =
                        rest.off.x === 0 && rest.off.y === 0 && rest.off.z === 0 &&
                        rest.ext.xp === 0 && rest.ext.xn === 0 &&
                        rest.ext.yp === 0 && rest.ext.yn === 0 &&
                        rest.ext.zp === 0 && rest.ext.zn === 0;
                      if (isZero) resetPieceAdjust(key);
                      else updatePieceAdjust(key, rest);
                    };
                    const restoreAll = () => {
                      hiddenEntries.forEach(([k]) => restoreOne(k));
                    };
                    return (
                      <div className="mb-2 rounded border border-amber-300 bg-amber-50/60 p-2">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <div className="text-[11px] font-semibold text-amber-900">
                            Hidden pieces on {config.width}′ ({hiddenEntries.length})
                          </div>
                          <button
                            type="button"
                            onClick={restoreAll}
                            className="text-[11px] px-2 py-0.5 rounded border border-amber-600 bg-white text-amber-900 hover:bg-amber-100"
                          >
                            Restore all
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {hiddenEntries.map(([k]) => (
                            <button
                              key={k}
                              type="button"
                              onClick={() => restoreOne(k)}
                              className="text-[10px] px-1.5 py-0.5 rounded border border-ui-border bg-white font-mono text-ink/70 hover:bg-ink/5"
                              title="Click to restore"
                            >
                              {k.replace(/^(piece:|cat:)/, "")} ↺
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {pieceAdjustEnabled && (
                    <div className="flex items-center justify-between gap-2 rounded border border-ui-border bg-ink/5 px-2 py-1.5">
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold text-ink">Auto-mirror Right → Left</div>
                        <div className="text-[10px] text-ink/60">Adjust the right side; the left twin updates automatically (X flipped).</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAutoMirrorRtoL((v) => !v)}
                        aria-pressed={autoMirrorRtoL}
                        className={`shrink-0 text-[11px] px-2.5 py-1 rounded border ${autoMirrorRtoL ? "bg-brand text-white border-brand" : "border-ui-border text-ink/70 hover:text-ink"}`}
                      >
                        {autoMirrorRtoL ? "On" : "Off"}
                      </button>
                    </div>
                  )}



                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] text-ink/60">
                      {pieceAdjustEnabled
                        ? "Click a piece in the 3D view or expand a row below to adjust."
                        : "Enable to edit per-piece position & scale."}
                    </p>
                    <button
                      type="button"
                      onClick={() => setPieceAdjustEnabled((v) => !v)}
                      aria-pressed={pieceAdjustEnabled}
                      className={`text-[11px] px-2.5 py-1 rounded border ${pieceAdjustEnabled ? "bg-brand text-white border-brand" : "border-ui-border text-ink/70 hover:text-ink"}`}
                    >
                      {pieceAdjustEnabled ? "Enabled" : "Enable"}
                    </button>
                  </div>
                  {pieceAdjustEnabled && (
                    <div className="space-y-4">
                      {HAMMER_PIECES.map((p) => {
                        const off = activePieceOffsetsIn[p.id] ?? { x: 0, y: 0, z: 0 };
                        const sc = activePieceScales[p.id] ?? { x: 1, y: 1, z: 1 };
                        const locked = (is20Wide && lock20All) || (hammer20PieceLocked[p.id] ?? false);
                        const setOff = (axis: "x" | "y" | "z", v: number) =>
                          setActivePieceOffsetsIn((s) => {
                            const next = { ...s, [p.id]: { ...(s[p.id] ?? { x: 0, y: 0, z: 0 }), [axis]: v } };
                            if (autoMirrorRtoL && isRightId(p.id)) {
                              const twin = toLeftTwinId(p.id);
                              if (twin !== p.id) {
                                const tv = axis === "x" ? -v : v;
                                next[twin] = { ...(s[twin] ?? { x: 0, y: 0, z: 0 }), [axis]: tv };
                              }
                            }
                            return next;
                          });
                        const setSc = (axis: "x" | "y" | "z", v: number) =>
                          setActivePieceScales((s) => {
                            const next = { ...s, [p.id]: { ...(s[p.id] ?? { x: 1, y: 1, z: 1 }), [axis]: v } };
                            if (autoMirrorRtoL && isRightId(p.id)) {
                              const twin = toLeftTwinId(p.id);
                              if (twin !== p.id) {
                                next[twin] = { ...(s[twin] ?? { x: 1, y: 1, z: 1 }), [axis]: v };
                              }
                            }
                            return next;
                          });
                        const toggleLock = () =>
                          setHammer20PieceLocked((s) => ({ ...s, [p.id]: !s[p.id] }));
                        return (
                          <details key={p.id} id={`piece-row-${p.id}`} className="border border-ui-border rounded p-2">
                            <summary className="text-xs font-semibold cursor-pointer flex items-center justify-between gap-2">
                              <span>{p.label}</span>
                              <button
                                type="button"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleLock(); }}
                                className={`text-[10px] px-1.5 py-0.5 rounded border ${locked ? "bg-brand/10 border-brand text-brand" : "border-ui-border text-ink/60 hover:text-ink"}`}
                                aria-pressed={locked}
                              >
                                {locked ? "🔒 Locked" : "🔓 Unlocked"}
                              </button>
                            </summary>
                              {(() => {
                                const isTopTie = p.id === "hammer.toptie";
                                const mult = hammer20PieceRangeMult[p.id] ?? 1;
                                const basePos = isTopTie ? 120 : 36;
                                const baseYMin = isTopTie ? -240 : -36;
                                const baseYMax = isTopTie ? 480 : 36;
                                const posMin = -basePos * mult;
                                const posMax = basePos * mult;
                                const yMin = baseYMin * mult;
                                const yMax = baseYMax * mult;
                                const baseScaleMin = isTopTie ? 0.1 : 0.25;
                                const baseScaleMax = isTopTie ? 5 : 2.5;
                                const scaleMin = Math.max(0.01, baseScaleMin / mult);
                                const scaleMax = baseScaleMax * mult;
                                const setMult = (m: number) =>
                                  setHammer20PieceRangeMult((s) => ({ ...s, [p.id]: m }));
                                return (
                              <div className="mt-2 space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-[10px] uppercase tracking-wider text-ink/50">Slider range</div>
                                <div className="flex gap-1">
                                  {[1, 2, 5, 10].map((m) => (
                                    <button
                                      key={m}
                                      type="button"
                                      onClick={() => setMult(m)}
                                      aria-pressed={mult === m}
                                      className={`text-[10px] px-1.5 py-0.5 rounded border ${mult === m ? "bg-brand text-white border-brand" : "border-ui-border text-ink/60 hover:text-ink"}`}
                                    >
                                      {m}×
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div className="text-[10px] uppercase tracking-wider text-ink/50">Position</div>
                              <RangeSlider label="X" value={off.x} min={posMin} max={posMax} step={0.25} unit={'"'} disabled={locked} lockable={false} defaultLocked={false} onChange={(v) => setOff("x", v)} />
                              <RangeSlider label="Y" value={off.y} min={yMin} max={yMax} step={0.25} unit={'"'} disabled={locked} lockable={false} defaultLocked={false} onChange={(v) => setOff("y", v)} />
                              <RangeSlider label="Z" value={off.z} min={posMin} max={posMax} step={0.25} unit={'"'} disabled={locked} lockable={false} defaultLocked={false} onChange={(v) => setOff("z", v)} />
                              <div className="text-[10px] uppercase tracking-wider text-ink/50 pt-1">Scale</div>
                              <RangeSlider label="Scale X" value={sc.x} min={scaleMin} max={scaleMax} step={0.01} unit="×" disabled={locked} lockable={false} defaultLocked={false} onChange={(v) => setSc("x", v)} />
                              <RangeSlider label="Scale Y" value={sc.y} min={scaleMin} max={scaleMax} step={0.01} unit="×" disabled={locked} lockable={false} defaultLocked={false} onChange={(v) => setSc("y", v)} />
                              <RangeSlider label="Scale Z" value={sc.z} min={scaleMin} max={scaleMax} step={0.01} unit="×" disabled={locked} lockable={false} defaultLocked={false} onChange={(v) => setSc("z", v)} />
                              </div>
                                );
                              })()}
                          </details>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => {
                          const offDefaults = is14Wide ? HAMMER14_OFFSETS_DEFAULT : is12Wide ? HAMMER12_OFFSETS_DEFAULT : is20Wide ? HAMMER20_OFFSETS_DEFAULT : HAMMER20_OFFSETS_DEFAULT;
                          const scaleDefaults = is14Wide ? HAMMER14_SCALES_DEFAULT : is12Wide ? HAMMER12_SCALES_DEFAULT : is20Wide ? HAMMER20_SCALES_DEFAULT : HAMMER20_SCALES_DEFAULT;
                          setActivePieceOffsetsIn(offDefaults);
                          setActivePieceScales(scaleDefaults);
                        }}
                        className="text-xs text-brand hover:underline"
                      >
                        Reset all positions & scales
                      </button>
                    </div>
                  )}
                </Section>
              )}
              {showHammer && is20Wide && config.truss === "hammer" && (
                <Section title="Truss Group Scale (20′ only)" index="A1.9">
                  <div className="space-y-2">
                    <RangeSlider label="Group Scale X" value={hammer20Scale.x} min={0.5} max={2} step={0.01} unit="×" disabled={lock20All} lockable={false} defaultLocked={false} onChange={(v) => setHammer20Scale((s) => ({ ...s, x: v }))} />
                    <RangeSlider label="Group Scale Y" value={hammer20Scale.y} min={0.5} max={2} step={0.01} unit="×" disabled={lock20All} lockable={false} defaultLocked={false} onChange={(v) => setHammer20Scale((s) => ({ ...s, y: v }))} />
                    <RangeSlider label="Group Scale Z" value={hammer20Scale.z} min={0.5} max={2} step={0.01} unit="×" disabled={lock20All} lockable={false} defaultLocked={false} onChange={(v) => setHammer20Scale((s) => ({ ...s, z: v }))} />
                    <button
                      type="button"
                      onClick={() => setHammer20Scale(HAMMER20_SCALE_DEFAULT)}
                      className="text-xs text-brand hover:underline"
                    >
                      Reset group scale
                    </button>
                  </div>
                </Section>
              )}
              {showHammer && is20Wide && config.truss === "hammer" && (
                <Section title="Truss Group Position (20′ only)" index="A1.9b">
                  <div className="space-y-2">
                    <RangeSlider label="Move X" value={hammer20GroupOffsetIn.x} min={-48} max={48} step={0.0625} unit={'"'} disabled={lock20All} lockable={false} defaultLocked={false} onChange={(v) => setHammer20GroupOffsetIn((s) => ({ ...s, x: v }))} />
                    <RangeSlider label="Move Y" value={hammer20GroupOffsetIn.y} min={-48} max={48} step={0.0625} unit={'"'} disabled={lock20All} lockable={false} defaultLocked={false} onChange={(v) => setHammer20GroupOffsetIn((s) => ({ ...s, y: v }))} />
                    <RangeSlider label="Move Z" value={hammer20GroupOffsetIn.z} min={-48} max={48} step={0.0625} unit={'"'} disabled={lock20All} lockable={false} defaultLocked={false} onChange={(v) => setHammer20GroupOffsetIn((s) => ({ ...s, z: v }))} />
                    <button
                      type="button"
                      onClick={() => setHammer20GroupOffsetIn(HAMMER20_GROUP_OFFSET_DEFAULT)}
                      className="text-xs text-brand hover:underline"
                    >
                      Reset group position
                    </button>
                  </div>
                </Section>
              )}
              {showHammer && is12Wide && config.truss === "hammer" && (
                <Section title="12′ Hammer Truss — Scale & Position" index="A1.9c">
                  <p className="mb-2 text-[10px] text-ink/50">
                    The 12′ wide hammer truss is built from dimensioned timber profiles.
                    Scale is a multiplier on top of an auto-fit to the
                    pavilion span (so 1.00× starts at the correct width).
                  </p>
                  <div className="space-y-2">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-ink/60">Scale</div>
                    <RangeSlider
                      label="Scale (all axes)"
                      value={Math.min(hammer12GlbScale.x, hammer12GlbScale.y, hammer12GlbScale.z)}
                      min={0.25}
                      max={3}
                      step={0.01}
                      unit="×"
                      lockable={false}
                      defaultLocked={false}
                      onChange={(v) => setHammer12GlbScale({ x: v, y: v, z: v })}
                    />
                    <RangeSlider label="Scale X" value={hammer12GlbScale.x} min={0.25} max={3} step={0.001} unit="×" lockable={false} defaultLocked={false} onChange={(v) => setHammer12GlbScale((s) => ({ ...s, x: v }))} />
                    <RangeSlider label="Scale Y" value={hammer12GlbScale.y} min={0.25} max={3} step={0.001} unit="×" lockable={false} defaultLocked={false} onChange={(v) => setHammer12GlbScale((s) => ({ ...s, y: v }))} />
                    <RangeSlider label="Scale Z" value={hammer12GlbScale.z} min={0.25} max={3} step={0.001} unit="×" lockable={false} defaultLocked={false} onChange={(v) => setHammer12GlbScale((s) => ({ ...s, z: v }))} />
                    <button
                      type="button"
                      onClick={() => setHammer12GlbScale(HAMMER12_GLB_SCALE_DEFAULT)}
                      className="text-xs text-brand hover:underline"
                    >
                      Reset scale
                    </button>
                    <div className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-ink/60">Position</div>
                    <RangeSlider label="Move X" value={hammer12GlbOffsetIn.x} min={-48} max={48} step={0.0625} unit={'"'} lockable={false} defaultLocked={false} onChange={(v) => setHammer12GlbOffsetIn((s) => ({ ...s, x: v }))} />
                    <RangeSlider label="Move Y" value={hammer12GlbOffsetIn.y} min={-48} max={48} step={0.0625} unit={'"'} lockable={false} defaultLocked={false} onChange={(v) => setHammer12GlbOffsetIn((s) => ({ ...s, y: v }))} />
                    <RangeSlider label="Move Z" value={hammer12GlbOffsetIn.z} min={-48} max={48} step={0.0625} unit={'"'} lockable={false} defaultLocked={false} onChange={(v) => setHammer12GlbOffsetIn((s) => ({ ...s, z: v }))} />
                    <button
                      type="button"
                      onClick={() => setHammer12GlbOffsetIn(HAMMER12_GLB_OFFSET_DEFAULT)}
                      className="text-xs text-brand hover:underline"
                    >
                      Reset position
                    </button>
                    <div className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-ink/60">Rotation</div>
                    <RangeSlider label="Rotate X" value={hammer12GlbRotationDeg.x} min={-180} max={180} step={0.05} unit="°" lockable={false} defaultLocked={false} onChange={(v) => setHammer12GlbRotationDeg((s) => ({ ...s, x: v }))} />
                    <RangeSlider label="Rotate Y" value={hammer12GlbRotationDeg.y} min={-180} max={180} step={0.05} unit="°" lockable={false} defaultLocked={false} onChange={(v) => setHammer12GlbRotationDeg((s) => ({ ...s, y: v }))} />
                    <RangeSlider label="Rotate Z" value={hammer12GlbRotationDeg.z} min={-180} max={180} step={0.05} unit="°" lockable={false} defaultLocked={false} onChange={(v) => setHammer12GlbRotationDeg((s) => ({ ...s, z: v }))} />
                    <button
                      type="button"
                      onClick={() => setHammer12GlbRotationDeg(HAMMER12_GLB_ROTATION_DEFAULT)}
                      className="text-xs text-brand hover:underline"
                    >
                      Reset rotation
                    </button>
                  </div>
                </Section>
              )}
              {showHammer && is14Wide && config.truss === "hammer" && (
                <Section title="14′ Hammer Truss — Scale & Position" index="A1.9d">
                  <p className="mb-2 text-[10px] text-ink/50">
                    The 14′ wide hammer truss is built from dimensioned timber profiles.
                    Scale is a multiplier on top of an auto-fit to the
                    pavilion span (so 1.00× starts at the correct width).
                  </p>
                  <div className="space-y-2">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-ink/60">Scale</div>
                    <RangeSlider
                      label="Scale (all axes)"
                      value={Math.min(hammer14GlbScale.x, hammer14GlbScale.y, hammer14GlbScale.z)}
                      min={0.25}
                      max={3}
                      step={0.01}
                      unit="×"
                      lockable={false}
                      defaultLocked={false}
                      onChange={(v) => setHammer14GlbScale({ x: v, y: v, z: v })}
                    />
                    <RangeSlider label="Scale X" value={hammer14GlbScale.x} min={0.25} max={3} step={0.001} unit="×" lockable={false} defaultLocked={false} onChange={(v) => setHammer14GlbScale((s) => ({ ...s, x: v }))} />
                    <RangeSlider label="Scale Y" value={hammer14GlbScale.y} min={0.25} max={3} step={0.001} unit="×" lockable={false} defaultLocked={false} onChange={(v) => setHammer14GlbScale((s) => ({ ...s, y: v }))} />
                    <RangeSlider label="Scale Z" value={hammer14GlbScale.z} min={0.25} max={3} step={0.001} unit="×" lockable={false} defaultLocked={false} onChange={(v) => setHammer14GlbScale((s) => ({ ...s, z: v }))} />
                    <button type="button" onClick={() => setHammer14GlbScale(HAMMER14_GLB_SCALE_DEFAULT)} className="text-xs text-brand hover:underline">Reset scale</button>
                    <div className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-ink/60">Position</div>
                    <RangeSlider label="Move X" value={hammer14GlbOffsetIn.x} min={-48} max={48} step={0.0625} unit={'"'} lockable={false} defaultLocked={false} onChange={(v) => setHammer14GlbOffsetIn((s) => ({ ...s, x: v }))} />
                    <RangeSlider label="Move Y" value={hammer14GlbOffsetIn.y} min={-48} max={48} step={0.0625} unit={'"'} lockable={false} defaultLocked={false} onChange={(v) => setHammer14GlbOffsetIn((s) => ({ ...s, y: v }))} />
                    <RangeSlider label="Move Z" value={hammer14GlbOffsetIn.z} min={-48} max={48} step={0.0625} unit={'"'} lockable={false} defaultLocked={false} onChange={(v) => setHammer14GlbOffsetIn((s) => ({ ...s, z: v }))} />
                    <button type="button" onClick={() => setHammer14GlbOffsetIn(HAMMER14_GLB_OFFSET_DEFAULT)} className="text-xs text-brand hover:underline">Reset position</button>
                    <div className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-ink/60">Rotation</div>
                    <RangeSlider label="Rotate X" value={hammer14GlbRotationDeg.x} min={-180} max={180} step={0.05} unit="°" lockable={false} defaultLocked={false} onChange={(v) => setHammer14GlbRotationDeg((s) => ({ ...s, x: v }))} />
                    <RangeSlider label="Rotate Y" value={hammer14GlbRotationDeg.y} min={-180} max={180} step={0.05} unit="°" lockable={false} defaultLocked={false} onChange={(v) => setHammer14GlbRotationDeg((s) => ({ ...s, y: v }))} />
                    <RangeSlider label="Rotate Z" value={hammer14GlbRotationDeg.z} min={-180} max={180} step={0.05} unit="°" lockable={false} defaultLocked={false} onChange={(v) => setHammer14GlbRotationDeg((s) => ({ ...s, z: v }))} />
                    <button type="button" onClick={() => setHammer14GlbRotationDeg(HAMMER14_GLB_ROTATION_DEFAULT)} className="text-xs text-brand hover:underline">Reset rotation</button>
                  </div>
                </Section>
              )}
              {showHammer && is16Wide && config.truss === "hammer" && (
                <Section title="16′ Hammer Truss — Scale & Position" index="A1.9e">
                  <p className="mb-2 text-[10px] text-ink/50">
                    The 16′ wide hammer truss is built from dimensioned timber profiles.
                    Scale is a multiplier on top of an auto-fit to the
                    pavilion span (so 1.00× starts at the correct width).
                  </p>
                  <div className="space-y-2">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-ink/60">Scale</div>
                    <RangeSlider
                      label="Scale (all axes)"
                      value={Math.min(hammer16GlbScale.x, hammer16GlbScale.y, hammer16GlbScale.z)}
                      min={0.25}
                      max={3}
                      step={0.01}
                      unit="×"
                      lockable={false}
                      defaultLocked={false}
                      onChange={(v) => setHammer16GlbScale({ x: v, y: v, z: v })}
                    />
                    <RangeSlider label="Scale X" value={hammer16GlbScale.x} min={0.25} max={3} step={0.001} unit="×" lockable={false} defaultLocked={false} onChange={(v) => setHammer16GlbScale((s) => ({ ...s, x: v }))} />
                    <RangeSlider label="Scale Y" value={hammer16GlbScale.y} min={0.25} max={3} step={0.001} unit="×" lockable={false} defaultLocked={false} onChange={(v) => setHammer16GlbScale((s) => ({ ...s, y: v }))} />
                    <RangeSlider label="Scale Z" value={hammer16GlbScale.z} min={0.25} max={3} step={0.001} unit="×" lockable={false} defaultLocked={false} onChange={(v) => setHammer16GlbScale((s) => ({ ...s, z: v }))} />
                    <button type="button" onClick={() => setHammer16GlbScale(HAMMER16_GLB_SCALE_DEFAULT)} className="text-xs text-brand hover:underline">Reset scale</button>
                    <div className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-ink/60">Position</div>
                    <RangeSlider label="Move X" value={hammer16GlbOffsetIn.x} min={-48} max={48} step={0.0625} unit={'"'} lockable={false} defaultLocked={false} onChange={(v) => setHammer16GlbOffsetIn((s) => ({ ...s, x: v }))} />
                    <RangeSlider label="Move Y" value={hammer16GlbOffsetIn.y} min={-48} max={48} step={0.0625} unit={'"'} lockable={false} defaultLocked={false} onChange={(v) => setHammer16GlbOffsetIn((s) => ({ ...s, y: v }))} />
                    <RangeSlider label="Move Z" value={hammer16GlbOffsetIn.z} min={-48} max={48} step={0.0625} unit={'"'} lockable={false} defaultLocked={false} onChange={(v) => setHammer16GlbOffsetIn((s) => ({ ...s, z: v }))} />
                    <button type="button" onClick={() => setHammer16GlbOffsetIn(HAMMER16_GLB_OFFSET_DEFAULT)} className="text-xs text-brand hover:underline">Reset position</button>
                    <div className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-ink/60">Rotation</div>
                    <RangeSlider label="Rotate X" value={hammer16GlbRotationDeg.x} min={-180} max={180} step={0.05} unit="°" lockable={false} defaultLocked={false} onChange={(v) => setHammer16GlbRotationDeg((s) => ({ ...s, x: v }))} />
                    <RangeSlider label="Rotate Y" value={hammer16GlbRotationDeg.y} min={-180} max={180} step={0.05} unit="°" lockable={false} defaultLocked={false} onChange={(v) => setHammer16GlbRotationDeg((s) => ({ ...s, y: v }))} />
                    <RangeSlider label="Rotate Z" value={hammer16GlbRotationDeg.z} min={-180} max={180} step={0.05} unit="°" lockable={false} defaultLocked={false} onChange={(v) => setHammer16GlbRotationDeg((s) => ({ ...s, z: v }))} />
                    <button type="button" onClick={() => setHammer16GlbRotationDeg(HAMMER16_GLB_ROTATION_DEFAULT)} className="text-xs text-brand hover:underline">Reset rotation</button>
                  </div>
                </Section>
              )}
              {showHammer && is20Wide && config.truss === "hammer" && (
                <Section title="20′ Hammer Truss — Scale & Position" index="A1.9f">
                  <p className="mb-2 text-[10px] text-ink/50">
                    The 20′ wide hammer truss is built from dimensioned timber profiles.
                    Scale is a multiplier on top of an auto-fit to the
                    pavilion span (so 1.00× starts at the correct width).
                  </p>
                  <div className="space-y-2">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-ink/60">Scale</div>
                    <RangeSlider
                      label="Scale (all axes)"
                      value={Math.min(hammer20GlbScale.x, hammer20GlbScale.y, hammer20GlbScale.z)}
                      min={0.25} max={3} step={0.001} unit="×"
                      lockable={false} defaultLocked={false}
                      onChange={(v) => setHammer20GlbScale({ x: v, y: v, z: v })}
                    />
                    <RangeSlider label="Scale X" value={hammer20GlbScale.x} min={0.25} max={3} step={0.001} unit="×" lockable={false} defaultLocked={false} onChange={(v) => setHammer20GlbScale((s) => ({ ...s, x: v }))} />
                    <RangeSlider label="Scale Y" value={hammer20GlbScale.y} min={0.25} max={3} step={0.001} unit="×" lockable={false} defaultLocked={false} onChange={(v) => setHammer20GlbScale((s) => ({ ...s, y: v }))} />
                    <RangeSlider label="Scale Z" value={hammer20GlbScale.z} min={0.25} max={3} step={0.001} unit="×" lockable={false} defaultLocked={false} onChange={(v) => setHammer20GlbScale((s) => ({ ...s, z: v }))} />
                    <button type="button" onClick={() => setHammer20GlbScale(HAMMER20_GLB_SCALE_DEFAULT)} className="text-xs text-brand hover:underline">Reset scale</button>
                    <div className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-ink/60">Position</div>
                    <RangeSlider label="Move X" value={hammer20GlbOffsetIn.x} min={-48} max={48} step={0.0625} unit={'"'} lockable={false} defaultLocked={false} onChange={(v) => setHammer20GlbOffsetIn((s) => ({ ...s, x: v }))} />
                    <RangeSlider label="Move Y" value={hammer20GlbOffsetIn.y} min={-48} max={48} step={0.0625} unit={'"'} lockable={false} defaultLocked={false} onChange={(v) => setHammer20GlbOffsetIn((s) => ({ ...s, y: v }))} />
                    <RangeSlider label="Move Z" value={hammer20GlbOffsetIn.z} min={-48} max={48} step={0.0625} unit={'"'} lockable={false} defaultLocked={false} onChange={(v) => setHammer20GlbOffsetIn((s) => ({ ...s, z: v }))} />
                    <button type="button" onClick={() => setHammer20GlbOffsetIn(HAMMER20_GLB_OFFSET_DEFAULT)} className="text-xs text-brand hover:underline">Reset position</button>
                    <div className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-ink/60">Rotation</div>
                    <RangeSlider label="Rotate X" value={hammer20GlbRotationDeg.x} min={-180} max={180} step={0.05} unit="°" lockable={false} defaultLocked={false} onChange={(v) => setHammer20GlbRotationDeg((s) => ({ ...s, x: v }))} />
                    <RangeSlider label="Rotate Y" value={hammer20GlbRotationDeg.y} min={-180} max={180} step={0.05} unit="°" lockable={false} defaultLocked={false} onChange={(v) => setHammer20GlbRotationDeg((s) => ({ ...s, y: v }))} />
                    <RangeSlider label="Rotate Z" value={hammer20GlbRotationDeg.z} min={-180} max={180} step={0.05} unit="°" lockable={false} defaultLocked={false} onChange={(v) => setHammer20GlbRotationDeg((s) => ({ ...s, z: v }))} />
                    <button type="button" onClick={() => setHammer20GlbRotationDeg(HAMMER20_GLB_ROTATION_DEFAULT)} className="text-xs text-brand hover:underline">Reset rotation</button>
                  </div>
                </Section>
              )}
              {config.truss === "arch" && (
                <Section title="Arch King Truss Pieces" index="A1.09a">
                  <div className="space-y-2">
                    <p className="text-[10px] text-ink/50">Click a piece to open its position/extension/scale sliders.</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {TRUSS_PIECES.filter((p) => p.truss === "arch").map((p) => {
                        const active = pieceAdjustKey === p.id || pieceAdjustKey === `piece:${p.id}`;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => { setPieceAdjustKey(p.id); setPieceAdjustLabel(p.label); }}
                            className={cn(
                              "text-left text-[11px] px-2 py-1.5 rounded border transition-colors",
                              active
                                ? "bg-brand text-brand-foreground border-brand"
                                : "bg-white text-ink/80 border-ui-border hover:text-ink hover:border-ink/40",
                            )}
                          >
                            {p.label.replace(/^Arch · /, "")}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </Section>
              )}
              {showPlates && config.truss === "hammer" && (!isBakedHammerWidth || is12Wide || is14Wide || is20Wide) && (

                <Section title={`Decorative Plate Offsets (${activePlateLabel} only)`} index="A1.10">
                  <div className="space-y-4">
                    <p className="text-[10px] text-ink/50">Adjustments here apply only to the {activePlateLabel}-wide pavilion. Switch widths to tune the others.</p>
                    {PLATE_LABELS.map((p) => {
                      const off = activePlateOffsetsIn[p.id];
                      const locks = plate14Locks[p.id] ?? { x: true, y: true, z: true };
                      // Mirror L/R pairs (X flips sign, Y/Z match) — except on 20′ where each side is independent.
                      const pairId: typeof p.id | null = is20Wide ? null : (
                        p.id === "vL" ? "vR" : p.id === "vR" ? "vL" :
                        p.id === "wL" ? "wR" : p.id === "wR" ? "wL" : null
                      );
                      const setOff = (axis: "x" | "y" | "z", v: number) =>
                        setActivePlateOffsetsIn((s) => {
                          const next = { ...s, [p.id]: { ...s[p.id], [axis]: v } };
                          if (pairId) {
                            const pv = axis === "x" ? -v : v;
                            next[pairId] = { ...s[pairId], [axis]: pv };
                          }
                          return next;
                        });
                      const setLock = (axis: "x" | "y" | "z", v: boolean) =>
                        setPlate14Locks((s) => ({ ...s, [p.id]: { ...(s[p.id] ?? { x: true, y: true, z: true }), [axis]: v } }));
                      return (
                        <details key={p.id} className="border border-ui-border rounded p-2">
                          <summary className="text-xs font-semibold cursor-pointer">{p.label}</summary>
                          <div className="mt-2 space-y-2">
                            <RangeSlider label="X" value={off.x} min={-36} max={36} step={0.25} unit={'"'} locked={locks.x} onLockChange={(l) => setLock("x", l)} onChange={(v) => setOff("x", v)} />
                            <RangeSlider label="Y" value={off.y} min={-36} max={36} step={0.25} unit={'"'} locked={locks.y} onLockChange={(l) => setLock("y", l)} onChange={(v) => setOff("y", v)} />
                            <RangeSlider label="Z" value={off.z} min={-18} max={18} step={0.25} unit={'"'} locked={locks.z} onLockChange={(l) => setLock("z", l)} onChange={(v) => setOff("z", v)} />
                          </div>
                        </details>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setActivePlateOffsetsIn(activePlateOffsetsDefault)}
                      className="text-xs text-brand hover:underline"
                    >
                      Reset all plate offsets ({activePlateLabel})
                    </button>
                  </div>
                </Section>
              )}
              {showPlates && config.truss === "arch" && (
                <Section title="Arch Decorative Plate" index="A1.10a">
                  <div className="space-y-4">
                    <p className="text-[10px] text-ink/50">Metal plate sits on the left side; the right side mirrors automatically. Position is authored in the left frame (inches/degrees).</p>
                    <details className="border border-ui-border rounded p-2" open>
                      <summary className="text-xs font-semibold cursor-pointer">Position (inches)</summary>
                      <div className="mt-2 space-y-2">
                        <RangeSlider label="X" value={archPlateOffsetIn.x} min={-48} max={48} step={0.25} unit={'"'} lockable={false} defaultLocked={false} onChange={(v) => setArchPlateOffsetIn((s) => ({ ...s, x: v }))} />
                        <RangeSlider label="Y" value={archPlateOffsetIn.y} min={-240} max={240} step={0.25} unit={'"'} lockable={false} defaultLocked={false} onChange={(v) => setArchPlateOffsetIn((s) => ({ ...s, y: v }))} />
                        <RangeSlider label="Z" value={archPlateOffsetIn.z} min={-24} max={24} step={0.25} unit={'"'} lockable={false} defaultLocked={false} onChange={(v) => setArchPlateOffsetIn((s) => ({ ...s, z: v }))} />
                      </div>
                    </details>
                    <details className="border border-ui-border rounded p-2">
                      <summary className="text-xs font-semibold cursor-pointer">Rotation (degrees)</summary>
                      <div className="mt-2 space-y-2">
                        <RangeSlider label="X" value={archPlateRotationDeg.x} min={-180} max={180} step={1} unit="°" lockable={false} defaultLocked={false} onChange={(v) => setArchPlateRotationDeg((s) => ({ ...s, x: v }))} />
                        <RangeSlider label="Y" value={archPlateRotationDeg.y} min={-180} max={180} step={1} unit="°" lockable={false} defaultLocked={false} onChange={(v) => setArchPlateRotationDeg((s) => ({ ...s, y: v }))} />
                        <RangeSlider label="Z" value={archPlateRotationDeg.z} min={-180} max={180} step={1} unit="°" lockable={false} defaultLocked={false} onChange={(v) => setArchPlateRotationDeg((s) => ({ ...s, z: v }))} />
                      </div>
                    </details>
                    <details className="border border-ui-border rounded p-2">
                      <summary className="text-xs font-semibold cursor-pointer">Size (per-axis scale)</summary>
                      <div className="mt-2 space-y-2">
                        <RangeSlider label="X" value={archPlateSizeScale.x} min={0.1} max={5} step={0.01} unit="×" lockable={false} defaultLocked={false} onChange={(v) => setArchPlateSizeScale((s) => ({ ...(typeof s === "number" ? { x: s, y: s, z: s } : s), x: v }))} />
                        <RangeSlider label="Y" value={archPlateSizeScale.y} min={0.1} max={5} step={0.01} unit="×" lockable={false} defaultLocked={false} onChange={(v) => setArchPlateSizeScale((s) => ({ ...(typeof s === "number" ? { x: s, y: s, z: s } : s), y: v }))} />
                        <RangeSlider label="Z" value={archPlateSizeScale.z} min={0.1} max={5} step={0.01} unit="×" lockable={false} defaultLocked={false} onChange={(v) => setArchPlateSizeScale((s) => ({ ...(typeof s === "number" ? { x: s, y: s, z: s } : s), z: v }))} />
                      </div>
                    </details>

                    <button
                      type="button"
                      onClick={() => {
                        setArchPlateOffsetIn(pw(ARCH_PLATE_OFFSET_DEFAULT_IN));
                        setArchPlateRotationDeg(pw(ARCH_PLATE_ROTATION_DEFAULT_DEG));
                        setArchPlateSizeScale(pw(ARCH_PLATE_SIZE_SCALE_DEFAULT));
                      }}
                      className="text-xs text-brand hover:underline"
                    >
                      Reset arch plate
                    </button>
                  </div>
                </Section>
              )}
              {showPlates && config.truss === "king" && (
                <Section title="King Plates · Apply 12' to other widths" index="A1.11">
                  <div className="space-y-2">
                    <p className="text-[10px] text-ink/50">Copies all king plate positions, rotations, and scales from the 12' width to the chosen target widths.</p>
                    <div className="flex flex-wrap gap-2">
                      {([
                        { label: "Apply 12' → 14'", targets: ["14"] },
                        { label: "Apply 12' → 16'", targets: ["16"] },
                        { label: "Apply 12' → 14' & 16'", targets: ["14", "16"] },
                      ] as const).map((b) => (
                        <button
                          key={b.label}
                          type="button"
                          onClick={() => {
                            copyKingPeakPlateOffsetIn("12", [...b.targets]);
                            copyKingPeakPlateRotationDeg("12", [...b.targets]);
                            copyKingPeakPlateSizeScale("12", [...b.targets]);
                            copyKingHeelPlateOffsetIn("12", [...b.targets]);
                            copyKingHeelPlateRotationDeg("12", [...b.targets]);
                            copyKingHeelPlateSizeScale("12", [...b.targets]);
                            copyKingWebPlateOffsetIn("12", [...b.targets]);
                            copyKingWebPlateRotationDeg("12", [...b.targets]);
                            copyKingWebPlateSizeScale("12", [...b.targets]);
                            copyKingHeelPlate2OffsetIn("12", [...b.targets]);
                            copyKingHeelPlate2RotationDeg("12", [...b.targets]);
                            copyKingHeelPlate2SizeScale("12", [...b.targets]);
                          }}
                          className="px-2 py-1 text-xs border border-ui-border rounded hover:bg-ui-border/30"
                        >
                          {b.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </Section>
              )}
              {showPlates && config.truss === "king" && ((
                [
                  { title: "King · Peak Plate", index: "A1.11a", off: kingPeakPlateOffsetIn, setOff: setKingPeakPlateOffsetIn, rot: kingPeakPlateRotationDeg, setRot: setKingPeakPlateRotationDeg, scl: kingPeakPlateSizeScale, setScl: setKingPeakPlateSizeScale, defOff: KING_PEAK_PLATE_OFFSET_DEFAULT_IN, defRot: KING_PEAK_PLATE_ROTATION_DEFAULT_DEG, defScl: KING_PEAK_PLATE_SIZE_SCALE_DEFAULT, mirrored: false },
                  { title: "King · Heel Plate (L/R mirrored)", index: "A1.11b", off: kingHeelPlateOffsetIn, setOff: setKingHeelPlateOffsetIn, rot: kingHeelPlateRotationDeg, setRot: setKingHeelPlateRotationDeg, scl: kingHeelPlateSizeScale, setScl: setKingHeelPlateSizeScale, defOff: KING_HEEL_PLATE_OFFSET_DEFAULT_IN, defRot: KING_HEEL_PLATE_ROTATION_DEFAULT_DEG, defScl: KING_HEEL_PLATE_SIZE_SCALE_DEFAULT, mirrored: true },
                  { title: "King · Web Plate (L/R mirrored)", index: "A1.11c", off: kingWebPlateOffsetIn, setOff: setKingWebPlateOffsetIn, rot: kingWebPlateRotationDeg, setRot: setKingWebPlateRotationDeg, scl: kingWebPlateSizeScale, setScl: setKingWebPlateSizeScale, defOff: KING_WEB_PLATE_OFFSET_DEFAULT_IN, defRot: KING_WEB_PLATE_ROTATION_DEFAULT_DEG, defScl: KING_WEB_PLATE_SIZE_SCALE_DEFAULT, mirrored: true },
                  { title: "King · Heel Plate 2 (L/R mirrored)", index: "A1.11d", off: kingHeelPlate2OffsetIn, setOff: setKingHeelPlate2OffsetIn, rot: kingHeelPlate2RotationDeg, setRot: setKingHeelPlate2RotationDeg, scl: kingHeelPlate2SizeScale, setScl: setKingHeelPlate2SizeScale, defOff: KING_HEEL_PLATE2_OFFSET_DEFAULT_IN, defRot: KING_HEEL_PLATE2_ROTATION_DEFAULT_DEG, defScl: KING_HEEL_PLATE2_SIZE_SCALE_DEFAULT, mirrored: true },
                ] as const
              ).map((kp) => (
                <Section key={kp.index} title={kp.title} index={kp.index}>
                  <div className="space-y-4">
                    <p className="text-[10px] text-ink/50">
                      {kp.mirrored
                        ? "Authored on the left; the right side mirrors automatically. Inches / degrees, per-axis scale."
                        : "Single plate at the peak; placed on both faces of the truss. Inches / degrees, per-axis scale."}
                    </p>
                    <details className="border border-ui-border rounded p-2" open>
                      <summary className="text-xs font-semibold cursor-pointer">Position (inches)</summary>
                      <div className="mt-2 space-y-2">
                        <RangeSlider label="X" value={kp.off.x} min={-480} max={480} step={0.25} unit={'"'} lockable={false} defaultLocked={false} onChange={(v) => kp.setOff((s) => ({ ...s, x: v }))} />
                        <RangeSlider label="Y" value={kp.off.y} min={-480} max={480} step={0.25} unit={'"'} lockable={false} defaultLocked={false} onChange={(v) => kp.setOff((s) => ({ ...s, y: v }))} />
                        <RangeSlider label="Z" value={kp.off.z} min={-24} max={24} step={0.25} unit={'"'} lockable={false} defaultLocked={false} onChange={(v) => kp.setOff((s) => ({ ...s, z: v }))} />
                      </div>
                    </details>
                    <details className="border border-ui-border rounded p-2">
                      <summary className="text-xs font-semibold cursor-pointer">Rotation (degrees)</summary>
                      <div className="mt-2 space-y-2">
                        <RangeSlider label="X" value={kp.rot.x} min={-180} max={180} step={1} unit="°" lockable={false} defaultLocked={false} onChange={(v) => kp.setRot((s) => ({ ...s, x: v }))} />
                        <RangeSlider label="Y" value={kp.rot.y} min={-180} max={180} step={1} unit="°" lockable={false} defaultLocked={false} onChange={(v) => kp.setRot((s) => ({ ...s, y: v }))} />
                        <RangeSlider label="Z" value={kp.rot.z} min={-180} max={180} step={1} unit="°" lockable={false} defaultLocked={false} onChange={(v) => kp.setRot((s) => ({ ...s, z: v }))} />
                      </div>
                    </details>
                    <details className="border border-ui-border rounded p-2">
                      <summary className="text-xs font-semibold cursor-pointer">Size (per-axis scale)</summary>
                      <div className="mt-2 space-y-2">
                        <RangeSlider label="X" value={kp.scl.x} min={0.1} max={5} step={0.01} unit="×" lockable={false} defaultLocked={false} onChange={(v) => kp.setScl((s) => ({ ...(typeof s === "number" ? { x: s, y: s, z: s } : s), x: v }))} />
                        <RangeSlider label="Y" value={kp.scl.y} min={0.1} max={5} step={0.01} unit="×" lockable={false} defaultLocked={false} onChange={(v) => kp.setScl((s) => ({ ...(typeof s === "number" ? { x: s, y: s, z: s } : s), y: v }))} />
                        <RangeSlider label="Z" value={kp.scl.z} min={0.1} max={5} step={0.01} unit="×" lockable={false} defaultLocked={false} onChange={(v) => kp.setScl((s) => ({ ...(typeof s === "number" ? { x: s, y: s, z: s } : s), z: v }))} />
                      </div>
                    </details>
                    <button
                      type="button"
                      onClick={() => {
                        kp.setOff(pw(kp.defOff));
                        kp.setRot(pw(kp.defRot));
                        kp.setScl(pw(kp.defScl));
                      }}
                      className="text-xs text-brand hover:underline"
                    >
                      Reset {kp.title.toLowerCase()}
                    </button>
                  </div>
                </Section>
              )))}
              {showPlates && config.truss === "arch" && (
                <Section title="Simple Plate" index="A1.10b">
                  <div className="space-y-4">
                    <p className="text-[10px] text-ink/50">Mirrored automatically across the truss centerline.</p>
                    <details className="border border-ui-border rounded p-2" open>
                      <summary className="text-xs font-semibold cursor-pointer">Position (inches)</summary>
                      <div className="mt-2 space-y-2">
                        <RangeSlider label="X" value={simplePlateOffsetIn.x} min={-48} max={48} step={0.25} unit={'"'} lockable={false} defaultLocked={false} onChange={(v) => setSimplePlateOffsetIn((s) => ({ ...s, x: v }))} />
                        <RangeSlider label="Y" value={simplePlateOffsetIn.y} min={-240} max={240} step={0.25} unit={'"'} lockable={false} defaultLocked={false} onChange={(v) => setSimplePlateOffsetIn((s) => ({ ...s, y: v }))} />
                        <RangeSlider label="Z" value={simplePlateOffsetIn.z} min={-24} max={24} step={0.25} unit={'"'} lockable={false} defaultLocked={false} onChange={(v) => setSimplePlateOffsetIn((s) => ({ ...s, z: v }))} />
                      </div>
                    </details>
                    <details className="border border-ui-border rounded p-2">
                      <summary className="text-xs font-semibold cursor-pointer">Rotation (degrees)</summary>
                      <div className="mt-2 space-y-2">
                        <RangeSlider label="X" value={simplePlateRotationDeg.x} min={-180} max={180} step={1} unit="°" lockable={false} defaultLocked={false} onChange={(v) => setSimplePlateRotationDeg((s) => ({ ...s, x: v }))} />
                        <RangeSlider label="Y" value={simplePlateRotationDeg.y} min={-180} max={180} step={1} unit="°" lockable={false} defaultLocked={false} onChange={(v) => setSimplePlateRotationDeg((s) => ({ ...s, y: v }))} />
                        <RangeSlider label="Z" value={simplePlateRotationDeg.z} min={-180} max={180} step={1} unit="°" lockable={false} defaultLocked={false} onChange={(v) => setSimplePlateRotationDeg((s) => ({ ...s, z: v }))} />
                      </div>
                    </details>
                    <details className="border border-ui-border rounded p-2">
                      <summary className="text-xs font-semibold cursor-pointer">Size (per-axis scale)</summary>
                      <div className="mt-2 space-y-2">
                        <RangeSlider label="X" value={simplePlateSizeScale.x} min={0.1} max={5} step={0.01} unit="×" lockable={false} defaultLocked={false} onChange={(v) => setSimplePlateSizeScale((s) => ({ ...(typeof s === "number" ? { x: s, y: s, z: s } : s), x: v }))} />
                        <RangeSlider label="Y" value={simplePlateSizeScale.y} min={0.1} max={5} step={0.01} unit="×" lockable={false} defaultLocked={false} onChange={(v) => setSimplePlateSizeScale((s) => ({ ...(typeof s === "number" ? { x: s, y: s, z: s } : s), y: v }))} />
                        <RangeSlider label="Z" value={simplePlateSizeScale.z} min={0.1} max={5} step={0.01} unit="×" lockable={false} defaultLocked={false} onChange={(v) => setSimplePlateSizeScale((s) => ({ ...(typeof s === "number" ? { x: s, y: s, z: s } : s), z: v }))} />
                      </div>
                    </details>

                    <button
                      type="button"
                      onClick={() => {
                        setSimplePlateOffsetIn(pw(SIMPLE_PLATE_OFFSET_DEFAULT_IN));
                        setSimplePlateRotationDeg(pw(SIMPLE_PLATE_ROTATION_DEFAULT_DEG));
                        setSimplePlateSizeScale(pw(SIMPLE_PLATE_SIZE_SCALE_DEFAULT));
                      }}
                      className="text-xs text-brand hover:underline"
                    >
                      Reset simple plate
                    </button>
                  </div>
                </Section>
              )}
              {showPlates && config.truss === "arch" && (
                <Section title="Top Plate" index="A1.10c">
                  <div className="space-y-4">
                    <p className="text-[10px] text-ink/50">Mirrored automatically across the truss centerline.</p>
                    <details className="border border-ui-border rounded p-2" open>
                      <summary className="text-xs font-semibold cursor-pointer">Position (inches)</summary>
                      <div className="mt-2 space-y-2">
                        <RangeSlider label="X" value={topPlateOffsetIn.x} min={-240} max={240} step={0.25} unit={'"'} lockable={false} defaultLocked={false} onChange={(v) => setTopPlateOffsetIn((s) => ({ ...s, x: v }))} />
                        <RangeSlider label="Y" value={topPlateOffsetIn.y} min={-240} max={240} step={0.25} unit={'"'} lockable={false} defaultLocked={false} onChange={(v) => setTopPlateOffsetIn((s) => ({ ...s, y: v }))} />
                        <RangeSlider label="Z" value={topPlateOffsetIn.z} min={-24} max={24} step={0.25} unit={'"'} lockable={false} defaultLocked={false} onChange={(v) => setTopPlateOffsetIn((s) => ({ ...s, z: v }))} />
                      </div>
                    </details>
                    <details className="border border-ui-border rounded p-2">
                      <summary className="text-xs font-semibold cursor-pointer">Rotation (degrees)</summary>
                      <div className="mt-2 space-y-2">
                        <RangeSlider label="X" value={topPlateRotationDeg.x} min={-180} max={180} step={1} unit="°" lockable={false} defaultLocked={false} onChange={(v) => setTopPlateRotationDeg((s) => ({ ...s, x: v }))} />
                        <RangeSlider label="Y" value={topPlateRotationDeg.y} min={-180} max={180} step={1} unit="°" lockable={false} defaultLocked={false} onChange={(v) => setTopPlateRotationDeg((s) => ({ ...s, y: v }))} />
                        <RangeSlider label="Z" value={topPlateRotationDeg.z} min={-180} max={180} step={1} unit="°" lockable={false} defaultLocked={false} onChange={(v) => setTopPlateRotationDeg((s) => ({ ...s, z: v }))} />
                      </div>
                    </details>
                    <details className="border border-ui-border rounded p-2">
                      <summary className="text-xs font-semibold cursor-pointer">Size (per-axis scale)</summary>
                      <div className="mt-2 space-y-2">
                        <RangeSlider label="X" value={topPlateSizeScale.x} min={0.1} max={5} step={0.01} unit="×" lockable={false} defaultLocked={false} onChange={(v) => setTopPlateSizeScale((s) => ({ ...(typeof s === "number" ? { x: s, y: s, z: s } : s), x: v }))} />
                        <RangeSlider label="Y" value={topPlateSizeScale.y} min={0.1} max={5} step={0.01} unit="×" lockable={false} defaultLocked={false} onChange={(v) => setTopPlateSizeScale((s) => ({ ...(typeof s === "number" ? { x: s, y: s, z: s } : s), y: v }))} />
                        <RangeSlider label="Z" value={topPlateSizeScale.z} min={0.1} max={5} step={0.01} unit="×" lockable={false} defaultLocked={false} onChange={(v) => setTopPlateSizeScale((s) => ({ ...(typeof s === "number" ? { x: s, y: s, z: s } : s), z: v }))} />
                      </div>
                    </details>
                    <button
                      type="button"
                      onClick={() => {
                        setTopPlateOffsetIn(pw(TOP_PLATE_OFFSET_DEFAULT_IN));
                        setTopPlateRotationDeg(pw(TOP_PLATE_ROTATION_DEFAULT_DEG));
                        setTopPlateSizeScale(pw(TOP_PLATE_SIZE_SCALE_DEFAULT));
                      }}
                      className="text-xs text-brand hover:underline"
                    >
                      Reset top plate
                    </button>
                  </div>
                </Section>
              )}
              {showPlates && config.truss === "arch" && (
                <Section title="Web Plate 2" index="A1.10d">
                  <div className="space-y-4">
                    <p className="text-[10px] text-ink/50">Mirrored automatically across the truss centerline; appears on every truss.</p>
                    <details className="border border-ui-border rounded p-2" open>
                      <summary className="text-xs font-semibold cursor-pointer">Position (inches)</summary>
                      <div className="mt-2 space-y-2">
                        <RangeSlider label="X" value={webPlate2OffsetIn.x} min={-240} max={240} step={0.25} unit={'"'} lockable={false} defaultLocked={false} onChange={(v) => setWebPlate2OffsetIn((s) => ({ ...s, x: v }))} />
                        <RangeSlider label="Y" value={webPlate2OffsetIn.y} min={-240} max={240} step={0.25} unit={'"'} lockable={false} defaultLocked={false} onChange={(v) => setWebPlate2OffsetIn((s) => ({ ...s, y: v }))} />
                        <RangeSlider label="Z" value={webPlate2OffsetIn.z} min={-24} max={24} step={0.25} unit={'"'} lockable={false} defaultLocked={false} onChange={(v) => setWebPlate2OffsetIn((s) => ({ ...s, z: v }))} />
                      </div>
                    </details>
                    <details className="border border-ui-border rounded p-2">
                      <summary className="text-xs font-semibold cursor-pointer">Rotation (degrees)</summary>
                      <div className="mt-2 space-y-2">
                        <RangeSlider label="X" value={webPlate2RotationDeg.x} min={-180} max={180} step={1} unit="°" lockable={false} defaultLocked={false} onChange={(v) => setWebPlate2RotationDeg((s) => ({ ...s, x: v }))} />
                        <RangeSlider label="Y" value={webPlate2RotationDeg.y} min={-180} max={180} step={1} unit="°" lockable={false} defaultLocked={false} onChange={(v) => setWebPlate2RotationDeg((s) => ({ ...s, y: v }))} />
                        <RangeSlider label="Z" value={webPlate2RotationDeg.z} min={-180} max={180} step={1} unit="°" lockable={false} defaultLocked={false} onChange={(v) => setWebPlate2RotationDeg((s) => ({ ...s, z: v }))} />
                      </div>
                    </details>
                    <details className="border border-ui-border rounded p-2">
                      <summary className="text-xs font-semibold cursor-pointer">Size (per-axis scale)</summary>
                      <div className="mt-2 space-y-2">
                        <RangeSlider label="X" value={webPlate2SizeScale.x} min={0.1} max={5} step={0.01} unit="×" lockable={false} defaultLocked={false} onChange={(v) => setWebPlate2SizeScale((s) => ({ ...(typeof s === "number" ? { x: s, y: s, z: s } : s), x: v }))} />
                        <RangeSlider label="Y" value={webPlate2SizeScale.y} min={0.1} max={5} step={0.01} unit="×" lockable={false} defaultLocked={false} onChange={(v) => setWebPlate2SizeScale((s) => ({ ...(typeof s === "number" ? { x: s, y: s, z: s } : s), y: v }))} />
                        <RangeSlider label="Z" value={webPlate2SizeScale.z} min={0.1} max={5} step={0.01} unit="×" lockable={false} defaultLocked={false} onChange={(v) => setWebPlate2SizeScale((s) => ({ ...(typeof s === "number" ? { x: s, y: s, z: s } : s), z: v }))} />
                      </div>
                    </details>
                    <button
                      type="button"
                      onClick={() => {
                        setWebPlate2OffsetIn(pw(WEB_PLATE_2_OFFSET_DEFAULT_IN));
                        setWebPlate2RotationDeg(pw(WEB_PLATE_2_ROTATION_DEFAULT_DEG));
                        setWebPlate2SizeScale(pw(WEB_PLATE_2_SIZE_SCALE_DEFAULT));
                      }}
                      className="text-xs text-brand hover:underline"
                    >
                      Reset web plate 2
                    </button>
                  </div>
                </Section>
              )}
              {showGrain && (
              <Section title="Grain Adjuster" index="A1.11">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink/50">Click-to-Select</p>
                      <button
                        type="button"
                        onClick={() => { setSelectPickMode((v) => !v); if (!selectPickMode) setGrainPickMode(false); }}
                        className={cn(
                          "px-3 py-1 text-[10px] uppercase tracking-widest rounded-full border transition-colors",
                          selectPickMode
                            ? "bg-brand text-brand-foreground border-brand"
                            : "bg-white text-ink/70 border-ui-border hover:text-ink",
                        )}
                      >
                        {selectPickMode ? "Selecting…" : "Enable"}
                      </button>
                    </div>
                    <p className="text-[10px] text-ink/50 leading-snug">
                      Click any wood face in the 3D view to jump to that piece's rotation slider below.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink/50">Grain Pick</p>
                      <button
                        type="button"
                        onClick={() => { setGrainPickMode((v) => !v); if (!grainPickMode) setSelectPickMode(false); }}
                        className={cn(
                          "px-3 py-1 text-[10px] uppercase tracking-widest rounded-full border transition-colors",
                          grainPickMode
                            ? "bg-brand text-brand-foreground border-brand"
                            : "bg-white text-ink/70 border-ui-border hover:text-ink",
                        )}
                      >
                        {grainPickMode ? "Picking…" : "Enable"}
                      </button>
                    </div>
                    <p className="text-[10px] text-ink/50 leading-snug">
                      Click any wood face in the 3D view to rotate its grain 90° per click. Disable to return to orbit-only.
                    </p>
                    {lastGrainPick && (
                      <p className="text-[10px] text-ink/60">Last: <span className="font-mono">{lastGrainPick}</span></p>
                    )}
                  </div>


                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-ink/50 mb-2">
                      By Category (degrees)
                    </p>
                    <div className="space-y-2">
                      {(Object.keys(GRAIN_CATEGORY_DEFAULTS) as GrainCategory[]).map((cat) => (
                        <RangeSlider
                          key={cat}
                          label={cat}
                          value={grainCategoryDeg[cat] ?? 0}
                          min={-180}
                          max={180}
                          step={1}
                          unit="°"
                          lockable={false}
                          defaultLocked={false}
                          onChange={(v) => setGrainCategoryDeg((s) => ({ ...s, [cat]: v }))}
                        />
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setGrainCategoryDeg(GRAIN_CATEGORY_DEFAULTS)}
                      className="text-xs text-brand hover:underline mt-2"
                    >
                      Reset categories
                    </button>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-ink/50 mb-2">
                      Per Piece (degrees)
                    </p>
                    <div className="space-y-1">
                      {Object.keys(GRAIN_PIECE_DEFAULTS_DEG).map((id) => (
                        <details key={id} id={`piece-row-${id}`} className="border border-ui-border rounded p-2 scroll-mt-24 transition-shadow">
                          <summary className="text-xs font-medium cursor-pointer flex items-center justify-between">
                            <span>{id}</span>
                            <span className="text-[10px] text-ink/50 tabular-nums">
                              {Math.round(grainPieceDeg[id] ?? GRAIN_PIECE_DEFAULTS_DEG[id] ?? 0)}°
                            </span>
                          </summary>
                          <div className="mt-2">
                            <RangeSlider
                              label="rotation"
                              value={grainPieceDeg[id] ?? GRAIN_PIECE_DEFAULTS_DEG[id] ?? 0}
                              min={-180}
                              max={180}
                              step={1}
                              unit="°"
                              lockable={false}
                              defaultLocked={false}
                              onChange={(v) => setGrainPieceDeg((s) => ({ ...s, [id]: v }))}
                            />
                          </div>
                        </details>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setGrainPieceDeg(GRAIN_PIECE_DEFAULTS_DEG)}
                      className="text-xs text-brand hover:underline mt-2"
                    >
                      Reset pieces
                    </button>
                  </div>
                </div>
              </Section>
              )}
              {showGrain && (
              <Section title="Hand-Peeled Randomizer" index="A1.12">
                <div className="space-y-3">
                  <p className="text-[10px] text-ink/50 leading-snug">
                    Applies only when the Hand-Peeled finish is selected. Randomly flips and offsets the
                    texture on each timber so no two pieces look identical.
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[10px] text-ink/60">
                      Seed: <span className="font-mono">{handPeeledRandom.seed}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setHandPeeledRandom((s) => ({
                          ...s,
                          seed: Math.random().toString(36).slice(2, 8),
                        }))
                      }
                      className="px-3 py-1 text-[10px] uppercase tracking-widest rounded-full border bg-white text-ink/70 border-ui-border hover:text-ink"
                    >
                      Regenerate
                    </button>
                  </div>
                  <RangeSlider
                    label="flip chance"
                    value={Math.round(handPeeledRandom.flipChance * 100)}
                    min={0}
                    max={100}
                    step={1}
                    unit="%"
                    lockable={false}
                    defaultLocked={false}
                    onChange={(v) => setHandPeeledRandom((s) => ({ ...s, flipChance: v / 100 }))}
                  />
                  <RangeSlider
                    label="offset amount"
                    value={Math.round(handPeeledRandom.offsetAmount * 100)}
                    min={0}
                    max={100}
                    step={1}
                    unit="%"
                    lockable={false}
                    defaultLocked={false}
                    onChange={(v) => setHandPeeledRandom((s) => ({ ...s, offsetAmount: v / 100 }))}
                  />
                  <RangeSlider
                    label="pattern size"
                    value={Math.round((handPeeledRandom.tileScale ?? 1) * 100)}
                    min={25}
                    max={400}
                    step={5}
                    unit="%"
                    lockable={false}
                    defaultLocked={false}
                    onChange={(v) => setHandPeeledRandom((s) => ({ ...s, tileScale: v / 100 }))}
                  />
                  <button
                    type="button"
                    onClick={() => setHandPeeledRandom(DEFAULT_HAND_PEELED_RANDOM)}
                    className="text-xs text-brand hover:underline"
                  >
                    Reset
                  </button>
                </div>
              </Section>
              )}
              {showCustomer && (
              <Section title="Internal Notes" index="A2">

                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Lead source, site access, special requests…"
                  className="w-full h-24 text-xs p-3 border border-ui-border rounded resize-none focus:outline-none focus:border-brand bg-canvas/40"
                />
              </Section>
              )}
            </>
          )}



          </MobileCategoryContext.Provider>
        </div>
      </aside>
      )}


      {/* Main Viewport */}
      <main className="flex-1 relative flex flex-col min-w-0">
        <header className={`${isAdmin ? "h-12" : "hidden"} border-b border-ui-border bg-white/80 backdrop-blur-sm px-3 md:px-8 flex items-center justify-end z-20`}>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            {isAdmin && <RoleSwitcher mode={mode} />}
            {isAdmin && (
            <details className="relative group">
              <summary className="list-none cursor-pointer px-3 py-2 text-xs font-semibold hover:bg-slate-50 rounded transition-colors flex items-center gap-1.5 [&::-webkit-details-marker]:hidden">
                File
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="opacity-60">
                  <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </summary>
              <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-ui-border rounded-md shadow-lg py-1 z-30">
                <button className="w-full text-left px-3 py-2 text-xs font-medium hover:bg-slate-50 transition-colors">
                  {isAdmin ? "Save Design" : "Save"}
                </button>
                <button className="w-full text-left px-3 py-2 text-xs font-medium hover:bg-slate-50 transition-colors">
                  Share
                </button>
                {isAdmin && (
                  <button className="w-full text-left px-3 py-2 text-xs font-medium hover:bg-slate-50 transition-colors">
                    Export JSON
                  </button>
                )}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={handleExportPieces}
                    disabled={exporting}
                    className="w-full text-left px-3 py-2 text-xs font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    {exporting ? "Exporting STL…" : "Export Pieces (STL .zip)"}
                  </button>
                )}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={handleExportTruss}
                    disabled={exporting}
                    className="w-full text-left px-3 py-2 text-xs font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    {exporting ? "Exporting…" : `Export Truss as One STL (${Math.round(config.width)}′, no plates)`}
                  </button>
                )}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={handleExportTrussGlb}
                    disabled={exporting}
                    className="w-full text-left px-3 py-2 text-xs font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    {exporting ? "Exporting…" : `Export Truss as One GLB (${Math.round(config.width)}′, no plates)`}
                  </button>
                )}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={handleExportTrussObj}
                    disabled={exporting}
                    className="w-full text-left px-3 py-2 text-xs font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    {exporting ? "Exporting…" : `Export Truss as One OBJ (${Math.round(config.width)}′, no plates)`}
                  </button>
                )}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={handleExportArchTrussGlb}
                    disabled={exporting}
                    className="w-full text-left px-3 py-2 text-xs font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    {exporting ? "Exporting…" : `Export Arch Truss as One GLB (${Math.round(config.width)}′, no plates)`}
                  </button>
                )}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={handleExportKingTrussGlb}
                    disabled={exporting}
                    className="w-full text-left px-3 py-2 text-xs font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    {exporting ? "Exporting…" : `Export King Truss as One GLB (${Math.round(config.width)}′, no plates)`}
                  </button>
                )}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={handleExportFullPavilionGlb}
                    disabled={exporting}
                    className="w-full text-left px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-50"
                  >
                    {exporting ? "Exporting…" : `Export FULL Pavilion as GLB (${Math.round(config.width)}′×${Math.round(config.length)}′, ${config.truss})`}
                  </button>
                )}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={handleExportTrussLowPolyStl}
                    disabled={exporting}
                    className="w-full text-left px-3 py-2 text-xs font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    {exporting ? "Exporting…" : `Export Truss as Clean Low-Poly STL (${Math.round(config.width)}′)`}
                  </button>
                )}



              </div>
            </details>
            )}
          </div>

        </header>

        <div className="flex-1 relative bg-gradient-to-b from-sky-100 to-emerald-50">
          {mode === "admin" && (
            <button
              type="button"
              onClick={() => { setPieceEditEnabled((v) => { const nv = !v; if (!nv) setPieceAdjustKey(null); return nv; }); }}
              className={cn(
                "absolute top-16 right-3 z-30 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider rounded-full border shadow-sm transition-colors",
                pieceEditEnabled
                  ? "bg-brand text-brand-foreground border-brand"
                  : "bg-white/90 text-ink/70 border-ui-border hover:text-ink",
              )}
              title="When on, clicking a 3D piece opens its adjust panel"
            >
              {pieceEditEnabled ? "Click-Edit: ON" : "Click-Edit: OFF"}
            </button>
          )}
          {mode === "admin" && (
            <button
              type="button"
              onClick={() => setMeasureEnabled((v) => !v)}
              className={cn(
                "absolute top-28 right-3 z-30 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider rounded-full border shadow-sm transition-colors",
                measureEnabled
                  ? "bg-amber-400 text-ink border-amber-500"
                  : "bg-white/90 text-ink/70 border-ui-border hover:text-ink",
              )}
              title="Click to drop point A. Double-click to drop point B. Drag to orbit."
            >
              {measureEnabled ? "Measure: ON — click A, dbl-click B" : "Measure: OFF"}
            </button>
          )}
          {mode === "customer" && <SceneLoadingBar />}
          <Suspense
            fallback={
              mode === "customer" ? null : (
                <div className="absolute inset-0 grid place-items-center text-xs uppercase tracking-[0.2em] text-ink/40">
                  Loading 3D scene…
                </div>
              )
            }
          >
            <Scene padTileScale={padTileScale} measureEnabled={measureEnabled} config={config} view={view} allowUnderside={mode === "admin"} showRoof={showRoof} showTrusses={showTrusses} showFrame={showFrame} showRafters={showRafters} showPad={showPad} showTable={showTable} showSectional={showSectional} showEgg={showEgg} eggOffset={{ x: clampedEggOffset.x * 0.0254, z: clampedEggOffset.z * 0.0254 }} eggRotation={eggRotationDeg * Math.PI / 180} showTv={showTv} tvCorner={tvCorner} tvHeightFt={Math.max(5, Math.min(config.height - 2, tvHeightFt))} showDining={showDining} diningOffset={{ x: clampedDiningOffset.x * 0.0254, z: clampedDiningOffset.z * 0.0254 }} diningRotation={diningRotationDeg * Math.PI / 180} showPatio={showPatio} patioOffset={{ x: clampedPatioOffset.x * 0.0254, z: clampedPatioOffset.z * 0.0254 }} patioRotation={patioRotationDeg * Math.PI / 180} sofaOffset={{ x: clampedSofaOffset.x * 0.0254, z: clampedSofaOffset.z * 0.0254 }} sofaRotation={sofaRotationDeg * Math.PI / 180} tableOffset={{ x: clampedTableOffset.x * 0.0254, z: clampedTableOffset.z * 0.0254 }} tableRotation={tableRotationDeg * Math.PI / 180} tableStain={tableStain} deckStain={deckStain} stainOpacity={stainOpacity} stainDarkness={stainDarkness} grainAdjust={grainAdjust} grainPieces={grainPieces} grainFaces={grainFaces} handPeeledRandom={handPeeledRandom} rakeTrimAdjust={rakeTrimAdjust} metalRakeTrimAdjust={metalRakeTrimAdjust} shingleScale={shingleScale} shingleContrast={shingleContrast} shingleBrightness={shingleBrightness} shingleSaturate={shingleSaturate} shingleBumpScale={shingleBumpScale} shingleRoughness={shingleRoughness} shingleCapRotation={shingleCapRotation} shingleCapScale={shingleCapScale} shingleCapOffset={shingleCapOffset} shingleCapTextureScale={shingleCapTextureScale} hammerYOffset={hammerYOffsetIn * 0.0254} hammerScale={hammerScale} hammerGroupOffset={is20Wide ? { x: HAMMER20_BAKED_GROUP_OFFSET_IN.x * 0.0254, y: HAMMER20_BAKED_GROUP_OFFSET_IN.y * 0.0254, z: HAMMER20_BAKED_GROUP_OFFSET_IN.z * 0.0254 } : { x: 0, y: 0, z: 0 }} hammerCorbelScale={hammerCorbelScale} hammerCorbelOffset={{ x: hammerCorbelOffset.x * 0.0254, y: hammerCorbelOffset.y * 0.0254, z: hammerCorbelOffset.z * 0.0254 }} hammerCorbelRotation={{ x: hammerCorbelRotation.x * Math.PI / 180, y: hammerCorbelRotation.y * Math.PI / 180, z: hammerCorbelRotation.z * Math.PI / 180 }} hammerPieceOffsets={hammerPieceOffsets} hammerPieceScales={hammerPieceScales} hammerUniformProfile55={hammerUniformProfile55} hammer12Glb={hammer12GlbAdjust} hammer14Glb={hammer14GlbAdjust} hammer16Glb={hammer16GlbAdjust} hammer20Glb={hammer20GlbAdjust} plateOffset={{ x: plateOffsetIn.x * 0.0254, y: plateOffsetIn.y * 0.0254, z: plateOffsetIn.z * 0.0254 }} plateRotation={{ x: plateRotationDeg.x * Math.PI / 180, y: plateRotationDeg.y * Math.PI / 180, z: plateRotationDeg.z * Math.PI / 180 }} plateSizeScale={plateSizeScale} webPlateOffset={{ x: webPlateOffsetIn.x * 0.0254, y: webPlateOffsetIn.y * 0.0254, z: webPlateOffsetIn.z * 0.0254 }} webPlateRotation={{ x: webPlateRotationDeg.x * Math.PI / 180, y: webPlateRotationDeg.y * Math.PI / 180, z: webPlateRotationDeg.z * Math.PI / 180 }} webPlateSizeScale={webPlateSizeScale} vPlateSurfaceInset={vPlateSurfaceInsetIn * 0.0254} webPlateSurfaceInset={webPlateSurfaceInsetIn * 0.0254} peakPlateOffset={{ x: peakPlateOffsetIn.x * 0.0254, y: peakPlateOffsetIn.y * 0.0254, z: peakPlateOffsetIn.z * 0.0254 }} peakPlateRotation={{ x: peakPlateRotationDeg.x * Math.PI / 180, y: peakPlateRotationDeg.y * Math.PI / 180, z: peakPlateRotationDeg.z * Math.PI / 180 }} peakPlateSizeScale={peakPlateSizeScale} peakPlateSurfaceInset={peakPlateSurfaceInsetIn * 0.0254} archPlateOffset={{ x: archPlateOffsetIn.x * 0.0254, y: archPlateOffsetIn.y * 0.0254, z: archPlateOffsetIn.z * 0.0254 }} archPlateRotation={{ x: archPlateRotationDeg.x * Math.PI / 180, y: archPlateRotationDeg.y * Math.PI / 180, z: archPlateRotationDeg.z * Math.PI / 180 }} archPlateSizeScale={archPlateSizeScale} simplePlateOffset={{ x: simplePlateOffsetIn.x * 0.0254, y: simplePlateOffsetIn.y * 0.0254, z: simplePlateOffsetIn.z * 0.0254 }} simplePlateRotation={{ x: simplePlateRotationDeg.x * Math.PI / 180, y: simplePlateRotationDeg.y * Math.PI / 180, z: simplePlateRotationDeg.z * Math.PI / 180 }} simplePlateSizeScale={simplePlateSizeScale} topPlateOffset={{ x: topPlateOffsetIn.x * 0.0254, y: topPlateOffsetIn.y * 0.0254, z: topPlateOffsetIn.z * 0.0254 }} topPlateRotation={{ x: topPlateRotationDeg.x * Math.PI / 180, y: topPlateRotationDeg.y * Math.PI / 180, z: topPlateRotationDeg.z * Math.PI / 180 }} topPlateSizeScale={topPlateSizeScale} webPlate2Offset={{ x: webPlate2OffsetIn.x * 0.0254, y: webPlate2OffsetIn.y * 0.0254, z: webPlate2OffsetIn.z * 0.0254 }} webPlate2Rotation={{ x: webPlate2RotationDeg.x * Math.PI / 180, y: webPlate2RotationDeg.y * Math.PI / 180, z: webPlate2RotationDeg.z * Math.PI / 180 }} webPlate2SizeScale={webPlate2SizeScale} kingPeakPlateOffset={{ x: kingPeakPlateOffsetIn.x * 0.0254, y: kingPeakPlateOffsetIn.y * 0.0254, z: kingPeakPlateOffsetIn.z * 0.0254 }} kingPeakPlateRotation={{ x: kingPeakPlateRotationDeg.x * Math.PI / 180, y: kingPeakPlateRotationDeg.y * Math.PI / 180, z: kingPeakPlateRotationDeg.z * Math.PI / 180 }} kingPeakPlateSizeScale={kingPeakPlateSizeScale} kingHeelPlateOffset={{ x: kingHeelPlateOffsetIn.x * 0.0254, y: kingHeelPlateOffsetIn.y * 0.0254, z: kingHeelPlateOffsetIn.z * 0.0254 }} kingHeelPlateRotation={{ x: kingHeelPlateRotationDeg.x * Math.PI / 180, y: kingHeelPlateRotationDeg.y * Math.PI / 180, z: kingHeelPlateRotationDeg.z * Math.PI / 180 }} kingHeelPlateSizeScale={kingHeelPlateSizeScale} kingWebPlateOffset={{ x: kingWebPlateOffsetIn.x * 0.0254, y: kingWebPlateOffsetIn.y * 0.0254, z: kingWebPlateOffsetIn.z * 0.0254 }} kingWebPlateRotation={{ x: kingWebPlateRotationDeg.x * Math.PI / 180, y: kingWebPlateRotationDeg.y * Math.PI / 180, z: kingWebPlateRotationDeg.z * Math.PI / 180 }} kingWebPlateSizeScale={kingWebPlateSizeScale} kingHeelPlate2Offset={{ x: kingHeelPlate2OffsetIn.x * 0.0254, y: kingHeelPlate2OffsetIn.y * 0.0254, z: kingHeelPlate2OffsetIn.z * 0.0254 }} kingHeelPlate2Rotation={{ x: kingHeelPlate2RotationDeg.x * Math.PI / 180, y: kingHeelPlate2RotationDeg.y * Math.PI / 180, z: kingHeelPlate2RotationDeg.z * Math.PI / 180 }} kingHeelPlate2SizeScale={kingHeelPlate2SizeScale} trussPlateExtraOffsets={trussPlateExtraOffsets} onPavilionMount={(g) => (pavilionRootRef.current = g)} grassDensity={grassDensity} grassTint={grassTint} grassTexture={grassTexture} rawBeamColor={rawBeamColor} rawDeckColor={rawDeckColor} roofOnlyLiftIn={config.truss === "hammer" ? (roofOnlyLiftByWidth[config.width] ?? 0) : 0} pieceAdjusts={pieceAdjusts} cloudSpread={cloudSpread} cloudConcentration={cloudConcentration} cloudHeight={cloudHeight} showBackyard={mode === "customer" ? showBackyard : false} onGrainPick={grainPickMode ? handleGrainPick : (selectPickMode || (mode === "admin" && pieceEditEnabled)) ? handleSelectPick : undefined} />
            {mode === "admin" && (config.truss === "arch" || config.truss === "king" || !isBakedHammerWidth || is14Wide || is16Wide || is20Wide) && (config.truss === "arch" || config.truss === "king" || pieceAdjustEnabled) && pieceAdjustKey && (() => {
              // Compute the mirrored-twin key by swapping the left/right token
              // (.l/.r, _l/_r, .left/.right) in the piece id.
              const tryTwin = (k: string) => {
                const candidates = [
                  k.replace(/(^|[._-])l($|[._-])/i, (_, a, b) => `${a}r${b}`),
                  k.replace(/(^|[._-])r($|[._-])/i, (_, a, b) => `${a}l${b}`),
                  k.replace(/(^|[._-])left($|[._-])/i, (_, a, b) => `${a}right${b}`),
                  k.replace(/(^|[._-])right($|[._-])/i, (_, a, b) => `${a}left${b}`),
                ];
                for (const c of candidates) if (c !== k && pieceAdjusts[c]) return c;
                for (const c of candidates) if (c !== k) return c;
                return null;
              };
              const twinKey = tryTwin(pieceAdjustKey);
              // Mirrors the local-X axis so two twins look symmetric in world
              // space (right-side pieces have a flipped local frame).
              const mirrorAdjust = (a: PieceAdjust): PieceAdjust => ({
                off: { x: -a.off.x, y: a.off.y, z: a.off.z },
                ext: {
                  xp: a.ext.xn, xn: a.ext.xp,
                  yp: a.ext.yp, yn: a.ext.yn,
                  zp: a.ext.zp, zn: a.ext.zn,
                },
                scl: a.scl ? { ...a.scl } : { x: 1, y: 1, z: 1 },
                hidden: false,
              });
              // Mirror across the peak (world X = 0): compute the source mesh's
              // current world position, reflect it across X, then back-solve the
              // target's local `off` so it lands at the mirrored world position.
              // This ignores raw coordinate parity between twins — the target
              // ends up symmetric to the source relative to the peak regardless
              // of differing local frames, parent scales, or pivot offsets.
              //
              // `srcWorldOverride` lets the caller pass a "would-be" source world
              // position computed from a pending adjust (used by the live-link
              // path so the twin reflects the slider's new value, not the value
              // the source mesh had on the previous frame).
              const computeMirroredAdjust = (
                sourceKey: string,
                targetKey: string,
                sourceAdjust: PieceAdjust,
                srcWorldOverride?: THREE.Vector3,
              ): PieceAdjust => {
                const newAdjust = mirrorAdjust(sourceAdjust);
                const root = pavilionRootRef.current;
                if (!root) return newAdjust;
                let sMesh: THREE.Mesh | null = null;
                let tMesh: THREE.Mesh | null = null;
                root.traverse((o) => {
                  const m = o as THREE.Mesh;
                  if (!(m as any).isMesh) return;
                  const mat = Array.isArray(m.material) ? m.material[0] : m.material;
                  const pk: string | undefined = (mat as any)?.userData?.pieceKey;
                  if (!pk) return;
                  const bare = pk.replace(/^(piece:|cat:)/, "");
                  if (!sMesh && (pk === sourceKey || bare === sourceKey)) sMesh = m;
                  if (!tMesh && (pk === targetKey || bare === targetKey)) tMesh = m;
                });
                if (!sMesh || !tMesh || !(tMesh as THREE.Mesh).parent) return newAdjust;

                const IN_M = 0.0254;
                const sM = sMesh as THREE.Mesh;
                const tM = tMesh as THREE.Mesh;
                sM.updateWorldMatrix(true, false);
                const tParent = tM.parent!;
                tParent.updateWorldMatrix(true, false);

                const sWorld =
                  srcWorldOverride?.clone() ??
                  new THREE.Vector3().setFromMatrixPosition(sM.matrixWorld);
                const tOrigLocal =
                  ((tM.userData as any).__paOrigPos as THREE.Vector3 | undefined)?.clone() ??
                  tM.position.clone();
                const desiredWorld = new THREE.Vector3(-sWorld.x, sWorld.y, sWorld.z);
                const desiredLocal = desiredWorld
                  .clone()
                  .applyMatrix4(tParent.matrixWorld.clone().invert());

                let bb = (tM.userData as any).__paBbox as THREE.Box3 | undefined;
                if (!bb) {
                  if (!tM.geometry.boundingBox) tM.geometry.computeBoundingBox();
                  bb = tM.geometry.boundingBox!.clone();
                }
                const W = Math.max(1e-6, bb.max.x - bb.min.x);
                const H = Math.max(1e-6, bb.max.y - bb.min.y);
                const D = Math.max(1e-6, bb.max.z - bb.min.z);
                const cx = (bb.min.x + bb.max.x) / 2;
                const cy = (bb.min.y + bb.max.y) / 2;
                const cz = (bb.min.z + bb.max.z) / 2;
                const sclN = newAdjust.scl ?? { x: 1, y: 1, z: 1 };
                const sx = ((W + (newAdjust.ext.xp + newAdjust.ext.xn) * IN_M) / W) * sclN.x;
                const sy = ((H + (newAdjust.ext.yp + newAdjust.ext.yn) * IN_M) / H) * sclN.y;
                const sz = ((D + (newAdjust.ext.zp + newAdjust.ext.zn) * IN_M) / D) * sclN.z;
                const pivotLocal = new THREE.Vector3((1 - sx) * cx, (1 - sy) * cy, (1 - sz) * cz);

                const pScale = new THREE.Vector3();
                tParent.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), pScale);
                const psx = Math.abs(pScale.x) > 1e-6 ? pScale.x : 1;
                const psy = Math.abs(pScale.y) > 1e-6 ? pScale.y : 1;
                const psz = Math.abs(pScale.z) > 1e-6 ? pScale.z : 1;

                const corrected = desiredLocal.sub(tOrigLocal);
                const sumLocal = corrected.applyQuaternion(tM.quaternion.clone().invert());
                const userLocal = sumLocal.sub(pivotLocal);
                newAdjust.off = {
                  x: (userLocal.x * psx - (newAdjust.ext.xp - newAdjust.ext.xn) * IN_M * 0.5) / IN_M,
                  y: (userLocal.y * psy - (newAdjust.ext.yp - newAdjust.ext.yn) * IN_M * 0.5) / IN_M,
                  z: (userLocal.z * psz - (newAdjust.ext.zp - newAdjust.ext.zn) * IN_M * 0.5) / IN_M,
                };
                return newAdjust;
              };

              // Predict where the source mesh WILL be in world space after a
              // pending adjust is applied (before the next frame). Mirrors the
              // math in PieceAdjuster so the linked twin update can use the
              // slider's new value immediately.
              const predictSourceWorld = (
                sourceKey: string,
                nextAdjust: PieceAdjust,
              ): THREE.Vector3 | undefined => {
                const root = pavilionRootRef.current;
                if (!root) return undefined;
                let sMesh: THREE.Mesh | null = null;
                root.traverse((o) => {
                  if (sMesh) return;
                  const m = o as THREE.Mesh;
                  if (!(m as any).isMesh) return;
                  const mat = Array.isArray(m.material) ? m.material[0] : m.material;
                  const pk: string | undefined = (mat as any)?.userData?.pieceKey;
                  if (!pk) return;
                  const bare = pk.replace(/^(piece:|cat:)/, "");
                  if (pk === sourceKey || bare === sourceKey) sMesh = m;
                });
                if (!sMesh) return undefined;
                const sM = sMesh as THREE.Mesh;
                const parent = sM.parent;
                if (!parent) return undefined;
                parent.updateWorldMatrix(true, false);
                const IN_M = 0.0254;
                const origLocal =
                  ((sM.userData as any).__paOrigPos as THREE.Vector3 | undefined)?.clone() ??
                  sM.position.clone();
                let bb = (sM.userData as any).__paBbox as THREE.Box3 | undefined;
                if (!bb) {
                  if (!sM.geometry.boundingBox) sM.geometry.computeBoundingBox();
                  bb = sM.geometry.boundingBox!.clone();
                }
                const W = Math.max(1e-6, bb.max.x - bb.min.x);
                const H = Math.max(1e-6, bb.max.y - bb.min.y);
                const D = Math.max(1e-6, bb.max.z - bb.min.z);
                const cx = (bb.min.x + bb.max.x) / 2;
                const cy = (bb.min.y + bb.max.y) / 2;
                const cz = (bb.min.z + bb.max.z) / 2;
                const sclN = nextAdjust.scl ?? { x: 1, y: 1, z: 1 };
                const sx = ((W + (nextAdjust.ext.xp + nextAdjust.ext.xn) * IN_M) / W) * sclN.x;
                const sy = ((H + (nextAdjust.ext.yp + nextAdjust.ext.yn) * IN_M) / H) * sclN.y;
                const sz = ((D + (nextAdjust.ext.zp + nextAdjust.ext.zn) * IN_M) / D) * sclN.z;
                const pivotLocal = new THREE.Vector3((1 - sx) * cx, (1 - sy) * cy, (1 - sz) * cz);
                const pScale = new THREE.Vector3();
                parent.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), pScale);
                const psx = Math.abs(pScale.x) > 1e-6 ? pScale.x : 1;
                const psy = Math.abs(pScale.y) > 1e-6 ? pScale.y : 1;
                const psz = Math.abs(pScale.z) > 1e-6 ? pScale.z : 1;
                const userLocal = new THREE.Vector3(
                  ((nextAdjust.ext.xp - nextAdjust.ext.xn) * IN_M * 0.5 + nextAdjust.off.x * IN_M) / psx,
                  ((nextAdjust.ext.yp - nextAdjust.ext.yn) * IN_M * 0.5 + nextAdjust.off.y * IN_M) / psy,
                  ((nextAdjust.ext.zp - nextAdjust.ext.zn) * IN_M * 0.5 + nextAdjust.off.z * IN_M) / psz,
                );
                const tParent = pivotLocal.add(userLocal).applyQuaternion(sM.quaternion);
                const localPos = origLocal.add(tParent);
                return localPos.applyMatrix4(parent.matrixWorld);
              };

              const copyToTwin = () => {
                const source = lastEditedPieceKeyRef.current ?? pieceAdjustKey;
                if (!source) return;
                const target = tryTwin(source);
                if (!target || target === source) return;
                const srcAdjust = pieceAdjusts[source] ?? ZERO_PIECE_ADJUST;
                updatePieceAdjust(target, computeMirroredAdjust(source, target, srcAdjust));
              };

              const handlePanelChange = (next: PieceAdjust) => {
                updatePieceAdjust(pieceAdjustKey, next, { fromUserEdit: true });
                if (pieceAdjustLinkTwin && twinKey) {
                  // Predict the source's world position using the new adjust so
                  // the twin tracks the slider in the same frame (otherwise the
                  // twin lags by one update, using the previous frame's pose).
                  const srcWorld = predictSourceWorld(pieceAdjustKey, next);
                  updatePieceAdjust(
                    twinKey,
                    computeMirroredAdjust(pieceAdjustKey, twinKey, next, srcWorld),
                  );
                }
              };
              return (
                <PieceAdjustPanel
                  pieceKey={pieceAdjustKey}
                  label={pieceAdjustLabel}
                  adjust={currentPieceAdjust}
                  onChange={handlePanelChange}
                  onReset={() => {
                    resetPieceAdjust(pieceAdjustKey);
                    if (pieceAdjustLinkTwin && twinKey) resetPieceAdjust(twinKey);
                  }}
                  onClose={() => setPieceAdjustKey(null)}
                  onDelete={() => {
                    const entries: Array<{ key: string; prev: PieceAdjust | undefined }> = [];
                    const cur = pieceAdjusts[pieceAdjustKey];
                    entries.push({ key: pieceAdjustKey, prev: cur });
                    updatePieceAdjust(pieceAdjustKey, { ...(cur ?? ZERO_PIECE_ADJUST), hidden: true });
                    if (pieceAdjustLinkTwin && twinKey) {
                      const curTwin = pieceAdjusts[twinKey];
                      entries.push({ key: twinKey, prev: curTwin });
                      updatePieceAdjust(twinKey, { ...(curTwin ?? ZERO_PIECE_ADJUST), hidden: true });
                    }
                    setDeletedHistory((h) => [...h, { entries }]);
                    setPieceAdjustKey(null);
                  }}
                  onUndoDelete={deletedHistory.length > 0 ? () => {
                    const last = deletedHistory[deletedHistory.length - 1];
                    last.entries.forEach(({ key, prev }) => {
                      if (prev === undefined) resetPieceAdjust(key);
                      else updatePieceAdjust(key, prev);
                    });
                    setDeletedHistory((h) => h.slice(0, -1));
                  } : undefined}
                  onCopyFromTwin={twinKey ? copyToTwin : undefined}
                  twinPieceKey={twinKey}
                  linkTwin={pieceAdjustLinkTwin}
                  onLinkTwinChange={twinKey ? setPieceAdjustLinkTwin : undefined}
                  onScaleAllPieces={(scl) => {
                    Object.keys(pieceAdjusts).forEach((k) => {
                      const cur = pieceAdjusts[k] ?? ZERO_PIECE_ADJUST;
                      updatePieceAdjust(k, { ...cur, scl: { ...scl } });
                    });
                  }}
                  onMoveAllPieces={(delta) => {
                    // Real-world nudge: delta is in inches along WORLD X/Y/Z.
                    // Each piece's `off` is stored in its mesh-LOCAL frame
                    // (see PieceAdjuster), so we convert the world delta into
                    // each mesh's local frame using its current worldQuaternion.
                    // Assumes ~uniform parent scale (true for this scene), so
                    // off (inches) = inverse(meshWorldQuat) * (worldDelta inches).
                    const root = pavilionRootRef.current;
                    const worldDelta = new THREE.Vector3(delta.x, delta.y, delta.z);
                    const localByKey = new Map<string, THREE.Vector3>();
                    if (root) {
                      const targetKeys = new Set(Object.keys(pieceAdjusts));
                      const tmpQ = new THREE.Quaternion();
                      root.updateWorldMatrix(true, true);
                      root.traverse((obj) => {
                        const m = obj as THREE.Mesh;
                        if (!(m as any).isMesh) return;
                        const mat = Array.isArray(m.material) ? m.material[0] : m.material;
                        const pk: string | undefined = (mat as any)?.userData?.pieceKey;
                        if (!pk) return;
                        const bare = pk.replace(/^(piece:|cat:)/, "");
                        for (const cand of [pk, bare]) {
                          if (targetKeys.has(cand) && !localByKey.has(cand)) {
                            m.getWorldQuaternion(tmpQ).invert();
                            const v = worldDelta.clone().applyQuaternion(tmpQ);
                            localByKey.set(cand, v);
                          }
                        }
                      });
                    }
                    Object.keys(pieceAdjusts).forEach((k) => {
                      const cur = pieceAdjusts[k] ?? ZERO_PIECE_ADJUST;
                      const v = localByKey.get(k) ?? worldDelta;
                      updatePieceAdjust(k, {
                        ...cur,
                        off: {
                          x: cur.off.x + v.x,
                          y: cur.off.y + v.y,
                          z: cur.off.z + v.z,
                        },
                      });
                    });
                  }}
                />
              );
            })()}


          </Suspense>















          <div className="absolute bottom-20 right-3 md:bottom-8 md:right-8 hidden md:flex flex-col gap-4">
            <div className="bg-white/90 backdrop-blur-sm rounded-full border border-ui-border/60 p-1.5 md:p-2 flex flex-row gap-1">
              {(["3d", "top", "side"] as ViewPreset[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={cn(
                    "px-5 py-2.5 rounded-full transition-colors text-[10px] font-medium uppercase tracking-[0.15em]",
                    view === v
                      ? "bg-brand text-brand-foreground"
                      : "text-ink/50 hover:text-ink",
                  )}
                >
                  {v === "3d" ? "Home" : v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Mobile floating live price (top center) */}
          <div ref={mobilePriceRef} className="md:hidden absolute top-3 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center">
            <button
              type="button"
              onClick={() => setMobilePriceOpen((v) => !v)}
              className="bg-white/95 backdrop-blur-sm border border-ui-border rounded-full px-4 py-1.5 shadow-md"
            >
              <PricePanel
                config={config}
                embedded
                beamStained={tableStain !== null}
                deckStained={deckStain !== null}
                hideSize
                totalOnly
              />
            </button>
            {mobilePriceOpen && (
              <div className="mt-2 w-[88vw] max-w-sm bg-white border border-ui-border rounded-lg shadow-xl p-3 max-h-[70dvh] overflow-y-auto">
                <PricePanel
                  config={config}
                  embedded
                  beamStained={tableStain !== null}
                  deckStained={deckStain !== null}
                />

                {!isAdmin && (
                  <div className="mt-4 space-y-3">
                    <p className="text-[10px] text-emerald-700 font-medium bg-emerald-50 px-2 py-1 inline-block rounded">
                      Pickup or Delivery in 4–6 weeks
                    </p>
                    <button
                      type="button"
                      onClick={async () => {
                        setQuoteOpen(true);
                        toast.success("Opening quote form…");
                      }}
                      className="w-full px-6 py-3 bg-brand text-brand-foreground text-xs font-semibold uppercase tracking-widest rounded shadow-lg shadow-brand/20 hover:bg-brand/90 transition-all"
                    >
                      Save Quote
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        setQuoteOpen(true);
                        toast.success("Opening quote form…");
                      }}
                      className="w-full px-6 py-3 bg-emerald-700 text-white rounded shadow-lg shadow-emerald-900/10 hover:bg-emerald-800 transition-all flex flex-col items-center gap-0.5"
                    >
                      <span className="text-xs font-semibold uppercase tracking-widest">Order Now</span>
                      <span className="text-[11px] font-medium normal-case tracking-normal">Place $2,500 Down Payment</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {!isAdmin && (
            <div className="absolute top-3 right-3 md:top-4 md:right-8 hidden md:flex flex-col items-end gap-2 max-w-[calc(100vw-1.5rem)]">
              {/* Primary pill: Roof, Rafters, Furniture */}
              <div className="bg-white/95 backdrop-blur-sm border border-ui-border rounded-full px-3 py-2 shadow-sm flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-widest text-ink/60">Roof</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={showRoof}
                    onClick={() => setShowRoof((v) => !v)}
                    className={cn(
                      "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                      showRoof ? "bg-brand" : "bg-slate-300",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                        showRoof ? "translate-x-4" : "translate-x-0.5",
                      )}
                    />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-widest text-ink/60">Furniture</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={furnitureOpen}
                    onClick={() => setFurnitureOpen((v) => !v)}
                    className={cn(
                      "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                      furnitureOpen ? "bg-brand" : "bg-slate-300",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                        furnitureOpen ? "translate-x-4" : "translate-x-0.5",
                      )}
                    />
                  </button>
                </div>
              </div>

              {furnitureOpen && (
              <div className="bg-white/95 backdrop-blur-sm border border-ui-border rounded-2xl md:rounded-full px-3 py-2 shadow-sm flex flex-wrap items-center gap-x-3 gap-y-2 md:gap-4 justify-end">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-widest text-ink/60">Sofa</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={showSectional}
                    onClick={() => setShowSectional((v) => {
                      if (!v && sofaOffset.x === 0 && sofaOffset.z === 0) setSofaOffset({ x: 0, z: -72 });
                      setOpenPlacement(!v ? "sofa" : null);
                      return !v;
                    })}
                    className={cn(
                      "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                      showSectional ? "bg-brand" : "bg-slate-300",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                        showSectional ? "translate-x-4" : "translate-x-0.5",
                      )}
                    />
                  </button>
                  {showSectional && (
                    <button
                      type="button"
                      onClick={() => setOpenPlacement(openPlacement === "sofa" ? null : "sofa")}
                      className={cn(
                        "ml-1 h-5 w-5 rounded-full grid place-items-center text-[11px] leading-none transition-colors",
                        openPlacement === "sofa" ? "bg-ink text-white" : "bg-slate-200 text-ink/70 hover:bg-slate-300",
                      )}
                      aria-label="Sofa placement"
                      title="Adjust placement"
                    >
                      ⋯
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-widest text-ink/60">Egg Grill</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={showEgg}
                    onClick={() => setShowEgg((v) => {
                      if (!v && eggOffset.x === 0 && eggOffset.z === 0) setEggOffset({ x: 84, z: -72 });
                      setOpenPlacement(!v ? "egg" : null);
                      return !v;
                    })}
                    className={cn(
                      "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                      showEgg ? "bg-brand" : "bg-slate-300",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                        showEgg ? "translate-x-4" : "translate-x-0.5",
                      )}
                    />
                  </button>
                  {showEgg && (
                    <button
                      type="button"
                      onClick={() => setOpenPlacement(openPlacement === "egg" ? null : "egg")}
                      className={cn(
                        "ml-1 h-5 w-5 rounded-full grid place-items-center text-[11px] leading-none transition-colors",
                        openPlacement === "egg" ? "bg-ink text-white" : "bg-slate-200 text-ink/70 hover:bg-slate-300",
                      )}
                      aria-label="Egg grill placement"
                      title="Adjust placement"
                    >
                      ⋯
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-widest text-ink/60">Dining Table</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={showDining}
                    onClick={() => setShowDining((v) => {
                      if (!v && diningOffset.x === 0 && diningOffset.z === 0) setDiningOffset({ x: 0, z: 60 });
                      setOpenPlacement(!v ? "dining" : null);
                      return !v;
                    })}
                    className={cn(
                      "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                      showDining ? "bg-brand" : "bg-slate-300",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                        showDining ? "translate-x-4" : "translate-x-0.5",
                      )}
                    />
                  </button>
                  {showDining && (
                    <button
                      type="button"
                      onClick={() => setOpenPlacement(openPlacement === "dining" ? null : "dining")}
                      className={cn(
                        "ml-1 h-5 w-5 rounded-full grid place-items-center text-[11px] leading-none transition-colors",
                        openPlacement === "dining" ? "bg-ink text-white" : "bg-slate-200 text-ink/70 hover:bg-slate-300",
                      )}
                      aria-label="Dining table placement"
                      title="Adjust placement"
                    >
                      ⋯
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-widest text-ink/60">Patio Sofa Set</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={showPatio}
                    onClick={() => setShowPatio((v) => {
                      if (!v && patioOffset.x === 0 && patioOffset.z === 0) setPatioOffset({ x: -84, z: 0 });
                      setOpenPlacement(!v ? "patio" : null);
                      return !v;
                    })}
                    className={cn(
                      "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                      showPatio ? "bg-brand" : "bg-slate-300",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                        showPatio ? "translate-x-4" : "translate-x-0.5",
                      )}
                    />
                  </button>
                  {showPatio && (
                    <button
                      type="button"
                      onClick={() => setOpenPlacement(openPlacement === "patio" ? null : "patio")}
                      className={cn(
                        "ml-1 h-5 w-5 rounded-full grid place-items-center text-[11px] leading-none transition-colors",
                        openPlacement === "patio" ? "bg-ink text-white" : "bg-slate-200 text-ink/70 hover:bg-slate-300",
                      )}
                      aria-label="Patio sofa set placement"
                      title="Adjust placement"
                    >
                      ⋯
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-widest text-ink/60">55″ TV</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={showTv}
                    onClick={() => setShowTv((v) => !v)}
                    className={cn(
                      "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                      showTv ? "bg-brand" : "bg-slate-300",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                        showTv ? "translate-x-4" : "translate-x-0.5",
                      )}
                    />
                  </button>
                  {showTv && (() => {
                    const order: Array<"fl" | "fr" | "br" | "bl"> = ["fl", "fr", "br", "bl"];
                    const labels: Record<"fl" | "fr" | "br" | "bl", string> = {
                      fl: "FL", fr: "FR", br: "BR", bl: "BL",
                    };
                    const next = () =>
                      setTvCorner(order[(order.indexOf(tvCorner) + 1) % order.length]);
                    return (
                      <button
                        type="button"
                        onClick={next}
                        className="ml-1 px-2 h-5 rounded-full text-[10px] uppercase tracking-widest bg-slate-200 text-ink/70 hover:bg-slate-300"
                        aria-label="Cycle TV corner"
                        title="Cycle TV to next corner post"
                      >
                        {labels[tvCorner]}
                      </button>
                    );
                  })()}
                </div>
              </div>
              )}

              {showTv && (
                <div className="mt-2">
                  <RangeSlider
                    label="TV height"
                    value={Math.max(5, Math.min(config.height - 2, tvHeightFt))}
                    min={5}
                    max={Math.max(5, config.height - 2)}
                    step={0.25}
                    unit="′"
                    lockable={false}
                    defaultLocked={false}
                    onChange={(v) => setTvHeightFt(v)}
                  />
                </div>
              )}



              {openPlacement && (() => {
                const placementBounds = openPlacement === "sofa"
                  ? sofaBounds
                  : openPlacement === "table"
                    ? tableBounds
                    : openPlacement === "dining"
                      ? diningBounds
                      : openPlacement === "patio"
                        ? patioBounds
                        : eggBounds;
                return (
                <PlacementPopover
                  label={
                    openPlacement === "sofa"
                      ? "Sofa placement"
                      : openPlacement === "table"
                        ? "Picnic table placement"
                        : openPlacement === "dining"
                          ? "Dining table placement"
                          : openPlacement === "patio"
                            ? "Patio sofa set placement"
                            : "Egg grill placement"
                  }
                  offset={
                    openPlacement === "sofa"
                      ? sofaOffset
                      : openPlacement === "table"
                        ? tableOffset
                        : openPlacement === "dining"
                          ? diningOffset
                          : openPlacement === "patio"
                            ? patioOffset
                            : eggOffset
                  }
                  setOffset={
                    openPlacement === "sofa"
                      ? setSofaOffset
                      : openPlacement === "table"
                        ? setTableOffset
                        : openPlacement === "dining"
                          ? setDiningOffset
                          : openPlacement === "patio"
                            ? setPatioOffset
                            : setEggOffset
                  }
                  rotationDeg={
                    openPlacement === "sofa"
                      ? sofaRotationDeg
                      : openPlacement === "table"
                        ? tableRotationDeg
                        : openPlacement === "dining"
                          ? diningRotationDeg
                          : openPlacement === "patio"
                            ? patioRotationDeg
                            : eggRotationDeg
                  }
                  setRotationDeg={
                    openPlacement === "sofa"
                      ? setSofaRotationDeg
                      : openPlacement === "table"
                        ? setTableRotationDeg
                        : openPlacement === "dining"
                          ? setDiningRotationDeg
                          : openPlacement === "patio"
                            ? setPatioRotationDeg
                            : setEggRotationDeg
                  }
                  maxX={placementBounds.maxX}
                  maxZ={placementBounds.maxZ}
                  onClose={() => setOpenPlacement(null)}
                />
                );
              })()}

            </div>
          )}

          {/* Customer Roof/Rafters/Furniture toggles are rendered inside the unified pill above. */}

          {isAdmin && (
          <div className="absolute top-4 right-8 bg-white/95 backdrop-blur-sm border border-ui-border rounded-full px-3 py-2 shadow-sm flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest text-ink/60">Roof</span>
              <button
                type="button"
                role="switch"
                aria-checked={showRoof}
                onClick={() => setShowRoof((v) => !v)}
                className={cn(
                  "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                  showRoof ? "bg-brand" : "bg-slate-300",
                )}
              >
                <span
                  className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                    showRoof ? "translate-x-4" : "translate-x-0.5",
                  )}
                />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest text-ink/60">Trusses</span>
              <button
                type="button"
                role="switch"
                aria-checked={showTrusses}
                onClick={() => setShowTrusses((v) => !v)}
                className={cn(
                  "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                  showTrusses ? "bg-brand" : "bg-slate-300",
                )}
              >
                <span
                  className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                    showTrusses ? "translate-x-4" : "translate-x-0.5",
                  )}
                />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest text-ink/60">Frame</span>
              <button
                type="button"
                role="switch"
                aria-checked={showFrame}
                onClick={() => setShowFrame((v) => !v)}
                className={cn(
                  "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                  showFrame ? "bg-brand" : "bg-slate-300",
                )}
              >
                <span
                  className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                    showFrame ? "translate-x-4" : "translate-x-0.5",
                  )}
                />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest text-ink/60">Pad</span>
              <button
                type="button"
                role="switch"
                aria-checked={showPad}
                onClick={() => setShowPad((v) => !v)}
                className={cn(
                  "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                  showPad ? "bg-brand" : "bg-slate-300",
                )}
              >
                <span
                  className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                    showPad ? "translate-x-4" : "translate-x-0.5",
                  )}
                />
              </button>
            </div>
            {showPad && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-widest text-ink/60">Pad Pattern Scale</span>
                <input
                  type="range"
                  min={0.25}
                  max={6}
                  step={0.05}
                  value={padTileScale}
                  onChange={(e) => setPadTileScale(parseFloat(e.target.value))}
                  className="w-32"
                />
                <span className="text-[10px] tabular-nums text-ink/70 w-10">{padTileScale.toFixed(2)}×</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest text-ink/60">Sofa</span>
              <button
                type="button"
                role="switch"
                aria-checked={showSectional}
                onClick={() => setShowSectional((v) => !v)}
                className={cn(
                  "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                  showSectional ? "bg-brand" : "bg-slate-300",
                )}
              >
                <span
                  className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                    showSectional ? "translate-x-4" : "translate-x-0.5",
                  )}
                />
              </button>
            </div>
          </div>
          )}

          {/* Grass + stain tuning moved into the admin "Scene Adjustments" section. */}




          <div className="hidden md:block absolute bottom-8 left-8 bg-white/90 backdrop-blur-sm border border-ui-border rounded-full px-4 py-2 text-[10px] uppercase tracking-widest text-ink/60 shadow-sm">
            Drag to orbit · Scroll to zoom
          </div>
          {grainPickMode && (
            <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-brand text-brand-foreground rounded-full px-4 py-1.5 text-[10px] uppercase tracking-widest shadow-md flex items-center gap-3">
              Grain pick · click any face to rotate that face 90°
              <button onClick={() => setGrainPickMode(false)} className="underline opacity-80 hover:opacity-100">Exit</button>
            </div>
          )}
          {selectPickMode && (
            <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-brand text-brand-foreground rounded-full px-4 py-1.5 text-[10px] uppercase tracking-widest shadow-md flex items-center gap-3">
              Select piece · click a wood face to jump to its slider
              <button onClick={() => setSelectPickMode(false)} className="underline opacity-80 hover:opacity-100">Exit</button>
            </div>
          )}
        </div>
      </main>

      {/* Right Summary */}
      {rightCollapsed ? (
        <aside className="hidden md:flex w-10 shrink-0 border-l border-ui-border bg-white flex-col items-center pt-4 z-10">
          <button
            onClick={() => setRightCollapsed(false)}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-ui-border/30 text-ink/60"
            aria-label="Expand quote builder"
            title="Expand"
          >
            ‹
          </button>
        </aside>
      ) : (
      <aside className="hidden md:flex w-64 shrink-0 border-l border-ui-border bg-white flex-col z-10 overflow-y-auto">
        <div className="p-6 border-b border-ui-border flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-ink/50">
            {isAdmin ? "Quote Builder" : "Your Pavilion"}
          </h3>
          <button
            onClick={() => setRightCollapsed(true)}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-ui-border/30 text-ink/60 shrink-0"
            aria-label="Collapse quote builder"
            title="Collapse"
          >
            ›
          </button>
        </div>

        <div className="p-6 flex-1 space-y-6">
          {/* Highlighted Model + Size hero */}
          <div className="rounded-lg border border-ui-border bg-gradient-to-br from-brand/5 to-transparent p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-ink/50">
              Model
            </p>
            <p className="mt-1 text-base font-bold text-ink leading-snug">
              {`${(trussLabel || roofLabel).replace(/ Pavilion Package$/, "")} Pavilion Package`}
            </p>
            <div className="mt-3 pt-3 border-t border-ui-border/60">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-ink/50">
                Size
              </p>
              <p className="mt-1 text-2xl font-bold text-brand tabular-nums leading-none">
                {config.width}′ × {config.length}′
              </p>
              <p className="mt-1 text-[11px] text-ink/60">
                {config.height}′ post height
              </p>
            </div>
          </div>

          {/* Specs */}
          <div className="space-y-3">
            <SummaryRow label="Timber Finish" value={wood.name} />
            {(() => {
              const STAIN_OPTIONS = [
                { name: "Old Lathe", hex: "#7a6a55" },
                { name: "Barn Brown", hex: "#5a3a25" },
                { name: "Medium Gray", hex: "#8a8478" },
                { name: "Sunset", hex: "#b87045" },
                { name: "White", hex: "#e8e0d2" },
                { name: "Light Gray", hex: "#b4ada1" },
                { name: "Cedar", hex: "#b07a4a" },
                { name: "Rustic Cedar", hex: "#8a4a2a" },
                { name: "Black", hex: "#15120e" },
                { name: "Cappuccino", hex: "#5e4530" },
                { name: "Early American", hex: "#6b4423" },
                { name: "Clear", hex: "#f5ecd9" },
              ];
              const labelFor = (hex: string | null) =>
                hex
                  ? (STAIN_OPTIONS.find((s) => s.hex.toLowerCase() === hex.toLowerCase())?.name ?? "Custom")
                  : "Unfinished";
              return (
                <>
                  <SummaryRow label="Beam Stain" value={labelFor(tableStain)} />
                  <SummaryRow label="Deckboard Stain" value={labelFor(deckStain)} />
                </>
              );
            })()}
            <SummaryRow label="Roof Color" value={roofMat.name} />
          </div>

          <div className="pt-6 border-t border-ui-border">
            <PricePanel
              config={config}
              embedded
              beamStained={tableStain !== null}
              deckStained={deckStain !== null}
              hideSize
            />

            <p className="text-[10px] text-emerald-700 mt-3 font-medium bg-emerald-50 px-2 py-1 inline-block rounded">
              Pickup or Delivery in 4–6 weeks
            </p>

            <button
              type="button"
              onClick={async () => {
                if (isAdmin) {
                  setQuoteOpen(true);
                  return;
                }
                setQuoteOpen(true);
                toast.success("Opening quote form…");
              }}
              className="mt-4 w-full px-6 py-3 bg-brand text-brand-foreground text-xs font-semibold uppercase tracking-widest rounded shadow-lg shadow-brand/20 hover:bg-brand/90 transition-all"
            >
              {isAdmin ? "Send Quote" : "SAVE QUOTE"}
            </button>


            {!isAdmin && (
              <button
                type="button"
                onClick={async () => {
                  setQuoteOpen(true);
                  toast.success("Opening quote form…");
                }}
                className="mt-3 w-full px-6 py-3 bg-emerald-700 text-white rounded shadow-lg shadow-emerald-900/10 hover:bg-emerald-800 transition-all flex flex-col items-center gap-0.5"
              >
                <span className="text-xs font-semibold uppercase tracking-widest">Order Now</span>
                <span className="text-[11px] font-medium normal-case tracking-normal">Place $2,500 Down Payment</span>
              </button>
            )}




          </div>


          {isAdmin && (
            <div className="pt-6 border-t border-ui-border space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-ink/50">
                Config JSON
              </p>
              <pre className="text-[10px] bg-canvas p-2 rounded border border-ui-border overflow-auto leading-snug">
{JSON.stringify(config, null, 2)}
              </pre>
            </div>
          )}
        </div>

        <div className="p-6 bg-slate-50 border-t border-ui-border">
          <p className="text-[10px] leading-relaxed text-ink/50">
            {isAdmin
              ? "Internal pricing — verify against current lumber rates before sending."
              : "Prices are estimates based on standard material costs. Local installation and permit fees not included."}
          </p>
        </div>
      </aside>
      )}

      <QuoteDialog
        open={quoteOpen}
        onOpenChange={setQuoteOpen}
        config={config}
        projectName={projectName}
        tableStain={tableStain}
        deckStain={deckStain}
      />
    </div>
    </SnowRailAdjustContext.Provider>
  );
}

function SizeDropdown({
  config,
  setConfig,
  mode,
}: {
  config: PavilionConfig;
  setConfig: React.Dispatch<React.SetStateAction<PavilionConfig>>;
  mode: ConfiguratorMode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data: pricingDoc } = useQuery({ queryKey: ["pricing_data"], queryFn: loadPricing, staleTime: 60_000 });
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const currentKey = sizeKey(config.width, config.length);
  const fmt = (n: number) => `$${n.toLocaleString()}`;
  const roofType = ROOF_MATERIALS.find((r) => r.id === config.roofId)?.type ?? "shingle";
  const roofKey: "metal" | "standing_seam" | "shingles" =
    roofType === "standing-seam" ? "standing_seam" : roofType === "shingle" ? "shingles" : "metal";
  const startingAt = (w: number, l: number): number | null => {
    const row = pricingDoc?.sizes.find((s) => s.id === `${w}x${l}`);
    const base = row?.basePriceByRoof?.[roofKey];
    if (base != null) return base;
    if (isCallForQuote(w, l)) return null;
    return estimatePrice({ ...config, width: w, length: l });
  };
  const fmtStart = (n: number | null) => (n == null ? "call for quote" : `starting at ${fmt(n)}`);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 text-sm font-medium px-3 py-2 border border-ui-border rounded-md bg-white hover:border-brand/40 focus:outline-none focus:border-brand transition-colors"
      >
        <span>{config.width}′ × {config.length}′</span>
        <span className="flex items-center gap-2">
          <span className="italic font-light text-ink/50 text-xs">{fmtStart(startingAt(config.width, config.length))}</span>
          <svg width="10" height="10" viewBox="0 0 10 10" className="opacity-60">
            <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.2" fill="none" />
          </svg>
        </span>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-72 overflow-auto bg-white border border-ui-border rounded-md shadow-lg py-1">
          {PAVILION_SIZES.filter((s) => mode === "admin" || !isCallForQuote(s.width, s.length)).map((s) => {
            const key = sizeKey(s.width, s.length);
            const price = startingAt(s.width, s.length);
            const active = key === currentKey;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setConfig((c) => ({ ...c, width: s.width, length: s.length }));
                  setOpen(false);
                }}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-1.5 text-sm hover:bg-canvas transition-colors",
                  active && "bg-brand/5 text-brand",
                )}
              >
                <span className="font-medium">{s.width}′ × {s.length}′</span>
                <span className="italic font-light text-ink/50 text-xs">{fmtStart(price)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}


function RoleSwitcher({ mode }: { mode: ConfiguratorMode }) {
  return (
    <div className="flex items-center bg-canvas border border-ui-border rounded-full p-0.5 text-[10px] font-semibold uppercase tracking-wider">
      <Link
        href="/"
        className={cn(
          "px-3 py-1.5 rounded-full transition-colors",
          mode === "customer"
            ? "bg-brand text-brand-foreground shadow-sm"
            : "text-ink/60 hover:text-ink",
        )}
      >
        Customer
      </Link>
      <Link
        href="/admin"
        className={cn(
          "px-3 py-1.5 rounded-full transition-colors",
          mode === "admin"
            ? "bg-brand text-brand-foreground shadow-sm"
            : "text-ink/60 hover:text-ink",
        )}
      >
        Admin
      </Link>
    </div>
  );
}

const MobileCategoryContext = createContext<string | null>(null);

function Section({
  title,
  index,
  mobileCatId,
  children,
}: {
  title: string;
  index: string;
  mobileCatId?: string;
  children: React.ReactNode;
}) {
  const activeCat = useContext(MobileCategoryContext);
  const hideOnMobile =
    mobileCatId != null && activeCat != null && activeCat !== mobileCatId;
  return (
    <section className={hideOnMobile ? "hidden md:block" : undefined}>
      <div className="flex items-center gap-3 mb-5">
        <span className="inline-flex items-center justify-center size-7 rounded-full bg-brand/10 text-brand text-[11px] font-semibold tabular-nums">
          {index}
        </span>
        <h3 className="font-serif text-base uppercase tracking-wider text-ink">
          {title}
        </h3>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-end gap-2">
      <span className="text-[11px] text-ink/60">{label}</span>
      <span className="text-sm font-medium text-right">{value}</span>
    </div>
  );
}

function PlacementPopover({
  label,
  offset,
  setOffset,
  rotationDeg,
  setRotationDeg,
  maxX,
  maxZ,
  onClose,
}: {
  label: string;
  offset: { x: number; z: number };
  setOffset: (v: { x: number; z: number } | ((prev: { x: number; z: number }) => { x: number; z: number })) => void;
  rotationDeg: number;
  setRotationDeg: (v: number | ((prev: number) => number)) => void;
  maxX: number;
  maxZ: number;
  onClose: () => void;
}) {
  const clampX = (v: number) => Math.max(-maxX, Math.min(maxX, v));
  const clampZ = (v: number) => Math.max(-maxZ, Math.min(maxZ, v));
  const wrapDeg = (v: number) => ((v + 180) % 360 + 360) % 360 - 180;

  const Row = ({
    name,
    value,
    min,
    max,
    step,
    unit,
    onChange,
  }: {
    name: string;
    value: number;
    min: number;
    max: number;
    step: number;
    unit: string;
    onChange: (v: number) => void;
  }) => {
    const clamp = (v: number) => Math.max(min, Math.min(max, v));
    const trackRef = useRef<HTMLDivElement | null>(null);
    const updateFromPointer = (clientX: number) => {
      const el = trackRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const t = (clientX - r.left) / r.width;
      const raw = min + Math.max(0, Math.min(1, t)) * (max - min);
      onChange(clamp(Math.round(raw / step) * step));
    };
    const pct = max === min ? 50 : ((clamp(value) - min) / (max - min)) * 100;
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(String(Math.round(value)));
    return (
      <div className="flex items-center gap-2">
        <span className="w-20 text-[11px] uppercase tracking-widest text-ink/70">{name}</span>
        <div
          ref={trackRef}
          onPointerDown={(e) => {
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            updateFromPointer(e.clientX);
          }}
          onPointerMove={(e) => {
            if (e.buttons === 1) updateFromPointer(e.clientX);
          }}
          onWheel={(e) => {
            e.preventDefault();
            onChange(clamp(value + (e.deltaY < 0 ? step : -step)));
          }}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
              e.preventDefault();
              onChange(clamp(value - (e.shiftKey ? step * 10 : step)));
            } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
              e.preventDefault();
              onChange(clamp(value + (e.shiftKey ? step * 10 : step)));
            } else if (e.key === "Home") {
              e.preventDefault();
              onChange(min);
            } else if (e.key === "End") {
              e.preventDefault();
              onChange(max);
            }
          }}
          role="slider"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-label={name}
          className="relative flex-1 h-3 rounded-full bg-ink/85 cursor-pointer touch-none select-none focus:outline-none focus:ring-2 focus:ring-brand/40"
        >
          {/* center tick */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-px h-1.5 bg-white/40" />
          {/* fill from center to current */}
          <div
            className="absolute top-0 bottom-0 bg-brand rounded-full"
            style={{
              left: `${Math.min(50, pct)}%`,
              right: `${100 - Math.max(50, pct)}%`,
            }}
          />
          {/* thumb */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-4 rounded-full bg-brand border-2 border-white shadow pointer-events-none"
            style={{ left: `${pct}%` }}
          />
        </div>
        {editing ? (
          <input
            autoFocus
            type="number"
            value={draft}
            min={min}
            max={max}
            step={step}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              const n = parseFloat(draft);
              if (Number.isFinite(n)) onChange(clamp(n));
              setEditing(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const n = parseFloat(draft);
                if (Number.isFinite(n)) onChange(clamp(n));
                setEditing(false);
              } else if (e.key === "Escape") {
                setEditing(false);
              }
            }}
            className="w-12 text-right text-xs tabular-nums bg-transparent border-b border-brand focus:outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraft(String(Math.round(value)));
              setEditing(true);
            }}
            title="Click to type a value"
            className="w-12 text-right text-xs tabular-nums text-ink/80 hover:text-ink"
          >
            {Math.round(value)}
            {unit}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="w-[320px] bg-white/95 backdrop-blur-sm border border-ui-border rounded-2xl px-4 py-3 shadow-md flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-ink/60">{label}</span>
        <button
          type="button"
          onClick={onClose}
          className="text-ink/50 hover:text-ink text-sm leading-none"
          aria-label="Close"
        >
          ✕
        </button>
      </div>
      <Row name="Left/Right" value={clampX(offset.x)} min={-maxX} max={maxX} step={1} unit={'"'} onChange={(v) => setOffset((p) => ({ ...p, x: v }))} />
      <Row name="Front/Back" value={clampZ(offset.z)} min={-maxZ} max={maxZ} step={1} unit={'"'} onChange={(v) => setOffset((p) => ({ ...p, z: v }))} />
      <Row name="Rotation" value={rotationDeg} min={-180} max={180} step={5} unit="°" onChange={(v) => setRotationDeg(wrapDeg(v))} />

      <button
        type="button"
        onClick={() => {
          setOffset({ x: 0, z: 0 });
          setRotationDeg(0);
        }}
        className="self-end text-[10px] uppercase tracking-widest text-ink/50 hover:text-ink"
      >
        Reset
      </button>
    </div>
  );
}

