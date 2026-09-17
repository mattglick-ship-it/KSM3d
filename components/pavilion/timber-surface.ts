import {useEffect, useMemo} from 'react';
import * as THREE from 'three';

// Tooling height is independent of the pine photograph: dark knots are pigment,
// not deep holes. Values are metres, matching the pavilion's model units.
export const TIMBER_SURFACES: Record<string, {roughness:number; depth:number; description:string}> = {
  smooth: {roughness:0.56, depth:0.00018, description:'Planed faces with fine, natural pine grain.'},
  'rough-sawn': {roughness:0.94, depth:0.0013, description:'Cross-grain saw marks and a coarse, matte surface.'},
  'hand-peeled': {roughness:0.78, depth:0.005, description:'Long drawknife scallops with softly uneven facets.'},
  'hatchet-hand-peeled': {roughness:0.88, depth:0.007, description:'Short hatchet cuts layered over hand-peeled facets.'},
};

const heightMaps = new Map<string, THREE.DataTexture>();
const fract = (n:number) => n-Math.floor(n);
const hash = (x:number,y:number) => fract(Math.sin(x*127.1+y*311.7)*43758.5453);
const TAU=Math.PI*2;

/** Periodic tooling relief; U follows the horizontal grain in beam_pine.png.
 * Bounded shared data maps avoid expensive new canvases for every timber face. */
export function createTimberHeightData(finish:string, size=512) {
  const data = new Uint8Array(size*size*4);
  for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
    const u=x/size,v=y/size;
    const fibers=Math.sin(TAU*(v*92+0.2*Math.sin(TAU*u*3)));
    const fine=hash(x,y)-0.5;
    let h=0.5+fibers*0.08+fine*0.05;
    if(finish==='rough-sawn') {
      // Saw passes cross the grain, with torn fibres between passes.
      h=0.5+0.17*Math.sin(TAU*(u*64+0.18*Math.sin(TAU*v*2)))+0.11*Math.sin(TAU*u*137)+fine*0.22+fibers*0.04;
    } else if(finish==='hand-peeled'||finish==='hatchet-hand-peeled') {
      // Staggered finite drawknife passes, not continuous corrugated grooves.
      const lane=v*8, row=Math.floor(lane), across=fract(lane);
      const along=u*7+hash(row,91), cell=Math.floor(along), t=fract(along);
      const seed=hash(cell,row);
      const feather=Math.pow(Math.sin(Math.PI*across),1.4);
      const pass=Math.pow(Math.sin(Math.PI*t),0.75);
      const facet=(t-0.5)*(0.05+0.08*seed);
      h=0.58-(0.19+0.13*seed)*feather*pass+facet*feather+fibers*0.022+fine*0.018;
      if(finish==='hatchet-hand-peeled') {
        // Short, irregular axe incisions across the grain, as in KSM's
        // Mifflintown reference: sharp entry lip and a shallow sloping exit.
        const row=Math.floor(v*10), along=u*13+hash(row,4)*0.8;
        const cell=Math.floor(along), t=fract(v*10);
        const seed=hash((cell+13)%13,row);
        const q=fract(along)-0.24-(t-0.5)*(seed-0.5)*0.4;
        const length=0.28+hash((cell+13)%13,row+31)*0.42;
        const ends=Math.max(0,1-Math.pow((t-0.5)/length,4));
        const cut=q>0&&q<0.38 ? Math.pow(1-q/0.38,1.5) : 0;
        h-=cut*ends*(0.22+0.25*seed)*(seed>0.35?1:0.12);

      }
    }
    const i=(y*size+x)*4, value=Math.round(THREE.MathUtils.clamp(h,0,1)*255);
    data[i]=data[i+1]=data[i+2]=value;data[i+3]=255;
  }
  return data;
}

function heightMap(finish:string) {
  let map=heightMaps.get(finish);
  if(!map){
    map=new THREE.DataTexture(createTimberHeightData(finish),512,512,THREE.RGBAFormat);
    map.wrapS=map.wrapT=THREE.RepeatWrapping;
    map.generateMipmaps=true;map.minFilter=THREE.LinearMipmapLinearFilter;map.magFilter=THREE.LinearFilter;
    map.anisotropy=8;map.needsUpdate=true;heightMaps.set(finish,map);
  }
  return map;
}

export function useTimberSurface(grain:THREE.Texture,finish:string) {
  const profile=TIMBER_SURFACES[finish]??TIMBER_SURFACES.smooth;
  const bumpMap=useMemo(()=>{
    const map=heightMap(finish).clone();
    map.wrapS=grain.wrapS;map.wrapT=grain.wrapT;
    map.repeat.copy(grain.repeat);map.offset.copy(grain.offset);
    map.center.copy(grain.center);map.rotation=grain.rotation;
    map.needsUpdate=true;
    return map;
  },[grain,finish]);
  useEffect(()=>()=>bumpMap.dispose(),[bumpMap]);
  return useMemo(()=>({bumpMap,bumpScale:profile.depth,roughness:profile.roughness,metalness:0}),[bumpMap,profile]);
}
