import {pushConfiguration} from '../server/push-crypto.mjs';
console.log('Web Push readiness:',JSON.stringify(pushConfiguration()));
import {deliveryProviderStatusWithConnection} from '../server/notification-delivery.mjs';
import {isStaging} from '../server/staging-safety.mjs';
import {gmailStatus,selectedEmailProvider} from '../server/gmail-delivery.mjs';
import {getPool} from '../server/database.mjs';
import {emailReadinessSummary,readClientEmailFailures} from '../server/email-delivery-diagnostics.mjs';

if(isStaging()){
 const pool=getPool();
 try{
  const gmail=await gmailStatus(pool);
  const emailOutcomes=(await pool.query("SELECT m.event_type,m.status,count(*)::int AS count FROM booking_client_messages m JOIN booking_client_flows f ON f.booking_id=m.booking_id JOIN businesses b ON b.id=f.business_id WHERE b.status='active' AND m.channel='email' AND m.created_at>=$1::timestamptz GROUP BY m.event_type,m.status ORDER BY m.event_type,m.status",[process.env.STAGING_CLIENT_EMAIL_AFTER||new Date().toISOString()])).rows;
  console.log('Staging client email outcomes (since rollout):',JSON.stringify(emailOutcomes));
  const required=['TWILIO_ACCOUNT_SID','TWILIO_AUTH_TOKEN','TWILIO_FROM_NUMBER'];
  console.log('Staging delivery readiness:',JSON.stringify({
   emailProvider:selectedEmailProvider(),gmailConnected:gmail.connected,
   gmailMissingConfiguration:gmail.missingConfiguration,
   twilioMissingConfiguration:required.filter(k=>!process.env[k]),
   stagingDeliveryEnabled:process.env.STAGING_NOTIFICATIONS_ENABLED==='true',
   clientEmailRolloutEnabled:Number.isFinite(Date.parse(process.env.STAGING_CLIENT_EMAIL_AFTER||'')),
   approvedTestEmailCount:String(process.env.STAGING_NOTIFICATION_EMAILS||'').split(',').filter(x=>x.trim()).length,
   approvedTestPhoneCount:String(process.env.STAGING_NOTIFICATION_PHONES||'').split(',').filter(x=>x.trim()).length
  }));
  console.log('Client email diagnostics:',JSON.stringify({readiness:emailReadinessSummary(await deliveryProviderStatusWithConnection(pool),gmail),failures:await readClientEmailFailures(pool)}));
 }catch{console.error('Staging delivery readiness temporarily unavailable');}
 finally{await pool.end();}
}

if(!isStaging()){
 const pool=getPool();
 try{
  const status=await deliveryProviderStatusWithConnection(pool);
  const gmail=selectedEmailProvider()==='gmail'?await gmailStatus(pool):null;
  console.log('Client email readiness:',JSON.stringify(emailReadinessSummary(status,gmail)));
  console.log('Client email failures (last 7 days):',JSON.stringify(await readClientEmailFailures(pool)));
 }
 catch{console.error('Client email readiness temporarily unavailable');}
 finally{await pool.end();}
}
