// Offline coverage for the reviewed September 2026 expansion. No live services.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename;
Module._resolveFilename=function(id,...args){return resolve.call(this,id.startsWith('@/')?path.join(root,id.slice(2)):id,...args)};
for(const ext of ['.ts','.tsx'])require.extensions[ext]=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,file);
const {initialDesign,designSchema}=require('../components/pavilion/designer-model.ts');
const {decodeDesignHash,pavilionSummary}=require('../lib/pavilion-commerce.ts');
const {CUSTOMER_PAVILION_SIZES,ROOF_MATERIALS,computeLinealFeet}=require('../lib/pavilion-config.ts');
const {pavilionStations,expandedFrame,availableTrusses,availableHeights,fitSize}=require('../lib/pavilion-layout.ts');
const {withExpandedSizes}=require('../lib/pricing/with-expanded-sizes.ts');
const {computeQuote,selectionFromConfig}=require('../lib/pricing/engine.ts');
const catalog=require('../lib/pricing/catalog.json');
const THREE=require('three'),{pavilionCameraPosition}=require('../components/pavilion/camera-fit.ts');
// Independent source values and the complete pre-expansion retail rows.
const expected=require('./fixtures/workbook-pavilion-prices.json');
const originals=require('./fixtures/original-pavilion-prices.json');
assert.equal(CUSTOMER_PAVILION_SIZES.length,33);
assert.equal(new Set(CUSTOMER_PAVILION_SIZES.map(s=>`${s.width}x${s.length}`)).size,33);
assert.equal(catalog.sizes.length,37);
for(const old of Object.values(originals))assert.deepEqual(catalog.sizes.find(s=>s.id===old.id),old,'Original row must remain exactly unchanged: '+old.id);
for(const size of CUSTOMER_PAVILION_SIZES)for(const aspect of [.45,.8,1.8,2.5])for(const view of ['3d','side','top']){
 const camera=new THREE.PerspectiveCamera(40,aspect,.1,200);camera.position.copy(pavilionCameraPosition(size.width,size.length,10,view,aspect));camera.lookAt(0,1.5,0);camera.updateMatrixWorld();
 for(const x of [-1,1])for(const z of [-1,1])for(const y of [0,(10+size.width/3+1)*.3048]){
  const p=new THREE.Vector3(x*(size.width+4)*.3048/2,y,z*(size.length+4)*.3048/2).project(camera);
  assert(Math.abs(p.x)<.9&&Math.abs(p.y)<.9,'Full model must fit '+JSON.stringify({size,aspect,view}));
 }
}

