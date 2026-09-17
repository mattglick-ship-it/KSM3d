import {loadPricing} from '@/lib/pricing/store';
import {quoteRequestSchema,pavilionSummary,DEPOSIT} from '@/lib/pavilion-commerce';
import {readCommerceRequest,commerceError} from '@/lib/commerce-request.server';
import {ksmService} from '@/lib/ksm-service.server';
export async function POST(request:Request){try{
 const {design,customer,projectName,submissionId}=quoteRequestSchema.parse(await readCommerceRequest(request));
 const summary=pavilionSummary(design,projectName,await loadPricing());
 const returnUrl=new URL('/?checkout=return',request.url).toString();
 const result=await ksmService('square-checkout',{items:[{inventoryItemId:`pavilion-downpayment-${submissionId}`,name:`Pavilion Down Payment — ${summary.model}`,sku:'PAVILION-DEPOSIT-2500',variantLabel:customer.email,quantity:1,unitPrice:DEPOSIT}],taxExempt:true,returnUrl,notes:`Pavilion quote ${submissionId}. ${summary.size}; ${summary.postHeight} posts; ${summary.timberFinish}; ${summary.roofMaterial}.`,shipping:{method:customer.fulfillment,address:customer.fulfillment==='delivery'?customer.address:undefined},customer:{name:customer.name,email:customer.email,phone:customer.phone,address:customer.fulfillment==='delivery'?customer.address:undefined}});
 const checkoutUrl=result.url||result.checkoutUrl;
 if(typeof checkoutUrl!=="string"||typeof result.squareOrderId!=="string")throw new Error("Invalid checkout response");
 const url=new URL(checkoutUrl);
 if(url.protocol!=='https:'||!['square.link','checkout.square.site','squareup.com','checkout.squareupsandbox.com'].some(host=>url.hostname===host||url.hostname.endsWith('.'+host)))throw new Error('KSM returned an unexpected checkout address.');
 return Response.json({url:url.toString(),orderId:result.squareOrderId});
}catch(error){return commerceError(error)}}
