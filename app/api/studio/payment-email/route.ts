import {requireOwner} from '../../../../lib/auth';
import {getPool} from '../../../../server/database.mjs';
import {validOrigin,trustedOrigin} from '../../../../server/security.mjs';
import {queueOwnerPaymentEmail} from '../../../../server/owner-payment-email.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
export async function POST(req:Request){if(!validOrigin(req))return Response.json({error:'Invalid origin.'},{status:403,headers});try{const owner=await requireOwner(req),raw=await req.text();if(raw.length>2000)return Response.json({error:'Request too large.'},{status:413,headers});return Response.json(await queueOwnerPaymentEmail(getPool(),{owner,input:(()=>{try{return JSON.parse(raw);}catch{throw Object.assign(Error('Invalid request.'),{status:400});}})(),origin:trustedOrigin(req)}),{headers});}catch(e:any){return Response.json({error:e.message==='AUTH_REQUIRED'?'Sign in as the business owner.':e.status?e.message:'Payment email could not be queued.'},{status:e.message==='AUTH_REQUIRED'?401:e.status||503,headers});}}
