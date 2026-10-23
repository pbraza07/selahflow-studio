import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {validEmail,validE164,notificationRecipient,notificationMessage,deliveryProviderStatus,sendNotificationChannel} from '../server/notification-delivery.mjs';
const read=async file=>readFile(new URL('../'+file,import.meta.url),'utf8');
test('v1.3.10 notification contacts, provider readiness and booking content',()=>{
 assert.equal(validEmail('owner@example.com'),true);
 assert.equal(validEmail('bad email'),false);
 assert.equal(validE164('+18135550123'),true);
 for(const n of ['8135550123','+12','+1abc',''])assert.equal(validE164(n),false);
 assert.deepEqual(deliveryProviderStatus({}),{emailConfigured:false,smsConfigured:false});
 assert.deepEqual(deliveryProviderStatus({RESEND_API_KEY:'x',RESEND_FROM_EMAIL:'hello@example.com',TWILIO_ACCOUNT_SID:'AC',TWILIO_AUTH_TOKEN:'x',TWILIO_FROM_NUMBER:'+18135550123'}),{emailConfigured:true,smsConfigured:true});
 const c={bookingApprovalReviewer:'owner',bookingNotifyOwnerPhone:'+18135550123',staff:[{id:'sam',name:'Sam',notificationEmail:'sam@example.com',notificationPhone:'+18135550124'}]};
 assert.equal(notificationRecipient(c,'login@example.com').email,'login@example.com');
 assert.equal(notificationRecipient({...c,bookingNotifyOwnerEmail:'special@example.com'},'login@example.com').email,'special@example.com');
 assert.equal(notificationRecipient({...c,bookingApprovalReviewer:'sam'},'login@example.com').phone,'+18135550124');
 const message=notificationMessage({businessName:'Crawford',request:{date:'2026-12-01',start_minute:540,duration:45,details:{customerName:'Jane',customerEmail:'jane@example.com',customerPhone:'8131231234',services:['Haircut'],quotedPrice:40}},link:'https://example.com/booking/respond/token'});
 for(const part of ['Crawford','Jane','Haircut','2026-12-01','9:00 AM','Review request:','jane@example.com'])assert.ok(message.text.includes(part),part);
 assert.ok(message.sms.includes('Accept/Decline'));
});
test('v1.3.10 Resend and Twilio APIs use correct request parameters without contacting networks',async()=>{
 const calls=[];
 const fakeFetch=async(url,options)=>{calls.push({url,options});return {ok:true,status:202,json:async()=>({id:'resend-fixture'})};};
 const emailEnv={RESEND_API_KEY:'re_fake',RESEND_FROM_EMAIL:'SelahFlow <verified@example.com>'};
 const smsEnv={TWILIO_ACCOUNT_SID:'ACtest',TWILIO_AUTH_TOKEN:'fake-token',TWILIO_FROM_NUMBER:'+18135550199'};
 const message={subject:'New Booking',text:'Details plus link',sms:'Booking review https://example.com'};
 assert.equal((await sendNotificationChannel('email','owner@example.com',message,emailEnv,fakeFetch)).status,'submitted');
 assert.equal((await sendNotificationChannel('sms','+18135550123',message,smsEnv,fakeFetch)).status,'submitted');
 assert.equal(calls[0].url,'https://api.resend.com/emails');
 assert.deepEqual(JSON.parse(calls[0].options.body).to,['owner@example.com']);
 assert.match(calls[1].url,/\/Messages.json$/);
 assert.equal(new URLSearchParams(calls[1].options.body).get('To'),'+18135550123');
 assert.equal((await sendNotificationChannel('email','owner@example.com',message,{},fakeFetch)).status,'not_configured');
 assert.equal((await sendNotificationChannel('sms','unformatted',message,smsEnv,fakeFetch)).status,'invalid_destination');
});
test('v1.3.10 additive booking notification migration preserves pending requests',async()=>{
 const pg=new PGlite();
 try{
  for(const file of ['001_initial.sql','002_public_booking.sql','003_platform_foundation.sql','004_business_customization.sql','005_business_approval_terms.sql','006_marketplace_active_businesses.sql','007_booking_approval_requests.sql','008_outbound_booking_notifications.sql'])await pg.exec(await read('migrations/'+file));
  await pg.query("INSERT INTO users(id,email,password_hash) VALUES('owner','owner@example.com','x')");
  await pg.query("INSERT INTO businesses(id,owner_id,slug,name,industry) VALUES('biz','owner','crawford','barber','barber')");
  await pg.query("INSERT INTO booking_requests(id,business_id,owner_id,date,staff_id,start_minute,duration,details,reviewer) VALUES('req','biz','owner','2026-12-01','sam',540,45,'{}','owner')");
  await pg.query("INSERT INTO booking_action_tokens(id,request_id,reviewer,token_hash,expires_at) VALUES('token-id','req','owner','hash',now()+interval '72 hours')");
  await pg.query("INSERT INTO booking_notification_attempts(id,request_id,channel,destination_masked,status) VALUES('audit-id','req','email','ow***@example.com','submitted')");
  assert.equal((await pg.query("SELECT status FROM booking_requests WHERE id='req'")).rows[0].status,'pending');
  assert.equal((await pg.query("SELECT COUNT(*)::int AS count FROM booking_notification_attempts")).rows[0].count,1);
  await assert.rejects(pg.query("INSERT INTO booking_notification_attempts(id,request_id,channel,status) VALUES('bad','req','fax','submitted')"));
 }finally{await pg.close();}
});
test('v1.3.10 review links cannot approve from GET and enforce explicit origin-checked POST',async()=>{
 const api=await read('app/api/booking/respond/route.ts');
 assert.match(api,/tokenHash\(token\)/);
 assert.match(api,/expires_at>now\(\)/);
 assert.match(api,/validOrigin\(req\)/);
 assert.match(api,/reviewPendingRequest\(/);
 const get=api.slice(api.indexOf('export async function GET'),api.indexOf('export async function POST'));
 assert.doesNotMatch(get,/reviewPendingRequest\(/);
 const owner=await read('app/studio/owner-dashboard.tsx');
 assert.match(owner,/bookingNotifyEmail/);assert.match(owner,/bookingNotifySms/);assert.match(owner,/notificationPhone/);
 const server=await read('lib/studio-handler.ts');
 assert.match(server,/notifyBookingRequest\(/);
 const settings=await read('app/api/studio/approvals/route.ts');
 assert.match(settings,/deliveryProviderStatus/);
});
