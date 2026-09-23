const assert=require('node:assert/strict'),T=require('three');
require('./load-typescript.cjs');
const {createWideTruss}=require('../components/pavilion/wide-truss-geometry.ts');
const {createKingPlatePackage}=require('../components/pavilion/standard-plate-package.ts');
const {CUSTOMER_PAVILION_SIZES}=require('../lib/pavilion-config.ts');
const {expandedFrame}=require('../lib/pavilion-layout.ts');
const expected={arch:['arch_plate_l','arch_plate_l','simple_plate','simple_plate','top_plate','web_plate_2'],hammer:['truss_plateV2','truss_plateV2','truss_platepeak','truss_platewac','truss_platewac'],king:['king_heel_plate2','king_heel_plate2','king_peak_plate','king_web_plate','truss_plateV2','truss_plateV2']};
const sections=new Map();let count=0;
for(const {width,length} of CUSTOMER_PAVILION_SIZES.filter(s=>s.width>16))for(const style of ['king','arch','hammer']){
 const frame=expandedFrame(width,length),span=width*.3048-.3,pitch=frame?.pitch??2/3,rise=span/2*pitch,profile=(frame?.rafterIn[1]??6)*.0254;
 const model=style==='king'?{plates:createKingPlatePackage(span,rise,profile),members:[]}:createWideTruss(style,span,rise,profile/.0254);
 const parts=model.plates.map(p=>p.geometry.userData.platePart).sort();assert.deepEqual(parts,expected[style].slice().sort(),`${style} ${width}: exact 16-foot part set`);
 assert.equal(model.plates.filter(p=>p.peak).length,1,'Only one exterior peak per end truss');
 for(const p of model.plates){
  const g=p.geometry,pos=g.attributes.position,section=g.boundingBox.getSize(new T.Vector3()).toArray();
  const key=style+p.id;
  if(sections.has(key))section.forEach((v,i)=>assert(Math.abs(v-sections.get(key)[i])<2e-6,'Hardware size must not stretch with span'));
  else sections.set(key,section);
  for(let i=0;i<pos.count;i++){
   const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
   assert(Number.isFinite(x+y+z));
   assert(y+Math.abs(x)*pitch<=rise+profile*Math.hypot(1,pitch)/2-.0019,'Plate cannot project through roof');
  }
  assert(pos.count>36,'Must retain shaped plate detail, not a substitute box');
  assert(section[2]>.004&&section[2]<.02,'Steel plate thickness retained');
 }
 model.plates.forEach(p=>p.geometry.dispose());model.members.forEach(m=>m.geometry.dispose());count++;
}
console.log(`Matched plate packages passed: ${count} offered size/style combinations, exact 16-foot part sets, fixed hardware dimensions, roof clearance and steel thickness.`);
