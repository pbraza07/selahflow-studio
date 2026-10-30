import {requireOwner} from '../../../../lib/auth';
import {getPool} from '../../../../server/database.mjs';
import {validOrigin,trustedOrigin,tokenHash,sessionToken} from '../../../../server/security.mjs';
import {platformBillingInfo,startPlatformSubscription,platformBillingPortal} from '../../../../server/platform-billing.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
const fail=(e:unknown)=>Response.json({error:(e as Error).message},{status:(e as Error).message==='AUTH_REQUIRED'?401:400,headers});
export async function GET(req:Request){try{return Response.json(await platformBillingInfo(getPool(),await requireOwner(req)),{headers});}catch(e){return fail(e);}}
export async function POST(req:Request){if(!validOrigin(req))return Response.json({error:'Invalid origin.'},{status:403,headers});try{const owner=await requireOwner(req),raw=await req.text();if(raw.length>3500)throw Error('Invalid request.');const b=JSON.parse(raw),origin=trustedOrigin(req),pool=getPool();const actual=(await pool.query('SELECT user_id FROM sessions WHERE token_hash=$1 AND expires_at>now()',[tokenHash(sessionToken(req)||'')])).rows[0];if(actual?.user_id!==owner)throw Error('Only the business owner can authorize package billing.');if(b.action==='portal')return Response.json(await platformBillingPortal(pool,{owner,origin}),{headers});return Response.json(await startPlatformSubscription(pool,{owner,planCode:b.planCode,agreement:b.agreement,origin,ipHash:tokenHash((req.headers.get('x-forwarded-for')||'unknown').split(',').at(-1))}),{headers});}catch(e){return fail(e);}}
