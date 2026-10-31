import {supportActor} from '../../../../server/platform-support.mjs';
import {requireOwner} from '../../../../lib/auth';
import {getPool} from '../../../../server/database.mjs';
import {validOrigin,trustedOrigin} from '../../../../server/security.mjs';
import {cashBillingInfo,statementDetail,startCashBillingSetup,cashInvoicePaymentLink,reconcileCashSetup} from '../../../../server/cash-commission-billing.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
const uuid=(s:unknown)=>typeof s==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(s);
async function context(req:Request){const owner=await requireOwner(req),pool=getPool();const b=(await pool.query("SELECT id FROM businesses WHERE owner_id=$1 AND status='active'",[owner])).rows[0];if(!b)throw Error('Business unavailable.');return {owner,pool,businessId:b.id};}
function failure(e:unknown){const m=(e as Error).message;return Response.json({error:m==='AUTH_REQUIRED'?'Sign in as the business owner.':m},{status:m==='AUTH_REQUIRED'?401:400,headers});}
export async function GET(req:Request){try{const {pool,businessId}=await context(req),id=new URL(req.url).searchParams.get('statement');if(id){if(!uuid(id))throw Error('Invalid statement reference.');return Response.json(await statementDetail(pool,businessId,id),{headers});}return Response.json(await cashBillingInfo(pool,businessId),{headers});}catch(e){return failure(e);}}
export async function POST(req:Request){if(!validOrigin(req))return Response.json({error:'Invalid origin.'},{status:403,headers});try{const {owner,pool,businessId}=await context(req),raw=await req.text();if(raw.length>2500)throw Error('Request too large.');const input=JSON.parse(raw);
 if(input.action==='setup'){const actor=await supportActor(pool,req);if(actor.id!==owner)throw Error('Only the signed-in business owner can authorize a billing card.');return Response.json(await startCashBillingSetup(pool,{businessId,owner,input,origin:trustedOrigin(req)}),{headers});}
 if(input.action==='pay'){if(!uuid(input.id))throw Error('Invalid statement reference.');return Response.json(await cashInvoicePaymentLink(pool,businessId,input.id),{headers});}
 if(input.action==='refresh'){const pending=(await pool.query('SELECT c.stripe_setup_session_id FROM commission_billing_profiles p JOIN commission_billing_consents c ON c.id=p.pending_consent_id WHERE p.business_id=$1',[businessId])).rows[0];if(pending?.stripe_setup_session_id)await reconcileCashSetup(pool,pending.stripe_setup_session_id);return Response.json(await cashBillingInfo(pool,businessId),{headers});}
 throw Error('Choose a valid billing action.');}catch(e){return failure(e);}}
