import type {Design} from '@/components/pavilion/designer-model';
import type {QuoteCustomer,pavilionSummary} from './pavilion-commerce';

export function quoteEmbedPayload(design:Design,customer:QuoteCustomer,quote:ReturnType<typeof pavilionSummary>,submissionId:string){
 return {type:'ksm:quote-request',submissionId,customer:{...customer,fulfillment:customer.fulfillment==='pickup'?'Pickup at KSM Log Homes':customer.address},quote,config:design.config,design};
}
export function notifyQuoteParent(payload:ReturnType<typeof quoteEmbedPayload>){
 if(window.parent===window)return;
 // Address only the embedding origin, never broadcast customer details.
 try {
  const parentUrl=document.referrer||window.location.ancestorOrigins?.[0];
  if(!parentUrl)return;
  const origin=new URL(parentUrl).origin;
  if(origin==='null')return;
  window.parent.postMessage(payload,origin);
 }catch{/* An embedding notification must not block saving a quote. */}
}
