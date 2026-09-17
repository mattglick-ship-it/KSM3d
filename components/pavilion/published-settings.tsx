"use client";
import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import {PAVILION_BAKED_DEFAULTS} from '@/lib/pavilionBakedDefaults';
import {getPavilionDefaults} from '@/lib/pavilion-defaults.functions';
import {loadPricing,SEED_DOC} from '@/lib/pricing/store';
export const DefaultsContext=createContext<Record<string,string>>(PAVILION_BAKED_DEFAULTS);
const PricingContext=createContext(SEED_DOC);
export const usePricing=()=>useContext(PricingContext);
export function PublishedSettings({children}:{children:ReactNode}){
 const [defaults,setDefaults]=useState(PAVILION_BAKED_DEFAULTS),[pricing,setPricing]=useState(SEED_DOC),[error,setError]=useState('');
 useEffect(()=>{let active=true;async function refresh(){try{const [d,p]=await Promise.all([getPavilionDefaults(),loadPricing()]);if(active){setDefaults({...PAVILION_BAKED_DEFAULTS,...d.data});setPricing(p);setError('')}}catch{if(active)setError('Live settings are unavailable. Showing the saved catalog estimate.')}}void refresh();window.addEventListener('focus',refresh);return()=>{active=false;window.removeEventListener('focus',refresh)}},[]);
 return <DefaultsContext.Provider value={defaults}><PricingContext.Provider value={pricing}>{error&&<div className="settings-notice" role="status">{error}</div>}{children}</PricingContext.Provider></DefaultsContext.Provider>;
}
