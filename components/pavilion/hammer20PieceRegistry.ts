// Registry of dedicated 20' hammer-beam-truss piece STLs.
//
// Each STL must be modeled in INCHES in a common truss-local frame
// (X = span, Y = vertical, Z = thickness). The loader scales to meters
// and keeps the authored position — no recentering, no auto-fit.

import tieBeamL from "@/assets/hammer20_tie_beam_l.stl.asset.json";
import tieBeamR from "@/assets/hammer20_tie_beam_r.stl.asset.json";
import princeL from "@/assets/hammer20_prince_l.stl.asset.json";
import princeR from "@/assets/hammer20_prince_r.stl.asset.json";
import topTie from "@/assets/hammer20_top_tie.stl.asset.json";
import kingpost from "@/assets/hammer20_kingpost.stl.asset.json";

export type Hammer20PieceKey =
  | "tieL" | "tieR"
  | "kingpost" | "post"
  | "strutL" | "strutR"
  | "corbelL" | "corbelR"
  | "dropL" | "dropR"
  | "princeL" | "princeR"
  | "topTie";

export const HAMMER20_PIECE_STLS: Partial<Record<Hammer20PieceKey, string>> = {
  tieL: tieBeamL.url,
  tieR: tieBeamR.url,
  princeL: princeL.url,
  princeR: princeR.url,
  topTie: topTie.url,
  kingpost: kingpost.url,
};

/** Extra pieces (no splitter bucket) that should be rendered as additions
 *  to the 20' truss. Each entry maps the registry key to a stable piece id
 *  for per-piece offset/scale sliders. */
export const HAMMER20_EXTRA_PIECES: Array<{ key: Hammer20PieceKey; piece: string }> = [
  { key: "topTie", piece: "hammer.toptie" },
];

