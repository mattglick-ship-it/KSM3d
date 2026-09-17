import {z} from 'zod';
import {readCommerceRequest,commerceError} from '@/lib/commerce-request.server';
import {ksmService} from '@/lib/ksm-service.server';
export async function POST(request:Request){try{
 const {orderId}=z.object({orderId:z.string().regex(/^[A-Za-z0-9_-]+$/).max(100)}).parse(await readCommerceRequest(request));
 // Verification is performed by KSM against Square, never by a URL flag.
 const result=await ksmService('square-confirm-order',{orderId});
 return Response.json({paid:result.ok===true&&typeof result.status==='string'&&['paid','fulfilled'].includes(result.status)});
}catch(error){return commerceError(error)}}
