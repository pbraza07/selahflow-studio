import {randomUUID} from 'node:crypto';
import {pushContext} from '../../../server/push-context.mjs';
import {validOrigin} from '../../../server/security.mjs';
import {configured,pushConfiguration,validPushSubscription,sendWebPush} from '../../../server/push-crypto.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
function fail(e:unknown){const m=(e as Error).message;return Response.json({error:m==='ACCESS_DENIED'?'Please sign in or open your valid staff review link.':'Unable to update device notifications.'},{status:m==='ACCESS_DENIED'?403:400,headers});}
export async function GET(req:Request){try{
 const c=await pushContext(req);
 const result=await c.pool.query("SELECT COUNT(*)::int AS n FROM business_push_subscriptions WHERE business_id=$1 AND reviewer=$2",[c.businessId,c.reviewer]);
 const endpoints=(await c.pool.query("SELECT endpoint FROM business_push_subscriptions WHERE business_id=$1 AND reviewer=$2",[c.businessId,c.reviewer])).rows.map((r:{endpoint:string})=>r.endpoint);
 return Response.json({...pushConfiguration(),publicKey:configured()?process.env.VAPID_PUBLIC_KEY:null,reviewer:c.reviewer,
   businessName:c.businessName,businessSlug:c.businessSlug,subscribedDevices:result.rows[0]?.n||0,subscribedEndpoints:endpoints},{headers});
 }catch(e){return fail(e);}}
export async function POST(req:Request){
 if(!validOrigin(req))return Response.json({error:'Invalid origin.'},{status:403,headers});
 try{
  const c=await pushContext(req);
  const raw=await req.text();if(raw.length>5000)return Response.json({error:'Device subscription is too large.'},{status:413,headers});
  const data=JSON.parse(raw);
  if(data.action==='test'){
   if(!configured())return Response.json({error:'Push notification service is unavailable.'},{status:503,headers});
   const sub=(await c.pool.query('SELECT endpoint,p256dh,auth FROM business_push_subscriptions WHERE business_id=$1 AND reviewer=$2 AND endpoint=$3',[c.businessId,c.reviewer,String(data.endpoint||'').slice(0,2048)])).rows[0];
   if(!sub)return Response.json({error:'This device is not registered for this business and reviewer. Enable it again.'},{status:404,headers});
   const result=await sendWebPush({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth}},{title:'SelahFlow · '+c.businessName,body:'Device notifications are connected for this business.',url:c.workspacePath||'/studio/'+encodeURIComponent(c.businessSlug),tag:'selahflow-device-test'});
   if(result.status==='gone'||result.status==='invalid_subscription'){
    await c.pool.query('DELETE FROM business_push_subscriptions WHERE business_id=$1 AND reviewer=$2 AND endpoint=$3',[c.businessId,c.reviewer,sub.endpoint]);
    return Response.json({error:'This device subscription expired. Enable notifications again.'},{status:410,headers});
   }
   return result.status==='submitted'?Response.json({ok:true,status:'provider_accepted'},{headers}):Response.json({error:'The push provider did not accept the test. Try again or contact the platform administrator.'},{status:502,headers});
  }
  if(data.action==='unsubscribe'){
   const endpoint=String(data.endpoint||'');
   if(!endpoint||endpoint.length>2048)return Response.json({error:'Invalid subscription.'},{status:400,headers});
   await c.pool.query('DELETE FROM business_push_subscriptions WHERE business_id=$1 AND reviewer=$2 AND endpoint=$3',[c.businessId,c.reviewer,endpoint]);
   return Response.json({ok:true,subscribed:false},{headers});
  }
  if(data.action!=='subscribe'||!validPushSubscription(data.subscription))return Response.json({error:'Invalid browser subscription or push provider.'},{status:400,headers});
  if(!configured())return Response.json({error:'Push notification service is not configured. Ask the platform administrator.'},{status:503,headers});
  const count=(await c.pool.query('SELECT COUNT(*)::int AS n FROM business_push_subscriptions WHERE business_id=$1 AND reviewer=$2',[c.businessId,c.reviewer])).rows[0]?.n||0;
  const already=(await c.pool.query('SELECT 1 FROM business_push_subscriptions WHERE business_id=$1 AND reviewer=$2 AND endpoint=$3',[c.businessId,c.reviewer,data.subscription.endpoint])).rowCount>0;
  if(count>=10&&!already)return Response.json({error:'Maximum 10 notification devices per reviewer.'},{status:409,headers});
  await c.pool.query("INSERT INTO business_push_subscriptions(id,business_id,reviewer,endpoint,p256dh,auth,user_agent) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(business_id,reviewer,endpoint) DO UPDATE SET p256dh=excluded.p256dh,auth=excluded.auth,user_agent=excluded.user_agent,updated_at=now()",[randomUUID(),c.businessId,c.reviewer,data.subscription.endpoint,data.subscription.keys.p256dh,data.subscription.keys.auth,(req.headers.get('user-agent')||'').slice(0,255)]);
  return Response.json({ok:true,subscribed:true},{headers});
 }catch(e){return fail(e);}
}
