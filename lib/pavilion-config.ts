import {EXPANDED_FRAMES,expandedFrame} from './pavilion-layout';
export type RoofStyle = "gable" | "hip" | "flat";
export type PostStyle = "square" | "brace";
export type TrussStyle = "none" | "arch" | "hammer" | "king";
export type RafterTail = "standard" | "scroll";

export const RAFTER_TAILS: { id: RafterTail; name: string }[] = [
  { id: "standard", name: "Standard Tail" },
  { id: "scroll", name: "Scroll Cut Tail" },
];

export type WoodFinish = {
  id: string;
  name: string;
  hex: string;
};

export const WOOD_FINISHES: WoodFinish[] = [
  { id: "smooth", name: "Smooth", hex: "#8a5a2b" },
  { id: "hand-peeled", name: "Hand-Peeled", hex: "#7a4a22" },
  { id: "rough-sawn", name: "Rough Sawn", hex: "#6b4520" },
  { id: "hatchet-hand-peeled", name: "Hatchet & Hand-Peeled", hex: "#5a3a18" },
];

export type RoofMaterialType = "shingle" | "metal" | "standing-seam";

export type RoofMaterial = {
  id: string;
  name: string;
  hex: string;
  type: RoofMaterialType;
  /** Marks the swatch as a "textured" finish — same render style as its
   *  parent type, grouped under a Textured Metal sub-menu in the UI. */
  textured?: boolean;
};

export const ROOF_MATERIAL_TYPES: { id: RoofMaterialType; name: string }[] = [
  { id: "shingle", name: "ARCHITECTURAL SHINGLES" },
  { id: "metal", name: "RIBBED METAL" },
  { id: "standing-seam", name: "Standing Seam" },
];

const ROOF_COLOR_PALETTE: { slug: string; name: string; hex: string }[] = [
  { slug: "white", name: "White", hex: "#ebebe9" },
  { slug: "ivory", name: "Ivory", hex: "#c8c8a8" },
  { slug: "clay", name: "Clay", hex: "#b8bab4" },
  { slug: "light-gray", name: "Light Gray", hex: "#b0b3b5" },
  { slug: "mocha-tan", name: "Mocha Tan", hex: "#c4a575" },
  { slug: "galvalume", name: "Galvalume", hex: "#a8a8a8" },
  { slug: "light-stone", name: "Light Stone", hex: "#a8a89c" },
  { slug: "patina-green", name: "Patina Green", hex: "#7a9888" },
  { slug: "copper", name: "Copper", hex: "#a8623a" },
  { slug: "slate-gray", name: "Slate Gray", hex: "#5a6168" },
  { slug: "hawaiian-blue", name: "Hawaiian Blue", hex: "#2b6a9e" },
  { slug: "barn-red", name: "Barn Red", hex: "#8a3a2a" },
  { slug: "bright-red", name: "Bright Red", hex: "#b02020" },
  { slug: "charcoal", name: "Charcoal", hex: "#3d4450" },
  { slug: "cocoa-brown", name: "Cocoa Brown", hex: "#5a3a32" },
  { slug: "forest-green", name: "Forest Green", hex: "#2d4a3e" },
  { slug: "dark-red", name: "Dark Red", hex: "#8a2020" },
  { slug: "bronze", name: "Bronze", hex: "#3a3530" },
  { slug: "gallery-blue", name: "Gallery Blue", hex: "#1e3a5f" },
  { slug: "burgundy", name: "Burgundy", hex: "#5a2230" },
  { slug: "fern-green", name: "Fern Green", hex: "#1a3a2a" },
  { slug: "black", name: "Black", hex: "#1a1d24" },
];

const TEXTURED_PALETTE: { slug: string; name: string; hex: string }[] = [
  { slug: "textured-black", name: "Textured Black", hex: "#1f2126" },
  { slug: "textured-bronze", name: "Textured Bronze", hex: "#4a3a2a" },
  { slug: "textured-copper", name: "Textured Copper", hex: "#8a5238" },
  { slug: "textured-cocoa", name: "Textured Cocoa", hex: "#5a3a32" },
  { slug: "textured-charcoal", name: "Textured Charcoal", hex: "#3a3f48" },
  { slug: "textured-slate", name: "Textured Slate", hex: "#525b62" },
  { slug: "textured-clay", name: "Textured Clay", hex: "#8a6650" },
  { slug: "textured-pewter", name: "Textured Pewter", hex: "#7a7d82" },
  { slug: "textured-forest", name: "Textured Forest", hex: "#2a3a30" },
  { slug: "textured-burgundy", name: "Textured Burgundy", hex: "#4a2228" },
];

