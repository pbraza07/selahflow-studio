import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {deleteClientPermanently} from '../server/delete-client.mjs';
import {authorizeClientDeletion} from '../server/deletion-authorization.mjs';
import {ensureParticipationWaiver,assertBookingWaiver,publicWaiverDocument} from '../server/participation-waivers.mjs';
import {waiverToday} from '../server/waiver-content.mjs';
import {issueMemberId} from '../server/member-id-policy.mjs';
import {startBookingCheckout} from '../server/stripe-checkout.mjs';
import {tokenHash} from '../server/security.mjs';
async function fixture(){
 const pg=new PGlite();
 for(const file of (await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await pg.exec(await readFile(new URL('../migrations/'+file,import.meta.url),'utf8'));
 await pg.exec("INSERT INTO users(id,email,password_hash) VALUES('owner','owner@example.invalid','x'); INSERT INTO businesses(id,owner_id,slug,name,status) VALUES('business','owner','test-business','Test business','active'); INSERT INTO customer_booking_ids(business_id,first_name,last_name,email,date_of_birth,member_number) VALUES('business','Test','Participant','test@example.invalid','1990-01-01','TP0101'); INSERT INTO business_client_profiles(id,owner,name,email,date_of_birth,member_number) VALUES('profile','owner','Test Participant','test@example.invalid','1990-01-01','TP0101')");
 const db={query:async(sql,args)=>{const r=await pg.query(sql,args);return {...r,rowCount:r.rows.length||r.affectedRows||0};},release(){}};
 return {pg,db,pool:{...db,connect:async()=>db}};
}
const config={name:'Test business',services:[{id:'training',requiresWaiver:true}]};
test('deletion preserves consent and reconcilable Stripe receipts once, releases ID and rejects stale source replay',async()=>{
 const {pg,db}=await fixture();try{
 const identity=(await pg.query('SELECT id FROM customer_booking_ids')).rows[0].id;
 await ensureParticipationWaiver(db,{businessId:'business',memberNumber:'TP0101',config,services:config.services,input:{signature:'Test Participant',role:'self',date:waiverToday(),version:'participation-1',documentHash:publicWaiverDocument(config).hash,accepted:true}});
 await pg.query("INSERT INTO appointments(id,owner,date,start,duration,staff,status,data) VALUES('visit','owner','2030-01-01',600,30,'coach','Completed',$1)",[JSON.stringify({name:'Test Participant',dateOfBirth:'1990-01-01',memberNumber:'TP0101',price:15})]);
 await pg.exec("INSERT INTO booking_payments(booking_id,business_id,stripe_account_id,amount_cents,lines,status) VALUES('visit','business','account',1500,'[]','paid'); INSERT INTO stripe_payment_receipts(stripe_account_id,provider_reference,business_id,booking_id,amount_cents) VALUES('account','payment','business','visit',1500)");
 await pg.query("INSERT INTO events(id,owner,created,kind,data) VALUES('receipt-event','owner','2030-01-01','cash_sale',$1)",[JSON.stringify({bookingId:'visit',providerReference:'payment',total:15,tax:0})]);
 await pg.exec('BEGIN');
 await deleteClientPermanently(db,{owner:'owner',businessId:'business',client:{id:'profile',name:'Test Participant',dateOfBirth:'1990-01-01',memberNumber:'TP0101'}});
 await pg.exec('COMMIT');
 const retained=(await pg.query('SELECT * FROM client_financial_retention')).rows;
 assert.equal(retained.length,1);assert.equal(Number(retained[0].amount_cents),1500);
 assert.doesNotMatch(JSON.stringify(retained),/Test Participant|test@example|TP0101/);
 const receipt=(await pg.query('SELECT * FROM stripe_payment_receipts')).rows[0];
 assert.equal(receipt.provider_reference,'payment');assert.equal(receipt.booking_id,null);assert.equal(receipt.membership_id,null);
 assert.equal((await pg.query('SELECT customer_id FROM participation_waivers')).rows[0].customer_id,null);
 assert.equal((await pg.query('SELECT count(*) n FROM client_deletion_audit')).rows[0].n,1);
 await assert.rejects(pg.query("INSERT INTO customer_booking_ids(id,business_id,first_name,last_name,email,date_of_birth,member_number) VALUES($1,'business','Test','Participant','','1990-01-01','TP0101')",[identity]),/deleted client record/);
 assert.equal(await issueMemberId(db,{businessId:'business',name:'Test Participant',dateOfBirth:'1990-01-01'}),'TP0101');
 await pg.exec("INSERT INTO customer_booking_ids(business_id,first_name,last_name,email,date_of_birth,member_number) VALUES('business','Test','Participant','','1990-01-01','TP0101')");
 await assert.rejects(()=>assertBookingWaiver(db,{owner:'owner',config,serviceIds:['training'],memberNumber:'TP0101'}),/required/);
 }finally{await pg.close();}
});
test('deletion authorization is exact, database-specific, recent, single-use and transactional',async()=>{
 const {pg,db}=await fixture();try{
 await assert.rejects(()=>authorizeClientDeletion(db,{businessId:'business',profileId:'profile'}),/verified backup/);
 await pg.exec("INSERT INTO client_deletion_authorizations(operation_id,business_id,profile_id,database_name,backup_sha256,restore_evidence_sha256,verified_at,expires_at) SELECT gen_random_uuid(),'business','profile',current_database(),repeat('a',64),repeat('b',64),now(),now()+interval '1 hour'");
 await assert.rejects(()=>authorizeClientDeletion(db,{businessId:'business',profileId:'other'}),/verified backup/);
 await pg.exec('BEGIN');assert.ok(await authorizeClientDeletion(db,{businessId:'business',profileId:'profile'}));await pg.exec('ROLLBACK');
 assert.ok(await authorizeClientDeletion(db,{businessId:'business',profileId:'profile'}));
 await assert.rejects(()=>authorizeClientDeletion(db,{businessId:'business',profileId:'profile'}),/verified backup/);
 }finally{await pg.close();}
});
test('checkout refuses an unsigned waiver before any Stripe call, even for an already-confirmed appointment',async()=>{
 const {pg,db,pool}=await fixture();try{
 const booking='12345678-1234-4234-8234-123456789012',token='a'.repeat(64);
 await pg.query('INSERT INTO settings(owner,data) VALUES($1,$2)',['owner',JSON.stringify(config)]);
 await pg.query("INSERT INTO appointments(id,owner,date,start,duration,staff,status,data) VALUES($1,'owner','2030-01-01',600,30,'coach','Confirmed',$2)",[booking,JSON.stringify({name:'Test Participant',dateOfBirth:'1990-01-01',memberNumber:'TP0101',serviceIds:['training'],price:15})]);
 await pg.query("INSERT INTO customer_booking_access(token_hash,owner_id,booking_id,expires_at) VALUES($1,'owner',$2,now()+interval '1 day')",[tokenHash(token),booking]);
 let calls=0;
 await assert.rejects(()=>startBookingCheckout(pool,{slug:'test-business',bookingId:booking,token,origin:'https://example.invalid'},async()=>{calls++;}),/waiver is required/);
 assert.equal(calls,0);assert.equal((await pg.query('SELECT count(*) n FROM booking_payments')).rows[0].n,0);
 }finally{await pg.close();}
});
