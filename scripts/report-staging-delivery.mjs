import {isStaging} from '../server/staging-safety.mjs';
import {gmailStatus,selectedEmailProvider} from '../server/gmail-delivery.mjs';
import {getPool} from '../server/database.mjs';

if(isStaging()){
 const pool=getPool();
 try{
  const gmail=await gmailStatus(pool);
  const required=['TWILIO_ACCOUNT_SID','TWILIO_AUTH_TOKEN','TWILIO_FROM_NUMBER'];
  console.log('Staging delivery readiness:',JSON.stringify({
   emailProvider:selectedEmailProvider(),gmailConnected:gmail.connected,
   gmailMissingConfiguration:gmail.missingConfiguration,
   twilioMissingConfiguration:required.filter(k=>!process.env[k]),
   stagingDeliveryEnabled:process.env.STAGING_NOTIFICATIONS_ENABLED==='true',
   approvedTestEmailCount:String(process.env.STAGING_NOTIFICATION_EMAILS||'').split(',').filter(x=>x.trim()).length,
   approvedTestPhoneCount:String(process.env.STAGING_NOTIFICATION_PHONES||'').split(',').filter(x=>x.trim()).length
  }));
 }catch{console.error('Staging delivery readiness temporarily unavailable');}
 finally{await pool.end();}
}
