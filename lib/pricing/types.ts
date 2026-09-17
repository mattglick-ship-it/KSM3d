// Pricing data types — see admin/pricing for shape.
export type RoofKey = "metal" | "standing_seam" | "shingles";
export type FinishId = "smooth" | "hand_peeled" | "hatchet_peeled" | "rough_sawn";
export type TrussStyleId = "king" | "arched_king" | "hammer";
export type RafterTailId = "standard" | "scroll_cut";
export type HeightId = "8" | "9" | "10";

export type PriceModel =
  | { model: "none" }
  | { model: "flat"; amount: number | null }
  | { model: "bySize"; amounts: Record<string, number | null> }
  | { model: "perLinearFt"; rate: number; basis: "timberLinearFt" }
  | { model: "perBoardFt"; rate: number; basis: "timberBoardFt" };

export type SizeRow = {
  id: string;
  label: string;
  width: number;
  length: number;
  posts: number;
  trusses?: number;
  rafters?: number;
  basePostFt?: number;
  postSize?: string;
  roofSqFt?: number;
  timberLinearFt: number;
  timberBoardFt: number;
  baseStructureCost?: number;
  basePriceByRoof: Partial<Record<RoofKey, number>>;
  heightPricing?: Partial<Record<HeightId, number>>;
  trussStyleUpgrade?: Partial<Record<TrussStyleId, number>>;
  rafterTailUpgrade?: Partial<Record<RafterTailId, number>>;
  decorativeTrussPlates?: { included: boolean; upcharge: number | null; basis?: string };
  overhangFaceboard?: { linearFt?: number; upcharge: number | null };
  texturedMetalUpcharge?: Partial<Record<RoofKey, number>>;
  roofingCost?: Partial<Record<RoofKey, number>>;
  status: "ok" | "needs_review";
  dataIssue?: string;
};

export type PricingDoc = {
  meta: {
    schemaVersion?: string;
    currency: string;
    openTodos?: string[];
    notes?: string[];
    generatedAt?: string;
    generatedFrom?: string;
    [k: string]: unknown;
  };
  roofMaterials: Array<{
    id: RoofKey;
    label: string;
    priceKey: string;
    colors?: string[];
    texturedUpcharge?: { model: string; amount: number | null };
  }>;
  options: {
    height: { label: string; ui: string; choices: Array<{ id: string; label: string; price: PriceModel }> };
    trussStyle: { label: string; ui: string; choices: Array<{ id: TrussStyleId; label: string; price: PriceModel }> };
    rafterTail: { label: string; ui: string; choices: Array<{ id: RafterTailId; label: string; price: PriceModel }> };
    decorativeTrussPlates: { label: string; ui: string; price: PriceModel };
    overhangFaceboard: { label: string; ui: string; price: PriceModel };
    texturedMetal: { label: string; ui: string; price: PriceModel };
    snowGuards?: { price: { model: "bySize"; amounts: Record<string, number | null> } };
    snowRail?: { price: { model: "bySize"; amounts: Record<string, number | null> } };
    timberFinish: { label: string; ui: string; choices: Array<{ id: FinishId; label: string; price: PriceModel }> };
  };
  sizes: SizeRow[];
};

import type { PavilionConfig } from "@/lib/pavilion-config";

export type Selection = {
  sizeId: string;
  roof: RoofKey;
  finish: FinishId;
  height: HeightId;
  trussStyle: TrussStyleId;
  rafterTail: RafterTailId;
  decorativeTrussPlates: boolean;
  overhangFaceboard: boolean;
  texturedMetal: boolean;
  stained: boolean;
  beamStained: boolean;
  deckStained: boolean;
  /** Full config retained so the engine can derive lineal feet for stain pricing. */
  config?: PavilionConfig;
};



export type QuoteLine = { label: string; amount: number };
export type Quote = {
  total: number;
  lines: QuoteLine[];
  callForPricing: string[];
  status: "ok" | "needs_review";
  size: SizeRow | null;
  warning?: string;
};

