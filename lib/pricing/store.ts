import {supabase} from '@/lib/supabase';
import seed from './catalog.json';
import type {PricingDoc} from './types';
import {withExpandedSizes} from './with-expanded-sizes';
export const SEED_DOC=seed as unknown as PricingDoc;
export async function loadPricing():Promise<PricingDoc>{
 const {data,error}=await supabase().from('ksm_pavilion_settings').select('data').eq('id','pricing').maybeSingle();
 if(error)throw error;
 return withExpandedSizes(data?.data??SEED_DOC);
}
export async function savePricing(doc:PricingDoc){
 if(!doc?.sizes?.length||!doc.options)throw new Error('A pricing catalog must contain sizes and options.');
 for(const size of doc.sizes)for(const value of Object.values(size.basePriceByRoof))if(typeof value!=='number'||!Number.isFinite(value)||value<0)throw new Error('Prices must be nonnegative numbers.');
 const normalized={...doc,options:{...doc.options,height:{...doc.options.height,offeredHeights:[8,9,10]}}};
 const {error}=await supabase().from('ksm_pavilion_settings').upsert({id:'pricing',data:normalized,updated_at:new Date().toISOString()});
 if(error)throw error;
}
