import {Html,Line} from '@react-three/drei';
export function Dimensions({width,length,height,pad}:{width:number;length:number;height:number;pad:boolean}){
 const w=width*.3048,l=length*.3048,h=height*.3048,y=pad?.2032:.025;
 const color='#19332c',z=l/2+.95,x=w/2+.95;
 const label=(text:string,position:[number,number,number])=><Html position={position} center style={{pointerEvents:'none'}}><span style={{display:'block',whiteSpace:'nowrap',background:'#fffef5',border:'1px solid #b98d44',borderRadius:4,padding:'5px 9px',color,fontFamily:'Gotham,Arial,sans-serif',fontSize:12}}>{text}</span></Html>;
 return <group><Line points={[[-w/2,y,z],[w/2,y,z]]} color={color} lineWidth={1.5}/>{[-w/2,w/2].map(a=><Line key={a} points={[[a,y,l/2],[a,y,z+.15]]} color={color} lineWidth={1}/>)}{label(width+'′',[0,y,z])}<Line points={[[x,y,-l/2],[x,y,l/2]]} color={color} lineWidth={1.5}/>{[-l/2,l/2].map(a=><Line key={a} points={[[w/2,y,a],[x+.15,y,a]]} color={color} lineWidth={1}/>)}{label(length+'′',[x,y,0])}<Line points={[[-w/2-.7,y,-l/2],[-w/2-.7,h+y,-l/2]]} color={color} lineWidth={1.5}/>{[y,h+y].map(a=><Line key={a} points={[[-w/2-.85,a,-l/2],[-w/2,a,-l/2]]} color={color} lineWidth={1}/>)}{label(height+'′ posts',[-w/2-.7,y+h/2,-l/2])}</group>;
}