export const ROOF_MATERIALS: RoofMaterial[] = [
  { id: "shingle-charcoal-gray", name: "Charcoal Gray", hex: "#2f3338", type: "shingle" },
  { id: "shingle-fox-hollow-gray", name: "Fox Hollow Gray", hex: "#b9bbbc", type: "shingle" },
  { id: "shingle-hickory", name: "Hickory", hex: "#8a4a26", type: "shingle" },
  { id: "shingle-hunter-green", name: "Hunter Green", hex: "#2f4a3a", type: "shingle" },
  { id: "shingle-pewter-gray", name: "Pewter Gray", hex: "#8a8d90", type: "shingle" },
  { id: "shingle-shake-wood", name: "Shake Wood", hex: "#b08040", type: "shingle" },
  { id: "shingle-weather-wood", name: "Weather Wood", hex: "#8a8166", type: "shingle" },
  { id: "shingle-williamsburg-slate", name: "Williamsburg Slate", hex: "#9a8e88", type: "shingle" },

  ...ROOF_COLOR_PALETTE.map((c) => ({
    id: `metal-${c.slug}`,
    name: c.name,
    hex: c.hex,
    type: "metal" as const,
  })),
  ...ROOF_COLOR_PALETTE.map((c) => ({
    id: `ss-${c.slug}`,
    name: c.name,
    hex: c.hex,
    type: "standing-seam" as const,
  })),
  ...TEXTURED_PALETTE.map((c) => ({
    id: `metal-${c.slug}`,
    name: c.name,
    hex: c.hex,
    type: "metal" as const,
    textured: true,
  })),
  ...TEXTURED_PALETTE.map((c) => ({
    id: `ss-${c.slug}`,
    name: c.name,
    hex: c.hex,
    type: "standing-seam" as const,
    textured: true,
  })),
];

export const POST_STYLES: { id: PostStyle; name: string }[] = [
  { id: "square", name: "Square" },
  { id: "brace", name: "Arched Brace" },
];

export const TRUSS_STYLES: { id: TrussStyle; name: string }[] = [
  { id: "king", name: "King Truss" },
  { id: "arch", name: "Arched King Truss" },
  { id: "hammer", name: "Hammer Truss" },
];

export const ROOF_STYLES: { id: RoofStyle; name: string }[] = [
  { id: "gable", name: "Gable" },
  { id: "hip", name: "Hip" },
  { id: "flat", name: "Flat" },
];

export type PavilionConfig = {
  width: number; // feet
  length: number;
  height: number;
  roof: RoofStyle;
  post: PostStyle;
  truss: TrussStyle;
  woodId: string;
  roofId: string;
  trussPlates: boolean;
  /** Corner-brace scale multiplier (1.0 = 3 ft horizontal leg). */
  braceScale: number;
  /** Add-on: snow guards on standing-seam roofs. */
  snowGuards: boolean;
  /** Add-on: snow rail along the eaves. */
  snowRail?: boolean;
  /** Rafter tail end-cut style. */
  rafterTail: RafterTail;
  /** Decorative gable-end rake fascia (overhang faceboard). */
  gableFascia: boolean;
  /** Whether the roof + rake fascia extends past the gable end as an overhang. */
  gableOverhang: boolean;
  /** Hide the back (rear) truss and the ridge pole — useful when the pavilion abuts a wall. */
  hideBackTruss?: boolean;
};

export const DEFAULT_CONFIG: PavilionConfig = {
  width: 16,
  length: 20,
  height: 8,
  roof: "gable",
  post: "brace",
  truss: "king",
  woodId: "smooth",
  roofId: "shingle-charcoal-gray",
  trussPlates: false,
  braceScale: 0.75,
  snowGuards: false,
  snowRail: false,
  rafterTail: "standard",
  gableFascia: false,
  gableOverhang: true,
  hideBackTruss: false,
};

