import seed from './catalog.json';
import {EXPANDED_FRAMES} from '../pavilion-layout';
import type {PricingDoc} from './types';

/** Older published catalogs keep their overrides and gain only missing new rows.
 * An existing row (even with blank prices) is an intentional admin decision. */
export function withExpandedSizes(doc: PricingDoc): PricingDoc {
  const present = new Set(doc.sizes.map(s => s.id));
  const missing = (seed as unknown as PricingDoc).sizes.filter(s => s.id in EXPANDED_FRAMES && !present.has(s.id));
  return {...doc, sizes: [...doc.sizes, ...structuredClone(missing)].sort((a,b) => a.width-b.width || a.length-b.length)};
}
