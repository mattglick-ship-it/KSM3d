// Test actual cut profiles, not only whole-model bounding boxes.
const assert=require('node:assert/strict'),THREE=require('three');
require('./load-typescript.cjs');
const {createWideTruss}=require('../components/pavilion/wide-truss-geometry.ts');
const {mapTimberGrain}=require('../components/pavilion/timber-grain.ts');
function contains(poly,p){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside}return inside}
function crosses(a,b,c,d){const cross=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);return cross(a,b,c)*cross(a,b,d)<-1e-12&&cross(c,d,a)*cross(c,d,b)<-1e-12}
function overlaps(a,b){return a.some(p=>contains(b,p))||b.some(p=>contains(a,p))||a.some((p,i)=>b.some((q,j)=>crosses(p,a[(i+1)%a.length],q,b[(j+1)%b.length])))}
let count=0;
for(const width of [18,20,22,24,28,30,32])for(const pitch of [2/3,.5])for(const height of [6,8,10])for(const style of ['arch','hammer']){
 const span=(width*12-7.5)*.0254,half=span/2,rise=half*pitch,model=createWideTruss(style,span,rise,height),p=model.profile;
 const members=model.members.map(m=>({...m}));
 // Cross-section of the live PlumbRafter at and inside its post seat.
 for(const side of [-1,1]){const t=p*Math.hypot(1,pitch)/2;members.push({id:`rafter.${side}`,outline:[[0,rise+t],[side*half,t],[side*half,-t],[0,rise-t]]})}
 const graph=members.map(a=>members.flatMap((b,j)=>a!==b&&overlaps(a.outline,b.outline)?[j]:[]));
 const reached=new Set([0]),todo=[0];while(todo.length)for(const j of graph[todo.pop()])if(!reached.has(j)){reached.add(j);todo.push(j)}
 assert.equal(reached.size,members.length,`${style} ${width}'/${pitch}/${height}: disconnected ${members.filter((_,i)=>!reached.has(i)).map(m=>m.id)}`);
 for(const m of model.members){
  const pos=m.geometry.attributes.position;
  for(let i=0;i<pos.count;i++){assert(Number.isFinite(pos.getX(i)+pos.getY(i)+pos.getZ(i)));assert(pos.getY(i)<=model.roofTop-Math.abs(pos.getX(i))*pitch+.00001,'Timber above roof plane')}
  assert(Math.abs(m.geometry.boundingBox.max.z-m.geometry.boundingBox.min.z-5.5*.0254)<1e-6,'Depth must not grow with span');
  const grain=mapTimberGrain(m.geometry);assert.equal(grain.userData.timberAxes.length,1,'One continuous solid per timber');grain.dispose();
 }
 for(const j of model.plates)assert(members.some(m=>contains(m.outline,j.point)),`Floating plate ${style} ${width} ${j.id}`);
 const wing=model.members.find(m=>m.id.endsWith('wing.r'));
 if(wing){assert(contains(wing.outline,[half*.25,rise*.38*(1-.25**2)]),'Continuous arch curve');assert(!contains(wing.outline,[half*.25,rise*.38*(1-.25**2)-p]),'Open beneath curved chord');}
 const knee=model.members.find(m=>m.id.endsWith('knee.r'));
 if(knee){assert(knee.geometry.boundingBox.max.y-knee.geometry.boundingBox.min.y>rise*.3,'Hammer must have tall curved knees, not short corbels');}
 model.members.forEach(m=>m.geometry.dispose());model.plates.forEach(m=>m.geometry.dispose());count++;
}
console.log(`Wide trusses passed: ${count} width/pitch/section/style combinations; connected timbers and rafters, attached plates, roof clearance, curved openings and longitudinal grain.`);
