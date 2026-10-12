import {randomUUID} from 'node:crypto';
import {getPool} from '../../../server/database.mjs';
import {tokenHash,validOrigin} from '../../../server/security.mjs';
import {configured,validPushSubscription} from '../../../server/push-crypto.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex,nofollow'};
async function access(req:Request){
 const token=req.headers.get('authorization')?.replace(/^Bearer /i,'')||'';
 if(!/^[a-f0-9]{64}$/.test(token))throw Error('Invalid booking access token.');
 const pool=getPool();
 const r=(await pool.query("SELECT a.owner_id,a.booking_id,b.name AS business_name FROM customer_booking_access a JOIN businesses b ON b.owner_id=a.owner_id WHERE a.token_hash=$1 AND a.expires_at>now() AND b.status='active'",[tokenHash(token)])).rows[0];
 if(!r)throw Error('Booking access expired or invalid.');
 return {pool,...r};
}
async function details(c:any){
 const pending=(await c.pool.query("SELECT status,date,start_minute AS start,details FROM booking_requests WHERE owner_id=$1 AND id=$2",[c.owner_id,c.booking_id])).rows[0];
 if(pending){const d=JSON.parse(pending.details||'{}');return {status:pending.status==='approved'?'Confirmed':pending.status==='declined'?'Declined':pending.status==='cancelled'?'Cancelled':'Awaiting approval',date:pending.date,start:pending.start,services:d.services||[],business:c.business_name};}
 const appointment=(await c.pool.query("SELECT status,date,start,data FROM appointments WHERE owner=$1 AND id=$2",[c.owner_id,c.booking_id])).rows[0];
 if(!appointment)throw Error('Booking record not found.');
 const d=JSON.parse(appointment.data||'{}');return {status:appointment.status,date:appointment.date,start:appointment.start,services:d.services||[],business:c.business_name};
}
export async function GET(req:Request){try{const c=await access(req);return Response.json({...await details(c),pushConfigured:configured()},{headers});}catch(e){return Response.json({error:(e as Error).message},{status:403,headers});}}
export async function POST(req:Request){
 if(!validOrigin(req))return Response.json({error:'Invalid origin'},{status:403,headers});
 try{
  const c=await access(req),body=await req.json();
  if(body.action==='subscribe'){
   if(!configured())return Response.json({error:'Push delivery is not configured by the platform.'},{status:503,headers});
   if(!validPushSubscription(body.subscription))throw Error('Invalid push subscription.');
   await c.pool.query("INSERT INTO customer_booking_push(id,owner_id,booking_id,token_hash,endpoint,p256dh,auth) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(owner_id,booking_id,endpoint) DO UPDATE SET p256dh=excluded.p256dh,auth=excluded.auth",[randomUUID(),c.owner_id,c.booking_id,tokenHash(req.headers.get('authorization')!.replace(/^Bearer /i,'')),body.subscription.endpoint,body.subscription.keys.p256dh,body.subscription.keys.auth]);
   return Response.json({ok:true},{headers});
  }
  if(body.action==='unsubscribe'){
   await c.pool.query("DELETE FROM customer_booking_push WHERE owner_id=$1 AND booking_id=$2",[c.owner_id,c.booking_id]);return Response.json({ok:true},{headers});
  }
  throw Error('Unknown action.');
 }catch(e){return Response.json({error:(e as Error).message},{status:400,headers});}
}
