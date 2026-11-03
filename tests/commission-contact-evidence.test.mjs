import test from 'node:test';import assert from 'node:assert/strict';import {readFile,readdir} from 'node:fs/promises';import {randomUUID} from 'node:crypto';import {PGlite} from '@electric-sql/pglite';
import {commissionEmail,commissionPhone} from '../server/commission-contact-evidence.mjs';
import {saveCommissionSettings,reserveCommission,attachCommissionSession} from '../server/first-customer-commissions.mjs';
async function setup(t){const previous={...process.env};Object.assign(process.env,{APP_ENV:'staging',STRIPE_SECRET_KEY:'sk_test_fixture',STRIPE_CONNECT_WEBHOOK_SECRET:'whsec_fixture'});const db=new PGlite();t.after(async()=>{await db.close();for(const k of Object.keys(process.env))if(!(k in previous))delete process.env[k];Object.assign(process.env,previous);});for(const f of(await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL('../migrations/'+f,import.meta.url),'utf8'));
 const query=async(s,v)=>{const r=await db.query(s,v);return {...r,rowCount:r.rows.length||r.affectedRows||0};},client={query};
 const tx=async fn=>{await query('BEGIN');try{const r=await fn();await query('COMMIT');return r;}catch(e){await query('ROLLBACK');throw e;}};
 for(const o of ['one','two']){await query('INSERT INTO users(id,email,password_hash) VALUES($1,$2,$3)',[o,o+'@example.test','unused']);await query("INSERT INTO businesses(id,owner_id,slug,name) VALUES($1,$1,$1,$1)",[o]);await query("INSERT INTO merchant_accounts(business_id,external_account_id,charges_enabled,onboarding_complete) VALUES($1,$2,true,true)",[o,'acct_'+o]);await tx(()=>saveCommissionSettings(client,{businessId:o,actor:o,bookingEnabled:true,membershipEnabled:true,acceptTerms:true}));}
 async function person(number,{business='one',name='Alex Member',email='alex@example.test',phone='+18135550123',dob=null,profile=true}={}){const registration=dob?null:randomUUID(),key=dob?name.trim().toLowerCase().replace(/\s+/g,' ')+'|'+dob:'registration:'+registration;await query('INSERT INTO business_member_ids(business_id,member_number,identity_key) VALUES($1,$2,$3)',[business,number,key]);if(profile)await query('INSERT INTO business_client_profiles(id,owner,name,email,phone,date_of_birth,member_number,registration_identity) VALUES($1,$2,$3,$4,$5,$6::date,$7,$8::uuid)',[randomUUID(),business,name,email,phone,dob,number,registration]);}
 const reserve=(number,extra={},api)=>tx(()=>reserveCommission(client,{businessId:'one',kind:'booking',memberNumber:number,sourceId:'visit-'+number,account:'acct_one',grossCents:10000,...extra},api));
 const paid=async number=>{const c=await reserve(number);assert.ok(c);await query("UPDATE first_customer_commissions SET status='paid',paid_at=now() WHERE id=$1",[c.id]);return c;};return {db,query,client,tx,person,reserve,paid};}
