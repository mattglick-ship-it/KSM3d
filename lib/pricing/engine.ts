import type { PricingDoc, Selection, Quote, QuoteLine, HeightId, RoofKey, FinishId, TrussStyleId, RafterTailId } from "./types";
import type { PavilionConfig } from "@/lib/pavilion-config";
import { ROOF_MATERIALS, computeLinealFeet, STAIN_BEAM_RATE_PER_LF, STAIN_DECK_RATE_PER_LF } from "@/lib/pavilion-config";


const HEIGHT_RATE = (h: number) => (h <= 16 ? 9.3 : 10.8);

/** Compute or look up the height upcharge for a given size + height. */
function heightAmount(size: { posts: number; basePostFt?: number; heightPricing?: Partial<Record<HeightId, number>> }, h: HeightId): number | null {
  // Prefer stored heightPricing if present.
  const stored = size.heightPricing?.[h];
  if (stored != null) return stored;
  const basePostFt = size.basePostFt ?? 8;
  const target = Number(h);
  if (target < basePostFt) return null;
  if (target === basePostFt) return 0;
  return +(((target - basePostFt) * size.posts * HEIGHT_RATE(target)).toFixed(2));
}

export function computeQuote(sel: Selection, data: PricingDoc): Quote {
  const size = data.sizes.find((s) => s.id === sel.sizeId) ?? null;
  if (!size) {
    return { total: 0, lines: [], callForPricing: [], status: "ok", size: null, warning: `No pricing for size ${sel.sizeId}` };
  }

  const lines: QuoteLine[] = [];
  const callForPricing: string[] = [];
  const add = (label: string, amount: number | null | undefined) => {
    if (amount == null) callForPricing.push(label);
    else if (amount !== 0) lines.push({ label, amount });
    else lines.push({ label, amount: 0 });
  };

  // 1. BASE
  const base = size.basePriceByRoof[sel.roof];
  if (base == null) {
    callForPricing.push(`Base price (${sel.roof})`);
  } else {
    lines.push({ label: `Base — ${size.label} / ${sel.roof.replace("_", " ")}`, amount: base });
  }

  // 2. FINISH
  if (sel.finish === "smooth") {
    /* +0 */
  } else if (sel.finish === "hand_peeled") {
    add("Hand-Peeled finish", +(size.timberLinearFt * 2).toFixed(2));
  } else if (sel.finish === "hatchet_peeled") {
    add("Hatchet & Hand-Peeled finish", +(size.timberLinearFt * 3).toFixed(2));
  } else if (sel.finish === "rough_sawn") {
    add("Rough Sawn finish", +(size.timberBoardFt * 0.35).toFixed(2));
  }

  // 3. HEIGHT
  if (sel.height !== "8") {
    const h = heightAmount(size, sel.height);
    if (h == null) callForPricing.push(`Height ${sel.height}'`);
    else if (h > 0) lines.push({ label: `Height ${sel.height}'`, amount: h });
  }

  // 4. TRUSS STYLE — per-size lookup. King = 0.
  if (sel.trussStyle !== "king") {
    const amt = size.trussStyleUpgrade?.[sel.trussStyle];
    if (amt == null) callForPricing.push(`${sel.trussStyle} truss`);
    else if (amt > 0) {
      const label =
        sel.trussStyle === "hammer"
          ? "Hammer Truss Pavilion Package"
          : "Arched King Truss Pavilion Package";
      lines.push({ label, amount: amt });
    }
  }

  // 5. RAFTER TAIL — per-size lookup.
  if (sel.rafterTail === "scroll_cut") {
    const amt = size.rafterTailUpgrade?.scroll_cut;
    if (amt == null) callForPricing.push("Scroll Cut Rafter Tail");
    else if (amt > 0) lines.push({ label: "Scroll Cut Rafter Tail", amount: amt });
  }

  // 6. PLATES — user-controlled; included sizes only add the zero-dollar line when selected.
  const plates = size.decorativeTrussPlates;
  if (sel.decorativeTrussPlates && plates?.included) {
    lines.push({ label: "Decorative Truss Plates (Included)", amount: 0 });
  } else if (sel.decorativeTrussPlates) {
    const amt = plates?.upcharge;
    if (amt == null) callForPricing.push("Decorative Truss Plates");
    else lines.push({ label: "Decorative Truss Plates", amount: amt });
  }

  // 7. FACEBOARD — per-size lookup.
  if (sel.overhangFaceboard) {
    const amt = size.overhangFaceboard?.upcharge;
    if (amt == null) callForPricing.push("Overhang Faceboard");
    else lines.push({ label: "Overhang Faceboard", amount: amt });
  }

  // 8. TEXTURED METAL — per-size lookup; metal/standing_seam only.
  if (sel.texturedMetal && (sel.roof === "metal" || sel.roof === "standing_seam")) {
    const amt = size.texturedMetalUpcharge?.[sel.roof];
    if (amt == null) callForPricing.push("Textured Metal");
    else if (amt > 0) lines.push({ label: "Textured Metal", amount: amt });
  }

  // 9. STAIN — beams + roof deckboards (unfinished is no upcharge)
  if ((sel.beamStained || sel.deckStained) && sel.config) {
    const lf = computeLinealFeet(sel.config);
    if (sel.beamStained) {
      const beamAmt = +(lf.beamsTotal * STAIN_BEAM_RATE_PER_LF).toFixed(2);
      lines.push({
        label: `Beam stain`,
        amount: beamAmt,
      });
    }
    if (sel.deckStained) {
      const deckAmt = +(lf.deckboards * STAIN_DECK_RATE_PER_LF).toFixed(2);
      lines.push({
        label: `Deckboard stain`,
        amount: deckAmt,
      });
    }
  }


  const total = lines.reduce((acc, l) => acc + l.amount, 0);
  return {
    total,
    lines,
    callForPricing,
    status: size.status,
    size,
    warning: size.dataIssue,
  };
}

