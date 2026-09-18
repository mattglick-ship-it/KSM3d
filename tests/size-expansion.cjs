// Offline coverage for the reviewed September 2026 expansion. No live services.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename;
Module._resolveFilename=function(id,...args){return resolve.call(this,id.startsWith('@/')?path.join(root,id.slice(2)):id,...args)};
for(const ext of ['.ts','.tsx'])require.extensions[ext]=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,file);
const {initialDesign,designSchema}=require('../components/pavilion/designer-model.ts');
const {decodeDesignHash,pavilionSummary}=require('../lib/pavilion-commerce.ts');
const {CUSTOMER_PAVILION_SIZES,ROOF_MATERIALS,computeLinealFeet}=require('../lib/pavilion-config.ts');
const {pavilionStations,expandedFrame}=require('../lib/pavilion-layout.ts');
const {withExpandedSizes}=require('../lib/pricing/with-expanded-sizes.ts');
const {computeQuote,selectionFromConfig}=require('../lib/pricing/engine.ts');
const catalog=require('../lib/pricing/catalog.json');
const THREE=require('three'),{pavilionCameraPosition}=require('../components/pavilion/camera-fit.ts');
const expected={
 '12x12':[4,2,2,8], '12x14':[4,2,3,8], '12x40':[10,3,8,22],
 '14x26':[6,3,4,14], '16x16':[4,2,3,8], '16x32':[6,3,6,14],
 '16x40':[10,3,8,22], '20x30':[6,3,6,14], '20x36':[10,3,8,14],
};
assert.equal(CUSTOMER_PAVILION_SIZES.length,21);
assert.equal(new Set(CUSTOMER_PAVILION_SIZES.map(s=>`${s.width}x${s.length}`)).size,21);
assert.equal(catalog.sizes.length,21);
for(const size of CUSTOMER_PAVILION_SIZES)for(const aspect of [.45,.8,1.8,2.5])for(const view of ['3d','side','top']){
 const camera=new THREE.PerspectiveCamera(40,aspect,.1,200);camera.position.copy(pavilionCameraPosition(size.width,size.length,10,view,aspect));camera.lookAt(0,1.5,0);camera.updateMatrixWorld();
 for(const x of [-1,1])for(const z of [-1,1])for(const y of [0,(10+size.width/3+1)*.3048]){
  const p=new THREE.Vector3(x*(size.width+4)*.3048/2,y,z*(size.length+4)*.3048/2).project(camera);
  assert(Math.abs(p.x)<.9&&Math.abs(p.y)<.9,'Full model must fit '+JSON.stringify({size,aspect,view}));
 }
}

const designFor=(id,extra={})=>{const [width,length]=id.split('x').map(Number);return {...initialDesign,config:{...initialDesign.config,width,length,...extra}}};
for(const [id,[posts,trusses,pairs,braces]] of Object.entries(expected)) {
 const [width,length]=id.split('x').map(Number),layout=pavilionStations(width,length);
 assert.equal(layout.postZ.length*2,posts,id+' posts');assert.equal(layout.trussZ.length,trusses,id+' trusses');assert.equal(layout.rafterZ.length,pairs,id+' rafter pairs');
 assert.equal(expandedFrame(width,length).braces,braces,id+' braces, excluding screws');
 assert.equal(layout.postZ[0],-length/2);assert.equal(layout.postZ.at(-1),length/2);
 for(const stations of Object.values(layout))for(let i=0;i<stations.length;i++)assert(Math.abs(stations[i]+stations.at(-1-i))<1e-8,id+' symmetry');
 for(const z of layout.rafterZ)assert(!layout.trussZ.includes(z),id+' no overlapping rafter/truss');
 for(const truss of ['king','arch','hammer'])for(const height of [8,9,10]){
  const design=designSchema.parse(designFor(id,{truss,height}));
  assert.deepEqual(decodeDesignHash('#design='+btoa(encodeURIComponent(JSON.stringify(design)))),design);
  assert.equal(computeLinealFeet(design.config).posts,posts*height);
  assert(Number.isFinite(pavilionSummary(design).totalAmount));
 }
}
for(const id of ['10x10','18x20','24x24','30x40','12x32'])assert.equal(designSchema.safeParse(designFor(id)).success,false,id+' remains unavailable');
const verified={ '12x12':{shingles:5880.51,metal:5972.91},'12x40':{shingles:15368.06,metal:15533.98,standing_seam:19581.5},'14x26':{shingles:11779.35,metal:12054.83,standing_seam:15506.5},'16x32':{shingles:15164.62,metal:15482.48,standing_seam:19829.5}};
for(const [id,prices] of Object.entries(verified))assert.deepEqual(catalog.sizes.find(s=>s.id===id).basePriceByRoof,prices);
for(const id of ['12x14','16x16','16x40','20x30','20x36'])for(const roofId of ['shingle','metal','standing-seam'].map(type=>ROOF_MATERIALS.find(r=>r.type===type&&!r.textured).id)){
 const design=designFor(id,{roofId});const summary=pavilionSummary(design);
 assert.equal(summary.total,'To be quoted');assert(summary.pending.some(p=>p.startsWith('Base price')));
}
const priced=designFor('12x40',{roofId:ROOF_MATERIALS.find(r=>r.type==='metal'&&!r.textured).id});
const arch=computeQuote(selectionFromConfig({...priced.config,truss:'arch'}),catalog);
assert(arch.callForPricing.includes('arched_king truss'));assert.equal(arch.total,15533.98);
const legacy=structuredClone(catalog);legacy.sizes=legacy.sizes.filter(s=>!expected[s.id]);legacy.sizes[0].basePriceByRoof.metal=12345;
const snapshot=structuredClone(legacy),merged=withExpandedSizes(legacy);
assert.deepEqual(legacy,snapshot,'merge must not mutate original');assert.equal(merged.sizes.length,21);
assert.equal(merged.sizes.find(s=>s.id===legacy.sizes[0].id).basePriceByRoof.metal,12345,'preserve published override');
const held=merged.sizes.find(s=>s.id==='12x40');held.basePriceByRoof={};held.trussStyleUpgrade.hammer=0;
assert.deepEqual(withExpandedSizes(merged),merged,'repeated merge preserves explicit blank and zero prices');
require.cache[require.resolve('../lib/pricing/store.ts')]={exports:{loadPricing:async()=>catalog}};
let externalCalls=0;
require.cache[require.resolve('../lib/ksm-service.server.ts')]={exports:{ksmService:async()=>{externalCalls++;throw Error('Unexpected external request')}}};
(async()=>{
 const route=require('../app/api/pavilion/checkout/route.ts');
 for(const id of ['12x14','16x16','16x40','20x30','20x36']){
  const data={design:designFor(id),customer:{name:'Offline check',email:'test@example.invalid',phone:'00000',fulfillment:'pickup',address:'',notes:''},projectName:'Offline test',submissionId:'00000000-0000-4000-8000-000000000009'};
  const response=await route.POST(new Request('https://example.invalid/api/pavilion/checkout',{method:'POST',headers:{Origin:'https://example.invalid','Content-Type':'application/json'},body:JSON.stringify(data)}));
  assert.equal(response.status,400);assert.match((await response.json()).error,/confirm this pavilion price/i);
 }
 assert.equal(externalCalls,0,'pending base prices must not initiate payments');
 console.log('Size expansion passed: 21 footprints; nine layouts; all styles/heights/save links; reviewed prices; held prices; published overrides; pending-price checkout block.');
})().catch(e=>{console.error(e);process.exitCode=1});
