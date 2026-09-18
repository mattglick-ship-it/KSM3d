import * as THREE from 'three';

type Point = [number, number];
export type WideTrussStyle = 'arch' | 'hammer';
export type WideMember = {id:string;geometry:THREE.BufferGeometry;outline:Point[]};
export type WideJoint = {id:string;point:Point;width:number;height:number;angle?:number;peak?:boolean};

const IN=.0254;
function rectangle(a:Point,b:Point,thickness:number):Point[] {
  const length=Math.hypot(b[0]-a[0],b[1]-a[1]);
  const x=-(b[1]-a[1])/length*thickness/2,y=(b[0]-a[0])/length*thickness/2;
  return [[a[0]+x,a[1]+y],[b[0]+x,b[1]+y],[b[0]-x,b[1]-y],[a[0]-x,a[1]-y]];
}
function clip(points:Point[],a:number,b:number,limit:number):Point[] {
  const result:Point[]=[];
  for(let i=0;i<points.length;i++){
    const p=points[i],q=points[(i+1)%points.length],d=a*p[0]+b*p[1]-limit,e=a*q[0]+b*q[1]-limit;
    if(d<=0)result.push(p);
    if((d<=0)!==(e<=0)){const t=d/(d-e);result.push([p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1])]);}
  }
  return result;
}
export function extrudeOutline(outline:Point[],depth:number) {
  const shape=new THREE.Shape(outline.map(p=>new THREE.Vector2(...p)));shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,steps:1});
  geometry.translate(0,0,-depth/2);geometry.computeBoundingBox();return geometry;
}

/** Connected, dimension-driven versions of the working 16-foot silhouettes.
 * All positions use the same truss-local roof coordinates as the rafters.
 * Member sections stay constant as span changes; no whole-model stretching or
 * historical per-width offsets can pull these joints apart. */
export function createWideTruss(style:WideTrussStyle,span:number,rise:number,memberHeightIn=6) {
  const half=span/2,pitch=rise/half,profile=memberHeightIn*IN,depth=5.5*IN;
  const roofTop=rise+profile*Math.hypot(1,pitch)/2;
  const members:WideMember[]=[],joints:WideJoint[]=[];
  const insideRoof=(points:Point[])=>clip(clip(points,pitch,1,roofTop-.001),-pitch,1,roofTop-.001);
  const add=(id:string,points:Point[])=>{const outline=insideRoof(points);members.push({id:`wide.${style}.${id}`,outline,geometry:extrudeOutline(outline,depth)});};
  const beam=(id:string,a:Point,b:Point,t=profile)=>add(id,rectangle(a,b,t));
  const reflect=(points:Point[],side:number):Point[]=>points.map(([x,y])=>[side*x,y]);
  const pendant=(id:string,bottom:number,top:number,w:number)=>add(id,[[-w/2,top],[w/2,top],[w/2,bottom+.22*profile],[w*.36,bottom+.22*profile],[w*.36,bottom+.08*profile],[w*.24,bottom],[-w*.24,bottom],[-w*.36,bottom+.08*profile],[-w*.36,bottom+.22*profile],[-w/2,bottom+.22*profile]]);
  const kingTop=rise-profile*Math.hypot(1,pitch)/2+profile*.14;
  if(style==='arch'){
    const crown=rise*.38,archDepth=profile*.92;
    // Two sawn curved chords share a continuous crown at the king post.
    for(const side of [-1,1]){
      const upper:Point[]=[],lower:Point[]=[];
      for(let i=0;i<=48;i++){const x=half*i/48,y=crown*(1-(x/half)**2);upper.push([x,y+archDepth/2]);lower.push([x,y-archDepth/2]);}
      add(`wing.${side<0?'l':'r'}`,reflect([...upper,...lower.reverse()],side));
      const startX=profile*.25,startY=crown+profile*.18;
      const endX=(rise-profile*Math.hypot(1,pitch)/2+profile*.14-startY+.8*startX)/(pitch+.8);
      const endY=rise-pitch*endX-profile*Math.hypot(1,pitch)/2+profile*.14;
      // Start inside the king/chord joint, rather than floating above the arch.
      beam(`strut.${side<0?'l':'r'}`,[side*startX,startY],[side*endX,endY],profile*.78);
      joints.push({id:`heel.${side}`,point:[side*(half-profile*.22),profile*.1],width:profile*1.25,height:profile*.72});
      joints.push({id:`web.${side}`,point:[side*endX,endY],width:profile*.78,height:profile*1.15,angle:side*Math.atan(pitch)});
    }
    pendant('kingpost',crown-profile*1.12,kingTop,profile*.86);
    joints.push({id:'crown',point:[0,crown],width:profile*1.15,height:profile*1.2});
  } else {
    const collarY=rise*.46,princeX=(rise-collarY)/pitch,beamY=profile*.08,innerX=princeX-profile*1.15;
    // A continuous upper tie connects the princes and king post. End bevels
    // are cut against the roof planes, not independently scaled drawings.
    beam('collar',[-princeX-profile*.5,collarY],[princeX+profile*.5,collarY]);
    pendant('kingpost',collarY-profile*.92,kingTop,profile*.88);
    for(const side of [-1,1]){
      const id=side<0?'l':'r',outer=half+profile*.08;
      add(`hammer.${id}`,reflect([[outer,beamY+profile/2],[innerX,beamY+profile/2],[innerX,beamY-profile*.56],[innerX+profile*.16,beamY-profile*.56],[innerX+profile*.16,beamY-profile*.82],[innerX+profile*.4,beamY-profile*.82],[innerX+profile*.62,beamY-profile/2],[outer,beamY-profile/2]],side));
      beam(`prince.${id}`,[side*princeX,beamY],[side*princeX,collarY],profile*.9);
      // The curved knee spans from the hammer/prince joint to the underside
      // of the upper tie, recreating the open central arch of the 16' design.
      const curve=new THREE.QuadraticBezierCurve(new THREE.Vector2(princeX,beamY+profile*.18),new THREE.Vector2(princeX,collarY),new THREE.Vector2(princeX*.35,collarY));
      const upper:Point[]=[],lower:Point[]=[];
      for(let i=0;i<=48;i++){const t=i/48,p=curve.getPoint(t),v=curve.getTangent(t),n=new THREE.Vector2(-v.y,v.x).multiplyScalar(profile*.4);upper.push([p.x+n.x,p.y+n.y]);lower.push([p.x-n.x,p.y-n.y]);}
      add(`knee.${id}`,reflect([...upper,...lower.reverse()],side));
      joints.push({id:`heel.${side}`,point:[side*(half-profile*.25),beamY],width:profile*1.25,height:profile*.68});
      joints.push({id:`prince.${side}`,point:[side*princeX,collarY-profile*.12],width:profile*1.15,height:profile*.92});
    }
    joints.push({id:'collar',point:[0,collarY],width:profile*1.2,height:profile*1.15});
  }
  joints.push({id:'peak',point:[0,rise-profile*.55],width:profile*.82,height:profile*1.15,peak:true});
  // Plates are cut against exactly the same roof envelope as the timbers.
  const plates=joints.map(j=>{
    const c=Math.cos(j.angle??0),s=Math.sin(j.angle??0);
    const points:Point[]=[[-j.width/2,-j.height/2],[j.width/2,-j.height/2],[j.width/2,j.height/2],[-j.width/2,j.height/2]].map(([x,y])=>[j.point[0]+x*c-y*s,j.point[1]+x*s+y*c]);
    return {...j,geometry:extrudeOutline(insideRoof(points),.25*IN)};
  });
  return {members,plates,depth,profile,pitch,roofTop};
}
