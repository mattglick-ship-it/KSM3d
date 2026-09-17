import type {Workbook} from "./read-xlsx";
import type { PricingDoc, SizeRow, RoofKey, HeightId } from "./types";

const FINISH_SCOPE = {
  include_keywords: ["post", "girder", "ridge", "rafter", "collar", "chord", "webbing", "king", "beam"],
  exclude_keywords: [
    "base", "lag", "screw", "anchor", "caulk", "decking", "shingle", "felt", "drip",
    "panel", "trim", "cap", "square", "starter", "bundle", "bdl", "roll", "bag", "gasket", "seal",
  ],
  include_faceboards: false,
  include_braces: false,
};

const SIZE_TAB_RE = /^\d+x\d+$/i;

type Row = unknown[];
const firstNumberAfter = (row: Row, i: number): number | null => {
  for (let j = i + 1; j < row.length; j++) {
    const v = row[j];
    if (typeof v === "number" && !Number.isNaN(v)) return v;
  }
  return null;
};

function classifyTimber(desc: string): "include" | "skip" {
  const d = desc.toLowerCase();
  if (FINISH_SCOPE.exclude_keywords.some((k) => d.includes(k))) return "skip";
  if (d.includes("faceboard")) return FINISH_SCOPE.include_faceboards ? "include" : "skip";
  if (d.includes("brace")) return FINISH_SCOPE.include_braces ? "include" : "skip";
  if (FINISH_SCOPE.include_keywords.some((k) => d.includes(k))) return "include";
  return "skip";
}

function parseSizeSheet(ws: unknown[][]): Omit<SizeRow, "id" | "label" | "width" | "length"> & { headerSize: string | null } {
  const rows = ws;
  let currentRoof: RoofKey | null = null;
  const basePriceByRoof: Partial<Record<RoofKey, number>> = {};
  let baseStructureCost: number | undefined;
  let timberLinearFt = 0;
  let timberBoardFt = 0;
  let postSize: string | undefined;
  let basePostFt: number | undefined;
  let posts = 0;
  let headerSize: string | null = null;

  const dimRe = /(\d+)\s*x\s*(\d+)\s*x\s*(\d+)/i;

  for (const row of rows) {
    if (!row || row.length === 0) continue;
    const joined = row.filter(Boolean).join(" | ").toLowerCase();
    if (joined.includes("shingle") && joined.includes("option")) currentRoof = "shingles";
    else if (joined.includes("standing seam") && joined.includes("option")) currentRoof = "standing_seam";
    else if ((joined.includes("grandrib") || joined.includes("ribbed")) && joined.includes("option")) currentRoof = "metal";

    for (let i = 0; i < row.length; i++) {
      const c = row[i];
      if (typeof c !== "string") continue;
      const lc = c.toLowerCase();
      if (lc.startsWith("total ksm items")) {
        const n = firstNumberAfter(row, i);
        if (n != null) baseStructureCost = n;
      } else if (lc.startsWith("grand total") && currentRoof) {
        const n = firstNumberAfter(row, i);
        if (n != null) basePriceByRoof[currentRoof] = n;
      }
      if (!headerSize && SIZE_TAB_RE.test(c.trim())) headerSize = c.trim();
    }

    // Timber / post detection: col[1]=qty number, col[2]=string desc
    const qty = row[1];
    const desc = row[2];
    if (typeof qty === "number" && typeof desc === "string") {
      const cls = classifyTimber(desc);
      const m = desc.match(dimRe);
      if (m) {
        const t = parseInt(m[1], 10);
        const w = parseInt(m[2], 10);
        const L = parseInt(m[3], 10);
        if (cls === "include") {
          timberLinearFt += qty * L;
          timberBoardFt += (qty * (t * w * L)) / 12;
        }
        // base post detection
        if (!postSize && /post/i.test(desc) && !/base/i.test(desc)) {
          postSize = `${t}x${w}`;
          basePostFt = L;
          posts = qty;
        } else if (/post/i.test(desc) && !/base/i.test(desc)) {
          // accumulate posts seen for that base post size if it matches
          if (postSize === `${t}x${w}` && basePostFt === L) posts += qty;
        }
      }
    }
  }

  // Round timber values
  timberLinearFt = +timberLinearFt.toFixed(2);
  timberBoardFt = +timberBoardFt.toFixed(2);

  // heightPricing
  const heightPricing: Partial<Record<HeightId, number>> = {};
  const bp = basePostFt ?? 8;
  const postsForHeight = posts || 0;
  for (const h of [8, 9, 10] as const) {
    if (h < bp) continue;
    const rate = h <= 16 ? 9.3 : 10.8;
    heightPricing[String(h) as HeightId] = +((h - bp) * postsForHeight * rate).toFixed(2);
  }

  return {
    posts: postsForHeight,
    basePostFt: bp,
    postSize,
    timberLinearFt,
    timberBoardFt,
    baseStructureCost,
    basePriceByRoof,
    heightPricing,
    status: "ok",
    headerSize,
  };
}

