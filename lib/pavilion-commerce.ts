import {z} from 'zod';
import {designSchema,stainName,type Design} from '@/components/pavilion/designer-model';
import {TRUSS_STYLES,WOOD_FINISHES,ROOF_MATERIALS} from './pavilion-config';
import {computeQuote,selectionFromConfig,fmtUSD} from './pricing/engine';
import catalog from './pricing/catalog.json';
import type {PricingDoc} from './pricing/types';
export const DEPOSIT=2500;
export const customerSchema=z.object({name:z.string().trim().min(1,'Enter your name').max(120),email:z.string().trim().email('Enter a valid email').max(255),phone:z.string().trim().min(5,'Enter your phone number').max(40),fulfillment:z.enum(['pickup','delivery']),address:z.string().trim().max(500),notes:z.string().trim().max(2000),sendCopyToCustomer:z.boolean().default(true)}).refine(c=>c.fulfillment==='pickup'||c.address.length>=5,{message:'Enter a delivery address',path:['address']});
export type QuoteCustomer=z.infer<typeof customerSchema>;
export const quoteRequestSchema=z.object({design:designSchema,customer:customerSchema,projectName:z.string().trim().min(1).max(120),submissionId:z.string().uuid(),screenshot:z.string().max(1800000).regex(/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/).optional()});
export function pavilionSummary(design:Design,projectName='My KSM pavilion',pricing:PricingDoc=catalog as unknown as PricingDoc){
 const c=design.config,roof=ROOF_MATERIALS.find(x=>x.id===c.roofId)!;
 const quote=computeQuote(selectionFromConfig(c,{beamStained:!!design.tableStain,deckStained:!!design.deckStain}),pricing);
 const pending=quote.callForPricing;
 return {projectName,model:`${TRUSS_STYLES.find(x=>x.id===c.truss)?.name} Pavilion Package`,trussStyle:TRUSS_STYLES.find(x=>x.id===c.truss)?.name,roofStyle:'Gable',size:`${c.width} × ${c.length} ft`,postHeight:`${c.height} ft`,species:'Eastern White Pine',timberFinish:WOOD_FINISHES.find(x=>x.id===c.woodId)?.name,beamStain:stainName(design.tableStain),deckboardStain:stainName(design.deckStain),roofMaterial:`${roof.type==='standing-seam'?'Standing seam':roof.type==='metal'?'Ribbed metal':'Shingles'} — ${roof.name}`,rafterTail:c.rafterTail==='scroll'?'Scroll cut':'Standard',snowGuards:c.snowGuards,snowRail:!!c.snowRail,upgrades:[c.trussPlates?'Decorative truss plates':null,c.gableFascia?'Gable faceboard':null,c.snowGuards?'Snow guards':null,c.snowRail?'Snow rail':null].filter(Boolean) as string[],lineItems:quote.lines.map(l=>({label:l.label,amount:fmtUSD(l.amount)})),total:pending.some(label=>label.startsWith('Base price'))?'To be quoted':fmtUSD(quote.total),totalAmount:quote.total,priceNote:pending.some(label=>label.startsWith('Base price'))?'Pavilion price requires confirmation':pending.length?'Estimate · some options require a quote':'Estimate · excludes tax and delivery',pending,leadTime:'4–6 weeks from order confirmation'};
}
export function designLink(design:Design){
 const url=new URL(window.location.href);url.search='';url.hash='design='+btoa(encodeURIComponent(JSON.stringify({...design,notes:''})));
 return url.toString();
}
export function decodeDesignHash(hash:string):Design|null{
 if(!hash.startsWith('#design='))return null;
 if(hash.length>30000)throw new Error('This design link is too large.');
 const raw=JSON.parse(decodeURIComponent(atob(hash.slice(8))));
 // Compatibility with original Lovable links that contained only a config.
 return designSchema.parse(raw.version?raw:{version:1,config:raw,tableStain:null,deckStain:null,notes:'',furniture:'none'});
}
