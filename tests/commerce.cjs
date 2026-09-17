const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename;
Module._resolveFilename=function(id,...args){return resolve.call(this,id.startsWith('@/')?path.join(root,id.slice(2)):id,...args)};
for(const ext of ['.ts','.tsx'])require.extensions[ext]=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,file);
const {initialDesign,designSchema}=require('../components/pavilion/designer-model.ts'),{pavilionSummary,decodeDesignHash}=require('../lib/pavilion-commerce.ts');
for(const height of [8,9,10]){const design=designSchema.parse({...initialDesign,config:{...initialDesign.config,height}});assert.equal(pavilionSummary(design).postHeight,`${height} ft`);assert.ok(Number.isFinite(pavilionSummary(design).totalAmount));assert.deepEqual(decodeDesignHash('#design='+btoa(encodeURIComponent(JSON.stringify(design)))),design)}
assert.equal(designSchema.safeParse({...initialDesign,config:{...initialDesign.config,height:12}}).success,false);
const catalog=require('../lib/pricing/catalog.json');
require.cache[require.resolve('../lib/pricing/store.ts')]={exports:{loadPricing:async()=>catalog}};
const calls=[];
require.cache[require.resolve('../lib/ksm-service.server.ts')]={exports:{ksmService:async(name,body)=>{calls.push({name,body});if(name==='square-checkout')return {checkoutUrl:'https://square.link/u/offline',squareOrderId:'offline-order'};if(name==='square-confirm-order')return {ok:true,status:'pending'};if(name==='calculate-shipping')return {miles:25,shippingCost:100};if(name==='capture-pavilion-lead')return {success:true};throw Error('Unexpected service')}}};
const payload={design:initialDesign,customer:{name:'Offline Test',email:'test@example.invalid',phone:'00000',fulfillment:'delivery',address:'Offline address',notes:''},projectName:'Offline test',submissionId:'00000000-0000-4000-8000-000000000001',total:1};
const req=(data)=>new Request('https://example.invalid/api/pavilion/quote',{method:'POST',headers:{Origin:'https://example.invalid','Content-Type':'application/json'},body:JSON.stringify(data)});
(async()=>{
 const quoteRoute=require('../app/api/pavilion/quote/route.ts');
 const before=calls.length;
 for(const [body,origin,expected] of [['{','https://example.invalid',400],['{}','https://other.invalid',403],['x'.repeat(2000001),'https://example.invalid',413],['{}','https://example.invalid',400]]){
  const response=await quoteRoute.POST(new Request('https://example.invalid/api/pavilion/quote',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body}));assert.equal(response.status,expected);
 }
 assert.equal(calls.length,before,'Rejected requests must not contact external services');
 const quote=await require('../app/api/pavilion/quote/route.ts').POST(req(payload));assert.equal(quote.status,200);assert.deepEqual(calls.find(c=>c.name==='capture-pavilion-lead').body.config.delivery,{miles:25,cost:100,quoteRequired:false});
 const checkout=await require('../app/api/pavilion/checkout/route.ts').POST(req(payload));assert.equal(checkout.status,200);assert.equal(calls.find(c=>c.name==='square-checkout').body.items[0].unitPrice,2500);
 const status=await require('../app/api/pavilion/payment-status/route.ts').POST(req({orderId:'offline-order',force:true}));assert.equal((await status.json()).paid,false);assert.deepEqual(calls.at(-1).body,{orderId:'offline-order'});
 const {generateQuotePdf}=require('../lib/pavilion-quote-pdf.ts');const pdf=generateQuotePdf({projectName:'KSM pavilion sample',customer:{...payload.customer,fulfillment:'Pickup at KSM',notes:'Offline sample only. '.repeat(100)},quote:pavilionSummary(initialDesign)});fs.mkdirSync(path.join(root,'tmp/pdfs'),{recursive:true});fs.writeFileSync(path.join(root,'tmp/pdfs/quote-sample.pdf'),Buffer.from(pdf.output('arraybuffer')));
 console.log('Offline checks passed: post heights, shared links, quote delivery, fixed deposit, payment verification, and PDF generation. No external requests sent.');
})().catch(e=>{console.error(e);process.exitCode=1});
