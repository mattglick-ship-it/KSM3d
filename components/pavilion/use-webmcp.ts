import {useEffect,useRef} from 'react';
import {designSchema,type Design} from './designer-model';
export function usePavilionTools(design:Design,setDesign:(d:Design)=>void,total:number,pending:string[]){
 const state=useRef({design,total,pending});state.current={design,total,pending};
 useEffect(()=>{const api=(document as any).modelContext;if(!api?.registerTool)return;const lifecycle=new AbortController();const register=(tool:unknown)=>{try{Promise.resolve(api.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{})}catch{}};
 register({name:'get_pavilion_design',title:'Read pavilion design',description:'Read the current KSM pavilion design and estimated price.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:async()=>state.current});
 register({name:'set_pavilion_design',title:'Update pavilion design',description:'Apply a complete validated pavilion design. Does not save an account record or place an order.',inputSchema:{type:'object',properties:{design:{type:'object'}},required:['design'],additionalProperties:false},annotations:{readOnlyHint:false},execute:async(input:unknown)=>{const value=input&&typeof input==='object'?(input as {design:unknown}).design:null;const result=designSchema.safeParse(value);if(!result.success)return {error:'Invalid KSM pavilion design',details:result.error.issues.map(i=>i.message)};setDesign(result.data);await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));return {updated:true,design:state.current.design};}});
 return()=>lifecycle.abort();},[setDesign]);
}
