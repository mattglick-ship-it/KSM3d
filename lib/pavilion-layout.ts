import additions from './pavilion-size-expansion.json';

export const EXPANDED_FRAMES = additions;
export function expandedFrame(width: number, length: number) {
  return additions[`${width}x${length}` as keyof typeof additions];
}

/** Symmetrical preview layout. Stations are measured from the pavilion center
 * in feet. Stock counts come from the detailed workbook; it has no joint plan. */
export function pavilionStations(width: number, length: number) {
  const frame = expandedFrame(width, length);
  const posts = frame?.posts ?? (length > 16 ? 6 : 4);
  const trusses = frame?.trusses ?? (length >= 26 ? 3 : 2);
  const stations = (count: number) => Array.from({length: count}, (_, i) => -length / 2 + length * i / (count - 1));
  const postZ = stations(posts / 2);
  const trussZ = stations(trusses);
  const rafterZ: number[] = [];
  for (let b = 0; b < trusses - 1; b++) {
    const count = frame ? Math.floor(frame.rafterPairs / (trusses - 1)) + (b < frame.rafterPairs % (trusses - 1) ? 1 : 0) : Math.max(2, Math.round((trussZ[b + 1] - trussZ[b]) / 4)) - 1;
    for (let i = 1; i <= count; i++) rafterZ.push(trussZ[b] + (trussZ[b + 1] - trussZ[b]) * i / (count + 1));
  }
  return {postZ, trussZ, rafterZ};
}
