import type {PavilionConfig} from '@/lib/pavilion-config';
import {pavilionStations} from '@/lib/pavilion-layout';

/** Feet are the same model coordinates used by Pavilion3D. Front is negative Z. */
export function createPlanSvg(config:PavilionConfig){
 const {width,length}=config,post=.625,stations=pavilionStations(width,length);
 const scale=Math.min(600/width,470/(length+post)),w=width*scale,h=length*scale,x=(820-w)/2,y=(640-h)/2;
 const px=(value:number)=>410+value*scale,py=(value:number)=>320-value*scale;
 const dim=(x1:number,y1:number,x2:number,y2:number,label:string,vertical=false)=>`<g stroke="#66736c" stroke-width="1"><path d="M${x1} ${y1}L${x2} ${y2}"/><path d="M${x1-5} ${y1-5}l10 10M${x2-5} ${y2-5}l10 10"/></g><text x="${(x1+x2)/2+(vertical?-14:0)}" y="${(y1+y2)/2+(vertical?0:-10)}" text-anchor="middle" ${vertical?`transform="rotate(-90 ${(x1+x2)/2-14} ${(y1+y2)/2})"`:''}>${label}</text>`;
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1230" height="960" viewBox="0 0 820 640" role="img" aria-label="Pavilion post and truss plan"><rect width="820" height="640" fill="white"/><g font-family="Arial,sans-serif" font-size="15" fill="#19332c"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#f9f7f1" stroke="#c9d0ca"/>
 ${stations.trussZ.filter(z=>!(config.hideBackTruss&&z===length/2)).map(z=>`<path d="M${x} ${py(z)}H${x+w}" stroke="#899e90" stroke-width="2" stroke-dasharray="7 5"/>`).join('')}
 ${[-1,1].map(sign=>`<path d="M${px(sign*(width-post)/2)} ${y}V${y+h}" stroke="#b98d44" stroke-width="${Math.max(3,post*scale*.65)}"/>`).join('')}
 ${stations.postZ.flatMap(z=>[-1,1].map(sign=>`<rect x="${px(sign*(width-post)/2)-post*scale/2}" y="${py(z)-post*scale/2}" width="${post*scale}" height="${post*scale}" fill="#19332c"/>`)).join('')}
 ${dim(x,y-34,x+w,y-34,`${width}′ overall post width`)}
 ${dim(x+w+36,y,x+w+36,y+h,`${length}′ end-post centers`,true)}
 ${stations.postZ.slice(1).map((z,i)=>dim(x-26,py(z),x-26,py(stations.postZ[i]),`${Number((z-stations.postZ[i]).toFixed(2))}′`,true)).join('')}
 <text x="410" y="${y+h+48}" text-anchor="middle" font-weight="bold">FRONT</text><text x="410" y="${y-65}" text-anchor="middle" font-weight="bold">REAR</text>
 <text x="410" y="${320-10}" text-anchor="middle">${width}′ × ${length}′ pavilion</text><text x="410" y="${320+14}" text-anchor="middle" font-size="13">${stations.postZ.length*2} posts · ${config.height}′ post height</text>
 <rect x="175" y="606" width="12" height="12" fill="#19332c"/><text x="195" y="618" font-size="13">Post</text><path d="M285 612h28" stroke="#b98d44" stroke-width="4"/><text x="323" y="618" font-size="13">Girder</text><path d="M435 612h30" stroke="#899e90" stroke-width="2" stroke-dasharray="7 5"/><text x="475" y="618" font-size="13">Truss position</text></g></svg>`;
}
export function PavilionPlan({config}:{config:PavilionConfig}){return <div className="pavilion-plan" dangerouslySetInnerHTML={{__html:createPlanSvg(config)}}/>}
export async function renderPlanImage(config:PavilionConfig){
 const url=URL.createObjectURL(new Blob([createPlanSvg(config)],{type:'image/svg+xml'}));
 try{const image=new Image();image.src=url;await image.decode();const canvas=document.createElement('canvas');canvas.width=1230;canvas.height=960;const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Could not create the plan drawing.');ctx.drawImage(image,0,0);return canvas.toDataURL('image/png')}finally{URL.revokeObjectURL(url)}
}
