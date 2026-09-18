import seed from './catalog.json';
import {EXPANDED_FRAMES} from '../pavilion-layout';
import type {PricingDoc} from './types';

/** Adopt the approved workbook bases once for additions only. Original rows and
 * option overrides stay intact. After adoption, admin edits (including blanks)
 * remain authoritative. Loading never writes back to the published catalog. */
export function withExpandedSizes(doc: PricingDoc): PricingDoc {
  const approved = seed as unknown as PricingDoc;
  const revision = approved.meta.workbookPricingRevision;
  const adopt = doc.meta.workbookPricingRevision !== revision;
  const additions = approved.sizes.filter(s=>s.id in EXPANDED_FRAMES);
  const present = new Set(doc.sizes.map(s=>s.id));
  const sizes = doc.sizes.map(row=>{
    const source=adopt ? additions.find(s=>s.id===row.id) : undefined;
    if(!source)return row;
    return {...row,basePriceByRoof:{...source.basePriceByRoof},baseTrussStyle:source.baseTrussStyle,
      dataIssue:source.dataIssue,status:source.status,sourceSheet:source.sourceSheet,sourceCells:source.sourceCells};
  });
  return {...doc,meta:{...doc.meta,workbookPricingRevision:revision},
    sizes:[...sizes,...structuredClone(additions.filter(s=>!present.has(s.id)))].sort((a,b)=>a.width-b.width||a.length-b.length)};
}
