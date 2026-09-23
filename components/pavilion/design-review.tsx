"use client";
import {useEffect,useState,type Dispatch,type SetStateAction} from 'react';
import {ArrowLeft,Download,FileText,FolderOpen,Link,LoaderCircle,Pencil,Printer} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle} from '@/components/ui/dialog';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {toast} from 'sonner';
import {designLink,pavilionSummary,DEPOSIT,type QuoteCustomer} from '@/lib/pavilion-commerce';
import {usePricing} from './published-settings';
import type {Design} from './designer-model';
import {captureReviewDrawings,drawingKey,type PavilionDrawings} from './review-drawings';
import {PavilionPlan,renderPlanImage} from './review-plan';
import type {QuotePdfData} from '@/lib/pavilion-quote-pdf';
import './design-review.css';

export type ReviewContact={customer:QuoteCustomer;setCustomer:Dispatch<SetStateAction<QuoteCustomer>>;projectName:string;setProjectName:Dispatch<SetStateAction<string>>};
type Props=ReviewContact&{open:boolean;onOpenChange:(open:boolean)=>void;design:Design;specs:[string,string][];onNotes:(notes:string)=>void;onQuote:(intent:'quote'|'order')=>void;onSave:()=>void;onEdit:(step:number)=>void;onDrawings:(key:string,drawings:PavilionDrawings|null)=>void};
type DocumentSnapshot=Omit<QuotePdfData,'quote'|'drawings'|'specs'>&{quote:ReturnType<typeof pavilionSummary>;drawings:PavilionDrawings;specs:[string,string][]};
const drawingNote='Illustrative configuration only; not an engineered construction or foundation drawing. Use stated dimensions; do not scale these views.';
const planNote='Width is measured across the outside post faces. Length and bay dimensions follow end-post centers. Roof overhangs and furniture are omitted from this framing plan.';

