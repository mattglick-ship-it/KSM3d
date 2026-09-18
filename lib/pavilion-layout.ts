import additions from './pavilion-size-expansion.json';

export type FrameTruss = 'king' | 'arch' | 'hammer';
export type FrameSpec = {
  width: number; length: number; posts: number; trusses: number; rafterPairs: number; braces: number;
  pitch: number; girderIn: number[]; ridgeIn: number[]; rafterIn: number[]; trussIn: number[];
  collarIn: number[]; collarStockFt: number; baseHeight: number; baseTruss: FrameTruss;
  allowedTrusses: FrameTruss[]; runtimeTruss: boolean; packageNote: string;
};
export const EXPANDED_FRAMES = additions as Record<string, FrameSpec>;
export function expandedFrame(width: number, length: number): FrameSpec | undefined {
  return EXPANDED_FRAMES[`${width}x${length}`];
}
export function availableTrusses(width: number, length: number): FrameTruss[] {
  return expandedFrame(width,length)?.allowedTrusses ?? ['king','arch','hammer'];
}
export function availableHeights(width: number, length: number) {
  const base = expandedFrame(width,length)?.baseHeight ?? 8;
  return [8,9,10].filter(h => h >= base);
}
export function trussPreviewPath(width: number, length: number, style: string) {
  return `/truss-icons/${style}-${width}${width===10 && length===10 ? '-6' : ''}.png`;
}
/** Changing footprint also selects a supported package and minimum post height. */
export function fitSize<T extends {width:number;length:number;height:number;truss:string}>(config:T,width:number,length:number):T {
  const frame=expandedFrame(width,length);
  return {...config,width,length,height:Math.max(config.height,frame?.baseHeight??8),
    truss:availableTrusses(width,length).includes(config.truss as FrameTruss)?config.truss:frame?.baseTruss??'king'};
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
