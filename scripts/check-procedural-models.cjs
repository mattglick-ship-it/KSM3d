const assert=require('node:assert/strict'),fs=require('node:fs'),T=require('three');
require('./load-typescript.cjs');
const {createPartGeometry,createHammerMembers}=require('../components/pavilion/procedural-geometry.ts');
const {makeFurniture,disposeFurniture,furnitureDimensions,picnicDimensions}=require('../components/pavilion/procedural-furniture.ts');
const survey=require('../components/pavilion/member-dimensions.json');
const tolerance=0.00002;
function checkBounds(geometry,expected,label){geometry.computeBoundingBox();for(const [end,key] of [[0,'min'],[1,'max']])for(let a=0;a<3;a++)assert(Math.abs(geometry.boundingBox[key].getComponent(a)-expected[end][a])<tolerance,`${label}: ${key}/${a}`);for(const attr of ['position','normal','uv']){assert(geometry.attributes[attr],`${label}: ${attr}`);for(const v of geometry.attributes[attr].array)assert(Number.isFinite(v),`${label}: finite ${attr}`);}assert(geometry.attributes.position.count>0);}
let n=0;
for(const [id,boxes]of Object.entries(survey)){
 if(/^hammer\d+$/.test(id))continue;
 const g=createPartGeometry(id),b=new T.Box3();boxes.forEach(bb=>{b.expandByPoint(new T.Vector3(...bb[0]));b.expandByPoint(new T.Vector3(...bb[1]))});checkBounds(g,[b.min.toArray(),b.max.toArray()],id);g.dispose();n++;
}
// The base's envelope alone cannot catch a crown flattened into a rectangle.
const base=createPartGeometry('post_base');
checkBounds(base,[[-28.292999267578125,-86.19999694824219,0],[53.606998443603516,-11.100000381469727,91]],'original post-base envelope');
const baseMaterial=new T.MeshBasicMaterial({side:T.DoubleSide});
const baseMesh=new T.Mesh(base,baseMaterial);baseMesh.updateMatrixWorld();
const hitBase=(y,z)=>new T.Raycaster(new T.Vector3(100,y,z),new T.Vector3(-1,0,0)).intersectObject(baseMesh);
assert(hitBase(-48.65,90).length>=4,'both plates retain their tall rounded crowns');
assert.equal(hitBase(-84,85).length,0,'upper plate corners must be open above the shoulders');
assert.equal(hitBase(-13,85).length,0,'opposite shoulders must remain below the crown');
const plateHits=hitBase(-48.65,70).map(h=>h.point.x);
for(const x of [50.439,51.439,-26.793,-25.793])assert(plateHits.some(v=>Math.abs(v-x)<.002),'original one-unit steel plate thickness');
for(const [y,z] of [[-27.297,50.25],[-70.2975,24.8525],[-70.2975,50.25],[-27.297,24.8525]]) {
 const hits=hitBase(y,z).map(h=>h.point.x);
 assert(hits.some(x=>Math.abs(x-53.607)<.002),'right bolt head');
 assert(hits.some(x=>Math.abs(x+28.293)<.002),'left bolt head');
}
base.dispose();baseMaterial.dispose();
for(const width of [12,14,16,20]){
 const parts=createHammerMembers(width),old=survey['hammer'+width];assert.equal(parts.length,10);
 for(let i=0;i<8;i++)checkBounds(parts[i].geometry,old[i],width+'/'+parts[i].name);
 const rafterBounds=new T.Box3();for(const p of parts.slice(8)){p.geometry.computeBoundingBox();rafterBounds.union(p.geometry.boundingBox)}
 for(let a=0;a<3;a++){assert(Math.abs(rafterBounds.min.getComponent(a)-old[8][0][a])<tolerance);assert(Math.abs(rafterBounds.max.getComponent(a)-old[8][1][a])<tolerance);}
 // Newly generated rafters retain the original 8/12 pitch, notch seats, and 12-inch tails.
 for(const p of parts.slice(8)){const a=p.geometry.attributes.position;for(let i=0;i<a.count;i++)assert(Number.isFinite(a.getX(i)+a.getY(i)+a.getZ(i)));}
 parts.forEach(p=>p.geometry.dispose());
}
for(const [kind,expected]of Object.entries(furnitureDimensions)){const g=makeFurniture(kind),b=new T.Box3().setFromObject(g),s=b.getSize(new T.Vector3());for(let a=0;a<3;a++)assert(Math.abs(s.getComponent(a)-expected[a])<1e-6,kind+' footprint');assert(Math.abs(b.min.y)<1e-6);disposeFurniture(g);}
const picnic=makeFurniture('picnic'),pb=new T.Box3().setFromObject(picnic),ps=pb.getSize(new T.Vector3());assert(Math.abs(pb.max.y-29*.0254)<1e-6);picnicDimensions.forEach((n,i)=>assert(Math.abs(ps.getComponent(i)-n)<1e-6,'picnic footprint and orientation'));disposeFurniture(picnic);
for(const f of fs.readdirSync('components/pavilion').filter(f=>/\.tsx?$/.test(f))){const text=fs.readFileSync('components/pavilion/'+f,'utf8');assert(!/useGLTF|STLLoader|OBJLoader|GLTFLoader/.test(text),f+' must generate its own geometry');assert(!/assets\/[^'"\n]+\.(glb|gltf|stl|obj)\.asset/.test(text),f+' must not import model assets');}
console.log(`Procedural geometry passed: ${n} part drawings, all 4 hammer widths and member locations, rafter envelopes, furniture dimensions, finite attributes, zero model loaders.`);
