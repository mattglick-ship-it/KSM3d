"use client";
import type {Dispatch,SetStateAction} from 'react';
import {Switch} from '@/components/ui/switch';
import {Button} from '@/components/ui/button';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
import {furnitureItems,furnitureBounds,type FurnitureId,type FurnitureLayout} from './furniture-layout';
import type {Design} from './designer-model';

export function FurnitureControls({design,onChange}:{design:Design;onChange:Dispatch<SetStateAction<Design>>}){
 const change=(id:FurnitureId,patch:Partial<FurnitureLayout[FurnitureId]>)=>onChange(d=>({...d,furnitureLayout:{...d.furnitureLayout,[id]:{...d.furnitureLayout[id],...patch}}}));
 return <div className="furniture-controls">{furnitureItems.map(({id,name})=>{
  const p=design.furnitureLayout[id],bounds=furnitureBounds(design.config,id,p.rotation);
  return <section className="furniture-item" key={id}><label className="toggle-row"><strong>{name}</strong><Switch aria-label={name} checked={p.enabled} onCheckedChange={enabled=>change(id,{enabled})}/></label>{p.enabled&&<div className="placement-controls">
   <label>Left / right <output>{Math.round(p.x)}″</output><input aria-label={`${name}: left / right`} type="range" min={-bounds.x} max={bounds.x} step="any" value={p.x} onChange={e=>change(id,{x:Number(e.target.value)})}/></label>
   <label>Front / back <output>{Math.round(p.z)}″</output><input aria-label={`${name}: front / back`} type="range" min={-bounds.z} max={bounds.z} step="any" value={p.z} onChange={e=>change(id,{z:Number(e.target.value)})}/></label>
   <label>Rotation <output>{p.rotation}°</output><input aria-label={`${name}: rotation`} type="range" min={0} max={360} step={5} value={p.rotation} onChange={e=>change(id,{rotation:Number(e.target.value)})}/></label>
   <Button variant="outline" size="sm" onClick={()=>change(id,{x:0,z:0,rotation:0})}>Reset placement</Button>
  </div>}</section>
 })}<section className="furniture-item"><label className="toggle-row"><strong>55″ TV</strong><Switch aria-label="55-inch TV" checked={design.tv.enabled} onCheckedChange={enabled=>onChange(d=>({...d,tv:{...d.tv,enabled}}))}/></label>{design.tv.enabled&&<div className="placement-controls"><label className="field-label">Mounting corner<Select value={design.tv.corner} onValueChange={corner=>onChange(d=>({...d,tv:{...d.tv,corner:corner as Design['tv']['corner']}}))}><SelectTrigger aria-label="TV mounting corner"><SelectValue/></SelectTrigger><SelectContent>{[['fl','Front left'],['fr','Front right'],['br','Back right'],['bl','Back left']].map(([id,name])=><SelectItem key={id} value={id}>{name}</SelectItem>)}</SelectContent></Select></label><label>Mounting height <output>{design.tv.height}′</output><input aria-label="TV mounting height" type="range" min={5} max={design.config.height-2} step={0.25} value={design.tv.height} onChange={e=>onChange(d=>({...d,tv:{...d.tv,height:Number(e.target.value)}}))}/></label></div>}</section></div>;
}
