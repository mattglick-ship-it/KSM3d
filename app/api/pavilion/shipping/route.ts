import {z} from 'zod';
import {readCommerceRequest,commerceError} from '@/lib/commerce-request.server';
import {ksmService} from '@/lib/ksm-service.server';
export async function POST(request:Request){try{
 const {address}=z.object({address:z.string().trim().min(5).max(500)}).parse(await readCommerceRequest(request));
 const data=await ksmService('calculate-shipping',{address});
 const miles=Number(data.miles),cost=Number(data.shippingCost);
 if(!Number.isFinite(miles)||miles<0||!Number.isFinite(cost)||cost<0)throw new Error('Delivery estimate is unavailable. KSM can quote delivery.');
 return Response.json({miles,cost,outOfRange:miles>200});
}catch(error){return commerceError(error)}}
