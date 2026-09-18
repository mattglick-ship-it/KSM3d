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
const stock=new T.BoxGeometry(.18,3,.18),first=mapTimberGrain(stock,new T.Vector3(1,1,1),1),second=mapTimberGrain(stock,new T.Vector3(1,1,1),2);
assert.notEqual(first.attributes.timberSeed.getX(0),second.attributes.timberSeed.getX(0),'different timbers need subtle material variation');
assert.equal(new Set(first.attributes.timberSeed.array).size,1,'all faces of one timber share its variation');
stock.dispose();first.dispose();second.dispose();
require('./load-typescript.cjs');
const {createHammerMembers}=require('../components/pavilion/procedural-geometry.ts');
for(const w of [12,14,16,20]) {
 let axes=0;
 for(const p of createHammerMembers(w)){const g=mapTimberGrain(p.geometry);axes+=g.userData.timberAxes.length;for(const v of g.attributes.uv.array)assert(Number.isFinite(v));g.dispose();p.geometry.dispose();}
 assert(axes>=10,'each procedural hammer timber needs its own grain direction');
}
console.log('Timber grain passed: all four faces, X/Y/Z, diagonal, mirrored, scale, end grain, and all four procedural hammer trusses.');
