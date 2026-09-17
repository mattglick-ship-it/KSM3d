import type { PavilionConfig, RoofMaterialType } from './pavilion-config';

export const DEFAULT_SNOW_RATES = {
  guardEach: 7.5,
  ribbedRailPerSection: 22.5,
  standingSeamRailPerFoot: 22.5,
} as const;
export type SnowRates = { -readonly [K in keyof typeof DEFAULT_SNOW_RATES]: number | null };
const IN = 0.0254;
export const FT = 12 * IN;

export function snowRoofLength(config: Pick<PavilionConfig, 'length' | 'gableOverhang'>) {
  return (config.length + (config.gableOverhang ? 3 : 0)) * FT;
}

// Shared by rendering and pricing: one guard per position, alternating rows.
export function snowGuardPositions(panelDepth: number, roofType: RoofMaterialType, spacing = FT): number[] {
  if (roofType === 'shingle') return [];
  if (roofType === 'metal') {
    const ribSpacing = 9 * IN;
    const count = Math.max(1, Math.floor(panelDepth / ribSpacing + 1e-9));
    const start = -(count * ribSpacing) / 2;
    return Array.from({ length: count }, (_, i) => start + (i + 0.5) * ribSpacing);
  }
  const count = Math.max(2, Math.floor(panelDepth / spacing + 1e-9));
  const step = panelDepth / count;
  return Array.from({ length: count }, (_, i) => -panelDepth / 2 + (i + 0.5) * step);
}

// One continuous rail at each eave, inset eight inches at each gable end.
export function snowRailLength(panelDepth: number) {
  return Math.max(0.01, panelDepth - 16 * IN);
}

export function snowQuantities(config: Pick<PavilionConfig, 'length' | 'gableOverhang'>, roofType: RoofMaterialType) {
  if (roofType === 'shingle') return { guards: 0, railFeet: 0, railSections: 0 };
  const depth = snowRoofLength(config);
  const feetPerSide = snowRailLength(depth) / FT;
  return {
    guards: snowGuardPositions(depth, roofType).length * 2,
    railFeet: feetPerSide * 2,
    railSections: Math.ceil(feetPerSide / 10 - 1e-9) * 2,
  };
}
