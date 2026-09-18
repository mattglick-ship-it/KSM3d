import {useEffect,useState} from 'react';
import {expandedFrame} from '@/lib/pavilion-layout';
import type {PricingDoc} from '@/lib/pricing/types';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Card,CardContent,CardHeader,CardTitle} from '@/components/ui/card';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
import {toast} from 'sonner';

const fields = [
 ['basePriceByRoof','shingles','Shingle package'],['basePriceByRoof','metal','Ribbed-metal package'],['basePriceByRoof','standing_seam','Standing-seam package'],
 ['trussStyleUpgrade','arched_king','Arched King upgrade'],['trussStyleUpgrade','hammer','Hammer upgrade'],
 ['rafterTailUpgrade','scroll_cut','Scroll-cut tails'],['decorativeTrussPlates','upcharge','Decorative plates'],
 ['overhangFaceboard','upcharge','Gable faceboard'],['texturedMetalUpcharge','metal','Textured ribbed metal'],['texturedMetalUpcharge','standing_seam','Textured standing seam'],
] as const;

export function ExpandedSizePricing({doc,onSave,saving}:{doc:PricingDoc;onSave:(doc:PricingDoc)=>Promise<void>;saving:boolean}) {
 const sizes=doc.sizes.filter(s=>expandedFrame(s.width,s.length));
 const [id,setId]=useState(sizes[0]?.id??'');
 const [draft,setDraft]=useState<Record<string,string>>({});
 const size=sizes.find(s=>s.id===id);
 useEffect(()=>{if(!size)return;setDraft(Object.fromEntries(fields.map(([group,key])=>{
   const value=(size[group] as Record<string,unknown>|undefined)?.[key];
   return [group+'.'+key,typeof value==='number'?String(value):''];
 })))},[doc,id]);
 async function save(){
  const next=structuredClone(doc),row=next.sizes.find(s=>s.id===id)!;
  for(const [group,key] of fields){
   const raw=(draft[group+'.'+key]??'').trim(),value=raw===''?null:Number(raw);
   if(value!==null&&(!Number.isFinite(value)||value<0)){toast.error('Enter nonnegative amounts, or leave a price blank.');return}
   const target=row as unknown as Record<string,Record<string,unknown>>;
   target[group]={...target[group]};
   if(value===null)delete target[group][key];else target[group][key]=value;
  }
  await onSave(next);
 }
 if(!size)return null;
 return <Card><CardHeader><CardTitle>Added sizes — package and option prices</CardTitle></CardHeader><CardContent className="space-y-4">
  <p className="text-sm">Package prices start from the approved Excel totals. Edit confirmed prices here; blank package prices require a quote and cannot proceed to a deposit.</p>
  <Select value={id} onValueChange={setId}><SelectTrigger aria-label="Size to price"><SelectValue/></SelectTrigger><SelectContent>{sizes.map(s=><SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent></Select>
  {size.dataIssue&&<p className="text-sm text-amber-800">Source review: {size.dataIssue}</p>}
  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">{fields.map(([group,key,label])=><label key={group+key} className="text-sm">{group==='trussStyleUpgrade'&&key===size.baseTrussStyle?'Included base truss':label}<Input inputMode="decimal" aria-label={`${size.id} ${label}`} value={draft[group+'.'+key]??''} placeholder="To be quoted" disabled={(group==='decorativeTrussPlates'&&!!size.decorativeTrussPlates?.included)||(group==='trussStyleUpgrade'&&key===size.baseTrussStyle)} onChange={e=>setDraft(d=>({...d,[group+'.'+key]:e.target.value}))}/></label>)}</div>
  {size.decorativeTrussPlates?.included&&<p className="text-sm">Decorative plates are included in this size’s package price.</p>}
  <Button onClick={save} disabled={saving}>{saving?'Saving…':'Save size prices'}</Button>
 </CardContent></Card>;
}
