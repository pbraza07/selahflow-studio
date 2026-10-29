import {requireOwner} from '../../../../lib/auth';
import {getPool} from '../../../../server/database.mjs';
import {validOrigin} from '../../../../server/security.mjs';
import {paymentProviderSettings,savePaymentProviderPreference} from '../../../../server/payment-provider-settings.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
function failure(e:unknown){const msg=(e as Error).message;const status=msg==='AUTH_REQUIRED'?401:msg==='FORBIDDEN'?403:/^Choose |Request too large|JSON/.test(msg)?400:503;return Response.json({error:status===401?'Please sign in to manage payment setup.':status===403?'Business unavailable.':status===400?'Choose Stripe or Helcim. Only a setup preference can be saved.':'Payment setup is temporarily unavailable.'},{status,headers});}
export async function GET(req:Request){try{return Response.json(await paymentProviderSettings(getPool(),await requireOwner(req)),{headers});}catch(e){return failure(e);}}
export async function POST(req:Request){
 if(!validOrigin(req))return Response.json({error:'Invalid origin.'},{status:403,headers});
 try{const owner=await requireOwner(req);const raw=await req.text();if(raw.length>200)throw Error('Request too large.');return Response.json(await savePaymentProviderPreference(getPool(),owner,JSON.parse(raw)),{headers});}catch(e){return failure(e);}
}
