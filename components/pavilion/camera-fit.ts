import * as THREE from 'three';

/** Fit the full pavilion/pad envelope in both dimensions of the viewport. */
export function pavilionCameraPosition(width:number,length:number,height:number,view:'3d'|'side'|'top',aspect:number,fov=40) {
 const target=new THREE.Vector3(0,1.5,0);
 const direction=new THREE.Vector3(...(view==='top'?[0,18,0.01]:view==='side'?[15,2.5,0]:[10,4.5,12]) as [number,number,number]).normalize();
 const right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),direction).normalize();
 const up=new THREE.Vector3().crossVectors(direction,right);
 const tanV=Math.tan(fov*Math.PI/360),tanH=tanV*Math.max(0.1,aspect);
 const halfW=(width+4)*0.3048/2,halfL=(length+4)*0.3048/2,top=(height+width/3+1)*0.3048;
 let distance=0;
 for(const x of [-halfW,halfW])for(const z of [-halfL,halfL])for(const y of [0,top]){
  const point=new THREE.Vector3(x,y,z).sub(target);
  distance=Math.max(distance,point.dot(direction)+1.12*Math.max(Math.abs(point.dot(right))/tanH,Math.abs(point.dot(up))/tanV));
 }
 return target.clone().addScaledVector(direction,distance);
}
