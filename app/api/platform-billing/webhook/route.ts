import {verifyStripeWebhook} from '../../../../server/membership-payments.mjs';
import {processPlatformBillingEvent} from '../../../../server/platform-billing.mjs';
import {getPool} from '../../../../server/database.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(req:Request){const raw=await req.text();if(raw.length>250000)return Response.json({error:'Payload too large.'},{status:413});let event;try{event=verifyStripeWebhook(raw,req.headers.get('stripe-signature'),process.env.STRIPE_PLATFORM_WEBHOOK_SECRET,Math.floor(Date.now()/1000),process.env,false);}catch{return Response.json({error:'Invalid platform payment signature.'},{status:400});}try{await processPlatformBillingEvent(getPool(),event);return Response.json({received:true});}catch{return Response.json({error:'Platform billing reconciliation unavailable.'},{status:503});}}
