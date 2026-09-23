import * as THREE from 'three';
import {createPartGeometry} from './procedural-geometry';

export type PlateStyle = 'king' | 'arch' | 'hammer';
export type PlateRole = 'heel' | 'web' | 'crown' | 'peak';
const IN = .0254;
// The same drawings, physical sizes and rotations used by the 16-foot sets.
// Width changes move plates between joints; they never stretch the hardware.
const packages: Record<PlateStyle, Partial<Record<PlateRole, {part:string;scale:[number,number];angle?:number;size?:number;mirror?:boolean}>>> = {
  arch: {
    heel:{part:'arch_plate_l',scale:[.91,.91],angle:1},
    web:{part:'simple_plate',scale:[1.21,1.35],angle:3},
    crown:{part:'web_plate_2',scale:[1.05,1.05]},
    peak:{part:'top_plate',scale:[1.05,1.05]},
  },
  hammer: {
    heel:{part:'truss_plateV2',scale:[1.06,1.06],size:14.4,mirror:true},
    web:{part:'truss_platewac',scale:[1.49,1.49],size:14.4,mirror:true},
    peak:{part:'truss_platepeak',scale:[1,1],size:14.4},
  },
  king: {
    heel:{part:'truss_plateV2',scale:[1,1]},
    web:{part:'king_heel_plate2',scale:[1.07,1.07],angle:-5},
    crown:{part:'king_web_plate',scale:[1.1,1.21]},
    peak:{part:'king_peak_plate',scale:[1,1]},
  },
};
export function createStandardPlate(style:PlateStyle,role:PlateRole,side=0) {
  const spec=packages[style][role];
  if(!spec)throw new Error(`No ${role} plate in the ${style} package`);
  const geometry=createPartGeometry(spec.part);
  geometry.computeBoundingBox();
  const center=geometry.boundingBox!.getCenter(new THREE.Vector3());
  const size=geometry.boundingBox!.getSize(new THREE.Vector3());
  geometry.translate(-center.x,-center.y,-center.z);
  const scale=spec.size ? spec.size*IN/Math.max(size.x,size.y) : IN;
  geometry.scale(scale*spec.scale[0],scale*spec.scale[1],spec.size ? .5*IN*spec.scale[0]/size.z : IN);
  if(spec.mirror)geometry.rotateY(Math.PI);
  if(spec.angle)geometry.rotateZ(spec.angle*Math.PI/180);
  // Arch/king drawings are the left plate; hammer's normalized drawing is right.
  if(side && side !== (style==='hammer'?1:-1))geometry.rotateY(Math.PI);
  geometry.computeBoundingBox();
  geometry.userData={plateStyle:style,plateRole:role,platePart:spec.part};
  return geometry;
}

export function placeStandardPlate(style:PlateStyle,role:PlateRole,point:[number,number],pitch:number,roofTop:number) {
  const geometry=createStandardPlate(style,role,Math.sign(point[0]));
  geometry.translate(point[0],point[1],0);
  // Keep the complete 16-foot silhouette below the decking without clipping
  // its decorative outline, even when the stock section or pitch changes.
  const positions=geometry.attributes.position;
  let drop=0;
  for(let i=0;i<positions.count;i++)drop=Math.max(drop,positions.getY(i)+Math.abs(positions.getX(i))*pitch-roofTop+.002);
  if(drop>0)geometry.translate(0,-drop,0);
  geometry.computeBoundingBox();
  return {geometry,thickness:geometry.boundingBox!.max.z-geometry.boundingBox!.min.z};
}

export function createKingPlatePackage(span:number,rise:number,profile:number) {
  const half=span/2,pitch=rise/half,roofTop=rise+profile*Math.hypot(1,pitch)/2;
  const tieTop=profile-2.25*IN;
  const webX=(rise-tieTop+profile/2)/(1+pitch)+6*IN;
  const joints:{id:string;role:PlateRole;point:[number,number];peak?:boolean}[]=[
    {id:'peak',role:'peak',point:[0,rise-3.5*IN],peak:true},
    {id:'crown',role:'crown',point:[0,tieTop]},
  ];
  for(const side of [-1,1]){
    joints.push({id:`heel.${side}`,role:'heel',point:[side*(half-profile*.7),tieTop-profile*.1]});
    joints.push({id:`web.${side}`,role:'web',point:[side*webX,rise-pitch*webX-profile*.3]});
  }
  return joints.map(j=>({...j,...placeStandardPlate('king',j.role,j.point,pitch,roofTop)}));
}
