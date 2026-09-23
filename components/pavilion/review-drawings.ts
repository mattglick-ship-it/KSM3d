import * as THREE from 'three';
import type {PavilionConfig} from '@/lib/pavilion-config';

export type PavilionDrawings = {perspective:string;rearPerspective:string;front:string;rear:string;left:string;right:string;plan:string};
export const drawingKey=(design:{config:PavilionConfig;tableStain:string|null;deckStain:string|null})=>JSON.stringify([design.config,design.tableStain,design.deckStain]);
let registered:{key:string;render:()=>Omit<PavilionDrawings,'plan'>}|null=null;
export function registerReviewRenderer(key:string,render:()=>Omit<PavilionDrawings,'plan'>){
 const entry={key,render};registered=entry;
 return ()=>{if(registered===entry)registered=null};
}
export async function captureReviewDrawings(key:string,signal:AbortSignal){
 for(let attempt=0;attempt<150;attempt++){
  if(signal.aborted)throw new DOMException('Cancelled','AbortError');
  if(registered?.key===key){
   await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
   if(signal.aborted)throw new DOMException('Cancelled','AbortError');
   if(registered?.key===key)return registered.render();
  }
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 throw new Error('The pavilion is still loading. Wait for the 3D model, then retry the drawings.');
}

export function pavilionDrawingCamera(bounds:THREE.Box3,view:Exclude<keyof PavilionDrawings,'plan'>){
 const center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
 if(view==='perspective'||view==='rearPerspective'){
  const camera=new THREE.PerspectiveCamera(30,1.5,.01,300),direction=new THREE.Vector3(view==='perspective'?1:-1,.62,view==='perspective'?-1:1).normalize();
  camera.position.copy(center).add(direction);camera.lookAt(center);
  const inverse=camera.quaternion.clone().invert(),tanV=Math.tan(THREE.MathUtils.degToRad(15));
  let distance=0;
  for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
   const p=new THREE.Vector3(x,y,z).sub(center).applyQuaternion(inverse);
   distance=Math.max(distance,p.z+Math.abs(p.x)/(tanV*1.5),p.z+Math.abs(p.y)/tanV);
  }
  camera.position.copy(center).addScaledVector(direction,distance*1.12);camera.updateMatrixWorld();return camera;
 }
 // Every elevation shares the same orthographic span, including narrow end views.
 const span=Math.max(size.x,size.z,size.y*1.5)*1.15;
 const camera=new THREE.OrthographicCamera(-span/2,span/2,span/3,-span/3,.01,300);
 camera.position.copy(center).add(new THREE.Vector3(view==='right'?80:view==='left'?-80:0,0,view==='front'?-80:view==='rear'?80:0));
 camera.lookAt(center);camera.updateMatrixWorld();return camera;
}

/** Render a copy of the actual selected timber model without moving the live camera.
 * Geometry and materials belong to the live scene and must never be disposed here. */
export function renderPavilionDrawings(root:THREE.Group,environment:THREE.Texture|null){
 const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
 renderer.setSize(1200,800);renderer.setPixelRatio(1);renderer.setClearColor('#ffffff',1);
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
 const scene=new THREE.Scene();scene.environment=environment;
 const model=root.clone(true);scene.add(model);model.updateMatrixWorld(true);
 scene.add(new THREE.HemisphereLight('#ffffff','#d9ccba',1.3));
 const light=new THREE.DirectionalLight('#fff8ed',2.8);light.position.set(-8,14,-10);scene.add(light);
 const fill=new THREE.DirectionalLight('#ffffff',1.2);fill.position.set(8,10,10);scene.add(fill);
 try{
  const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3());
  if(bounds.isEmpty()||!Number.isFinite(size.length())||size.length()===0)throw new Error('The pavilion model is not ready. Retry the drawings.');
  const result={} as Omit<PavilionDrawings,'plan'>;
  for(const face of ['front','rear','left','right','perspective','rearPerspective'] as const){
   const camera=pavilionDrawingCamera(bounds,face);
   renderer.render(scene,camera);result[face]=renderer.domElement.toDataURL('image/jpeg',.9);
  }
  return result;
 }finally{scene.clear();renderer.dispose();renderer.forceContextLoss()}
}
