// Regression checks for money and missing-rate behavior; never calls services.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),ts=require('typescript');
function load(file){const module={exports:{}};const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','module','exports',js)(name=>name.startsWith('@/')?load(path.resolve(name.slice(2)+'.ts')):require(name),module,module.exports);return module.exports}
const {computeQuote,selectionFromConfig}=load(path.resolve('lib/pricing/engine.ts'));
const {DEFAULT_CONFIG,ROOF_MATERIALS}=load(path.resolve('lib/pavilion-config.ts'));
const catalog=JSON.parse(fs.readFileSync('lib/pricing/catalog.json'));
const size=catalog.sizes[0],base={...DEFAULT_CONFIG,width:size.width,length:size.length,height:8,truss:'king',woodId:'smooth',roofId:ROOF_MATERIALS.find(r=>r.type==='standing-seam').id,snowGuards:false,snowRail:false,rafterTail:'standard',trussPlates:false,gableFascia:false};
const quote=(changes={},doc=catalog)=>computeQuote(selectionFromConfig({...base,...changes}),doc);
const total=quote().total;
assert(quote({snowGuards:true}).callForPricing.includes('Snow guards'));
assert.equal(quote({snowGuards:true}).total,total);
const priced=structuredClone(catalog);priced.options.snowGuards={price:{model:'bySize',amounts:{[size.id]:321.75}}};priced.options.snowRail={price:{model:'bySize',amounts:{[size.id]:654.25}}};
assert.equal(quote({snowGuards:true},priced).total,total+321.75);
assert(!quote({snowGuards:true},priced).callForPricing.includes('Snow guards'));
assert.equal(quote({snowRail:true},priced).total,total+654.25);
assert.equal(quote({snowGuards:false},priced).total,total);
for(const invalid of [-5,NaN,Infinity,'400',null]){priced.options.snowGuards.price.amounts[size.id]=invalid;assert(quote({snowGuards:true},priced).callForPricing.includes('Snow guards'))}
priced.options.snowGuards.price.amounts[size.id]=0;assert.equal(quote({snowGuards:true},priced).lines.find(l=>l.label==='Snow guards').amount,0);
const shingle=ROOF_MATERIALS.find(r=>r.type==='shingle').id;assert(!quote({roofId:shingle,snowGuards:true,snowRail:true},priced).lines.some(l=>l.label.startsWith('Snow')));
console.log('Snow pricing checks passed: exact deltas, pending rates, deselection, invalid rates, zero and shingles.');
