// Static orthographic 3D style diagrams. No extra WebGL contexts in the menu.
import * as THREE from 'three';
import {createRequire} from 'node:module';
const sharp=createRequire(import.meta.url)('sharp');
import {mkdir, writeFile} from 'node:fs/promises';
const camera=new THREE.OrthographicCamera(-3.75,3.75,2.65,-2.65,0.1,50);
camera.position.set(4,3.4,13);camera.lookAt(0,1.6,0);camera.updateMatrixWorld();
const light=new THREE.Vector3(-0.4,0.85,1).normalize();
const faces=[];
function addGeometry(geometry,position=new THREE.Vector3(),rotation=0){
 const mesh=new THREE.Mesh(geometry);mesh.position.copy(position);mesh.rotation.z=rotation;mesh.updateMatrixWorld();
 const g=geometry.index?geometry.toNonIndexed():geometry;const p=g.attributes.position;
 for(let i=0;i<p.count;i+=3){
  const v=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,i+j).applyMatrix4(mesh.matrixWorld));
  const n=v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0])).normalize();
  if(n.dot(camera.position.clone().sub(v[0]))<=0)continue;
  const shade=0.62+Math.max(0,n.dot(light))*0.38;
  const color=[224,191,141].map(c=>Math.round(c*shade));
  const depth=v.reduce((sum,q)=>sum+q.clone().applyMatrix4(camera.matrixWorldInverse).z,0)/3;
  const points=v.map(q=>q.clone().project(camera)).map(q=>`${((q.x+1)*240).toFixed(2)},${((1-q.y)*170).toFixed(2)}`).join(' ');
  faces.push({depth,svg:`<polygon points="${points}" fill="rgb(${color})" stroke="rgb(${color})" stroke-width="0.5"/>`});
 }
}
function beam(x1,y1,x2,y2,t=0.19,z=0){
 addGeometry(new THREE.BoxGeometry(Math.hypot(x2-x1,y2-y1),t,0.25),new THREE.Vector3((x1+x2)/2,(y1+y2)/2,z),Math.atan2(y2-y1,x2-x1));
}
function arch(x1,y1,cx,cy,x2,y2,t=0.19){
 const shape=new THREE.Shape();shape.moveTo(x1,y1);shape.quadraticCurveTo(cx,cy,x2,y2);
 shape.lineTo(x2,y2+t);shape.quadraticCurveTo(cx,cy+t,x1,y1+t);shape.closePath();
 const g=new THREE.ExtrudeGeometry(shape,{depth:0.25,bevelEnabled:true,bevelSize:0.008,bevelThickness:0.008,bevelSegments:1,steps:1,curveSegments:24});
 g.translate(0,0,-0.125);addGeometry(g);
}
await mkdir('public/truss-icons',{recursive:true});
for(const style of ['king','arch','hammer']){
 faces.length=0;
 beam(-2.8,1,0,3.15,0.22);beam(0,3.15,2.8,1,0.22);
 beam(-2.5,0.15,-2.5,1.2,0.22);beam(2.5,0.15,2.5,1.2,0.22);
 if(style==='king'){
  beam(-2.6,1.07,2.6,1.07,0.23);beam(0,1.1,0,3.04,0.23);
  beam(0,1.2,-1.35,2.05,0.17);beam(0,1.2,1.35,2.05,0.17);
 }else if(style==='arch'){
  arch(-2.5,0.88,0,2.4,2.5,0.88,0.23);
  beam(0,1.74,0,3.04,0.22);
  beam(-1.45,1.47,-1.05,2.26,0.16);beam(1.45,1.47,1.05,2.26,0.16);
 }else{
  beam(-2.75,1.03,-1.28,1.03,0.22);beam(1.28,1.03,2.75,1.03,0.22);
  beam(-1.35,0.94,-1.35,2.1,0.2);beam(1.35,0.94,1.35,2.1,0.2);
  beam(-1.45,2.06,1.45,2.06,0.18);beam(0,1.96,0,3.05,0.2);
  arch(-1.35,1.12,-1.12,1.85,-0.25,1.98,0.17);arch(0.25,1.98,1.12,1.85,1.35,1.12,0.17);
  beam(-2.48,0.45,-1.86,0.96,0.16);beam(2.48,0.45,1.86,0.96,0.16);
 }
 faces.sort((a,b)=>a.depth-b.depth);
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="480" height="340" viewBox="0 0 480 340"><defs><filter id="shadow" x="-50%" width="200%"><feGaussianBlur stdDeviation="9"/></filter></defs><ellipse cx="240" cy="270" rx="153" ry="12" fill="#19332c" opacity=".16" filter="url(#shadow)"/>${faces.map(f=>f.svg).join('')}</svg>`;
 await sharp(Buffer.from(svg)).png().toFile(`public/truss-icons/${style}.png`);
}
