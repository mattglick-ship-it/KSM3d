import {createClient,type SupabaseClient} from '@supabase/supabase-js';
let client:SupabaseClient|undefined;
export function supabase(){
 if(!client)client=createClient('https://aymeshzwwffwvccwvzro.supabase.co','sb_publishable_OPE30brknIJJBlCQHBY71g_PS6heEfH',{auth:{storageKey:'ksm-pavilion-auth',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
 return client;
}
