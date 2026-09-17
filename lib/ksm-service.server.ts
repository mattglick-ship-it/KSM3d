// Server-only gateway; the secret is supplied by Sites at runtime.
export async function ksmService(name: "capture-pavilion-lead" | "calculate-shipping" | "square-checkout" | "square-confirm-order", body: unknown) {
 const key=process.env.KSM_COMMERCE_SERVICE_KEY;
 if(!key)throw new Error("KSM commerce is not configured in this environment.");
 const response=await fetch("https://aymeshzwwffwvccwvzro.supabase.co/functions/v1/ksm-pavilion-commerce",{method:"POST",headers:{"Content-Type":"application/json","x-ksm-service-key":key},body:JSON.stringify({name,body}),signal:AbortSignal.timeout(30000)});
 const raw:unknown=await response.json();
 if(!raw||typeof raw!=="object"||Array.isArray(raw))throw new Error("Invalid KSM response");
 const data=raw as Record<string,unknown>;
 if(!response.ok||data.error)throw new Error(typeof data.error==="string"?data.error:"KSM service temporarily unavailable");
 return data;
}
