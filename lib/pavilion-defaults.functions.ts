import {supabase} from '@/lib/supabase';
export async function getPavilionDefaults(){
 const {data,error}=await supabase().from('ksm_pavilion_settings').select('data,updated_at').eq('id','defaults').maybeSingle();
 if(error)throw error;
 return {data:data?.data as Record<string,string>|null,updatedAt:data?.updated_at??null};
}
export async function publishPavilionDefaults(input:{data:{data:Record<string,string>}}){
 const data:Record<string,string>={};
 for(const [key,value] of Object.entries(input.data.data))if(key.startsWith('pav.')&&typeof value==='string'){JSON.parse(value);data[key]=value}
 const {error}=await supabase().from('ksm_pavilion_settings').upsert({id:'defaults',data,updated_at:new Date().toISOString()});
 if(error)throw error;
 return {ok:true,count:Object.keys(data).length};
}
