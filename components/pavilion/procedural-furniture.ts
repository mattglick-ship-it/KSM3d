import * as T from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// Surveyed outer dimensions in metres; source models are not used at runtime.
export const furnitureDimensions={
  sectional:[2.4384,0.6906939390005501,1.4081258533303556],
  patio:[2.4384,0.7376193349669198,1.6317910864186451],
  dining:[2.794,1.2144829154013614,1.6491264879385266],
  grill:[1.2192,1.0589770909989975,0.6523761447473632],
} as const;
export type FurnitureKind=keyof typeof furnitureDimensions|'picnic';
export const picnicDimensions=[1.6622142141711576,0.7366,1.8288] as const;
const IN=.0254;
export function makeFurniture(kind:FurnitureKind,stain:string|null=null){
 const root=new T.Group();root.name=`procedural-${kind}`;
 const wood=new T.MeshStandardMaterial({color:stain??'#c29763',roughness:.76});
 const frame=new T.MeshStandardMaterial({color:'#343c39',roughness:.55,metalness:.55});
 const cloth=new T.MeshStandardMaterial({color:'#d3d0bd',roughness:1});
 const darkCloth=new T.MeshStandardMaterial({color:'#818b80',roughness:1});
 const ceramic=new T.MeshStandardMaterial({color:'#315b35',roughness:.48});
 function mesh(g:T.BufferGeometry,position:number[],material:T.Material=wood,parent:T.Group=root){const m=new T.Mesh(g,material);m.position.set(...position as [number,number,number]);m.castShadow=m.receiveShadow=true;parent.add(m);return m;}
 function box(size:number[],position:number[],material:T.Material=wood,parent:T.Group=root,round=0){return mesh(round?new RoundedBoxGeometry(...size as [number,number,number],3,round):new T.BoxGeometry(...size as [number,number,number]),position,material,parent);}
 function beam(a:number[],b:number[],w:number,d:number,material:T.Material=wood,parent:T.Group=root){const start=new T.Vector3(...a as [number,number,number]),end=new T.Vector3(...b as [number,number,number]);const m=box([w,start.distanceTo(end),d],start.clone().add(end).multiplyScalar(.5).toArray(),material,parent);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),end.sub(start).normalize());return m;}
 function slats(w:number,d:number,y:number,z=0,parent:T.Group=root){const n=Math.max(3,Math.round(d/.12));for(let i=0;i<n;i++)box([w,.035,d/n-.005],[0,y,z-d/2+d/n*(i+.5)],wood,parent,.002);}
 function legs(w:number,d:number,h:number,parent:T.Group=root){for(const x of [-1,1])for(const z of [-1,1])box([.045,h,.045],[x*(w/2-.05),h/2,z*(d/2-.05)],frame,parent);}
 function sofa(w:number,d:number,parent:T.Group){
  legs(w,d,.18,parent);box([w,.08,d],[0,.2,0],frame,parent,.02);
  for(let i=0;i<3;i++)box([(w-.16)/3-.015,.12,d-.16],[-(w-.16)/2+(i+.5)*(w-.16)/3,.30,0],cloth,parent,.022);
  box([w-.16,.35,.13],[0,.47,-d/2+.065],darkCloth,parent,.025);
  for(const side of [-1,1]){box([.08,.32,d],[side*(w/2-.04),.38,0],frame,parent,.02);box([.095,.045,d+.015],[side*(w/2-.04),.56,0],wood,parent,.015);}
  for(let i=0;i<3;i++){const p=box([.38,.32,.10],[-w/2+.34+i*(w-.68)/2,.48,-d/2+.16],cloth,parent,.035);p.rotation.x=-.15;}
 }
 if(kind==='picnic'){
  // Table top is exactly 72 × 30 inches, with its upper surface 29 inches high.
  const length=72*IN,topW=30*IN,height=29*IN,thick=1.5*IN;
  for(let i=0;i<5;i++)box([length,thick,(topW-4*.004)/5],[0,height-thick/2,-topW/2+(i+.5)*(topW-4*.004)/5+i*.004],wood,root,.002);
  for(const x of [-24*IN,24*IN]){
   for(const side of [-1,1])beam([x,0,side*24*IN],[x,height-thick,side*9*IN],3.5*IN,1.5*IN);
   box([3.5*IN,1.5*IN,60*IN],[x,16.5*IN,0]);
   box([3.5*IN,1.5*IN,topW],[x,height-thick-0.75*IN,0]);
  }
  const benchCenter=picnicDimensions[0]/2-(5.5+5.65)*IN/2;
  for(const side of [-1,1])for(let j=0;j<2;j++)box([length,thick,5.5*IN],[0,18*IN-thick/2,side*(benchCenter+(j-.5)*5.65*IN)],wood,root,.002);
  for(const side of [-1,1])beam([0,17*IN,0],[side*24*IN,26*IN,0],2.5*IN,1.5*IN);
  // Plumb-cut the splayed feet at floor level; diagonal box ends otherwise
  // protrude below zero and would change the measured overall height.
  root.updateMatrixWorld(true);
  root.traverse(o=>{if(!(o as T.Mesh).isMesh)return;const m=o as T.Mesh,p=m.geometry.getAttribute('position'),inverse=m.matrixWorld.clone().invert(),v=new T.Vector3();
   for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(m.matrixWorld);if(v.y<0){v.y=0;v.applyMatrix4(inverse);p.setXYZ(i,v.x,v.y,v.z);}}
   m.geometry.applyMatrix4(m.matrixWorld);m.position.set(0,0,0);m.quaternion.identity();m.scale.set(1,1,1);
   m.geometry.computeBoundingBox();m.geometry.computeVertexNormals();
  });
  // The reference tabletop's long axis is Z; retain its placement in the pavilion.
  root.rotation.y=Math.PI/2;
 }else if(kind==='sectional'||kind==='patio'){
  const sofaGroup=new T.Group();root.add(sofaGroup);sofaGroup.position.set(0,0,-.35);sofa(2.3,.77,sofaGroup);
  if(kind==='sectional'){
   box([.72,.08,.9],[-.79,.2,.42],frame,root,.015);box([.68,.12,.9],[-.79,.30,.42],cloth,root,.02);for(const x of [-1.08,-.50])box([.045,.18,.045],[x,.09,.81],frame);
  }else{for(const side of [-1,1]){const chair=new T.Group();root.add(chair);chair.position.set(side*1.1,0,.64);chair.rotation.y=side*Math.PI/2;sofa(.7,.7,chair);}}
  const table=new T.Group();root.add(table);table.position.set(.25,0,.55);legs(.9,.48,.3,table);slats(.9,.48,.32,0,table);
 }else if(kind==='dining'){
  legs(1.7,.85,.72);slats(1.8,.9,.74);
  for(const side of [-1,1])for(const x of [-.60,0,.60]){
   const chair=new T.Group();chair.position.set(x,0,side*.72);chair.rotation.y=side===1?Math.PI:0;root.add(chair);
   legs(.45,.43,.43,chair);slats(.46,.44,.45,0,chair);
   for(const px of [-.20,.20])box([.035,.85,.035],[px,.425,-.20],frame,chair);
   for(let j=0;j<4;j++)box([.42,.045,.025],[0,.60+j*.07,-.20],wood,chair,.004);
  }
 }else{
  // Turned ceramic shell, separate lid, metal band, handle, shelves and cart.
  legs(1.08,.56,.72);box([1.10,.035,.58],[0,.72,0],frame);slats(1.10,.5,.16);
  const profile=[[.14,0],[.21,.04],[.26,.18],[.275,.32],[.27,.39],[.25,.44]].map(([r,y])=>new T.Vector2(r,y));
  mesh(new T.LatheGeometry(profile,48),[0,.42,0],ceramic);
  const lidProfile=[[.27,0],[.265,.06],[.23,.16],[.16,.23],[.06,.27],[.04,.28]].map(([r,y])=>new T.Vector2(r,y));
  mesh(new T.LatheGeometry(lidProfile,48),[0,.86,0],ceramic);
  mesh(new T.CylinderGeometry(.277,.277,.027,48),[0,.86,0],frame);
  mesh(new T.CylinderGeometry(.062,.052,.055,24),[0,1.16,0],frame);
  box([.24,.035,.045],[0,.95,.27],wood,root,.012);
  for(const side of [-1,1])box([.30,.035,.45],[side*.47,.76,0],wood,root,.014);
  for(const x of [-.48,.48])for(const z of [-.23,.23]){const wheel=mesh(new T.CylinderGeometry(.05,.05,.025,20),[x,.05,z],frame);wheel.rotation.z=Math.PI/2;}
 }
 if(kind!=='picnic'){
  // Match the old displayed footprint and height exactly, then ground/centre.
  const b=new T.Box3().setFromObject(root),s=b.getSize(new T.Vector3()),target=furnitureDimensions[kind];
  root.scale.set(target[0]/s.x,target[1]/s.y,target[2]/s.z);
  root.updateMatrixWorld(true);const fitted=new T.Box3().setFromObject(root),c=fitted.getCenter(new T.Vector3());
  root.position.set(-c.x,-fitted.min.y,-c.z);
 }
 const materials=new Set<T.Material>();root.traverse(o=>{if((o as T.Mesh).isMesh)materials.add((o as T.Mesh).material as T.Material)});
 // Dispose material instances that were not needed for this particular model.
 for(const m of [wood,frame,cloth,darkCloth,ceramic])if(!materials.has(m))m.dispose();
 return root;
}
export function disposeFurniture(root:T.Group){const materials=new Set<T.Material>();root.traverse(o=>{if((o as T.Mesh).isMesh){const m=o as T.Mesh;m.geometry.dispose();materials.add(m.material as T.Material)}});materials.forEach(m=>m.dispose());}
