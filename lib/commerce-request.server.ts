import {ZodError} from 'zod';
class RequestError extends Error {
 constructor(message:string,readonly status:number){super(message)}
}
export async function readCommerceRequest(request:Request){
 const origin=request.headers.get('origin');
 if(origin&&origin!==new URL(request.url).origin)throw new RequestError('Please submit from the KSM designer.',403);
 if(Number(request.headers.get('content-length')||0)>2000000)throw new RequestError('Request is too large.',413);
 const reader=request.body?.getReader();
 const chunks:Uint8Array[]=[];let size=0;
 if(reader)while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2000000){await reader.cancel();throw new RequestError('Request is too large.',413)}chunks.push(value)}
 const body=new Uint8Array(size);let offset=0;for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.byteLength}
 try{return JSON.parse(new TextDecoder().decode(body))}catch{throw new RequestError('Please submit valid quote data.',400)}
}
export function commerceError(error:unknown){
 const message=error instanceof ZodError?error.issues[0]?.message:error instanceof Error?error.message:'Please try again.';
 return Response.json({error:message},{status:error instanceof RequestError?error.status:error instanceof ZodError?400:502});
}