// ---- Selection mapping from the existing PavilionConfig ----
const WOOD_TO_FINISH: Record<string, FinishId> = {
  smooth: "smooth",
  "hand-peeled": "hand_peeled",
  "hatchet-hand-peeled": "hatchet_peeled",
  "rough-sawn": "rough_sawn",
};
const TRUSS_TO_STYLE: Record<string, TrussStyleId> = {
  king: "king",
  arch: "arched_king",
  hammer: "hammer",
  none: "king", // treat as base
};
const ROOF_TYPE_TO_KEY: Record<string, RoofKey> = {
  metal: "metal",
  "standing-seam": "standing_seam",
  shingle: "shingles",
};

export function selectionFromConfig(
  config: PavilionConfig,
  opts: { stained?: boolean; beamStained?: boolean; deckStained?: boolean } = {},
): Selection {
  const roofMat = ROOF_MATERIALS.find((r) => r.id === config.roofId);
  const roof: RoofKey = ROOF_TYPE_TO_KEY[roofMat?.type ?? "metal"] ?? "metal";
  const textured = !!roofMat?.textured;
  const heightNum = Math.max(8, Math.min(10, Math.round(config.height)));
  const heightId: HeightId = String(heightNum) as HeightId;
  const rafterTail: RafterTailId = config.rafterTail === "scroll" ? "scroll_cut" : "standard";
  const beamStained = !!(opts.beamStained ?? opts.stained);
  const deckStained = !!(opts.deckStained ?? opts.stained);
  return {
    sizeId: `${config.width}x${config.length}`,
    roof,
    finish: WOOD_TO_FINISH[config.woodId] ?? "smooth",
    height: heightId,
    trussStyle: TRUSS_TO_STYLE[config.truss] ?? "king",
    rafterTail,
    decorativeTrussPlates: !!config.trussPlates,
    overhangFaceboard: !!config.gableFascia,
    texturedMetal: textured,
    stained: beamStained || deckStained,
    beamStained,
    deckStained,
    config,
  };
}


export const fmtUSD = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });


