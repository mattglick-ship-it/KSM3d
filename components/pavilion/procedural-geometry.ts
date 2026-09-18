import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import dimensions from './member-dimensions.json';
import profiles from './member-profiles.json';

/** Dimensional drawings: stock corners, cut lines, fitted curve controls, and
 * extrusion depths. No imported triangles, indices, normals, UVs, or loaders.
 * Every surface is manufactured afresh by Three.js. Historical member frames
 * preserve published position/scale settings and existing saved designs. */
type Bounds=number[][];
type Drawing={axes:number[];depth:number[];paths:{start:number[];commands:(string|number)[][];hole:boolean}[]};
const survey=dimensions as Record<string,Bounds[]>;
const drawings=profiles as unknown as Record<string,Drawing[]>;
export const IN=.0254;
/** One continuous girder, local X along its length. End cuts are sized from
 * the timber section, so extending a pavilion never stretches the scrolls.
 * The paired cuts share a level top and retain full bearing over the posts. */
export function createGirderGeometry(length:number,width:number,height:number){
 const half=length/2,top=height/2,bottom=-height/2;
 const run=Math.min(height*.786,length/4),reveal=run*(.143/.786);
 const lipX=half-reveal,heelX=half-run,lipY=top-height*.319;
 const rise=lipY-bottom,k=.5522847498;
 const s=new THREE.Shape();
 s.moveTo(-half,top);s.lineTo(half,top);
 s.lineTo(half,top-height*.21);s.lineTo(lipX,top-height*.21);s.lineTo(lipX,lipY);
 s.bezierCurveTo(lipX-(lipX-heelX)*k,lipY,heelX,bottom+rise*k,heelX,bottom);
 s.lineTo(-heelX,bottom);
 s.bezierCurveTo(-heelX,bottom+rise*k,-lipX+(lipX-heelX)*k,lipY,-lipX,lipY);
 s.lineTo(-lipX,top-height*.21);s.lineTo(-half,top-height*.21);s.closePath();
 const geometry=new THREE.ExtrudeGeometry(s,{depth:width,bevelEnabled:false,curveSegments:32,steps:1});
 geometry.translate(0,0,-width/2);geometry.computeBoundingBox();
 return geometry;
}
export function polygon(points:number[][]){const s=new THREE.Shape();points.forEach((p,i)=>i?s.lineTo(p[0],p[1]):s.moveTo(p[0],p[1]));s.closePath();return s;}
export function fitBounds(g:THREE.BufferGeometry,bounds:Bounds){
 g.computeBoundingBox();const b=g.boundingBox!,size=b.getSize(new THREE.Vector3()),min=b.min.clone();
 g.translate(-min.x,-min.y,-min.z);
 g.scale(...size.toArray().map((v,i)=>(bounds[1][i]-bounds[0][i])/Math.max(v,1e-12)) as [number,number,number]);
 g.translate(...bounds[0] as [number,number,number]);g.computeBoundingBox();g.computeVertexNormals();return g;
}
function manufacture(d:Drawing,bounds:Bounds){
 const shape=new THREE.Shape();
 for(const p of d.paths){const path=p.hole?new THREE.Path():shape;path.moveTo(p.start[0],p.start[1]);
  for(const command of p.commands){const [op,...values]=command;const v=values as number[];
   if(op==='L')path.lineTo(v[0],v[1]);
   else if(op==='C')path.bezierCurveTo(v[0],v[1],v[2],v[3],v[4],v[5]);
   else throw new Error(`Unknown drawing operation: ${op}`);
  }path.closePath();if(p.hole)shape.holes.push(path);
 }
 const g=new THREE.ExtrudeGeometry(shape,{depth:d.depth[1]-d.depth[0],bevelEnabled:false,curveSegments:24,steps:1});
 g.translate(0,0,d.depth[0]);
 const matrix=new THREE.Matrix4(),e=matrix.elements;e.fill(0);e[15]=1;
 for(let local=0;local<3;local++)e[local*4+d.axes[local]]=1;
 g.applyMatrix4(matrix);
 if(matrix.determinant()<0){
  // An odd axis permutation reverses winding; keep generated faces outward.
  for(const attr of Object.values(g.attributes)){const a=attr as THREE.BufferAttribute;for(let i=0;i<a.count;i+=3)for(let k=0;k<a.itemSize;k++){const j=i*a.itemSize+k,l=(i+2)*a.itemSize+k,v=a.array[j];a.array[j]=a.array[l];a.array[l]=v;}}
 }
 // Constrain curve sampling to the exact surveyed stock envelope.
 return fitBounds(g,bounds);
}
export function createPartGeometry(id:string):THREE.BufferGeometry{
 const plan=drawings[id],boxes=survey[id];if(!plan||!boxes)throw new Error(`Missing dimensional drawing: ${id}`);
 const pieces=plan.map((d,i)=>manufacture(d,boxes[i]));if(pieces.length===1)return pieces[0];
 const result=mergeGeometries(pieces,false)!;pieces.forEach(g=>g.dispose());return result;
}
export const hammerMemberNames=['tie.l','tie.r','kingpost','prince.l','prince.r','toptie','kingbrace.l','kingbrace.r','rafters'] as const;
/** Each width keeps its own measured cut/curvature drawing and member positions.
 * Left/right rafters are separate new solids with exact 8/12 pitch and seats. */
export function createHammerMembers(width:12|14|16|20){
 const boxes=survey[`hammer${width}`],plans=drawings[`hammer${width}`];
 const result=boxes.slice(0,8).map((b,i)=>({name:`hammer.${hammerMemberNames[i]}`,geometry:manufacture(plans[i],b)}));
 const b=boxes[8],half=b[1][0],top=b[1][1],bottom=b[0][1];
 const verticalProfile=6*IN*Math.hypot(1,2/3),seatX=half-12*IN;
 const seatY=-3.25*IN,seatInner=(top-verticalProfile-seatY)/(2/3);
 for(const side of [-1,1]){
  const shape=polygon([[0,top],[half,bottom+verticalProfile],[half,bottom],
   [seatX,top-verticalProfile-seatX*(2/3)],[seatX,seatY],[seatInner,seatY],[0,top-verticalProfile]]);
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:b[1][2]-b[0][2],bevelEnabled:false});
  geometry.translate(0,0,b[0][2]);if(side===-1)geometry.rotateY(Math.PI);
  result.push({name:`hammer.rafter.${side===-1?'l':'r'}`,geometry});
 }
 return result;
}
export function createHammerScene(width:12|14|16|20,material:THREE.Material){
 const group=new THREE.Group();group.name=`procedural-hammer-${width}`;
 for(const p of createHammerMembers(width)){const mesh=new THREE.Mesh(p.geometry,material);mesh.name=p.name;
  mesh.castShadow=mesh.receiveShadow=true;mesh.userData.proceduralMember=p.name;group.add(mesh);}
 return group;
}
