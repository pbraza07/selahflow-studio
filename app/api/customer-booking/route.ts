import {randomUUID} from 'node:crypto';
import {getPool} from '../../../server/database.mjs';
import {tokenHash,validOrigin} from '../../../server/security.mjs';
import {configured,validPushSubscription,allowedPushEndpoint} from '../../../server/push-crypto.mjs';
import {customerBookingDetails} from '../../../server/customer-booking-status.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex,nofollow'};
async function access(req:Request){
 const token=req.headers.get('authorization')?.replace(/^Bearer /i,'')||'';
 if(!/^[a-f0-9]{64}$/.test(token))throw Error('Invalid booking access token.');
 const pool=getPool(),hash=tokenHash(token);
 const r=(await pool.query("SELECT a.owner_id,a.booking_id,b.name AS business_name,b.slug AS business_slug FROM customer_booking_access a JOIN businesses b ON b.owner_id=a.owner_id WHERE a.token_hash=$1 AND a.expires_at>now() AND b.status='active'",[hash])).rows[0];
 if(!r)throw Error('Booking access expired or invalid.');
 return {pool,hash,...r};
}
export async function GET(req:Request){try{
 const c=await access(req);
 const item=await customerBookingDetails(c.pool,{ownerId:c.owner_id,bookingId:c.booking_id,businessName:c.business_name,businessSlug:c.business_slug});
 return Response.json({...item,pushConfigured:configured()},{headers});
}catch(e){return Response.json({error:(e as Error).message},{status:403,headers});}}
export async function POST(req:Request){
 if(!validOrigin(req))return Response.json({error:'Invalid origin'},{status:403,headers});
 try{
  const c=await access(req),raw=await req.text();
  if(raw.length>5000)return Response.json({error:'Device subscription is too large.'},{status:413,headers});
  const body=JSON.parse(raw);
  if(body.action==='status'||body.action==='unsubscribe'){
   if(!allowedPushEndpoint(body.endpoint))throw Error('Invalid push subscription.');
   if(body.action==='status'){
    const found=await c.pool.query('SELECT 1 FROM customer_booking_push WHERE owner_id=$1 AND booking_id=$2 AND endpoint=$3',[c.owner_id,c.booking_id,body.endpoint]);
    return Response.json({ok:true,subscribed:found.rows.length>0,configured:configured()},{headers});
   }
   await c.pool.query('DELETE FROM customer_booking_push WHERE owner_id=$1 AND booking_id=$2 AND endpoint=$3',[c.owner_id,c.booking_id,body.endpoint]);
   return Response.json({ok:true,subscribed:false},{headers});
  }
  if(body.action==='subscribe'){
   if(!configured())return Response.json({error:'Push delivery is not configured by the platform.'},{status:503,headers});
   if(!validPushSubscription(body.subscription))throw Error('Invalid push subscription.');
   const existing=(await c.pool.query('SELECT endpoint FROM customer_booking_push WHERE owner_id=$1 AND booking_id=$2',[c.owner_id,c.booking_id])).rows;
   if(existing.length>=10&&!existing.some((row:{endpoint:string})=>row.endpoint===body.subscription.endpoint))return Response.json({error:'Maximum 10 notification devices per booking.'},{status:409,headers});
   await c.pool.query("INSERT INTO customer_booking_push(id,owner_id,booking_id,token_hash,endpoint,p256dh,auth) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(owner_id,booking_id,endpoint) DO UPDATE SET token_hash=excluded.token_hash,p256dh=excluded.p256dh,auth=excluded.auth",[randomUUID(),c.owner_id,c.booking_id,c.hash,body.subscription.endpoint,body.subscription.keys.p256dh,body.subscription.keys.auth]);
   return Response.json({ok:true,subscribed:true},{headers});
  }
  throw Error('Unknown action.');
 }catch(e){return Response.json({error:(e as Error).message},{status:400,headers});}
}
