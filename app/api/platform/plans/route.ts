import {randomUUID} from 'node:crypto';
import {getPool} from '../../../../server/database.mjs';
import {requireOwner} from '../../../../lib/auth';
import {validOrigin} from '../../../../server/security.mjs';
import {getPlatformRole} from '../../../../server/platform-roles.mjs';
import {PLAN_CODES,planEntitlements} from '../../../../server/plan-entitlements.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const response=(body:unknown,status=200)=>Response.json(body,{status,headers});
function fail(e:unknown){
 const msg=(e as Error).message||'Unable to update business plan.';
 if(msg==='AUTH_REQUIRED')return response({error:'Sign in as a platform administrator.'},401);
 if(msg==='FORBIDDEN')return response({error:'Primary platform administrator access required.'},403);
 const status=/unchanged|already|Stripe|subscription|changed/i.test(msg)?409:
  /valid|select|confirm|reason|acknowledge|active|not found/i.test(msg)?400:503;
 if(status===503)console.error('Platform subscription entitlement assignment failed',e);
 return response({error:status===503?'Unable to manage the plan right now.':msg},status);
}
async function admin(req:Request){
 const pool=getPool(),actor=await requireOwner(req),role=await getPlatformRole(pool,actor);
 if(!role)throw Error('FORBIDDEN');
 return {pool,actor,role};
}
export async function GET(req:Request){
 try{
  const {pool,role}=await admin(req);
  const [businesses,audit]=await Promise.all([
   pool.query("SELECT b.id,b.name,b.slug,b.status,b.owner_id,s.plan_code,s.status AS subscription_status,s.stripe_subscription_id FROM businesses b LEFT JOIN business_subscriptions s ON s.business_id=b.id ORDER BY CASE WHEN b.status='active' THEN 0 ELSE 1 END,b.name"),
   pool.query("SELECT a.business_id,b.name AS business_name,a.previous_plan,a.new_plan,a.reason,a.created_at FROM business_plan_entitlement_audit a JOIN businesses b ON b.id=a.business_id ORDER BY a.created_at DESC LIMIT 30")
  ]);
  return response({canChange:role==='primary',businesses:businesses.rows.map((b:any)=>({
   id:b.id,name:b.name,slug:b.slug,status:b.status,planCode:b.plan_code||'free',
   planBenefits:planEntitlements(b.plan_code,b.subscription_status),
   hasConnectedSubscription:!!b.stripe_subscription_id
  })),recentChanges:audit.rows});
 }catch(e){return fail(e);}
}
export async function POST(req:Request){
 if(!validOrigin(req))return response({error:'Invalid request origin.'},403);
 let client:any;
 try{
  const {pool,actor,role}=await admin(req);
  if(role!=='primary')throw Error('FORBIDDEN');
  const raw=await req.text();if(raw.length>2200)return response({error:'Plan assignment request is too large.'},413);
  const payload=JSON.parse(raw);
  if(!payload||typeof payload!=='object'||Array.isArray(payload)||
   typeof payload.businessId!=='string'||!/^[0-9a-f-]{36}$/i.test(payload.businessId)||
   !PLAN_CODES.includes(payload.planCode)||
   typeof payload.confirmName!=='string'||payload.confirmName.length>100||
   payload.acknowledgeNoPayment!==true||
   typeof payload.reason!=='string'||payload.reason.trim().length<10||
   payload.reason.trim().length>1000||/[<>\u0000-\u001f]/.test(payload.reason))
    throw Error('Select a valid business and plan, enter a reason of 10–1000 characters and acknowledge that this does not collect payment.');
  client=await pool.connect();
  await client.query('BEGIN');
  const b=(await client.query("SELECT id,name,status FROM businesses WHERE id=$1 FOR UPDATE",[payload.businessId])).rows[0];
  if(!b)throw Error('Business not found.');
  if(b.status!=='active')throw Error('Only active businesses may have plan entitlements changed.');
  if(b.name!==payload.confirmName)throw Error('Confirm the exact business name before changing its plan.');
  const sub=(await client.query(
   'SELECT plan_code,status,stripe_subscription_id FROM business_subscriptions WHERE business_id=$1 FOR UPDATE',[b.id])).rows[0];
  if(!sub)throw Error('Business subscription record not found.');
  if(sub.stripe_subscription_id)throw Error('A connected Stripe subscription must be managed by its billing integration. Manual changes are not allowed.');
  if(sub.plan_code===payload.planCode&&sub.status==='active')throw Error('This business is already assigned that plan.');
  await client.query('UPDATE business_subscriptions SET plan_code=$1,status=$2,updated_at=now() WHERE business_id=$3',
   [payload.planCode,'active',b.id]);
  await client.query(
   'INSERT INTO business_plan_entitlement_audit(id,business_id,actor_id,previous_plan,new_plan,reason) VALUES($1,$2,$3,$4,$5,$6)',
   [randomUUID(),b.id,actor,sub.plan_code,payload.planCode,payload.reason.trim()]);
  await client.query('COMMIT');
  return response({ok:true,previousPlan:sub.plan_code,assignedPlan:payload.planCode,
   benefits:planEntitlements(payload.planCode,'active'),
   message:'Business plan benefits updated. This was an administrator entitlement change only; no subscription payment was collected. Existing customer records remain unchanged.'});
 }catch(e){if(client)try{await client.query('ROLLBACK');}catch{}return fail(e);}
 finally{client?.release();}
}
