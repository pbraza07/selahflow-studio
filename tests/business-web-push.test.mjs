import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createECDH,createDecipheriv,createPublicKey,hkdfSync,verify} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {allowedPushEndpoint,validPushSubscription,configured,encryptPushPayload,vapidJwt,sendWebPush} from '../server/push-crypto.mjs';
const read=async p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const keyPair=()=>{const e=createECDH('prime256v1');const p=e.generateKeys(),raw=e.getPrivateKey(),scalar=Buffer.alloc(32);raw.copy(scalar,32-raw.length);return {private:scalar.toString('base64url'),public:p.toString('base64url'),ecdh:e};};
test('v1.3.11 only trusted HTTPS push providers and valid ECDH subscriptions are allowed',()=>{
 for(const ep of [
  'https://fcm.googleapis.com/fcm/send/test',
  'https://updates.push.services.mozilla.com/wpush/v2/abc',
  'https://web.push.apple.com/abc',
  'https://my.push.apple.com/a',
  'https://wns2-abc.notify.windows.com/test'
 ])assert.equal(allowedPushEndpoint(ep),true,ep);
 for(const ep of ['http://localhost:1000/internal','https://127.0.0.1/a','https://example.com/a','https://fcm.googleapis.com.evil.net/x','http://fcm.googleapis.com/x','https://admin@fcm.googleapis.com/x','https://fcm.googleapis.com:8443/x','not-url'])assert.equal(allowedPushEndpoint(ep),false,ep);
 const client=keyPair(),valid={endpoint:'https://fcm.googleapis.com/fcm/send/abc',keys:{p256dh:client.public,auth:Buffer.alloc(16,4).toString('base64url')}};
 assert.equal(validPushSubscription(valid),true);
 assert.equal(validPushSubscription({...valid,keys:{...valid.keys,p256dh:'foo'}}),false);
 assert.equal(configured({}),false);
});
test('v1.3.11 Web Push encryption round-trips RFC8291 aes128gcm ciphertext and signed VAPID token',()=>{
 const c=keyPair(),v=keyPair(),env={VAPID_PUBLIC_KEY:v.public,VAPID_PRIVATE_KEY:v.private,VAPID_SUBJECT:'mailto:ops@example.com'};
 const sub={endpoint:'https://web.push.apple.com/abc',keys:{p256dh:c.public,auth:Buffer.alloc(16,12).toString('base64url')}};
 const message={title:'Crawford · New booking',body:'One pending request',url:'/studio/crawford#booking-notifications'};
 const cipher=encryptPushPayload(sub,message);
 assert.equal(cipher.readUInt32BE(16),4096);
 const salt=cipher.subarray(0,16),serverLength=cipher[20],serverPub=cipher.subarray(21,21+serverLength),encrypted=cipher.subarray(21+serverLength);
 assert.equal(serverLength,65);
 const info=Buffer.concat([Buffer.from('WebPush: info\0'),c.ecdh.getPublicKey(),serverPub]);
 const secret=c.ecdh.computeSecret(serverPub),auth=Buffer.from(sub.keys.auth,'base64url');
 const ikm=Buffer.from(hkdfSync('sha256',secret,auth,info,32));
 const key=Buffer.from(hkdfSync('sha256',ikm,salt,Buffer.from('Content-Encoding: aes128gcm\0'),16));
 const nonce=Buffer.from(hkdfSync('sha256',ikm,salt,Buffer.from('Content-Encoding: nonce\0'),12));
 const d=createDecipheriv('aes-128-gcm',key,nonce);d.setAuthTag(encrypted.subarray(-16));
 const text=Buffer.concat([d.update(encrypted.subarray(0,-16)),d.final()]);
 assert.equal(text.at(-1),2);
 assert.deepEqual(JSON.parse(text.subarray(0,-1).toString()),message);
 const jwt=vapidJwt(sub.endpoint,env,2000000000),[header,claims,sig]=jwt.split('.');
 assert.equal(JSON.parse(Buffer.from(header,'base64url').toString()).alg,'ES256');
 assert.equal(JSON.parse(Buffer.from(claims,'base64url').toString()).aud,'https://web.push.apple.com');
 const keyObj=createPublicKey({key:{kty:'EC',crv:'P-256',x:Buffer.from(v.ecdh.getPublicKey().subarray(1,33)).toString('base64url'),y:Buffer.from(v.ecdh.getPublicKey().subarray(33,65)).toString('base64url')},format:'jwk'});
 assert.equal(verify('sha256',Buffer.from(header+'.'+claims),{key:keyObj,dsaEncoding:'ieee-p1363'},Buffer.from(sig,'base64url')),true);
});
test('v1.3.11 delivery transport returns actual provider status and prunes expired subscriptions',async()=>{
 const c=keyPair(),v=keyPair(),env={VAPID_PUBLIC_KEY:v.public,VAPID_PRIVATE_KEY:v.private,VAPID_SUBJECT:'mailto:ops@example.com'};
 const sub={endpoint:'https://fcm.googleapis.com/fcm/send/abc',keys:{p256dh:c.public,auth:Buffer.alloc(16,12).toString('base64url')}};
 const calls=[];
 const result=await sendWebPush(sub,{title:'Booking',body:'New appointment',url:'/studio/crawford'},env,async(url,opts)=>{calls.push({url,opts});return {status:201,ok:true};});
 assert.equal(result.status,'submitted');assert.equal(calls[0].opts.headers['Content-Encoding'],'aes128gcm');
 assert.match(calls[0].opts.headers.Authorization,/^vapid t=/);
 assert.equal((await sendWebPush(sub,{title:'Booking'},env,async()=>({status:410,ok:false}))).status,'gone');
 assert.equal((await sendWebPush(sub,{title:'Booking'},{},async()=>{throw Error('Should not contact provider.');})).status,'not_configured');
});
test('v1.3.11 additive migration isolates push devices per business and reviewer and preserves bookings',async()=>{
 const pg=new PGlite();
 try{
  for(const f of ['001_initial.sql','002_public_booking.sql','003_platform_foundation.sql','004_business_customization.sql','005_business_approval_terms.sql','006_marketplace_active_businesses.sql','007_booking_approval_requests.sql','008_outbound_booking_notifications.sql','009_business_web_push.sql'])await pg.exec(await read('migrations/'+f));
  await pg.query("INSERT INTO users(id,email,password_hash) VALUES('a','a@test.com','x'),('b','b@test.com','x')");
  await pg.query("INSERT INTO businesses(id,owner_id,slug,name,industry) VALUES('b1','a','crawford','Crawford','barber'),('b2','b','other','Other','barber')");
  await pg.query("INSERT INTO appointments(id,owner,date,staff,start,duration,data,status) VALUES('old','a','2026-12-01','sam',540,30,'{}','Confirmed')");
  await pg.query("INSERT INTO booking_requests(id,business_id,owner_id,date,staff_id,start_minute,duration,details,reviewer) VALUES('req','b1','a','2026-12-01','sam',540,30,'{}','owner')");
  await pg.query("INSERT INTO business_push_subscriptions(id,business_id,reviewer,endpoint,p256dh,auth) VALUES('push','b1','owner','https://fcm.googleapis.com/a','key','secret')");
  await pg.query("INSERT INTO business_notification_reads(business_id,reviewer,request_id) VALUES('b1','owner','req')");
  assert.equal((await pg.query("SELECT COUNT(*)::int AS n FROM business_push_subscriptions WHERE business_id='b2'")).rows[0].n,0);
  assert.equal((await pg.query("SELECT COUNT(*)::int AS n FROM business_notification_reads WHERE business_id='b1'")).rows[0].n,1);
  assert.equal((await pg.query("SELECT COUNT(*)::int AS n FROM appointments")).rows[0].n,1);
  await assert.rejects(pg.query("INSERT INTO business_push_subscriptions(id,business_id,reviewer,endpoint,p256dh,auth) VALUES('push2','b2','owner','https://fcm.googleapis.com/a','key','secret')"));
 }finally{await pg.close();}
});
test('v1.3.11 owner/team authentication, unread read receipts and safe notification clicks',async()=>{
 const ctx=await read('server/push-context.mjs');
 assert.match(ctx,/booking_review_links/);assert.match(ctx,/tokenHash\(bearer\)/);
 assert.match(ctx,/b.owner_id=\$1/);assert.match(ctx,/cfg.bookingApprovalReviewer!==found.reviewer/);
 const sub=await read('app/api/push/route.ts');
 assert.match(sub,/pushContext\(req\)/);assert.match(sub,/validOrigin\(req\)/);assert.match(sub,/validPushSubscription/);
 const inbox=await read('app/api/push/inbox/route.ts');
 assert.match(inbox,/business_notification_reads/);assert.match(inbox,/r.business_id=\$1/);assert.match(inbox,/r.reviewer=\$2/);
 const serviceWorker=await read('public/sw.js');
 assert.match(serviceWorker,/notificationclick/);assert.doesNotMatch(serviceWorker,/fetch\('/);
 const booking=await read('lib/studio-handler.ts');
 assert.match(booking,/pushBookingRequest\(id\)/);
 const owner=await read('app/studio/owner-dashboard.tsx');
 assert.match(owner,/OwnerNotificationBell/);assert.match(owner,/DevicePushControls/);
 const team=await read('app/components/team-booking-review.tsx');
 assert.match(team,/TeamPushBell/);assert.match(team,/DevicePushControls/);
});
