import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const root=new URL('../migrations/',import.meta.url);
const target='2230020a-f028-4249-9c6f-e7ef60126a30';
const cleanup=await readFile(new URL('045_remove_legacy_crawford.sql',root),'utf8');
async function fixture(){
 const db=new PGlite();
 for(const f of (await readdir(root)).filter(f=>f.endsWith('.sql')&&!f.startsWith('045')).sort())await db.exec(await readFile(new URL(f,root),'utf8'));
 for(const [id,owner,slug] of [[target,'admin','crawford'],['other','other-owner','other-business']]){
  await db.query('INSERT INTO users(id,email,password_hash) VALUES($1,$2,$3)',[owner,owner+'@example.com','unchanged']);
  await db.query("INSERT INTO businesses(id,owner_id,slug,name,status) VALUES($1,$2,$3,'Studio','archived')",[id,owner,slug]);
  await db.query('INSERT INTO settings(owner,data) VALUES($1,$2)',[owner,'{"name":"Studio"}']);
  await db.query("INSERT INTO business_memberships(business_id,user_id,role) VALUES($1,$2,'owner')",[id,owner]);
  await db.query("INSERT INTO business_subscriptions(business_id) VALUES($1)",[id]);
  await db.query("INSERT INTO appointments(id,owner,date,staff,start,duration,data,status) VALUES($1,$2,'2026-10-19','coach',600,60,'{}','confirmed')",[id,owner]);
  await db.query("INSERT INTO slots(owner,date,staff,minute,appointment) VALUES($1,'2026-10-19','coach',600,$2)",[owner,id]);
  await db.query("INSERT INTO booking_requests(id,business_id,owner_id,date,staff_id,start_minute,duration,details,status,appointment_id) VALUES($1,$1,$2,'2026-10-19','coach',600,60,'{}','accepted',$1)",[id,owner]);
  await db.query("INSERT INTO booking_client_flows(booking_id,business_id,request_id,payment_url,expires_at) VALUES($1,$1,$1,'https://example.com',now()+interval '1 day')",[id]);
  await db.query("INSERT INTO booking_client_messages(id,booking_id,event_type,channel,destination,destination_masked,message) VALUES($1,$1,'payment_link','email','test@example.com','t***','{}')",[id]);
  await db.query("INSERT INTO booking_payments(booking_id,business_id,stripe_account_id,amount_cents,lines) VALUES($1,$1,'fixture',100,'[]')",[id]);
  await db.query("INSERT INTO booking_receipt_emails(booking_key,event_type,business_id,destination,destination_masked,message) VALUES($1,'submission',$1,'test@example.com','t***','{}')",[id]);
  await db.query("INSERT INTO membership_plans(id,business_id,name,interval_unit,price_cents) VALUES($1,$1,'Test plan','month',100)",[id]);
  await db.query("INSERT INTO customer_memberships(id,business_id,plan_id,price_cents,customer_name,customer_email,status,stripe_account_id) VALUES($1,$1,$1,100,'Test Client','test@example.com','expired','fixture')",[id]);
  await db.query("INSERT INTO membership_session_ledger(id,business_id,membership_id,event_type) VALUES($1,$1,$1,'adjustment')",[id]);
  await db.query("INSERT INTO membership_payment_emails(payment_id,business_id,membership_id,destination,destination_masked,snapshot,message) VALUES($1,$1,$1,'test@example.com','t***','{}','{}')",[id]);
  await db.query("INSERT INTO business_client_profiles(id,owner,name) VALUES($1,$2,'Test Client')",[id,owner]);
  await db.query("INSERT INTO events(id,owner,created,kind,data) VALUES($1,$2,'2026-10-19','test','{}')",[id,owner]);
 }
 await db.exec("INSERT INTO platform_admins(user_id,role) VALUES('admin','primary'); INSERT INTO staging_snapshot_runs(id,source_commit,captured_at,summary) VALUES('snapshot','test',now(),'{\"businesses\":[{\"id\":\""+target+"\",\"slug\":\"crawford\"},{\"id\":\"other\"}]}');");
 await db.query("INSERT INTO staging_snapshot_backups(run_id,table_name,records) SELECT 'snapshot','businesses',jsonb_agg(to_jsonb(b)) FROM businesses b");
 return db;
}
test('Crawford cleanup removes only the verified tenant and dependent rows, preserves admin and import replay marker, and is idempotent',async()=>{
 const db=await fixture();
 try{
  const otherBefore=(await db.query("SELECT row_to_json(b) AS row FROM businesses b WHERE id='other'")).rows;
  await db.exec(cleanup);
  for(const table of ['businesses','appointments','booking_requests','booking_client_messages','customer_memberships','membership_plans','membership_session_ledger','business_client_profiles','events']){
   assert.equal((await db.query(`SELECT count(*)::int AS n FROM ${table} WHERE id=$1`,[target])).rows[0].n,0,table);
   assert.equal((await db.query(`SELECT count(*)::int AS n FROM ${table} WHERE id='other'`)).rows[0].n,1,table);
  }
  for(const table of ['booking_payments','booking_receipt_emails','booking_client_flows','membership_payment_emails','business_memberships','business_subscriptions']){
   assert.equal((await db.query(`SELECT count(*)::int AS n FROM ${table} WHERE business_id=$1`,[target])).rows[0].n,0,table);
   assert.equal((await db.query(`SELECT count(*)::int AS n FROM ${table} WHERE business_id='other'`)).rows[0].n,1,table);
  }
  for(const table of ['settings','slots']){
   assert.equal((await db.query(`SELECT count(*)::int AS n FROM ${table} WHERE owner='admin'`)).rows[0].n,0);
   assert.equal((await db.query(`SELECT count(*)::int AS n FROM ${table} WHERE owner='other-owner'`)).rows[0].n,1);
  }
  assert.deepEqual((await db.query("SELECT row_to_json(b) AS row FROM businesses b WHERE id='other'")).rows,otherBefore);
  assert.equal((await db.query("SELECT password_hash FROM users WHERE id='admin'")).rows[0].password_hash,'unchanged');
  assert.equal((await db.query("SELECT role FROM platform_admins WHERE user_id='admin'")).rows[0].role,'primary');
  assert.equal((await db.query("SELECT jsonb_array_length(records)::int AS n FROM staging_snapshot_backups")).rows[0].n,1);
  assert.equal((await db.query("SELECT summary->'businesses' AS businesses FROM staging_snapshot_runs WHERE id='snapshot'")).rows[0].businesses.length,1);
  await db.exec(cleanup);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM businesses')).rows[0].n,1);
 }finally{await db.close();}
});
test('connected billing aborts the cleanup before any tenant records change',async()=>{
 const db=await fixture();
 try{
  await db.query("INSERT INTO merchant_accounts(business_id,external_account_id) VALUES($1,'acct_external')",[target]);
  await assert.rejects(db.exec(cleanup),/payment obligations/);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM businesses WHERE id=$1',[target])).rows[0].n,1);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM settings WHERE owner='admin'")).rows[0].n,1);
 }finally{await db.close();}
});
