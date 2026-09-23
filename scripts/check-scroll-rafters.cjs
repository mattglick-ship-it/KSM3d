const assert=require('node:assert/strict'),T=require('three');
require('./load-typescript.cjs');
const {createFittedScrollRafter}=require('../components/pavilion/scroll-rafter-geometry.ts');
const {CUSTOMER_PAVILION_SIZES}=require('../lib/pavilion-config.ts');
const {expandedFrame}=require('../lib/pavilion-layout.ts');
const IN=.0254,mat=new T.MeshBasicMaterial({side:T.DoubleSide});
let count=0;
for(const size of CUSTOMER_PAVILION_SIZES.filter(s=>s.width===12||s.width===14))for(const style of ['king','arch','hammer']){
 const frame=expandedFrame(size.width,size.length),half=size.width*.3048/2-.15;
 const t=(frame&&(frame.runtimeTruss||style==='king')?frame.rafterIn[1]:6)*IN;
 const pitchAngle=Math.atan(2/3),depth=5.5*IN,iy=half*2/3,outerX=half+16*IN,seatX=half+4*IN;
 const height=t/Math.cos(pitchAngle),top=iy+height/2,bottom=iy-height/2;
 const meshes=[-1,1].map(side=>{
  const g=createFittedScrollRafter({iy,outerX,pitchAngle,t,depth,side,seatX,seatY:-4*IN});
  const p=g.attributes.position;for(let i=0;i<p.count;i++){
   const x=side*p.getX(i),y=p.getY(i),z=p.getZ(i);
   assert(Number.isFinite(x+y+z));
   assert(x>=-1e-6&&x<=outerX+1e-6,'Tail cannot project past roof edge');
   assert(y<=top-x*2/3+1e-6&&y>=bottom-x*2/3-1e-6,'All cuts stay within rafter stock');
   assert(Math.abs(z)<=depth/2+1e-6,'Correct timber thickness');
  }
  const m=new T.Mesh(g,mat);m.updateMatrixWorld();return m;
 });
 const hits=(m,x,y)=>new T.Raycaster(new T.Vector3(x,y,1),new T.Vector3(0,0,-1)).intersectObject(m).length>0;
 for(const [i,side] of [-1,1].entries()){
  const x=outerX-t*.05,endTop=top-x*2/3;
  assert(hits(meshes[i],side*x,endTop-height*.1),'Solid upper tip');
  assert(!hits(meshes[i],side*x,endTop-height*.7),'Lower tip carved away, no hanging rectangular end');
  assert(hits(meshes[i],side*(seatX-.02),-.08),'Solid wood above birdsmouth');
  assert(!hits(meshes[i],side*(seatX-.02),-.10),'Open birdsmouth below bearing');
 }
 for(let x=0;x<30;x++)for(let y=0;y<20;y++){
  const px=outerX-t*x/30,py=top-px*2/3-height*y/20;
  assert.equal(hits(meshes[0],-px,py),hits(meshes[1],px,py),'Left/right scrolls must match');
 }
 meshes.forEach(m=>m.geometry.dispose());count++;
}
mat.dispose();console.log(`Scroll rafters passed: ${count} size/style combinations, roof envelope, timber thickness, mirrored cuts, open lower tips and seated birdsmouths.`);
