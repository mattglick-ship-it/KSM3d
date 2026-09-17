"use client";
import {QuoteCheckout} from './quote-checkout';
import {initialDesign,designSchema} from './designer-model';
import type {PavilionConfig} from '@/lib/pavilion-config';
export function QuoteDialog({open,onOpenChange,config,tableStain,deckStain}:{open:boolean;onOpenChange:(v:boolean)=>void;config:PavilionConfig;projectName?:string;tableStain?:string|null;deckStain?:string|null}){
 const parsed=designSchema.safeParse({...initialDesign,config,tableStain:tableStain??null,deckStain:deckStain??null});
 if(!parsed.success)return open?<div role="alert">Choose a customer catalog size and 8, 9, or 10 foot posts before requesting a quote.<button onClick={()=>onOpenChange(false)}>Close</button></div>:null;
 return <QuoteCheckout open={open} onOpenChange={onOpenChange} design={parsed.data} intent="quote" capture={()=>document.querySelector('canvas')?.toDataURL('image/jpeg',.7)}/>;
}
