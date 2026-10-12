import {getPool} from '../../../../server/database.mjs';
import {requireOwner} from '../../../../lib/auth';
import {validOrigin} from '../../../../server/security.mjs';
import {getPlatformRole} from '../../../../server/platform-roles.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
const limits=['bookableStaff','services','bookingFields','sessionSeries','membershipPlans'];
async function context(req:Request){const pool=getPool(),actor=await requireOwner(req);if(await getPlatformRole(pool,actor)!=='primary')throw Error('Primary administrator access required.');return pool;}
export async function GET(req:Request){try{const pool=await context(req);const rows=(await pool.query('SELECT business_id,limits FROM business_entitlement_overrides')).rows;return Response.json({overrides:rows},{headers:{'Cache-Control':'no-store'}});}catch(e){return Response.json({error:(e as Error).message},{status:403});}}
export async function POST(req:Request){if(!validOrigin(req))return Response.json({error:'Invalid origin'},{status:403});try{
 const pool=await context(req),input=await req.json();
 const businessId=String(input.businessId||'');const found=(await pool.query('SELECT id FROM businesses WHERE id=$1',[businessId])).rows[0];if(!found)throw Error('Business not found.');
 const custom:any={};for(const key of limits){const value=input.limits?.[key];if(value!==undefined&&value!==null&&value!==''){if(!Number.isInteger(value)||value<0||value>100000)throw Error('Invalid '+key+' allowance.');custom[key]=value;}}
 await pool.query('INSERT INTO business_entitlement_overrides(business_id,limits) VALUES($1,$2::jsonb) ON CONFLICT(business_id) DO UPDATE SET limits=excluded.limits,updated_at=now()',[businessId,JSON.stringify(custom)]);
 return Response.json({ok:true,limits:custom});
}catch(e){return Response.json({error:(e as Error).message},{status:400});}}
