import {createClient} from 'npm:@supabase/supabase-js@2.116.0';
// Only the standalone server knows the random key whose SHA-256 is below.
const KEY_HASH='3337c421f797c5d12d22eb1959bb8a204d201849a3f5424b273254474d911c83';
const LEGACY_URL='https://iumyjqupqicybpuzzzoy.supabase.co/functions/v1/';
const LEGACY_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1bXlqcXVwcWljeWJwdXp6em95Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MjE2MTIsImV4cCI6MjA4NzQ5NzYxMn0.nhWqyNMSPLuF5O_ROJtH-ZN5PjDdkdqk8eauzDT08aI';
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
async function upstream(name:string,body:unknown){
 const response=await fetch(LEGACY_URL+name,{method:'POST',headers:{'Content-Type':'application/json',apikey:LEGACY_KEY,Authorization:'Bearer '+LEGACY_KEY},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
 const data=await response.json();if(!response.ok||data.error)throw new Error(typeof data.error==='string'?data.error:'KSM service temporarily unavailable');return data;
}
Deno.serve(async req=>{
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 const secret=req.headers.get('x-ksm-service-key')??'';
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(secret)))).map(n=>n.toString(16).padStart(2,'0')).join('');
 if(digest!==KEY_HASH)return json({error:'Unauthorized'},401);
 try{
  const text=await req.text();if(text.length>2000000)return json({error:'Request too large'},413);
  const {name,body}=JSON.parse(text);
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
  if(name==='calculate-shipping')return json(await upstream(name,{address:body.address}));
  if(name==='capture-pavilion-lead'){
   const c=body.config,id=body.submissionId;
   const sendCopyToCustomer=c?.emailCopyRequested!==false;
   if(!/^[0-9a-f-]{36}$/i.test(id)||!c?.design||!c?.summary||typeof body.email!=='string')return json({error:'Invalid quote'},400);
   const {data:existing,error:readError}=await db.from('ksm_pavilion_quotes').select('service_status,email_status').eq('id',id).maybeSingle();if(readError)throw readError;
   if(existing)return json({success:true,reference:id,emailStatus:existing.email_status});
   const {error:insertError}=await db.from('ksm_pavilion_quotes').insert({id,project_name:c.summary.projectName,customer:{name:body.name,email:body.email,phone:body.phone,address:c.deliveryAddress??'',notes:c.notes??'',fulfillment:c.fulfillment,sendCopyToCustomer},design:c.design,summary:c.summary,delivery:c.delivery??null,service_status:'pending',email_status:sendCopyToCustomer?'pending':'not_requested'});
   if(insertError){if(insertError.code==='23505')return json({success:true,reference:id,emailStatus:'unconfirmed'});throw insertError}
   try{
    const result=await upstream(name,body);if(result.success!==true)throw new Error('Quote receipt unconfirmed');
    await db.from('ksm_pavilion_quotes').update({service_status:'accepted',email_status:sendCopyToCustomer?'requested':'not_requested',updated_at:new Date().toISOString()}).eq('id',id);
    return json({success:true,reference:id,emailStatus:sendCopyToCustomer?'requested':'not_requested'});
   }catch{
    await db.from('ksm_pavilion_quotes').update({service_status:'uncertain',email_status:sendCopyToCustomer?'unconfirmed':'not_requested',updated_at:new Date().toISOString()}).eq('id',id);
    return json({success:true,reference:id,emailStatus:sendCopyToCustomer?'unconfirmed':'not_requested',notice:'Your quote is saved with KSM. We’ll follow up with you.'});
   }
  }
  if(name==='square-checkout'){
   const id=String(body.items?.[0]?.inventoryItemId??'').replace(/^pavilion-downpayment-/,'');
   const {data:quote,error}=await db.from('ksm_pavilion_quotes').select('id,customer,checkout_url,square_order_id,payment_status').eq('id',id).single();if(error||!quote)return json({error:'Save your quote before paying.'},400);
   if(quote.payment_status==='paid')return json({error:'This deposit is already paid. Contact KSM before making another payment.'},409);
   if(quote.checkout_url&&quote.square_order_id)return json({checkoutUrl:quote.checkout_url,squareOrderId:quote.square_order_id});
   if(quote.payment_status==='creating')return json({error:'Your checkout is being confirmed. Contact KSM before retrying.'},409);
   const {data:locked,error:lockError}=await db.from('ksm_pavilion_quotes').update({payment_status:'creating'}).eq('id',id).eq('payment_status','not_started').select('id').maybeSingle();if(lockError||!locked)return json({error:'Checkout is already in progress.'},409);
   // Fixed deposit is enforced again at the service boundary.
   const item={...body.items[0],quantity:1,unitPrice:2500,sku:'PAVILION-DEPOSIT-2500'};
   try{
    const result=await upstream(name,{...body,items:[item],taxExempt:true,shipping:{method:body.shipping?.method,address:body.shipping?.address},customer:quote.customer});
    const checkoutUrl=result.checkoutUrl??result.url;
    const url=new URL(checkoutUrl);if(url.protocol!=='https:'||!['square.link','squareup.com','checkout.square.site','checkout.squareupsandbox.com'].some(h=>url.hostname===h||url.hostname.endsWith('.'+h)))throw new Error('Unexpected checkout URL');
    if(typeof result.squareOrderId!=='string')throw new Error('Missing Square order');
    const {error:updateError}=await db.from('ksm_pavilion_quotes').update({checkout_url:checkoutUrl,square_order_id:result.squareOrderId,payment_status:'pending',updated_at:new Date().toISOString()}).eq('id',id);if(updateError)throw updateError;
    return json(result);
   }catch{return json({error:'Checkout confirmation is pending. Contact KSM before trying another deposit.'},502)}
  }
  if(name==='square-confirm-order'){
   const {data:quote}=await db.from('ksm_pavilion_quotes').select('id').eq('square_order_id',body.orderId).maybeSingle();if(!quote)return json({ok:false,status:'unknown'});
   // Never forward a caller-supplied force flag.
   const result=await upstream(name,{orderId:body.orderId});
   if(result.ok===true&&['paid','fulfilled'].includes(result.status))await db.from('ksm_pavilion_quotes').update({payment_status:'paid',status:'ordered',updated_at:new Date().toISOString()}).eq('id',quote.id);
   return json(result);
  }
  return json({error:'Unknown operation'},400);
 }catch{return json({error:'KSM service is temporarily unavailable. Please try again later.'},502)}
});
