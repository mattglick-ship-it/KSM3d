"use client";
import {useEffect,useMemo,useRef,useState} from 'react';
import {z} from 'zod';
import {toast} from 'sonner';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Textarea} from '@/components/ui/textarea';
import {Checkbox} from '@/components/ui/checkbox';
import {RadioGroup,RadioGroupItem} from '@/components/ui/radio-group';
import {customerSchema,pavilionSummary,designLink,DEPOSIT,type QuoteCustomer} from '@/lib/pavilion-commerce';
import {usePricing} from './published-settings';
import {notifyQuoteParent,quoteEmbedPayload} from '@/lib/pavilion-embed';
import type {Design} from './designer-model';

async function api(path:string,body:unknown){
 const response=await fetch('/api/pavilion/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const data=z.record(z.unknown()).parse(await response.json());if(!response.ok||data.error)throw new Error(typeof data.error==='string'?data.error:'Please try again.');return data;
}

export function QuoteCheckout({open,onOpenChange,design,intent,capture}:{open:boolean;onOpenChange:(v:boolean)=>void;design:Design;intent:'quote'|'order';capture:()=>string|undefined}){
 const pricing=usePricing();
 const [notice,setNotice]=useState('');
 const [customer,setCustomer]=useState<QuoteCustomer>({name:'',email:'',phone:'',fulfillment:'pickup',address:'',notes:'',sendCopyToCustomer:true});
 const [projectName,setProjectName]=useState('My KSM pavilion'),[pdf,setPdf]=useState(true),[busy,setBusy]=useState(false),[saved,setSaved]=useState(false),[error,setError]=useState('');
 const [shipping,setShipping]=useState<{miles:number;cost:number;outOfRange:boolean}|null>(null),[shippingBusy,setShippingBusy]=useState(false),[shippingError,setShippingError]=useState('');
 const shippingRequest=useRef(0),savedFingerprint=useRef(''),attemptFingerprint=useRef(''),notifiedSubmission=useRef(''),submission=useRef('');
 const summary=useMemo(()=>pavilionSummary(design,projectName,pricing),[design,projectName,pricing]);
 const update=<K extends keyof QuoteCustomer>(key:K,value:QuoteCustomer[K])=>{setCustomer(c=>({...c,[key]:value}));setSaved(false);setError('');if(key==='address'||key==='fulfillment'){shippingRequest.current++;setShipping(null);setShippingBusy(false);setShippingError('')}};
 useEffect(()=>{if(open){setSaved(false);setError('');setNotice('');setCustomer(c=>({...c,notes:c.notes||design.notes}))}},[open,intent]);
 async function estimateDelivery(){const id=++shippingRequest.current;setShippingBusy(true);setShippingError('');try{const data=z.object({miles:z.number().nonnegative(),cost:z.number().nonnegative(),outOfRange:z.boolean()}).parse(await api('shipping',{address:customer.address}));if(id===shippingRequest.current)setShipping(data)}catch(e){if(id===shippingRequest.current)setShippingError(e instanceof Error?e.message:'KSM can quote delivery.')}finally{if(id===shippingRequest.current)setShippingBusy(false)}}
 async function downloadPdf(){
  const {downloadQuotePdf}=await import('@/lib/pavilion-quote-pdf');
  downloadQuotePdf({projectName,customer:{...customer,fulfillment:customer.fulfillment==='pickup'?'Pickup at KSM Log Homes':customer.address},quote:summary});
 }
 async function submit(mode:'quote'|'order'){
  const parsed=customerSchema.safeParse(customer);if(!parsed.success){setError(parsed.error.issues[0].message);return}
  if(!projectName.trim()){setError('Enter a project name.');return}
  setBusy(true);setError('');
  try{
   const fingerprint=JSON.stringify({design,customer:parsed.data,projectName});
   if(savedFingerprint.current!==fingerprint){
    if(attemptFingerprint.current!==fingerprint){submission.current=crypto.randomUUID();attemptFingerprint.current=fingerprint;}
    if(notifiedSubmission.current!==submission.current){notifyQuoteParent(quoteEmbedPayload(design,parsed.data,summary,submission.current));notifiedSubmission.current=submission.current;}
    const screenshot=capture();
    const result=await api('quote',{design,customer:parsed.data,projectName,submissionId:submission.current,...(screenshot&&screenshot.length<1800000?{screenshot}:{})});setNotice(typeof result.notice==='string'?result.notice:'');
    savedFingerprint.current=fingerprint;setSaved(true);
    if(pdf){try{await downloadPdf()}catch{toast.error('Quote saved, but the PDF could not be downloaded.')}}
   }
   if(mode==='order'){
    const result=z.object({url:z.string().url(),orderId:z.string().min(1)}).parse(await api('checkout',{design,customer:parsed.data,projectName,submissionId:submission.current}));
    try{sessionStorage.setItem('ksm-pending-payment',JSON.stringify({orderId:result.orderId,design}));}catch{}
    window.location.assign(result.url);
   }else{setSaved(true);toast.success('Quote saved with KSM.');}
  }catch(e){setError((savedFingerprint.current?'Your quote is saved. ':'')+(e instanceof Error?e.message:'Please try again.'));}finally{setBusy(false)}
 }
 return <Dialog open={open} onOpenChange={v=>{if(!busy)onOpenChange(v)}}><DialogContent className="quote-dialog"><DialogHeader><DialogTitle>{intent==='order'?'Order your pavilion':'Save your pavilion quote'}</DialogTitle><DialogDescription>{summary.size} · {summary.trussStyle} · Eastern White Pine</DialogDescription></DialogHeader>
 <form onSubmit={e=>{e.preventDefault();void submit(intent)}} className="quote-form">
 <div className="quote-price"><span>Estimated pavilion</span><strong>{summary.total}</strong><small>{summary.priceNote}</small></div>
 <label>Project name<Input value={projectName} onChange={e=>{setProjectName(e.target.value);setSaved(false)}} maxLength={120} required/></label>
 <label>Name<Input autoComplete="name" value={customer.name} onChange={e=>update('name',e.target.value)} maxLength={120} required/></label>
 <div className="quote-fields"><label>Email<Input type="email" autoComplete="email" value={customer.email} onChange={e=>update('email',e.target.value)} maxLength={255} required/></label><label>Phone<Input type="tel" autoComplete="tel" value={customer.phone} onChange={e=>update('phone',e.target.value)} maxLength={40} required/></label></div>
 <fieldset><legend>Delivery or pickup</legend><RadioGroup value={customer.fulfillment} onValueChange={v=>update('fulfillment',v as QuoteCustomer['fulfillment'])} className="quote-fulfillment"><label><RadioGroupItem value="pickup"/>Pickup at KSM</label><label><RadioGroupItem value="delivery"/>Delivery</label></RadioGroup></fieldset>
 {customer.fulfillment==='delivery'&&<div className="delivery-fields"><label>Delivery address<Textarea autoComplete="street-address" value={customer.address} onChange={e=>update('address',e.target.value)} maxLength={500} required/></label><Button type="button" variant="outline" disabled={shippingBusy||customer.address.trim().length<5} onClick={estimateDelivery}>{shippingBusy?'Calculating…':'Estimate delivery'}</Button>{shipping&&<p>{shipping.outOfRange?'This address is beyond 200 miles. KSM will provide a delivery quote.':`Estimated delivery: $${shipping.cost.toLocaleString()} · ${Math.round(shipping.miles)} miles`}</p>}{shippingError&&<p role="status">Delivery estimate unavailable. You can still request a quote from KSM.</p>}</div>}
 <label>Notes<Textarea value={customer.notes} onChange={e=>update('notes',e.target.value)} rows={2} maxLength={2000}/></label>
 <label className="quote-check"><Checkbox checked={customer.sendCopyToCustomer} onCheckedChange={v=>update('sendCopyToCustomer',v===true)}/>Email a copy of this quote to me</label>
 <label className="quote-check"><Checkbox checked={pdf} onCheckedChange={v=>setPdf(v===true)}/>Download a PDF after saving</label>
 <p className="quote-note">Your quote is saved with KSM.{customer.sendCopyToCustomer?' An email copy will be requested.':''} Estimated lead time: 4–6 weeks from order confirmation.</p>
 {intent==='order'&&<div className="deposit-details"><strong>${DEPOSIT.toLocaleString()} down payment</strong><p>Pay securely through KSM’s Square checkout using the payment methods offered there. Your deposit applies toward the pavilion total. Tax and delivery are settled with the final balance.</p></div>}
 {summary.pending.length>0&&<p className="quote-note">KSM will confirm pricing for: {summary.pending.join(', ')}.</p>}
 {error&&<p role="alert" className="quote-error">{error}</p>}{saved&&intent==='quote'&&<p role="status" className="quote-success">{notice||'Your quote is saved with KSM. We’ll follow up with you.'}</p>}
 <div className="quote-actions"><Button type="button" variant="outline" disabled={busy} onClick={()=>onOpenChange(false)}>Close</Button><Button type="submit" disabled={busy||(saved&&intent==='quote')}>{busy?'Please wait…':intent==='order'?'Continue to Square · $2,500':'Save quote with KSM'}</Button></div>
 <div className="quote-secondary"><Button type="button" variant="ghost" onClick={()=>downloadPdf().catch(()=>toast.error('Could not create the PDF.'))}>Download PDF only</Button><Button type="button" variant="ghost" onClick={()=>navigator.clipboard.writeText(designLink(design)).then(()=>toast.success('Design link copied.')).catch(()=>toast.error('Could not copy the link.'))}>Copy design link</Button></div>
 </form></DialogContent></Dialog>;
}

export function PaymentReturn(){
 const [message,setMessage]=useState('');
 useEffect(()=>{
  const url=new URL(window.location.href);if(url.searchParams.get('checkout')!=='return')return;
  let active=true;setMessage('Checking your payment with Square…');
  try{const pending=JSON.parse(sessionStorage.getItem('ksm-pending-payment')||'null');if(!pending?.orderId){setMessage('Your payment status will be confirmed by KSM. Check your Square receipt.');return}
   api('payment-status',{orderId:pending.orderId}).then(result=>{if(active){setMessage(result.paid?'Your $2,500 pavilion down payment is confirmed. KSM will follow up with your order details.':'Payment is awaiting confirmation. Check your Square receipt before trying again.');if(result.paid)sessionStorage.removeItem('ksm-pending-payment')}}).catch(()=>{if(active)setMessage('Payment confirmation is still pending. Check your Square receipt or contact KSM before paying again.')});
  }catch{setMessage('Check your Square receipt or contact KSM for payment confirmation.');}
  return()=>{active=false};
 },[]);
 return message?<div className="payment-return" role="status">{message}<button aria-label="Dismiss payment status" onClick={()=>setMessage('')}>×</button></div>:null;
}