function Specs({rows}:{rows:[string,string][]}){return <dl className="ksm-review-specs">{rows.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
function Views({drawings,elevations=false}:{drawings:PavilionDrawings;elevations?:boolean}){
 const views=elevations?([['front','Front'],['rear','Rear'],['left','Left side'],['right','Right side']] as const):([['perspective','Front perspective'],['rearPerspective','Rear perspective']] as const);
 return <div className={'ksm-review-views '+(elevations?'elevations':'perspectives')}>{views.map(([key,title])=><figure key={key}><img src={drawings[key]} alt={title+' of your pavilion'}/><figcaption>{title}</figcaption></figure>)}</div>;
}
function Prices({summary}:{summary:ReturnType<typeof pavilionSummary>}){return <div className="ksm-review-prices">{summary.lineItems.map((line,i)=><div key={i}><span>{line.label}</span><strong>{line.amount}</strong></div>)}<div className="ksm-review-total"><span>{summary.pending.some(x=>x.startsWith('Base price'))?'Pavilion price':summary.pending.length?'Priced subtotal':'Estimated total'}</span><strong>{summary.total}</strong></div>{summary.pending.length>0&&<div className="ksm-review-pending"><strong>To be quoted</strong><ul>{summary.pending.map(item=><li key={item}>{item}</li>)}</ul></div>}</div>}

export default function DesignReview({open,onOpenChange,design,specs,customer,setCustomer,projectName,setProjectName,onNotes,onQuote,onSave,onEdit,onDrawings}:Props){
 const pricing=usePricing(),summary=pavilionSummary(design,projectName,pricing),key=drawingKey(design);
 const [drawings,setDrawings]=useState<PavilionDrawings|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0),[documentData,setDocumentData]=useState<DocumentSnapshot|null>(null);
 useEffect(()=>{
  if(!open)return;
  const controller=new AbortController();setDrawings(null);setError('');onDrawings(key,null);
  void (async()=>{try{
   const views=await captureReviewDrawings(key,controller.signal),plan=await renderPlanImage(design.config);
   if(!controller.signal.aborted){const result={...views,plan};setDrawings(result);onDrawings(key,result)}
  }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Could not create the drawings. Please retry.')}})();
  return ()=>controller.abort();
 },[open,key,retry,onDrawings]);
 function update(field:'name'|'phone'|'email'|'address',value:string){setCustomer(c=>({...c,[field]:value}))}
 function openDocument(){if(drawings)setDocumentData({projectName,customer:{...customer,notes:design.notes,fulfillment:customer.fulfillment==='delivery'?`Delivery: ${customer.address||'Address to be confirmed'}`:'Pickup at KSM'},quote:summary,specs,drawings})}
 return <><Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="ksm-review-screen" showCloseButton={false} aria-describedby={undefined}>
  <header className="ksm-review-header"><Button variant="ghost" onClick={()=>onOpenChange(false)}><ArrowLeft size={18}/><span>Back to designer</span></Button><DialogTitle>Design review</DialogTitle><img src="/brand/ksm-logo.png" alt="KSM Log Homes Co."/></header>
  <div className="ksm-review-body">
   <section className="ksm-review-card"><div className="ksm-review-heading"><div><p className="ksm-review-eyebrow">YOUR PAVILION</p><h2>{summary.size} · {summary.trussStyle}</h2></div><Button variant="outline" onClick={()=>onEdit(0)}><Pencil size={16}/>Edit design</Button></div>
    <h3>Customer & project</h3><div className="ksm-review-fields"><label className="wide">Project name<Input value={projectName} onChange={e=>setProjectName(e.target.value)} maxLength={120}/></label><label>Name<Input autoComplete="name" value={customer.name} onChange={e=>update('name',e.target.value)} maxLength={120}/></label><label>Phone<Input autoComplete="tel" type="tel" value={customer.phone} onChange={e=>update('phone',e.target.value)} maxLength={40}/></label><label>Email<Input type="email" autoComplete="email" value={customer.email} onChange={e=>update('email',e.target.value)} maxLength={255}/></label><label>Pickup or delivery<select value={customer.fulfillment} onChange={e=>setCustomer(c=>({...c,fulfillment:e.target.value as QuoteCustomer['fulfillment']}))}><option value="pickup">Pickup at KSM</option><option value="delivery">Delivery</option></select></label>{customer.fulfillment==='delivery'&&<label className="wide">Delivery address<Input autoComplete="street-address" value={customer.address} onChange={e=>update('address',e.target.value)} maxLength={500}/></label>}</div>
   </section>
   <section className="ksm-review-card"><div className="ksm-review-heading"><div><h2>Your estimate</h2><p>{summary.priceNote}</p></div><strong className="ksm-review-amount">{summary.total}</strong></div><p>KSM confirms current pricing, delivery, installation, and tax before an order. Estimated lead time: {summary.leadTime}.</p>
    <div className="ksm-review-actions"><Button disabled={summary.pending.some(x=>x.startsWith('Base price'))} onClick={()=>onQuote('order')}>Order now · ${DEPOSIT.toLocaleString()} down</Button><Button variant="outline" onClick={()=>onQuote('quote')}>Save quote with KSM</Button><Button variant="outline" onClick={openDocument} disabled={!drawings}><FileText size={17}/>Save PDF / Print</Button></div>
    <details><summary>Price details</summary><Prices summary={summary}/></details>
    <div className="ksm-review-secondary"><Button variant="ghost" onClick={onSave}><FolderOpen size={17}/>My saved designs</Button><Button variant="ghost" onClick={()=>navigator.clipboard.writeText(designLink(design)).then(()=>toast.success('Design link copied.')).catch(()=>toast.error('Could not copy the link.'))}><Link size={17}/>Copy design link</Button></div>
   </section>
   <section className="ksm-review-card"><div className="ksm-review-heading"><h2>Pavilion views</h2><Button variant="ghost" onClick={()=>onEdit(2)}>Edit finishes</Button></div>
    {!drawings&&(error?<div role="alert" className="ksm-review-loading"><p>{error}</p><Button variant="outline" onClick={()=>setRetry(n=>n+1)}>Retry drawings</Button></div>:<div role="status" className="ksm-review-loading"><LoaderCircle className="animate-spin"/><p>Preparing your pavilion views and elevations…</p></div>)}
    {drawings&&<><Views drawings={drawings}/><h3>Exterior elevations</h3><Views drawings={drawings} elevations/><p className="ksm-review-note">All four elevations use the same scale. {design.config.width}′ width × {design.config.length}′ length · {design.config.height}′ post height. Roof overhangs extend beyond the nominal size.</p></>}
    <details open><summary>Dimensioned post & truss plan</summary><PavilionPlan config={design.config}/><p className="ksm-review-note">{planNote}</p></details><p className="ksm-review-note">{drawingNote}</p>
   </section>
   <section className="ksm-review-card"><div className="ksm-review-heading"><h2>Building specifications</h2><Button variant="ghost" onClick={()=>onEdit(0)}>Edit design</Button></div><Specs rows={specs}/><p className="ksm-review-note">Furniture, TV, and the patio pad are shown for scale in the designer and are not included in the pavilion price.</p><label className="ksm-review-notes">Notes for KSM<textarea value={design.notes} maxLength={2000} rows={4} onChange={e=>{onNotes(e.target.value);setCustomer(c=>({...c,notes:e.target.value}))}} placeholder="Your intended use, location, or questions…"/></label></section>
  </div>
 </DialogContent></Dialog>{documentData&&<ReviewDocument data={documentData} onClose={()=>setDocumentData(null)}/>}</>;
}

function ReviewDocument({data,onClose}:{data:DocumentSnapshot;onClose:()=>void}){
 const [busy,setBusy]=useState(false),drawings=data.drawings;
 async function download(){setBusy(true);try{const {downloadQuotePdf}=await import('@/lib/pavilion-quote-pdf');downloadQuotePdf(data)}catch{toast.error('Could not create the PDF. Please try again.')}finally{setBusy(false)}}
 async function print(){setBusy(true);try{await document.fonts.ready;await Promise.all(Array.from(document.querySelectorAll<HTMLImageElement>('.ksm-document-pages img')).map(img=>img.decode()));window.print()}catch{toast.error('Could not prepare the document. Try Download PDF.')}finally{setBusy(false)}}
 return <Dialog open onOpenChange={open=>{if(!open)onClose()}}><DialogContent className="ksm-review-screen ksm-document-screen" showCloseButton={false} aria-describedby={undefined}>
  <header className="ksm-review-header"><Button variant="ghost" onClick={onClose}><ArrowLeft size={18}/>Back to review</Button><DialogTitle>Your document</DialogTitle><div className="ksm-document-actions"><Button variant="outline" disabled={busy} onClick={download}><Download size={16}/>Download PDF</Button><Button disabled={busy} onClick={print}><Printer size={16}/>Print</Button></div></header>
  <div className="ksm-document-pages">
   <section className="ksm-document-page"><DocumentHeader title="Pavilion estimate"/><h2>{data.projectName}</h2><Specs rows={[["Name",data.customer.name||'Not entered'],["Email",data.customer.email||'Not entered'],["Phone",data.customer.phone||'Not entered'],["Pickup / delivery",data.customer.fulfillment]]}/><h3>Building specifications</h3><Specs rows={data.specs||[]}/><h3>Price details</h3><Prices summary={data.quote}/><p>KSM confirms final pricing, delivery, installation, and tax. This estimate does not place an order.</p>{data.customer.notes&&<><h3>Notes for KSM</h3><p className="ksm-document-notes">{data.customer.notes}</p></>}</section>
   <section className="ksm-document-page"><DocumentHeader title="Pavilion perspectives"/><Views drawings={drawings}/><p>{data.quote.size} · {data.quote.trussStyle} · {data.quote.postHeight} posts</p></section>
   <section className="ksm-document-page"><DocumentHeader title="Exterior elevations"/><Views drawings={drawings} elevations/><p>All four elevations use the same scale. Roof overhangs extend beyond the nominal pavilion size.</p><p>{drawingNote}</p></section>
   <section className="ksm-document-page"><DocumentHeader title="Dimensioned post & truss plan"/><img className="ksm-document-plan" src={drawings.plan} alt="Dimensioned pavilion post and truss plan"/><p>{planNote}</p><p>{drawingNote}</p></section>
  </div>
 </DialogContent></Dialog>;
}
function DocumentHeader({title}:{title:string}){return <div className="ksm-document-heading"><div><p>KSM LOG HOMES CO.</p><h2>{title}</h2></div><img src="/brand/ksm-logo.png" alt="KSM Log Homes Co."/></div>}