test('contact normalization is conservative and supports formatted US and international phones',()=>{
 assert.equal(commissionEmail(' Alex@Example.TEST '),'alex@example.test');assert.equal(commissionEmail('alex+service@example.test'),'alex+service@example.test');assert.equal(commissionEmail('N/A'),'');assert.equal(commissionEmail(''),'');
 for(const p of ['(813) 555-0123','1-813-555-0123','+1 813 555 0123','0018135550123'])assert.equal(commissionPhone(p),'+18135550123');assert.equal(commissionPhone('+351 912 345 678'),'+351912345678');for(const p of ['','5550123','unknown','+0000'])assert.equal(commissionPhone(p),'');
});
test('email OR phone corroborates a duplicate ID without charging a second first-booking fee; membership remains independent',async t=>{
 const s=await setup(t);await s.person('AM1001');await s.paid('AM1001');
 await s.person('AM1002',{email:' ALEX@EXAMPLE.TEST ',phone:'+18135550999'});assert.equal(await s.reserve('AM1002'),null);
 await s.person('AM1003',{email:'different@example.test',phone:'(813) 555-0123',name:' ALEX   MEMBER '});assert.equal(await s.reserve('AM1003'),null);
 assert.ok(await s.reserve('AM1003',{kind:'membership',sourceId:'membership-3'}));
 assert.equal(await s.reserve('AM1002',{collectionMethod:'cash',account:'cash'}),null);
});
test('supporting contacts find retained historical paid bookings and remain scoped to the business',async t=>{
 const s=await setup(t);await s.person('AM1001');await s.query("INSERT INTO appointments(id,owner,date,staff,start,duration,data,status) VALUES('old','one','2030-01-02','a',600,30,$1,'Completed')",[JSON.stringify({memberNumber:'AM1001',paymentStatus:'paid'})]);await s.person('AM1002');assert.equal(await s.reserve('AM1002'),null);
 await s.person('AM1001',{business:'two'});assert.ok(await s.reserve('AM1001',{businessId:'two',account:'acct_two',sourceId:'other-business'}));
});
test('shared family contact details do not exempt different names or conflicting known birth dates',async t=>{
 const s=await setup(t);await s.person('AM1001',{dob:'2000-01-01'});await s.paid('AM1001');await s.person('JM1002',{name:'Jamie Member',dob:'2002-01-01'});assert.ok(await s.reserve('JM1002'));
 await s.person('AM1003',{dob:'2005-01-01'});assert.ok(await s.reserve('AM1003'));
 await s.person('XX1004',{name:'Someone Else',email:'',phone:''});assert.ok(await s.reserve('XX1004'));
});
test('hashed evidence and established identity links survive contact edits and source deletion without storing raw personal details',async t=>{
 const s=await setup(t);await s.person('AM1001');await s.paid('AM1001');await s.query("DELETE FROM business_client_profiles WHERE member_number='AM1001'");await s.query("DELETE FROM business_member_ids WHERE member_number='AM1001'");await s.person('AM1002');assert.equal(await s.reserve('AM1002'),null);
 await s.query("UPDATE business_client_profiles SET email='new@example.test',phone='+18135550999' WHERE member_number='AM1002'");assert.equal(await s.reserve('AM1002'),null);
 const hashes=JSON.stringify((await s.query('SELECT * FROM commission_contact_evidence')).rows);assert.doesNotMatch(hashes,/alex@example|new@example|813555|Alex Member/);assert.ok((await s.query('SELECT * FROM commission_identity_links')).rows.length>0);
});
test('matching duplicate IDs cannot open competing first-time card claims; expired attempts can be retried',async t=>{
 const s=await setup(t);await s.person('AM1001');const a=await s.reserve('AM1001');await s.tx(()=>attachCommissionSession(s.client,a,{id:'cs_existing'}));await s.person('AM1002');let reads=0;
 await assert.rejects(s.reserve('AM1002',{},async(path,o)=>{reads++;assert.equal(path,'checkout/sessions/cs_existing');assert.equal(o.account,'acct_one');return {status:'open'};}),/matching client/);assert.equal(reads,1);
 const b=await s.reserve('AM1002',{},async()=>({status:'expired'}));assert.ok(b);assert.notEqual(a.id,b.id);
 await s.query("UPDATE first_customer_commissions SET status='refunded',refunded_fee_cents=fee_cents WHERE id=$1",[a.id]);assert.equal(await s.reserve('AM1002'),null);
});
test('same-name contacts with multiple known birthdays require verification when the new registration has no birthday',async t=>{
 const s=await setup(t);await s.person('AM1001',{dob:'2000-01-01'});await s.person('AM1002',{dob:'2001-01-01'});await s.person('AM1003');await assert.rejects(s.reserve('AM1003'),/verify the existing Client ID or birth date/);assert.equal((await s.query('SELECT * FROM first_customer_commissions')).rows.length,0);
 await s.person('AM1004',{email:'unrelated@example.test',phone:'+18135550999'});assert.ok(await s.reserve('AM1004'));
});
test('a no-birthday duplicate cannot bridge conflicting birthdays after later contact changes',async t=>{
 const s=await setup(t);await s.person('AM1001',{dob:'2000-01-01'});await s.paid('AM1001');await s.person('AM1002');assert.equal(await s.reserve('AM1002'),null);
 await s.query("UPDATE business_client_profiles SET email='new@example.test',phone='+18135550999' WHERE member_number='AM1002'");assert.equal(await s.reserve('AM1002'),null);
 await s.person('AM1003',{email:'new@example.test',phone:'+18135550999',dob:'2005-01-01'});assert.ok(await s.reserve('AM1003'));
});
test('legacy membership contact records corroborate paid membership history even without a directory profile',async t=>{
 const s=await setup(t);await s.person('AM1001',{profile:false});const key=(await s.query("SELECT identity_key FROM business_member_ids WHERE business_id='one' AND member_number='AM1001'")).rows[0].identity_key;
 await s.query("INSERT INTO membership_plans(id,business_id,name,interval_unit,price_cents,sessions_included) VALUES('plan','one','Monthly','month',10000,4)");
 await s.query("INSERT INTO customer_memberships(id,business_id,plan_id,customer_name,customer_email,customer_phone,status,stripe_account_id,price_cents,member_number,registration_identity,initial_paid_at) VALUES($1,'one','plan','Alex Member','alex@example.test','+18135550123','canceled','acct_one',10000,'AM1001',$2::uuid,now())",[randomUUID(),key.slice(13)]);
 await s.person('AM1002');assert.equal(await s.reserve('AM1002',{kind:'membership',sourceId:'new-membership'}),null);assert.ok(await s.reserve('AM1002',{kind:'booking'}));
});