export type ParseWarning = { sizeId: string; message: string };

export type ParseResult = {
  sizes: SizeRow[];
  hammerAmounts: Record<string, number>;
  warnings: ParseWarning[];
};

export function parseWorkbook(wb: Workbook): ParseResult {
  const sizes: SizeRow[] = [];
  const variants: { baseId: string; prices: Partial<Record<RoofKey, number>> }[] = [];
  const warnings: ParseWarning[] = [];

  for (const name of wb.SheetNames) {
    if (name.toLowerCase() === "price list") continue;
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const parsed = parseSizeSheet(ws);

    if (name.includes("(")) {
      const baseId = name.split("(")[0].trim();
      variants.push({ baseId, prices: parsed.basePriceByRoof });
      continue;
    }

    const id = name.trim();
    const m = id.match(/^(\d+)x(\d+)$/i);
    if (!m) continue;
    const width = parseInt(m[1], 10);
    const length = parseInt(m[2], 10);

    let status: "ok" | "needs_review" = "ok";
    let dataIssue: string | undefined;
    if (parsed.headerSize && parsed.headerSize.toLowerCase() !== id.toLowerCase()) {
      status = "needs_review";
      dataIssue = `Header size "${parsed.headerSize}" does not match tab "${id}".`;
      warnings.push({ sizeId: id, message: dataIssue });
    }
    const metalP = parsed.basePriceByRoof.metal ?? 0;
    const ssP = parsed.basePriceByRoof.standing_seam ?? 0;
    if (metalP && ssP > metalP * 1.5) {
      status = "needs_review";
      const msg = `Standing seam price ${ssP} > metal ${metalP} × 1.5 — verify roof SF.`;
      dataIssue = dataIssue ? `${dataIssue} ${msg}` : msg;
      warnings.push({ sizeId: id, message: msg });
    }

    sizes.push({
      id,
      label: `${width}' × ${length}'`,
      width,
      length,
      posts: parsed.posts,
      basePostFt: parsed.basePostFt,
      postSize: parsed.postSize,
      timberLinearFt: parsed.timberLinearFt,
      timberBoardFt: parsed.timberBoardFt,
      baseStructureCost: parsed.baseStructureCost,
      basePriceByRoof: parsed.basePriceByRoof,
      heightPricing: parsed.heightPricing,
      status,
      dataIssue,
    });
  }

  // Hammer deltas
  const hammerAmounts: Record<string, number> = {};
  for (const v of variants) {
    const base = sizes.find((s) => s.id.toLowerCase() === v.baseId.toLowerCase());
    if (!base) continue;
    const deltas: number[] = [];
    for (const roof of ["metal", "standing_seam", "shingles"] as const) {
      const b = base.basePriceByRoof[roof];
      const var_ = v.prices[roof];
      if (b != null && var_ != null) deltas.push(var_ - b);
    }
    if (deltas.length > 0) {
      const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length;
      hammerAmounts[base.id] = +avg.toFixed(2);
    }
  }

  return { sizes, hammerAmounts, warnings };
}

/** Merge parsed XLSX into an existing doc while preserving manual upcharges. */
export function mergeParseIntoDoc(prev: PricingDoc, parsed: ParseResult): PricingDoc {
  const next: PricingDoc = JSON.parse(JSON.stringify(prev));
  // Replace sizes entirely
  next.sizes = parsed.sizes;

  // Refresh hammer amounts from variants, preserve any previously-entered
  // amounts that don't have an HB tab.
  const hammer = next.options.trussStyle.choices.find((c) => c.id === "hammer");
  if (hammer && hammer.price.model === "bySize") {
    const prevAmts = hammer.price.amounts || {};
    const merged: Record<string, number | null> = { ...prevAmts };
    for (const [id, amt] of Object.entries(parsed.hammerAmounts)) {
      merged[id] = amt;
    }
    hammer.price = { model: "bySize", amounts: merged };
  }
  return next;
}