/** Kit price sheet: [width, length] → { shingle, metal, standing-seam }. */
export const ORIGINAL_PAVILION_SIZES: { width: number; length: number }[] = [
  { width: 12, length: 16 },
  { width: 12, length: 20 },
  { width: 12, length: 24 },
  { width: 14, length: 20 },
  { width: 14, length: 24 },
  { width: 14, length: 28 },
  { width: 16, length: 20 },
  { width: 16, length: 24 },
  { width: 16, length: 28 },
  { width: 20, length: 20 },
  { width: 20, length: 24 },
  { width: 20, length: 28 },
];
const CUSTOM_PAVILION_SIZES = [
  { width: 24, length: 24 },
  { width: 24, length: 28 },
  { width: 24, length: 32 },
  { width: 24, length: 36 },
  { width: 24, length: 40 },
  { width: 28, length: 24 },
  { width: 28, length: 28 },
  { width: 28, length: 32 },
  { width: 28, length: 36 },
  { width: 28, length: 40 },
  { width: 32, length: 24 },
  { width: 32, length: 28 },
  { width: 32, length: 32 },
  { width: 32, length: 36 },
  { width: 32, length: 40 },
];

export const CUSTOMER_PAVILION_SIZES = [...ORIGINAL_PAVILION_SIZES,...Object.values(EXPANDED_FRAMES).map(({width,length})=>({width,length}))].sort((a,b)=>a.width-b.width||a.length-b.length);
export const PAVILION_SIZES = [...new Map([...CUSTOMER_PAVILION_SIZES,...CUSTOM_PAVILION_SIZES].map(s=>[`${s.width}x${s.length}`,s])).values()];
export function isCallForQuote(width: number, length: number): boolean {
  return !CUSTOMER_PAVILION_SIZES.some(s=>s.width===width&&s.length===length);
}


export const PRICE_TABLE: Record<
  string,
  Record<RoofMaterialType, number>
> = {
  "10x12": { shingle: 4395, metal: 4445, "standing-seam": 5338 },
  "10x16": { shingle: 5340, metal: 5400, "standing-seam": 6485 },
  "10x20": { shingle: 6661, metal: 6817, "standing-seam": 8309 },
  "12x16": { shingle: 6409, metal: 6480, "standing-seam": 7782 },
  "12x20": { shingle: 7995, metal: 8182, "standing-seam": 9971 },
  "12x24": { shingle: 9352, metal: 9510, "standing-seam": 11601 },
  "14x20": { shingle: 8753, metal: 8948, "standing-seam": 10988 },
  "14x24": { shingle: 10160, metal: 10312, "standing-seam": 12924 },
  "14x28": { shingle: 11418, metal: 11637, "standing-seam": 14729 },
  "16x20": { shingle: 9282, metal: 9589, "standing-seam": 11925 },
  "16x24": { shingle: 10794, metal: 11068, "standing-seam": 13939 },
  "16x28": { shingle: 12272, metal: 12505, "standing-seam": 15929 },
  "20x20": { shingle: 11940, metal: 12309, "standing-seam": 15250 },
  "20x24": { shingle: 14122, metal: 14443, "standing-seam": 18039 },
  "20x28": { shingle: 16120, metal: 16314, "standing-seam": 20876 },
};

export function sizeKey(w: number, l: number) {
  return `${w}x${l}`;
}

export function estimatePrice(c: PavilionConfig): number {
  const roofType = ROOF_MATERIALS.find((r) => r.id === c.roofId)?.type ?? "shingle";
  const row = PRICE_TABLE[sizeKey(c.width, c.length)];
  const base = row ? row[roofType] : 35 * c.width * c.length;
  const postMult = c.post === "brace" ? 1.05 : 1;
  const woodMult = c.woodId === "walnut" ? 1.1 : c.woodId === "white" ? 1.05 : 1;
  return Math.round(base * postMult * woodMult);
}

// ---------- Stain pricing ----------
export const STAIN_BEAM_RATE_PER_LF = 5.20;
export const STAIN_DECK_RATE_PER_LF = 0.98;

