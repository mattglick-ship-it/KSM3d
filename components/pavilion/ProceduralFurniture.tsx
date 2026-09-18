import {useMemo,useEffect} from 'react';
import {makeFurniture,disposeFurniture,type FurnitureKind} from './procedural-furniture';
export type FurnitureProps={position?:[number,number,number];rotation?:number;stain?:string|null};
export function ProceduralFurniture({kind,position=[0,0,0],rotation=0,stain=null}:FurnitureProps&{kind:FurnitureKind}){
 const object=useMemo(()=>makeFurniture(kind,stain),[kind,stain]);
 useEffect(()=>()=>disposeFurniture(object),[object]);
 return <group position={position} rotation={[0,rotation,0]}><primitive object={object}/></group>;
}
