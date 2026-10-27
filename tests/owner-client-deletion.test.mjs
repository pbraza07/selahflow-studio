import {deleteOwnerClient} from '../server/owner-client-deletion.mjs';
import {deleteOwnerMembership} from '../server/owner-membership-deletion.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';
const profile='11111111-1111-4111-8111-111111111111';
async function fixture(){
 const pg=new PGlite();
 for(const f of (await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await pg.exec(await readFile(new URL('../migrations/'+f,import.meta.url),'utf8'));
 await pg.exec("INSERT INTO users(id,email,password_hash) VALUES('owner','owner@example.test','hash'),('other','other@example.test','hash'); INSERT INTO businesses(id,owner_id,slug,name,status) VALUES('biz','owner','business','Business','active'),('other-biz','other','other-business','Other','active'); INSERT INTO settings(owner,data) VALUES('owner','{}'),('other','{}');");
 await pg.query("INSERT INTO business_client_profiles(id,owner,name,email,date_of_birth,member_number) VALUES($1,'owner','Test Person','test@example.test','1990-01-01','TP010190')",[profile]);
 await pg.exec("INSERT INTO customer_booking_ids(business_id,first_name,last_name,email,date_of_birth,member_number) VALUES('biz','Test','Person','test@example.test','1990-01-01','TP010190'),('other-biz','Test','Person','test@example.test','1990-01-01','TP010190')");
 await pg.query("INSERT INTO appointments(id,owner,date,start,duration,staff,status,data) VALUES('visit','owner','2030-01-01',600,30,'coach','Confirmed',$1)",[JSON.stringify({name:'Test Person',email:'test@example.test',dateOfBirth:'1990-01-01',memberNumber:'TP010190'})]);
 const db={query:async(s,p)=>{const r=await pg.query(s,p);return {...r,rowCount:r.rows.length||r.affectedRows||0}},release(){}},pool={...db,connect:async()=>db};
 const url=new URL('../app/api/studio/clients/route.ts',import.meta.url),source=await readFile(url,'utf8'),nativeRequire=createRequire(url),exports={};
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 new Function('require','exports',compiled)(path=>path.endsWith('/server/database.mjs')?{getPool:()=>pool}:path.endsWith('/lib/auth')?{requireOwner:async req=>{const owner=req.headers.get('x-test-owner');if(!owner)throw Error('AUTH_REQUIRED');return owner;}}:nativeRequire(path),exports);
 const origin=process.env.APP_URL||process.env.RENDER_EXTERNAL_URL||'https://example.test';
 const post=(body,owner='owner',validOrigin=true)=>exports.POST(new Request(new URL('/api/studio/clients',origin),{method:'POST',headers:{'Content-Type':'application/json',...(owner?{'x-test-owner':owner}:{}),Origin:validOrigin?new URL(origin).origin:'https://untrusted.invalid'},body:JSON.stringify(body)}));
 return {pg,post,db};
}
test('one confirmed owner request deletes client without operator paperwork; retries cannot delete a new holder of the released ID',async()=>{
 const {pg,post}=await fixture();try{
 const body={action:'delete',clientId:profile,confirmPhrase:'DELETE CLIENT'};
 assert.equal((await post(body,'')).status,401);
 assert.equal((await post(body,'owner',false)).status,403);
 assert.equal((await post(body,'other')).status,409);
 assert.equal((await post({...body,confirmPhrase:''})).status,409);
 assert.equal((await pg.query('SELECT count(*)::int n FROM client_deletion_authorizations')).rows[0].n,0);
 const first=await post(body);assert.equal(first.status,200,await first.text());
 assert.equal((await pg.query("SELECT count(*)::int n FROM business_client_profiles WHERE owner='owner'")).rows[0].n,0);
 assert.equal((await pg.query("SELECT count(*)::int n FROM customer_booking_ids WHERE business_id='biz'")).rows[0].n,0);
 assert.equal((await pg.query("SELECT count(*)::int n FROM business_member_ids WHERE business_id='biz'")).rows[0].n,0);
 assert.equal((await post(body)).status,200);
 const created=await post({action:'create',firstName:'Terry',lastName:'Parker',dateOfBirth:'1990-01-01',email:'terry@example.test'});
 assert.equal(created.status,200,await created.text());
 assert.equal((await pg.query("SELECT member_number FROM business_client_profiles WHERE owner='owner'")).rows[0].member_number,'TP010190');
 assert.equal((await post(body)).status,200);
 assert.equal((await pg.query("SELECT count(*)::int n FROM business_client_profiles WHERE owner='owner'")).rows[0].n,1,'retry cannot delete the new ID holder');
 assert.equal((await pg.query("SELECT count(*)::int n FROM customer_booking_ids WHERE business_id='other-biz'")).rows[0].n,1);
 assert.equal((await pg.query('SELECT count(*)::int n FROM client_deletion_audit')).rows[0].n,1);
 }finally{await pg.close();}
});
test('anonymized deleted-client card and removed-list retry are deletable without touching other clients',async()=>{
 const {pg,post}=await fixture();try{
 const removed='22222222-2222-4222-8222-222222222222';
 await pg.query("INSERT INTO business_client_profiles(id,owner,name,email,archived) VALUES($1,'owner','Deleted client','',false)",[removed]);
 assert.equal((await post({action:'delete',clientId:removed,confirmPhrase:'DELETE CLIENT'})).status,200);
 assert.equal((await post({action:'deleteArchived',clientIds:[removed],confirmPhrase:'DELETE REMOVED CLIENTS'})).status,200);
 assert.equal((await pg.query('SELECT id FROM business_client_profiles')).rows[0].id,profile);
 const denied=await post({action:'deleteArchived',clientIds:[profile],confirmPhrase:'DELETE REMOVED CLIENTS'});
 assert.equal(denied.status,409);
 }finally{await pg.close();}
});


test('Add Client accepts the editor-generated ID and saves required profile answers atomically',async()=>{
 const {pg,post}=await fixture();try{
 const fields=[{id:'level',label:'Player Level',type:'select',options:['2 (Recreational)'],required:true},{id:'age',label:'Age group',type:'select',options:['Adult'],required:true},{id:'position',label:'Player Position',type:'select',options:['Striker'],required:true}];
 await pg.query("UPDATE settings SET data=$1 WHERE owner='owner'",[JSON.stringify({bookingCustomFields:fields})]);
 const body={action:'create',firstName:'Jamie',lastName:'Rivera',dateOfBirth:'1995-07-23',memberNumber:'JR072395',email:'new@example.test',phone:'8135550100',notes:'New player',customAnswers:{level:'2 (Recreational)',age:'Adult',position:'Striker'}};
 const created=await post(body);assert.equal(created.status,200,await created.clone().text());const id=(await created.json()).clientId;
 const row=(await pg.query('SELECT * FROM business_client_profiles WHERE id=$1',[id])).rows[0];assert.equal(row.member_number,'JR072395');assert.equal(row.first_name,'Jamie');assert.equal(row.last_name,'Rivera');assert.equal(row.notes,'New player');assert.deepEqual(row.registration_answers,body.customAnswers);assert.equal(row.registration_field_labels.position,'Player Position');
 assert.equal((await pg.query("SELECT member_number FROM business_member_ids WHERE business_id='biz' AND member_number='JR072395'")).rows.length,1);
 assert.equal((await post(body)).status,409,'repeat submission cannot create a second client');
 const invalid=await post({...body,firstName:'Tammy',lastName:'Random',email:'different@example.test',memberNumber:'ZZ010190'});assert.equal(invalid.status,400);assert.match((await invalid.json()).error,/supplied membership ID/);
 assert.equal((await pg.query("SELECT count(*)::int n FROM business_member_ids WHERE business_id='biz' AND member_number='TR072395'")).rows[0].n,0,'failed request rolls back ID allocation');
 const collision=await post({...body,firstName:'Jordan',lastName:'Roberts',email:'collision@example.test'});assert.equal(collision.status,400);assert.match((await collision.json()).error,/already assigned/);
 const foreign=await post({...body,email:'foreign@example.test'},'other');assert.equal(foreign.status,200,'same ID is independent in another business');
 const missing=await post({...body,firstName:'Lara',lastName:'Young',memberNumber:'LY072395',customAnswers:{...body.customAnswers,position:''}});assert.equal(missing.status,400);assert.match((await missing.json()).error,/Player Position is required/);assert.equal((await pg.query("SELECT member_number FROM business_member_ids WHERE business_id='biz' AND member_number='LY072395'")).rows.length,0);
 }finally{await pg.close();}
});

const exactClient={id:profile,name:'Test Person',email:'test@example.test',dateOfBirth:'1990-01-01',memberNumber:'TP010190'};
async function transaction(db,fn){await db.query('BEGIN');try{const result=await fn();await db.query('COMMIT');return result;}catch(e){await db.query('ROLLBACK');throw e;}}
async function pendingPayment(pg){await pg.exec("INSERT INTO booking_payments(booking_id,business_id,stripe_account_id,amount_cents,lines,stripe_checkout_session_id) VALUES('visit','biz','acct_one',6000,'[]','cs_test_booking')");}
const checkout=(kind,source,id,status='open')=>({id,status,payment_status:'unpaid',livemode:false,client_reference_id:source,metadata:{selahflow_business_id:'biz',[kind==='booking'?'booking_id':'membership_id']:source}});

test('owner deletion expires exactly this client unpaid checkouts and releases commission reservations, including a pending membership without commissions',async()=>{
 const {pg,db}=await fixture();try{
 await pendingPayment(pg);
 await pg.exec("INSERT INTO membership_plans(id,business_id,name,interval_unit,price_cents) VALUES('plan','biz','Group Academy','month',6000); INSERT INTO customer_memberships(id,business_id,plan_id,price_cents,customer_name,customer_email,date_of_birth,member_number,status,stripe_account_id,stripe_checkout_session_id) VALUES('member','biz','plan',6000,'Test Person','test@example.test','1990-01-01','TP010190','pending_payment','acct_one','cs_test_member'); INSERT INTO first_customer_commissions(business_id,identity_digest,kind,source_id,stripe_account_id,stripe_checkout_session_id,gross_cents,eligible_cents,fee_cents) VALUES('biz','digest','booking','visit','acct_one','cs_test_booking',6000,6000,600)");
 const calls=[];
 const api=async(path,options)=>{calls.push({path,...options});assert.equal(options.account,'acct_one');const isMember=path.includes('cs_test_member');return checkout(isMember?'membership':'booking',isMember?'member':'visit',isMember?'cs_test_member':'cs_test_booking',path.endsWith('/expire')||isMember?'expired':'open');};
 const result=await transaction(db,()=>deleteOwnerClient(db,{owner:'owner',businessId:'biz',client:exactClient,clientId:profile,confirmPhrase:'DELETE CLIENT',api}));
 assert.equal(result.removed.customer_memberships,1);assert.equal(result.removed.booking_payments,1);
 assert.equal(calls.filter(c=>c.path.endsWith('/expire')).length,1);assert.ok(calls.find(c=>c.path.endsWith('/expire')).idempotencyKey);
 const claim=(await pg.query('SELECT status,source_id FROM first_customer_commissions')).rows[0];assert.equal(claim.status,'expired');assert.equal(claim.source_id,null);
 assert.equal((await pg.query("SELECT count(*)::int n FROM customer_booking_ids WHERE business_id='other-biz'")).rows[0].n,1);
 assert.equal((await transaction(db,()=>deleteOwnerClient(db,{owner:'owner',businessId:'biz',client:null,clientId:profile,confirmPhrase:'DELETE CLIENT',api}))).alreadyDeleted,true);
 }finally{await pg.close();}
});

test('paid, processing, wrong-tenant, expiry-race and unavailable Stripe responses stop deletion and preserve local records',async()=>{
 const {pg,db}=await fixture();try{
 await pendingPayment(pg);
 for(const api of [
  async()=>({...checkout('booking','visit','cs_test_booking','complete'),payment_status:'paid'}),
  async()=>checkout('booking','visit','cs_test_booking','complete'),
  async()=>({...checkout('booking','visit','cs_test_booking'),metadata:{selahflow_business_id:'other-biz',booking_id:'visit'}}),
  async(path)=>checkout('booking','visit','cs_test_booking',path.endsWith('/expire')?'complete':'open'),
  async()=>{throw Error('Stripe unavailable');}
 ]){
  await assert.rejects(transaction(db,()=>deleteOwnerClient(db,{owner:'owner',businessId:'biz',client:exactClient,clientId:profile,confirmPhrase:'DELETE CLIENT',api})),/Stripe|payment|checkout/i);
  assert.equal((await pg.query('SELECT count(*)::int n FROM business_client_profiles')).rows[0].n,1);
  assert.equal((await pg.query('SELECT status FROM booking_payments')).rows[0].status,'pending');
 }
 // A retry after provider expiry / database rollback checks Stripe again and succeeds.
 const api=async()=>checkout('booking','visit','cs_test_booking','expired');
 await transaction(db,()=>deleteOwnerClient(db,{owner:'owner',businessId:'biz',client:exactClient,clientId:profile,confirmPhrase:'DELETE CLIENT',api}));
 assert.equal((await pg.query('SELECT count(*)::int n FROM business_client_profiles')).rows[0].n,0);
 }finally{await pg.close();}
});

test('membership deletion retains settled financial facts, detaches receipt references and checks the actual subscription before removal',async()=>{
 const {pg,db}=await fixture();try{
 await pg.exec("INSERT INTO membership_plans(id,business_id,name,interval_unit,price_cents) VALUES('plan','biz','Group Academy','month',6000); INSERT INTO customer_memberships(id,business_id,plan_id,price_cents,customer_name,customer_email,date_of_birth,member_number,status,stripe_account_id,stripe_subscription_id,initial_paid_at) VALUES('member','biz','plan',6000,'Test Person','test@example.test','1990-01-01','TP010190','expired','acct_one','sub_one',now()); INSERT INTO stripe_payment_receipts(stripe_account_id,provider_reference,business_id,membership_id,amount_cents) VALUES('acct_one','in_one','biz','member',6000); INSERT INTO membership_session_ledger(id,business_id,membership_id,appointment_id,event_type,session_delta,amount_cents) VALUES('ledger','biz','member','stripe:in_one','payment_confirmed',4,6000)");
 const subscription=status=>({id:'sub_one',status,livemode:false,metadata:{selahflow_business_id:'biz',membership_id:'member'}});
 await assert.rejects(transaction(db,()=>deleteOwnerMembership(db,{owner:'owner',businessId:'biz',id:'member',api:async()=>subscription('active')})),/Cancel the active/);
 assert.equal((await pg.query('SELECT count(*)::int n FROM customer_memberships')).rows[0].n,1);
 await assert.rejects(transaction(db,()=>deleteOwnerMembership(db,{owner:'other',businessId:'biz',id:'member',api:async()=>{throw Error('Unexpected provider call');}})),/not found/);
 let calls=0;const result=await transaction(db,()=>deleteOwnerMembership(db,{owner:'owner',businessId:'biz',id:'member',api:async(path,o)=>{calls++;assert.equal(path,'subscriptions/sub_one');assert.equal(o.method,'GET');return subscription('canceled');}}));
 assert.equal(calls,1);assert.equal(result.retainedFinancialRecords,1);
 assert.equal((await pg.query('SELECT membership_id FROM stripe_payment_receipts')).rows[0].membership_id,null);
 assert.equal((await pg.query('SELECT amount_cents FROM client_financial_retention')).rows[0].amount_cents,6000);
 assert.equal((await pg.query('SELECT count(*)::int n FROM customer_memberships')).rows[0].n,0);
 assert.equal((await pg.query('SELECT count(*)::int n FROM appointments')).rows[0].n,1,'membership-only deletion retains bookings');
 }finally{await pg.close();}
});
