const assert=require('node:assert/strict'),T=require('three');
require('./load-typescript.cjs');
const {createGirderGeometry,IN}=require('../components/pavilion/procedural-geometry.ts');
const {CUSTOMER_PAVILION_SIZES}=require('../lib/pavilion-config.ts');
const {expandedFrame}=require('../lib/pavilion-layout.ts');
const {mapTimberGrain}=require('../components/pavilion/timber-grain.ts');
const material=new T.MeshBasicMaterial({side:T.DoubleSide});
let count=0;
for(const {width,length} of CUSTOMER_PAVILION_SIZES){
 const frame=expandedFrame(width,length),w=((frame?.girderIn[0]??8)-.5)*IN,h=((frame?.girderIn[1]??8)-.5)*IN;
 const len=(length*12+27)*IN,g=createGirderGeometry(len,w,h),b=g.boundingBox;
 assert(Math.abs(b.max.x-b.min.x-len)<1e-6,'No cap beyond the specified length');
 assert(Math.abs(b.max.y-b.min.y-h)<1e-6,'Correct beam height');
 assert(Math.abs(b.max.z-b.min.z-w)<1e-6,'Correct beam width');
 for(const attr of Object.values(g.attributes))for(const v of attr.array)assert(Number.isFinite(v));
 const mesh=new T.Mesh(g,material);mesh.updateMatrixWorld();
 const hits=(x,y)=>new T.Raycaster(new T.Vector3(x,y,w),new T.Vector3(0,0,-1)).intersectObject(mesh);
 // Both ends must have an open lower corner and a solid upper reveal.
 for(const side of [-1,1]){
  assert.equal(hits(side*(len/2-.2*h),-h*.4).length,0,'Scroll removes the lower tip');
  assert(hits(side*(len/2-.05*h),h*.4).length>0,'Upper reveal stays solid');
  for(const x of [-3.75,0,3.75])assert(hits(side*(length*6+x)*IN,-h*.45).length>0,'Full-depth post bearing');
 }
 // Compare every sampled silhouette point with its reflection, including cuts.
 for(let x=0;x<=30;x++)for(let y=0;y<=20;y++){
  const px=len/2-h*x/30,py=h*(y/20-.5);
  assert.equal(hits(px,py).length>0,hits(-px,py).length>0,'Matching front and rear scrolls');
 }
 const grain=mapTimberGrain(g);assert.equal(grain.userData.timberAxes.length,1,'One continuous timber');grain.dispose();
 g.dispose();count++;
}
material.dispose();
console.log(`Girder ends passed: ${count} footprints, mirrored cuts, open scrolls, full post bearing, correct stock dimensions, no extra caps and continuous grain.`);
