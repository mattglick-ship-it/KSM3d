import {z} from 'zod';
import type {PavilionConfig} from '@/lib/pavilion-config';

export const furnitureItems=[{id:'picnic',name:'Picnic table',x:72,z:60},{id:'sectional',name:'Sectional seating',x:96,z:48},{id:'dining',name:'Dining table',x:72,z:38},{id:'patio',name:'Patio sofa set',x:96,z:84},{id:'grill',name:'Kamado grill',x:48,z:48}] as const;
export type FurnitureId=typeof furnitureItems[number]['id'];
const placementSchema=z.object({enabled:z.boolean(),x:z.number().finite(),z:z.number().finite(),rotation:z.number().finite().min(0).max(360)});
export const furnitureLayoutSchema=z.object({picnic:placementSchema,sectional:placementSchema,dining:placementSchema,patio:placementSchema,grill:placementSchema});
export type FurnitureLayout=z.infer<typeof furnitureLayoutSchema>;
export function defaultFurnitureLayout(selected:string='none'):FurnitureLayout{
 return Object.fromEntries(furnitureItems.map(item=>[item.id,{enabled:item.id===selected,x:0,z:0,rotation:0}])) as FurnitureLayout;
}
// Match the original placement envelope, in inches from pavilion center.
export function furnitureBounds(config:Pick<PavilionConfig,'width'|'length'>,id:FurnitureId,rotation:number){
 const item=furnitureItems.find(item=>item.id===id)!;
 const rad=rotation*Math.PI/180,c=Math.abs(Math.cos(rad)),s=Math.abs(Math.sin(rad));
 return {x:Math.max(0,config.width*6-7.5-(item.x*c+item.z*s)/2),z:Math.max(0,config.length*6-3.75-(item.x*s+item.z*c)/2)};
}
export function normalizeFurniture(config:Pick<PavilionConfig,'width'|'length'>,layout:FurnitureLayout):FurnitureLayout{
 return Object.fromEntries(furnitureItems.map(({id})=>{const p=layout[id],bounds=furnitureBounds(config,id,p.rotation);return [id,{...p,x:Math.max(-bounds.x,Math.min(bounds.x,p.x)),z:Math.max(-bounds.z,Math.min(bounds.z,p.z))}]})) as FurnitureLayout;
}
