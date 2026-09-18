// Render engineering previews directly from the application's truss functions
// and procedural member drawings. This is a static triangle projection, not an extra
// WebGL context. Re-run after modifying model geometry or baked adjustments.
import * as THREE from 'three';
import ts from 'typescript';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const sharp=require('sharp');
require('./load-typescript.cjs');
const {createPartGeometry,createHammerScene}=require('../components/pavilion/procedural-geometry.ts');
const source=readFileSync('components/pavilion/Pavilion3D.tsx','utf8');
const ast=ts.createSourceFile('model.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const wanted=['KingTruss','ArchTruss','PlumbRafter','SnowGuards','SeamRidges'];
const functions=ast.statements.filter(s=>ts.isFunctionDeclaration(s)&&wanted.includes(s.name?.text)).map(s=>s.getText(ast)).join('\n');
const jsx=(type,props,...children)=>({type,props:{...props,children}});
const assets={};
for(const m of source.matchAll(/import (\w+) from "@\/assets\/([^\"]+)"/g))assets[m[1]]=JSON.parse(readFileSync('assets/'+m[2]));
const loadPart=(id,enabled=true)=>{if(!enabled)return null;const geom=createPartGeometry(id);geom.scale(.0254,.0254,.0254);geom.computeBoundingBox();return{geom,axis:0}};
const snowSource=readFileSync('lib/snow-retention.ts','utf8').replace(/^import .*;\n/gm,'').replace(/export /g,'');
const snowGuardPositions=new Function(ts.transpileModule(snowSource,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText+';return snowGuardPositions;')();
const env={snowGuardPositions,THREE,React:{createElement:jsx,Fragment:'fragment'},useMemo:fn=>fn(),useScrollCutRafterGeometry:()=>null,useSingleHammerPieceGeom:loadPart,WoodMaterial:p=>jsx('meshStandardMaterial',{color:'#deb87c',userData:{pieceKey:p.piece}}),contrastAccent:c=>c,...assets};
const compiled=ts.transpileModule(functions,{compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022}}).outputText;
const model=new Function(...Object.keys(env),compiled+';return {KingTruss,ArchTruss,PlumbRafter,SnowGuards,SeamRidges};')(...Object.values(env));
function object(node){
 if(!node||typeof node==='boolean')return null;
 if(Array.isArray(node)){const g=new THREE.Group();node.flat(Infinity).forEach(n=>{const o=object(n);if(o)g.add(o)});return g}
 if(typeof node.type==='function')return object(node.type(node.props));
 const p=node.props??{};
 if(node.type?.endsWith('Geometry'))return new THREE[node.type[0].toUpperCase()+node.type.slice(1)](...(p.args??[]));
 if(node.type==='meshStandardMaterial')return new THREE.MeshStandardMaterial({color:p.color??'#deb87c',userData:p.userData??{}});
 const o=node.type==='mesh'?new THREE.Mesh(p.geometry,new THREE.MeshStandardMaterial({color:'#deb87c'})):new THREE.Group();
 if(p.position)o.position.set(...p.position);if(p.rotation)o.rotation.set(...p.rotation);if(p.scale)o.scale.set(...p.scale);
 for(const c of (p.children??[]).flat(Infinity)){const ch=object(c);if(!ch)continue;if(ch.isBufferGeometry)o.geometry=ch;else if(ch.isMaterial)o.material=ch;else o.add(ch)}
 return o;
}
// Reuse the real PieceAdjuster implementation so mesh-centred scales/offsets
// and hidden pieces agree with the main view.
const paSource=readFileSync('components/pavilion/PieceAdjuster.tsx','utf8').replace(/^import .*;\n/gm,'').replace(/export /g,'');
let applyFrame;
const pa=new Function('THREE','useFrame',ts.transpileModule(paSource,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText+';return PieceAdjuster;')(THREE,fn=>{applyFrame=fn});
const defaultsSource=readFileSync('lib/pavilionBakedDefaults.ts','utf8');
const baked=new Function(ts.transpileModule(defaultsSource.replace(/export /g,''),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText+';return PAVILION_BAKED_DEFAULTS;')();
const ref=readFileSync('components/pavilion/reference-scene.tsx','utf8');
const archDefaults=ref.slice(ref.indexOf('const EXT0 ='),ref.indexOf('const ARCH_PIECE_ADJUSTS_DEFAULT'));
const arches=new Function(ts.transpileModule(archDefaults,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText+';return ARCH_PIECE_ADJUSTS_BAKED;')();
async function render(root,path,roof=false){
 root.updateMatrixWorld(true);
 const box=new THREE.Box3().setFromObject(root),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
 const aspect=roof?2:1.6,w=1280,h=w/aspect;
 const camera=new THREE.OrthographicCamera(-1,1,1,-1,.01,100);
 camera.position.copy(center).add(new THREE.Vector3(roof?3:.55,roof?3:.35,4).normalize().multiplyScalar(20));camera.lookAt(center);camera.updateMatrixWorld();
 const corners=[];for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])corners.push(new THREE.Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse));
 const cb=new THREE.Box3().setFromPoints(corners),cs=cb.getSize(new THREE.Vector3());const halfH=Math.max(cs.y,cs.x/aspect)*.59;
 camera.left=-halfH*aspect;camera.right=halfH*aspect;camera.top=halfH;camera.bottom=-halfH;camera.updateProjectionMatrix();
 const pixels=Buffer.alloc(w*h*3),zbuffer=new Float64Array(w*h).fill(-Infinity);
 for(let i=0;i<w*h;i++){pixels[i*3]=242;pixels[i*3+1]=241;pixels[i*3+2]=237}
 let count=0;
 const faces=[],light=new THREE.Vector3(-.5,.9,1).normalize();
 root.traverse(mesh=>{if(!mesh.isMesh||!mesh.visible)return;const geo=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry,p=geo.attributes.position;
 const base=(Array.isArray(mesh.material)?mesh.material[0]:mesh.material).color.clone().convertLinearToSRGB();
 for(let i=0;i<p.count;i+=3){const vertices=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,i+j).applyMatrix4(mesh.matrixWorld));const n=vertices[1].clone().sub(vertices[0]).cross(vertices[2].clone().sub(vertices[0])).normalize();if(n.dot(camera.position.clone().sub(vertices[0]))<=0)continue;
 const shade=.5+Math.max(0,n.dot(light))*.5;const rgb=[base.r,base.g,base.b].map(v=>Math.round(v*255*shade));
 const pv=vertices.map(v=>v.clone().project(camera)).map(v=>({x:(v.x+1)*w/2,y:(1-v.y)*h/2,z:-v.z}));
 const [a,b,c]=pv,den=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);if(Math.abs(den)<1e-10)continue;
 const xmin=Math.max(0,Math.floor(Math.min(a.x,b.x,c.x))),xmax=Math.min(w-1,Math.ceil(Math.max(a.x,b.x,c.x)));
 const ymin=Math.max(0,Math.floor(Math.min(a.y,b.y,c.y))),ymax=Math.min(h-1,Math.ceil(Math.max(a.y,b.y,c.y)));
 for(let y=ymin;y<=ymax;y++)for(let x=xmin;x<=xmax;x++){
  const u=((b.y-c.y)*(x+.5-c.x)+(c.x-b.x)*(y+.5-c.y))/den,v=((c.y-a.y)*(x+.5-c.x)+(a.x-c.x)*(y+.5-c.y))/den,t=1-u-v;
  if(u<0||v<0||t<0)continue;const z=u*a.z+v*b.z+t*c.z,index=y*w+x;if(z<=zbuffer[index])continue;
  zbuffer[index]=z;for(let k=0;k<3;k++)pixels[index*3+k]=rgb[k];
 }count++;
 }
 });
 await sharp(pixels,{raw:{width:w,height:h,channels:3}}).resize(640).png().toFile(path);console.log(path,count,'faces');
}
mkdirSync('public/truss-icons',{recursive:true});
for(const width of [12,14,16,20])for(const style of ['king','arch','hammer']){
 const span=width*.3048-.3,rise=span/3;let root;
 if(style==='hammer'){
  root=createHammerScene(width,new THREE.MeshStandardMaterial({color:'#deb87c'}));
 }else{root=object(model[style==='king'?'KingTruss':'ArchTruss']({span,z:0,baseY:0,peakY:rise,color:'#deb87c',seatLower:.1524,plates:false}));
  const adjusts=style==='arch'?(JSON.parse(baked['pav.archPieceAdjustsByWidth.v14-runtime-large-widths']??'null')??arches)[width]:(JSON.parse(baked['pav.pieceAdjustsByWidth.v24-hammer14scrollmatcharch']??'{}')[`king-${width}`]??{});
  pa({rootRef:{current:root},adjusts,cacheKey:width});applyFrame();
 }
 await render(root,`public/truss-icons/${style}-${width}.png`);
}
const roof=new THREE.Group();const slab=new THREE.Mesh(new THREE.BoxGeometry(1.4,.05,1.5),new THREE.MeshStandardMaterial({color:'#64716d'}));roof.add(slab);
roof.add(object(model.SeamRidges({slopeLen:1.4,panelDepth:1.5,color:'#64716d'})));
roof.add(object(model.SnowGuards({slopeLen:1.4,panelDepth:1.5,color:'#64716d'})));
mkdirSync('public/roof-details',{recursive:true});await render(roof,'public/roof-details/snow-guards.png',true);
