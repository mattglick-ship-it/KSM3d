// Offline document checks. No quote submission, customer email, or payment requests.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),ts=require('typescript');
const cache=new Map();
function load(file){
 if(cache.has(file))return cache.get(file);
 const module={exports:{}};
 const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 new Function('require','module','exports',js)(name=>{
  if(!name.startsWith('.')&&!name.startsWith('@/'))return require(name);
  const target=name.startsWith('@/')?path.resolve(name.slice(2)):path.resolve(path.dirname(file),name);
  if(target.endsWith('.json'))return require(target);
  return load(['.ts','.tsx'].map(ext=>target+ext).find(fs.existsSync));
 },module,module.exports);cache.set(file,module.exports);return module.exports;
}
async function main(){
 const {createPlanSvg}=load(path.resolve('components/pavilion/review-plan.tsx'));
 const {pavilionStations,fitSize}=load(path.resolve('lib/pavilion-layout.ts'));
 const {CUSTOMER_PAVILION_SIZES}=load(path.resolve('lib/pavilion-config.ts'));
 const {initialDesign}=load(path.resolve('components/pavilion/designer-model.ts'));
 const {pavilionSummary}=load(path.resolve('lib/pavilion-commerce.ts'));
 const {generateQuotePdf}=load(path.resolve('lib/pavilion-quote-pdf.ts'));
 const {pavilionDrawingCamera}=load(path.resolve('components/pavilion/review-drawings.ts'));
 const THREE=require('three');
 for(const {width,length} of CUSTOMER_PAVILION_SIZES){
  const config=fitSize(initialDesign.config,width,length),stations=pavilionStations(width,length);
  const bounds=new THREE.Box3(new THREE.Vector3(-width*.1524-.5,0,-length*.1524-.5),new THREE.Vector3(width*.1524+.5,5.8,length*.1524+.5));
  const cameras=['front','rear','left','right','perspective','rearPerspective'].map(view=>pavilionDrawingCamera(bounds,view));
  for(const camera of cameras)for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
   const point=new THREE.Vector3(x,y,z).project(camera);assert(Math.abs(point.x)<.94&&Math.abs(point.y)<.94&&Math.abs(point.z)<1,`Clipped drawing for ${width} × ${length}`);
  }
  assert(cameras.slice(0,4).every(camera=>camera.right===cameras[0].right));
  for(const hideBackTruss of [false,true]){
   const svg=createPlanSvg({...config,hideBackTruss});
   assert(!/NaN|Infinity|undefined/.test(svg));
   assert.equal((svg.match(/fill="#19332c"\/>/g)||[]).length,stations.postZ.length*2+1);
   assert.equal((svg.match(/stroke-dasharray="7 5"/g)||[]).length,stations.trussZ.length+(hideBackTruss?0:1));
   assert(svg.includes(`${width}′ overall post width`));assert(svg.includes(`${length}′ end-post centers`));
  }
 }
 const sharpDir=fs.readdirSync('node_modules/.pnpm').find(x=>x.startsWith('sharp@'));
 const sharp=require(path.resolve('node_modules/.pnpm',sharpDir,'node_modules/sharp'));
 const design={...initialDesign,config:fitSize(initialDesign.config,24,32)};
 const plan=await sharp(Buffer.from(createPlanSvg(design.config))).png().toBuffer();
 // Test fixture for placement; real model renderings are checked in the browser.
 const view=await sharp('public/truss-icons/king-24.png').resize(1200,800,{fit:'contain',background:'#ffffff'}).jpeg().toBuffer();
 const jpeg='data:image/jpeg;base64,'+view.toString('base64');
 const drawings={perspective:jpeg,rearPerspective:jpeg,front:jpeg,rear:jpeg,left:jpeg,right:jpeg,plan:'data:image/png;base64,'+plan.toString('base64')};
 const summary=pavilionSummary(design);
 const specs=[['Pavilion',summary.trussStyle],['Size',summary.size],['Post height',summary.postHeight],['Timber finish',summary.timberFinish],['Beam stain',summary.beamStain],['Ceiling stain',summary.deckboardStain],['Roof',summary.roofMaterial],['Rafter tails',summary.rafterTail],['Rear truss','Included'],['Snow guards','None'],['Snow rail','None']];
 const data={projectName:'Review verification — 24 × 32 pavilion',customer:{name:'Document QA',email:'qa@example.com',phone:'555-0100',fulfillment:'Pickup at KSM',notes:''},quote:summary,specs,drawings};
 fs.mkdirSync('tmp/pdfs',{recursive:true});
 const normal=generateQuotePdf(data);assert(normal.getNumberOfPages()>=4);fs.writeFileSync('tmp/pdfs/review-verification.pdf',Buffer.from(normal.output('arraybuffer')));
 const long=generateQuotePdf({...data,customer:{...data.customer,notes:'A long customer note to verify page wrapping and readable margins. '.repeat(30)},quote:{...summary,pending:['Scroll cut rafter tail requires a quote','Custom delivery and installation to be confirmed'],priceNote:'Estimate · some options require a quote'}});
 assert(long.getNumberOfPages()>normal.getNumberOfPages());fs.writeFileSync('tmp/pdfs/review-long-notes.pdf',Buffer.from(long.output('arraybuffer')));
 fs.writeFileSync('tmp/pdfs/review-plan.png',plan);
 console.log(`Review documents passed: ${CUSTOMER_PAVILION_SIZES.length} framing plans, rear-truss omission, finite dimensions, PDF drawings, pending prices and long-note pagination (${normal.getNumberOfPages()} / ${long.getNumberOfPages()} pages).`);
}
main().catch(e=>{console.error(e);process.exitCode=1});
