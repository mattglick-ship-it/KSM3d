import {ZodError} from 'zod';
export async function readCommerceRequest(request:Request){
 const origin=request.headers.get('origin');
 if(origin&&origin!==new URL(request.url).origin)throw new Error('Please submit from the KSM designer.');
 if(Number(request.headers.get('content-length')||0)>2000000)throw new Error('Request is too large.');
 const text=await request.text();if(text.length>2000000)throw new Error('Request is too large.');
 return JSON.parse(text);
}
export function commerceError(error:unknown){
 const message=error instanceof ZodError?error.issues[0]?.message:error instanceof Error?error.message:'Please try again.';
 return Response.json({error:message},{status:error instanceof ZodError?400:502});
}