export type LinealFeetBreakdown = {
  posts: number;
  perimeterBeams: number;
  trusses: number;
  rafters: number;
  arches: number;
  faceboard: number;
  beamsTotal: number;
  deckboards: number;
};

/**
 * Estimate stainable lineal feet for a pavilion. "Beams" aggregates posts,
 * perimeter top beams, truss members, rafters, arched corner braces, and the
 * gable/eave faceboard. "Deckboards" is derived from sloped roof area using
 * 2x6 boards at 5.25" coverage.
 *
 * Legacy sizes retain their original estimate basis. Added sizes use their
 * reviewed post/truss/rafter counts, sheet roof pitch and selected gable overhang.
 */
export function computeLinealFeet(c: PavilionConfig): LinealFeetBreakdown {
  const frame = expandedFrame(c.width, c.length);
  const W = c.width;
  const L = c.length;
  const H = c.height;
  const pitchRise = c.roof === "flat" ? 0 : frame ? frame.pitch * 12 : 4;
  const slope = Math.sqrt(1 + (pitchRise / 12) ** 2); // ≈1.054 for 4:12
  const overhang = 1; // ft each side

  // Posts: 4 corners × height
  const posts = (frame?.posts ?? 4) * H;

  // Perimeter top beams (2 long + 2 short)
  const perimeterBeams = frame ? 2 * (L + 28 / 12) + L + frame.rafterPairs * frame.collarStockFt : 2 * (W + L);

  // Trusses: end trusses + interior every ~10 ft
  const trussCount = c.truss === "none" ? 0 : frame ? frame.trusses - (c.hideBackTruss ? 1 : 0) : Math.max(2, Math.ceil(L / 10) + 1);
  const rise = (W / 2) * (pitchRise / 12);
  const topChord = (W / 2) * slope;
  let perTrussLf = 0;
  if (c.truss === "king") {
    // bottom chord + 2 top chords + king post
    perTrussLf = W + 2 * topChord + rise;
  } else if (c.truss === "arch") {
    // king + arched bottom chord (~1.1× straight span)
    perTrussLf = W * 1.1 + 2 * topChord + rise;
  } else if (c.truss === "hammer") {
    // 2 tie beams, kingpost, 2 struts, 2 corbels, 2 prince beams
    perTrussLf = 2 * (W * 0.35) + rise + 2 * 3 + 2 * 2 + 2 * (W * 0.25) + 2 * topChord;
  }
  const trusses = trussCount * perTrussLf;

  // Rafter pairs spaced ~24" along the length
  const rafterPairs = frame?.rafterPairs ?? Math.max(2, Math.floor(L / 2) + 1);
  const rafterLen = (W / 2) * slope + overhang;
  const rafters = 2 * rafterPairs * rafterLen;

  // Arched corner braces (4 corners × 2 legs × ~3 ft)
  const arches = c.post === "brace" ? (frame?.braces ?? 8) * 3 : 0;

  // Faceboard: rake fascia along gable ends (if enabled) + eave fascia both sides
  const rakeLen = (W / 2) * slope + overhang;
  const eaveLen = L + 2 * overhang;
  const faceboard = (c.gableFascia ? 4 * rakeLen : 0) + 2 * eaveLen;

  const beamsTotal = posts + perimeterBeams + trusses + rafters + arches + faceboard;

  // Deckboards: sloped roof area × (12 / 5.25) lf per sqft
  const widthWithOverhang = W + 2 * overhang;
  const lengthWithOverhang = frame ? L + (c.gableOverhang ? 3 : 0) : L + 2 * overhang;
  const roofArea =
    c.roof === "flat"
      ? widthWithOverhang * lengthWithOverhang
      : widthWithOverhang * slope * lengthWithOverhang;
  const deckboards = (roofArea * 12) / 5.25;

  return {
    posts: round1(posts),
    perimeterBeams: round1(perimeterBeams),
    trusses: round1(trusses),
    rafters: round1(rafters),
    arches: round1(arches),
    faceboard: round1(faceboard),
    beamsTotal: round1(beamsTotal),
    deckboards: round1(deckboards),
  };
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
