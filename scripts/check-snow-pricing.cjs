// Offline checks: no customer, email, database, or payment requests.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),ts=require('typescript');
function load(file){const module={exports:{}};const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','module','exports',js)(name=>name.startsWith('@/')?load(path.resolve(name.slice(2)+'.ts')):name.startsWith('.')?load(path.resolve(path.dirname(file),name+'.ts')):require(name),module,module.exports);return module.exports}
const {computeQuote,selectionFromConfig,snowOptionQuote,fmtUSD}=load(path.resolve('lib/pricing/engine.ts'));
const {DEFAULT_CONFIG,ROOF_MATERIALS}=load(path.resolve('lib/pavilion-config.ts'));
const {snowGuardPositions,snowQuantities,snowRoofLength}=load(path.resolve('lib/snow-retention.ts'));
const catalog=JSON.parse(fs.readFileSync('lib/pricing/catalog.json'));
const config=(type,length=20,gableOverhang=true)=>({...DEFAULT_CONFIG,width:16,length,gableOverhang,roofId:ROOF_MATERIALS.find(r=>r.type===type).id,snowGuards:false,snowRail:false});
for(const size of catalog.sizes)for(const type of ['metal','standing-seam'])for(const overhang of [true,false]) {
 const c={...config(type,size.length,overhang),width:size.width};
 const q=snowQuantities(c,type);
 assert.equal(q.guards,2*snowGuardPositions(snowRoofLength(c),type).length);
 const base=computeQuote(selectionFromConfig(c),catalog).total;
 for(const key of ['snowGuards','snowRail']){
  const priced=snowOptionQuote(catalog,c,key);
  const expected=key==='snowGuards'?q.guards*7.5:type==='metal'?q.railSections*22.5:q.railFeet*22.5;
  assert.equal(priced.amount,Math.round(expected*100)/100);
  const quote=computeQuote(selectionFromConfig({...c,[key]:true}),catalog);
  assert(Math.abs(quote.total-base-priced.amount)<1e-7);
  assert(!quote.callForPricing.some(l=>l.startsWith('Snow')));
 }
}
assert.equal(snowOptionQuote(catalog,config('standing-seam'),'snowGuards').amount,345); // 46 pieces
assert.equal(snowOptionQuote(catalog,config('metal'),'snowGuards').amount,450); // 60 pieces
assert.equal(snowOptionQuote(catalog,config('metal'),'snowRail').amount,135); // 3 sections per side
assert.equal(snowOptionQuote(catalog,config('standing-seam'),'snowRail').amount,975); // 43 1/3 installed feet
assert.equal(snowOptionQuote(catalog,config('metal',20,false),'snowRail').amount,90);
assert.equal(fmtUSD(22.5),'$22.5');
const old=structuredClone(catalog);delete old.options.snowRetentionRates;
assert.equal(snowOptionQuote(old,config('metal'),'snowRail').amount,135); // old live catalogs inherit approved unit rates
for(const invalid of [-5,NaN,Infinity,'400',null]){const d=structuredClone(catalog);d.options.snowRetentionRates.guardEach=invalid;assert.equal(snowOptionQuote(d,config('metal'),'snowGuards').amount,null)}
const zero=structuredClone(catalog);zero.options.snowRetentionRates.guardEach=0;assert.equal(snowOptionQuote(zero,config('metal'),'snowGuards').amount,0);
assert(!computeQuote(selectionFromConfig({...config('shingle'),snowGuards:true,snowRail:true}),catalog).lines.some(l=>l.label.startsWith('Snow')));
console.log('Snow pricing passed: every catalog size, both metals, overhangs, rendered guard counts, sections, linear feet, cents, legacy catalogs, invalid/zero rates and shingles.');
