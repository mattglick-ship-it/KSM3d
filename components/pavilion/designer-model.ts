import {z} from 'zod';
import {furnitureLayoutSchema,defaultFurnitureLayout,normalizeFurniture,type FurnitureLayout} from './furniture-layout';
import {DEFAULT_CONFIG,CUSTOMER_PAVILION_SIZES,ROOF_MATERIALS,WOOD_FINISHES,type PavilionConfig} from '@/lib/pavilion-config';
import type {ViewPreset} from './Scene';
export const designSchema=z.object({
 version:z.literal(1),
 config:z.object({width:z.number(),length:z.number(),height:z.union([z.literal(8),z.literal(9),z.literal(10)]),roof:z.literal('gable'),post:z.enum(['square','brace']),truss:z.enum(['king','arch','hammer']),woodId:z.string().refine(v=>WOOD_FINISHES.some(x=>x.id===v)),roofId:z.string().refine(v=>ROOF_MATERIALS.some(x=>x.id===v)),trussPlates:z.boolean(),braceScale:z.number().min(0.25).max(1.5),snowGuards:z.boolean(),snowRail:z.boolean().optional(),rafterTail:z.enum(['standard','scroll']),gableFascia:z.boolean(),gableOverhang:z.boolean(),hideBackTruss:z.boolean().optional()}).refine(c=>CUSTOMER_PAVILION_SIZES.some(s=>s.width===c.width&&s.length===c.length),'Choose an available pavilion size'),
 tableStain:z.string().regex(/^#[0-9a-f]{6}$/i).nullable(),deckStain:z.string().regex(/^#[0-9a-f]{6}$/i).nullable(),
 notes:z.string().max(2000),
 furniture:z.enum(['none','picnic','sectional','dining','patio','grill']).default('none'),
 furnitureLayout:furnitureLayoutSchema.optional(),
 tv:z.object({enabled:z.boolean(),corner:z.enum(['fl','fr','br','bl']),height:z.number().finite().min(5).max(8)}).default({enabled:false,corner:'fl',height:6}),
}).transform(d=>({...d,furnitureLayout:normalizeFurniture(d.config,d.furnitureLayout??defaultFurnitureLayout(d.furniture)),tv:{...d.tv,height:Math.min(d.config.height-2,d.tv.height)}}));
export type Design=z.infer<typeof designSchema>;
export const initialDesign:Design=designSchema.parse({version:1,config:{...DEFAULT_CONFIG,height:8,roof:'gable',truss:'king',roofId:'ss-slate-gray'},tableStain:null,deckStain:null,notes:'',furniture:'picnic'});
export type SceneInputs={furnitureLayout:FurnitureLayout;tv:Design['tv'];config:PavilionConfig;view:ViewPreset;showRoof:boolean;showPad:boolean;showBackyard:boolean;showTable:boolean;showSectional:boolean;showEgg:boolean;showTv:boolean;showDining:boolean;showPatio:boolean;tableStain:string|null;deckStain:string|null;measureEnabled:boolean;showDimensions:boolean};
export const stains=[{name:'Unfinished',hex:null},{name:'Old Lathe',hex:'#7a6a55'},{name:'Barn Brown',hex:'#5a3a25'},{name:'Medium Gray',hex:'#8a8478'},{name:'Sunset',hex:'#b87045'},{name:'White',hex:'#e8e0d2'},{name:'Light Gray',hex:'#b4ada1'},{name:'Cedar',hex:'#b07a4a'},{name:'Rustic Cedar',hex:'#8a4a2a'},{name:'Black',hex:'#15120e'},{name:'Cappuccino',hex:'#5e4530'},{name:'Early American',hex:'#6b4423'},{name:'Clear',hex:'#f5ecd9'}];
export const stainName=(hex:string|null)=>stains.find(s=>s.hex===hex)?.name||'Custom';

