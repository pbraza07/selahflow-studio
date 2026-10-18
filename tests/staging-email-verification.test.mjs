import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {verifyStagingClientEmails} from '../server/staging-email-verification.mjs';
test('staging verification authorizes only one saved recipient, refreshes email buttons and never repeats accepted messages',async()=>{
 const pg=new PGlite();try{
  for(const f of (await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await pg.exec(await readFile(new URL('../migrations/'+f,import.meta.url),'utf8'));
  await pg.exec("INSERT INTO users(id,email,password_hash) VALUES('u','owner@example.test','x'); INSERT INTO businesses(id,owner_id,slug,name,status) VALUES('b','u','one','One','active'); INSERT INTO settings(owner,data) VALUES('u','{}');");
  const query=async(s,v)=>{const r=await pg.query(s,v);return {...r,rowCount:r.rows.length||r.affectedRows||0};};
  for(const [id,email,status] of [['unpaid','client@example.test','pending'],['paid','client@example.test','paid'],['other','other@example.test','pending']]){
   await query("INSERT INTO appointments(id,owner,date,start,duration,staff,status,data) VALUES($1,'u','2030-11-01',600,30,'coach','Confirmed',$2)",[id,JSON.stringify({name:'Client',email,services:['Training'],price:25})]);
   await query("INSERT INTO booking_client_flows(booking_id,business_id,payment_url,expires_at) VALUES($1,'b','https://app.example/payment/one#token=fixture',now()+interval '1 day')",[id]);
   await query("INSERT INTO booking_payments(booking_id,business_id,stripe_account_id,amount_cents,lines,status) VALUES($1,'b','acct_fixture',2500,'[]',$2)",[id,status]);
   await query("INSERT INTO booking_client_messages(id,booking_id,event_type,channel,destination,destination_masked,message,status) VALUES($1,$2,$3,'email',$4,'cl***@example.test','{}','not_configured')",['msg-'+id,id,status==='paid'?'payment_confirmation':'payment_link',email]);
  }
  await pg.exec("INSERT INTO booking_receipt_emails(booking_key,event_type,business_id,destination,destination_masked,message,status) VALUES('unpaid','submission','b','client@example.test','cl***@example.test','{}','not_configured')");
  const env={APP_ENV:'staging',DATABASE_URL:'postgresql://selahflow_staging_user:fixture@db/selahflow_staging',STAGING_DATABASE_HOST:'db',APP_URL:'https://app.example'},target={businessSlug:'one',recipient:'client@example.test'};
  let processed=0;
  const processors={payments:async(db,{messageIds})=>{processed+=messageIds.length;await db.query("UPDATE booking_client_messages SET status='submitted',detail='Simulated acceptance' WHERE id=ANY($1::text[])",[messageIds]);},receipts:async(db,{bookingKeys})=>{processed++;await db.query("UPDATE booking_receipt_emails SET status='submitted',detail='Simulated acceptance' WHERE booking_key=ANY($1::text[])",[bookingKeys]);}};
  await assert.rejects(verifyStagingClientEmails(pg,target,{},processors),/restricted to staging/);
  const result=await verifyStagingClientEmails(pg,target,env,processors);
  assert.equal(result.bookingReceipt,'submitted');assert.equal(result.paymentLink,'submitted');assert.equal(result.paymentConfirmation,'submitted');assert.equal(processed,3);
  const messages=(await pg.query("SELECT * FROM booking_client_messages WHERE id<>'msg-other'")).rows;
  assert.ok(messages.every(m=>m.message.actions.length>=3&&m.client_delivery_authorized_at));
  assert.equal((await pg.query("SELECT status FROM booking_client_messages WHERE id='msg-other'")).rows[0].status,'not_configured');
  assert.equal((await verifyStagingClientEmails(pg,target,env,processors)).alreadyApplied,true);assert.equal(processed,3);
  const receiptProof=await verifyStagingClientEmails(pg,{businessSlug:'one',recipient:'other@example.test',receiptOnly:true,ensureBookingReceipt:true},env,processors);
  assert.equal(receiptProof.bookingReceipt,'submitted');assert.equal(processed,4);
  assert.equal((await pg.query("SELECT status FROM booking_client_messages WHERE id='msg-other'")).rows[0].status,'not_configured','receipt proof does not release another payment email');
 }finally{await pg.close();}
});
