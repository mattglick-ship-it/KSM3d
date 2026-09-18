import type {SupabaseClient} from '@supabase/supabase-js';
export function activityDays(now=new Date()){
 const end=new Date(now);end.setHours(0,0,0,0);
 return Array.from({length:30},(_,i)=>{const date=new Date(end);date.setDate(date.getDate()-29+i);return {start:date.toISOString(),label:date.toLocaleDateString('en-US',{month:'short',day:'numeric'}),count:0}});
}
export async function loadQuoteActivity(db:SupabaseClient,now=new Date()){
 const days=activityDays(now);
 const totalResult=await db.from('ksm_pavilion_quotes').select('id',{count:'exact',head:true});
 if(totalResult.error)throw totalResult.error;
 let offset=0;
 // Page the full date range; the latest-500 table is not the analytics source.
 while(true){
  const {data,error}=await db.from('ksm_pavilion_quotes').select('id,created_at').gte('created_at',days[0].start).lte('created_at',now.toISOString()).order('created_at').order('id').range(offset,offset+999);
  if(error)throw error;
  for(const row of data??[]){const time=Date.parse(row.created_at);const index=days.findLastIndex(day=>time>=Date.parse(day.start));if(index>=0)days[index].count++}
  if(!data||data.length<1000)break;
  offset+=data.length;
 }
 return {total:totalResult.count??0,days,last30:days.reduce((sum,d)=>sum+d.count,0),last7:days.slice(-7).reduce((sum,d)=>sum+d.count,0)};
}
export type QuoteActivity=Awaited<ReturnType<typeof loadQuoteActivity>>;
