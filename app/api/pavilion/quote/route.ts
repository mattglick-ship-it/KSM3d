import {loadPricing} from '@/lib/pricing/store';
import {quoteRequestSchema,pavilionSummary} from '@/lib/pavilion-commerce';
import {readCommerceRequest,commerceError} from '@/lib/commerce-request.server';
import {ksmService} from '@/lib/ksm-service.server';
export async function POST(request:Request){try{
 const input=quoteRequestSchema.parse(await readCommerceRequest(request));
 const {design,customer,submissionId,projectName,screenshot}=input;
 const summary=pavilionSummary(design,projectName,await loadPricing());
 let delivery:{miles?:number;cost?:number;quoteRequired:boolean}|undefined;
 if(customer.fulfillment==='delivery'){try{const data=await ksmService('calculate-shipping',{address:customer.address});const miles=Number(data.miles),cost=Number(data.shippingCost);if(!Number.isFinite(miles)||miles<0||!Number.isFinite(cost)||cost<0)throw new Error('Invalid delivery');delivery={miles,...(miles<=200?{cost}:{}),quoteRequired:miles>200}}catch{delivery={quoteRequired:true}}}
 // Recompute the estimate here; no client-supplied price becomes quote authority.
 const config={...design.config,tableStain:design.tableStain,deckStain:design.deckStain,summary,delivery,modelName:summary.model,total:summary.totalAmount,fulfillment:customer.fulfillment,deliveryAddress:customer.fulfillment==='delivery'?customer.address:null,notes:customer.notes,emailCopyRequested:customer.sendCopyToCustomer,sendCopyToCustomer:customer.sendCopyToCustomer,submissionId,design,source:'ksm3d',...(screenshot?{screenshotDataUrl:screenshot}:{})};
 const result=await ksmService('capture-pavilion-lead',{type:'ksm:quote-request',name:customer.name,email:customer.email,phone:customer.phone,customer:{...customer,fulfillment:customer.fulfillment==='pickup'?'Pickup at KSM Log Homes':customer.address},quote:summary,config,submissionId});
 if(result.success!==true)throw new Error('KSM did not confirm that the quote was saved. Please try again.');
 return Response.json({success:true,reference:submissionId,summary,notice:result.notice,emailStatus:result.emailStatus});
}catch(error){return commerceError(error)}}