const designFor=(id,extra={})=>{const [width,length]=id.split('x').map(Number);return {...initialDesign,config:{...fitSize(initialDesign.config,width,length),...extra}}};
for(const [id,source] of Object.entries(expected)) {
 const {posts,trusses,rafterPairs:pairs,braces}=source;
 const [width,length]=id.split('x').map(Number),layout=pavilionStations(width,length),frame=expandedFrame(width,length);
 assert.equal(layout.postZ.length*2,posts,id+' posts');assert.equal(layout.trussZ.length,trusses,id+' trusses');assert.equal(layout.rafterZ.length,pairs,id+' rafter pairs');
 assert.equal(frame.braces,braces,id+' braces, excluding screws');assert.equal(frame.pitch,source.pitch);assert.equal(frame.baseHeight,source.baseHeight);
 assert.equal(layout.postZ[0],-length/2);assert.equal(layout.postZ.at(-1),length/2);
 for(const stations of Object.values(layout))for(let i=0;i<stations.length;i++)assert(Math.abs(stations[i]+stations.at(-1-i))<1e-8,id+' symmetry');
 for(const z of layout.rafterZ)assert(!layout.trussZ.includes(z),id+' no overlapping rafter/truss');
 const row=catalog.sizes.find(s=>s.id===id);
 assert.deepEqual(row.basePriceByRoof,source.prices,id+' exact workbook totals');assert.deepEqual(row.sourceCells,source.cells);
 for(const [roof,roofId] of [['shingles','shingle-charcoal-gray'],['metal','metal-black'],['standing_seam','ss-black']]) {
  const quote=computeQuote(selectionFromConfig(designFor(id,{roofId}).config),catalog);
  assert.equal(quote.lines.find(l=>l.label.startsWith('Base —')).amount,source.prices[roof],id+' base '+roof);
  const plateCharge=width>16&&!row.decorativeTrussPlates?.included?row.decorativeTrussPlates?.upcharge:0;
  assert.equal(quote.total,source.prices[roof]+(plateCharge??0),id+' base plus required plates');
  assert.deepEqual(quote.callForPricing,plateCharge==null?['Decorative Truss Plates']:[],id+' required package price status');
 }
 for(const truss of availableTrusses(width,length))for(const height of availableHeights(width,length)){
  if(width===18){assert.equal(designSchema.safeParse(designFor(id,{truss,height})).success,false,id+" removed from configurator");continue;}
  const design=designSchema.parse(designFor(id,{truss,height}));
  assert.deepEqual(decodeDesignHash('#design='+btoa(encodeURIComponent(JSON.stringify(design)))),design);
  assert.equal(computeLinealFeet(design.config).posts,posts*height);
  assert(Number.isFinite(pavilionSummary(design).totalAmount));
 }
}
// Required packages survive old saved designs and explicit attempts to omit them.
for(const {width,length} of CUSTOMER_PAVILION_SIZES){
 const raw=designFor(`${width}x${length}`,{trussPlates:false});
 const restored=designSchema.parse(raw);
 assert.equal(restored.config.trussPlates,width>16,'Plate threshold is strictly above 16 feet');
 const sel=selectionFromConfig(raw.config),quote=computeQuote({...sel,decorativeTrussPlates:false},catalog);
 assert.equal(sel.decorativeTrussPlates,width>16,'Selection always includes required plates');
 assert.equal(quote.lines.some(l=>l.label.startsWith('Decorative Truss Plates')),width>16,'Quote cannot omit required plate package');
 assert.equal(decodeDesignHash('#design='+btoa(encodeURIComponent(JSON.stringify(raw)))).config.trussPlates,width>16,'Old design links adopt plate requirement');
}
for(const id of ['12x32','24x28','28x32'])assert.equal(designSchema.safeParse(designFor(id)).success,false,id+' remains unavailable');
assert.equal(designSchema.safeParse(designFor('18x20',{truss:'king'})).success,false);
assert.equal(designSchema.safeParse(designFor('10x10',{truss:'arch'})).success,false);
for(const id of ['30x34','30x40','32x32'])for(const height of [8,9]){
 assert.equal(designSchema.safeParse(designFor(id,{height})).success,false);
 assert(computeQuote(selectionFromConfig(designFor(id,{height}).config),catalog).callForPricing.includes(`Height ${height}'`));
}
const arch=computeQuote(selectionFromConfig(designFor('12x40',{roofId:'metal-black',truss:'arch'}).config),catalog);
assert(arch.callForPricing.includes('arched_king truss'));assert.equal(arch.total,15533.98);
// Both old published catalogs and the prior nine-size release adopt approved
// bases once; existing retail and option overrides survive that adoption.
const legacy=structuredClone(catalog);delete legacy.meta.workbookPricingRevision;
legacy.sizes=legacy.sizes.filter(s=>!expected[s.id]||s.id==='12x40');
legacy.sizes.find(s=>s.id==='12x16').basePriceByRoof.metal=12345;
legacy.sizes.find(s=>s.id==='12x40').basePriceByRoof={};
legacy.sizes.find(s=>s.id==='12x40').trussStyleUpgrade.hammer=321;
const snapshot=structuredClone(legacy),merged=withExpandedSizes(legacy);
assert.deepEqual(legacy,snapshot,'merge must not mutate original');assert.equal(merged.sizes.length,37);
assert.equal(merged.sizes.find(s=>s.id==='12x16').basePriceByRoof.metal,12345,'preserve published retail override');
assert.deepEqual(merged.sizes.find(s=>s.id==='12x40').basePriceByRoof,expected['12x40'].prices);
assert.equal(merged.sizes.find(s=>s.id==='12x40').trussStyleUpgrade.hammer,321,'preserve option override');
const held=merged.sizes.find(s=>s.id==='12x40');held.basePriceByRoof={};held.trussStyleUpgrade.hammer=0;
assert.deepEqual(withExpandedSizes(merged),merged,'later admin edits preserve explicit blank and zero prices');
require.cache[require.resolve('../lib/pricing/store.ts')]={exports:{loadPricing:async()=>merged}};
let externalCalls=0;
require.cache[require.resolve('../lib/ksm-service.server.ts')]={exports:{ksmService:async()=>{externalCalls++;throw Error('Unexpected external request')}}};
(async()=>{
 const route=require('../app/api/pavilion/checkout/route.ts');
 const data={design:designFor('12x40'),customer:{name:'Offline check',email:'test@example.invalid',phone:'00000',fulfillment:'pickup',address:'',notes:''},projectName:'Offline test',submissionId:'00000000-0000-4000-8000-000000000009'};
 const response=await route.POST(new Request('https://example.invalid/api/pavilion/checkout',{method:'POST',headers:{Origin:'https://example.invalid','Content-Type':'application/json'},body:JSON.stringify(data)}));
 assert.equal(response.status,400);assert.match((await response.json()).error,/confirm this pavilion price/i);
 assert.equal(externalCalls,0,'pending base prices must not initiate payments');
 console.log('Size expansion passed: 33 offered footprints (18-foot widths removed), 25 workbook layouts and 75 roof prices; original twelve complete price records unchanged; supported packages/heights/save links; full camera fit; pricing migration and payment guard.');
})().catch(e=>{console.error(e);process.exitCode=1});
