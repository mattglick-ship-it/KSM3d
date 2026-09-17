const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript'),T=require('three');
const source=ts.transpileModule(fs.readFileSync('components/pavilion/timber-grain.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const m={exports:{}};new Function('require','exports','module',source)(require,m.exports,m);const {mapTimberGrain}=m.exports;
function checkBox(geometry,axis,scale=new T.Vector3(1,1,1)){
 const before=geometry.attributes.uv.array.slice(),g=mapTimberGrain(geometry,scale),p=g.attributes.position,uv=g.attributes.uv,ends=g.attributes.timberEnd;
 assert.deepEqual(geometry.attributes.uv.array,before,'must not mutate source geometry');
 let sides=0,caps=0;
 for(let i=0;i<p.count;i+=3){if(ends.getX(i)){caps++;continue} sides++;for(let k=1;k<3;k++){
  const delta=new T.Vector3().fromBufferAttribute(p,i+k).sub(new T.Vector3().fromBufferAttribute(p,i)).multiply(scale);
  assert(Math.abs(Math.abs(uv.getX(i+k)-uv.getX(i))-Math.abs(delta.dot(axis)/2.4))<1e-5,'longitudinal U must follow the timber on every long face');
 }}
 assert.equal(sides,8);assert.equal(caps,4);g.dispose();geometry.dispose();
}
checkBox(new T.BoxGeometry(4,.18,.18),new T.Vector3(1,0,0));
checkBox(new T.BoxGeometry(.18,4,.18),new T.Vector3(0,1,0));
checkBox(new T.BoxGeometry(.18,.18,4),new T.Vector3(0,0,1));
checkBox(new T.BoxGeometry(4,.18,.18).rotateZ(Math.PI/5),new T.Vector3(Math.cos(Math.PI/5),Math.sin(Math.PI/5),0));
checkBox(new T.BoxGeometry(4,.18,.18).scale(-1,1,1),new T.Vector3(1,0,0),new T.Vector3(1.5,1,1));
(async()=>{const {GLTFLoader}=await import('three/examples/jsm/loaders/GLTFLoader.js');for(const w of [12,14,16,20]){
 const b=fs.readFileSync(`public/models/hammer${w}_truss.glb`),loader=new GLTFLoader();loader.register(()=>({name:'NO_TEXTURES',loadTexture:()=>Promise.resolve(null)}));const gltf=await loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');gltf.scene.traverse(mesh=>{if(!mesh.isMesh)return;const g=mapTimberGrain(mesh.geometry);assert(g.userData.timberAxes.length>=9,'imported truss needs independent timber directions');for(const v of g.attributes.uv.array)assert(Number.isFinite(v));g.dispose()});}
 console.log('Timber grain passed: all four faces on X/Y/Z, diagonal and mirrored timbers; scale, end grain, source isolation, all four imported hammer trusses.');
})().catch(e=>{console.error(e);process.exitCode=1});
