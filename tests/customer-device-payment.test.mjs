import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {randomUUID,createECDH} from 'node:crypto';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';
import {tokenHash,validOrigin,trustedOrigin} from '../server/security.mjs';
import {validPushSubscription,allowedPushEndpoint} from '../server/push-crypto.mjs';
import {customerBookingDetails} from '../server/customer-booking-status.mjs';
import {bookingPaymentPreview} from '../server/booking-payment-preview.mjs';
import {customerBookingPushPayload,notifyCustomerBooking} from '../server/customer-push.mjs';

test('client access resolves accepted appointment and payment policy, with private multi-device opt-in and isolation',async()=>{
 const pg=new PGlite();
 try{
  for(const f of (await readdir(new URL('../migrations/',import.meta.url))).filter(x=>x.endsWith('.sql')).sort())await pg.exec(await readFile(new URL('../migrations/'+f,import.meta.url),'utf8'));
  const pool={query:async(sql,params)=>{const r=await pg.query(sql,params);return {...r,rowCount:r.rows.length||r.affectedRows||0};}};
  await pg.exec("INSERT INTO users(id,email,password_hash) VALUES('u1','one@example.test','hash'),('u2','two@example.test','hash'); INSERT INTO businesses(id,owner_id,slug,name,status) VALUES('b1','u1','one','One','active'),('b2','u2','two','Two','active');");
  const config={open:8,close:20,buffer:0,services:[{id:'s',name:'Session',price:25,duration:30,maxSlots:1,requiresApproval:true}],staff:[{id:'coach',services:['s']}]};
  await pool.query("INSERT INTO settings(owner,data) VALUES('u1',$1)",[JSON.stringify(config)]);
  const requestId=randomUUID(),appointmentId=randomUUID(),token='a'.repeat(64),secondToken='b'.repeat(64),foreignToken='c'.repeat(64);
  const detail={services:['Original session'],serviceIds:['s'],quotedPrice:25,price:25};
  await pool.query("INSERT INTO booking_requests(id,business_id,owner_id,date,staff_id,start_minute,duration,details,reviewer) VALUES($1,'b1','u1','2030-11-01','coach',600,30,$2,'owner')",[requestId,JSON.stringify(detail)]);
  for(const [key,owner] of [[token,'u1'],[secondToken,'u1'],[foreignToken,'u2']])await pool.query('INSERT INTO customer_booking_access(token_hash,owner_id,booking_id) VALUES($1,$2,$3)',[tokenHash(key),owner,requestId]);
  const source=await readFile(new URL('../app/api/customer-booking/route.ts',import.meta.url),'utf8'),api={};
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function('require','exports',code)(path=>{
   if(path==='node:crypto')return {randomUUID};
   if(path.endsWith('database.mjs'))return {getPool:()=>pool};
   if(path.endsWith('security.mjs'))return {tokenHash,validOrigin};
   if(path.endsWith('push-crypto.mjs'))return {configured:()=>true,validPushSubscription,allowedPushEndpoint};
   if(path.endsWith('customer-booking-status.mjs'))return {customerBookingDetails};
   throw Error(path);
  },api);
  const requestOrigin=trustedOrigin(new Request('https://example.test/api/customer-booking'));
  const foreignOrigin=requestOrigin==='https://evil.example'?'https://foreign.example':'https://evil.example';
  const req=(body,key=token,origin=requestOrigin)=>new Request(new URL('/api/customer-booking',requestOrigin),{method:body?'POST':'GET',headers:{Authorization:'Bearer '+key,Origin:origin,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  let response=await api.GET(req());assert.equal(response.status,200);let item=await response.json();assert.equal(item.status,'Awaiting approval');assert.equal(item.paymentAvailable,false);assert.equal(item.slug,'one');assert.equal(response.headers.get('Cache-Control'),'no-store');
  assert.equal((await api.GET(req(null,'d'.repeat(64)))).status,403);
  assert.equal((await api.GET(req(null,foreignToken))).status,403,'same booking id in another tenant cannot resolve this booking');
  const previewArgs={slug:'one',bookingId:requestId,token};assert.equal((await bookingPaymentPreview(pool,previewArgs)).status,'awaiting_approval');

  await pool.query("INSERT INTO appointments(id,owner,date,staff,start,duration,status,data) VALUES($1,'u1','2030-11-02','coach',660,30,'Confirmed',$2)",[appointmentId,JSON.stringify({...detail,services:['Updated session']})]);
  await pool.query("UPDATE booking_requests SET status='accepted',appointment_id=$1 WHERE id=$2",[appointmentId,requestId]);
  item=await(await api.GET(req())).json();assert.equal(item.date,'2030-11-02');assert.deepEqual(item.services,['Updated session']);assert.equal(item.paymentAvailable,true);assert.equal((await bookingPaymentPreview(pool,previewArgs)).status,'ready');
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM booking_payments')).rows[0].n,0,'reading status does not create checkout');
  await pool.query("UPDATE appointments SET data=$1 WHERE id=$2",[JSON.stringify({...detail,membershipCovered:true}),appointmentId]);assert.equal((await bookingPaymentPreview(pool,previewArgs)).status,'covered');
  await pool.query("UPDATE appointments SET status='Cancelled' WHERE id=$1",[appointmentId]);item=await(await api.GET(req())).json();assert.equal(item.status,'Cancelled');assert.equal(item.paymentAvailable,false);await assert.rejects(bookingPaymentPreview(pool,previewArgs),/unavailable/);
  const ec=createECDH('prime256v1');ec.generateKeys();const sub=i=>({endpoint:'https://web.push.apple.com/device'+i,keys:{p256dh:ec.getPublicKey().toString('base64url'),auth:Buffer.alloc(16,i).toString('base64url')}});
  for(const i of [1,2])assert.equal((await api.POST(req({action:'subscribe',subscription:sub(i)}))).status,200);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM customer_booking_push')).rows[0].n,2,'one token can register two devices');
  assert.equal((await api.POST(req({action:'subscribe',subscription:sub(1)},secondToken))).status,200);assert.equal((await pool.query('SELECT token_hash FROM customer_booking_push WHERE endpoint=$1',[sub(1).endpoint])).rows[0].token_hash,tokenHash(secondToken),'fresh token repairs matching endpoint without duplicate');
  assert.equal((await(await api.POST(req({action:'status',endpoint:sub(1).endpoint}))).json()).subscribed,true);
  assert.equal((await(await api.POST(req({action:'status',endpoint:sub(1).endpoint},foreignToken))).json()).subscribed,false);
  assert.equal((await api.POST(req({action:'unsubscribe',endpoint:sub(1).endpoint},foreignToken))).status,200);assert.equal((await pool.query('SELECT count(*)::int AS n FROM customer_booking_push')).rows[0].n,2);
  assert.equal((await api.POST(req({action:'unsubscribe',endpoint:sub(1).endpoint},token,foreignOrigin))).status,403);
  assert.equal((await api.POST(req({action:'unsubscribe',endpoint:sub(1).endpoint}))).status,200);assert.equal((await pool.query('SELECT endpoint FROM customer_booking_push')).rows[0].endpoint,sub(2).endpoint,'disable removes only this booking/device');
  assert.equal((await api.POST(req({action:'subscribe',subscription:{...sub(3),endpoint:'https://127.0.0.1/internal'}}))).status,400);
  await pool.query('UPDATE customer_booking_access SET expires_at=now()-interval \'1 second\' WHERE token_hash=$1',[tokenHash(token)]);assert.equal((await api.POST(req({action:'subscribe',subscription:sub(3)}))).status,400);
 }finally{await pg.close();}
});

test('acceptance push targets secure booking payment view without access tokens and prunes only expired devices',async()=>{
 const accepted=customerBookingPushPayload('booking-1','Confirmed'),declined=customerBookingPushPayload('booking-1','Declined');
 assert.equal(accepted.url,'/customer/booking?id=booking-1#booking-payment');assert.match(accepted.body,/accepted.*payment/);assert.ok(!accepted.url.includes('token'));assert.ok(!declined.url.includes('#booking-payment'));
 const queries=[],sent=[];const pool={query:async(sql,params)=>{queries.push({sql,params});return {rows:sql.startsWith('SELECT')?[{id:'device1',endpoint:'https://web.push.apple.com/one',p256dh:'one',auth:'secret'},{id:'device2',endpoint:'https://web.push.apple.com/two',p256dh:'two',auth:'secret'}]:[]};}};
 const result=await notifyCustomerBooking('owner1','booking-1','Confirmed',{pool,isConfigured:()=>true,send:async(sub,payload)=>{sent.push({sub,payload});return {status:sent.length===1?'submitted':'gone'};}});
 assert.equal(result.delivered,1);assert.deepEqual(queries[0].params,['owner1','booking-1']);assert.match(queries[0].sql,/a\.expires_at>now\(\)/);assert.deepEqual(queries[1].params,['device2']);assert.deepEqual(sent[0].payload,accepted);
 assert.deepEqual(await notifyCustomerBooking('owner1','booking-1','Confirmed',{isConfigured:()=>false}),{delivered:0});
});
