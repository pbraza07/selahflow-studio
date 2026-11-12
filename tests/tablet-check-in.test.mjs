import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {kioskIdentity,kioskPhone,kioskContext,kioskLookup,kioskCheckIn,kioskMemberStatus,kioskWaiver,kioskSignWaiver} from '../server/kiosk.mjs';
import {markAutomaticNoShow,processAutomaticAttendance} from '../server/automatic-attendance.mjs';
import {changeAppointmentStatus} from '../server/appointment-membership-usage.mjs';
import {publicWaiverDocument,ensureParticipationWaiver} from '../server/participation-waivers.mjs';
import {waiverToday} from '../server/waiver-content.mjs';
import {tokenHash} from '../server/security.mjs';
const now=new Date('2026-11-12T15:00:00Z'),config={name:'Test Club',timezone:'America/New_York'},token='a'.repeat(64);
async function fixture(){
 const db=new PGlite();for(const f of (await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL('../migrations/'+f,import.meta.url),'utf8'));
 await db.exec(`INSERT INTO users(id,email,password_hash) VALUES('owner','owner@example.test','hash'),('other','other@example.test','hash');
 INSERT INTO businesses(id,owner_id,slug,name,status,auto_no_show_after) VALUES('biz','owner','test-club','Test Club','active','2026-11-12T00:00Z'),('other','other','other-club','Other Club','active','2026-11-12T00:00Z');
 INSERT INTO membership_plans(id,business_id,name,interval_unit,price_cents,sessions_included) VALUES('plan','biz','Gold','month',10000,8);
 INSERT INTO customer_memberships(id,business_id,plan_id,customer_name,customer_email,customer_phone,date_of_birth,status,price_cents,sessions_included,sessions_used,member_number,stripe_account_id) VALUES('member','biz','plan','Jane Doe','jane@example.test','8135550100','1990-01-01','active',10000,8,0,'JD010190','manual');
 INSERT INTO customer_booking_ids(business_id,first_name,last_name,email,date_of_birth,member_number) VALUES('biz','Jane','Doe','jane@example.test','1990-01-01','JD010190');`);
 const device=(await db.query("INSERT INTO kiosk_devices(business_id,token_hash,expires_at) VALUES('biz',$1,now()+interval '1 day') RETURNING id",[tokenHash(token)])).rows[0];
 const ctx={id:'biz',slug:'test-club',owner_id:'owner',config,device_id:device.id};
 const add=async(id,data={},start=600,status='Confirmed',date='2026-11-12',owner='owner')=>db.query('INSERT INTO appointments(id,owner,date,staff,start,duration,status,data) VALUES($1,$2,$3,$4,$5,60,$6,$7)',[id,owner,date,id+'-coach',start,status,JSON.stringify({name:'Jane Doe',email:'jane@example.test',phone:'(813) 555-0100',memberNumber:'JD010190',services:['Small group'],...data})]);
 return {db,ctx,add};
}
async function tx(db,fn){await db.exec('BEGIN');try{const v=await fn();await db.exec('COMMIT');return v;}catch(e){await db.exec('ROLLBACK');throw e;}}
const used=async db=>(await db.query("SELECT sessions_used FROM customer_memberships WHERE id='member'")).rows[0].sessions_used;
test('tablet identifiers normalize common phone formats, email and Member IDs',()=>{
 for(const phone of ['8135550100','(813) 555-0100','+1 813.555.0100','001-813-555-0100','813 555 0100 ext. 23'])assert.equal(kioskPhone(phone),'8135550100');
 assert.equal(kioskIdentity('email',' JANE@EXAMPLE.TEST '),'jane@example.test');assert.equal(kioskIdentity('memberNumber','jd-010190'),'JD010190');
 assert.throws(()=>kioskIdentity('phone','abc'));assert.throws(()=>kioskIdentity('memberNumber','invalid'));assert.equal(kioskPhone('+44 20 7946 0958'),'442079460958');
});
test('paired tablet is scoped to its business, expiry and revocation',async()=>{const {db,ctx}=await fixture();try{
 const req=new Request('https://example.test',{headers:{cookie:'sf_kiosk_test-club='+token}});
 assert.equal((await kioskContext(db,req,'test-club')).device_id,ctx.device_id);
 await assert.rejects(()=>kioskContext(db,req,'other-club'),/KIOSK_REQUIRED/);
 await db.query('UPDATE kiosk_devices SET revoked_at=now()');await assert.rejects(()=>kioskContext(db,req,'test-club'),/KIOSK_REQUIRED/);
 await db.query("UPDATE kiosk_devices SET revoked_at=NULL,expires_at=now()-interval '1 day'");await assert.rejects(()=>kioskContext(db,req,'test-club'),/KIOSK_REQUIRED/);
 }finally{await db.close();}});
test('tablet lookup, check-in and retries use exactly one membership session, ordinary attendance stays ordinary',async()=>{const {db,ctx,add}=await fixture();try{
 await add('visit');const early=await tx(db,()=>kioskLookup(db,ctx,{kind:'email',value:'jane@example.test'},new Date('2026-11-12T14:29Z')));assert.equal(early.appointments[0].canCheckIn,false);await assert.rejects(()=>tx(db,()=>kioskCheckIn(db,ctx,{grant:early.grant,id:'visit'},new Date('2026-11-12T14:29Z'))),/30 minutes/);await add('foreign',{},600,'Confirmed','2026-11-12','other');await add('sample',{sample:true});
 let result=await tx(db,()=>kioskLookup(db,ctx,{kind:'phone',value:'+1 (813) 555-0100'},now));assert.deepEqual(result.appointments.map(a=>a.id),['visit']);assert.equal(result.appointments[0].canCheckIn,true);assert.equal('email'in result.appointments[0],false);
 await assert.rejects(()=>tx(db,()=>kioskCheckIn(db,ctx,{grant:result.grant,id:'foreign'},now)),/Choose a session/);
 const checked=await tx(db,()=>kioskCheckIn(db,ctx,{grant:result.grant,id:'visit'},now));assert.equal(checked.membershipDeducted,true);assert.equal(await used(db),1);
 assert.equal((await tx(db,()=>kioskCheckIn(db,ctx,{grant:result.grant,id:'visit'},now))).alreadyProcessed,true);assert.equal(await used(db),1);
 const member=await tx(db,()=>kioskMemberStatus(db,ctx,{value:'JD010190'}));assert.equal(member.plans[0].used,1);assert.equal(member.plans[0].remaining,7);assert.equal(member.history[0].membershipSessionUsed,true);assert.deepEqual(member.history[0].services,['Small group']);assert.ok(!member.history.some(a=>a.id==='foreign'));
 await add('regular',{name:'Non Member',email:'regular@example.test',memberNumber:''});result=await tx(db,()=>kioskLookup(db,ctx,{kind:'email',value:'REGULAR@example.test'},now));await tx(db,()=>kioskCheckIn(db,ctx,{grant:result.grant,id:'regular'},now));assert.equal(await used(db),1);assert.equal((await db.query("SELECT status FROM appointments WHERE id='regular'")).rows[0].status,'Checked in');
 await db.query('DELETE FROM kiosk_grants');await assert.rejects(()=>tx(db,()=>kioskCheckIn(db,ctx,{grant:result.grant,id:'regular'},now)),/expired/);
 }finally{await db.close();}});
test('five-minute grace boundary, automatic marking, owner correction and midnight sessions',async()=>{const {db,ctx,add}=await fixture();try{
 await add('visit');const business={id:ctx.id,owner_id:ctx.owner_id,config};const options={business,appointmentId:'visit'};
 assert.equal((await tx(db,()=>markAutomaticNoShow(db,{...options,now:new Date('2026-11-12T15:04:59Z')}))).skipped,true);
 let found=await tx(db,()=>kioskLookup(db,ctx,{kind:'memberNumber',value:'JD010190'},now));
 await assert.rejects(()=>tx(db,()=>kioskCheckIn(db,ctx,{id:'visit',grant:found.grant},new Date('2026-11-12T15:05:00Z'))),/ask staff/);
 await tx(db,()=>markAutomaticNoShow(db,{...options,now:new Date('2026-11-12T15:05:00Z')}));assert.equal(await used(db),1);
 assert.equal((await tx(db,()=>markAutomaticNoShow(db,{...options,now:new Date('2026-11-12T15:06Z')}))).skipped,true);
 await tx(db,()=>changeAppointmentStatus(db,{owner:'owner',appointmentId:'visit',status:'Checked in',eventId:'correction',ledgerId:'correction-ledger',createdAt:now.toISOString()}));assert.equal(await used(db),1);
 await add('midnight',{},1438);await tx(db,()=>markAutomaticNoShow(db,{business,appointmentId:'midnight',now:new Date('2026-11-13T05:03Z')}));assert.equal(await used(db),2);
 await add('old',{},600,'Confirmed','2026-11-11');assert.equal((await tx(db,()=>markAutomaticNoShow(db,{business,appointmentId:'old',now}))).skipped,true);
 await add('disabled');await db.query("UPDATE businesses SET auto_no_show_enabled=false WHERE id='biz'");assert.equal((await tx(db,()=>markAutomaticNoShow(db,{business,appointmentId:'disabled',now:new Date('2026-11-12T15:06Z')}))).skipped,true);
 }finally{await db.close();}});
test('worker selects only due confirmed bookings after activation, skips samples and records failures for owner review',async()=>{const {db,add}=await fixture();try{
 await add('due');await add('early',{},660);await add('cancelled',{},600,'Cancelled');await add('sample',{sample:true});await add('old',{},600,'Confirmed','2026-11-11');
 const pool={query:(...a)=>db.query(...a),connect:async()=>({query:(...a)=>db.query(...a),release(){}})};
 const result=await processAutomaticAttendance(pool,new Date('2026-11-12T15:05Z'));assert.equal(result.marked,1);assert.equal(result.failed,0);assert.equal(await used(db),1);assert.equal((await processAutomaticAttendance(pool,new Date('2026-11-12T15:05Z'))).marked,0);
 await db.query("UPDATE membership_plans SET credit_eligibility='{\"mode\":\"selected\",\"serviceIds\":[\"other-service\"]}' WHERE id='plan'");await add('needs-review',{membershipCovered:true,serviceIds:['training']});
 for(let i=0;i<5;i++)assert.equal((await processAutomaticAttendance(pool,new Date('2026-11-12T15:06Z'))).failed,1);
 assert.equal((await processAutomaticAttendance(pool,new Date('2026-11-12T15:06Z'))).failed,0);assert.equal((await db.query("SELECT status FROM automatic_attendance WHERE appointment_id='needs-review'")).rows[0].status,'review');assert.equal(await used(db),1);
 }finally{await db.close();}});
test('waiver re-signing validates before replacing current consent and retains superseded evidence',async()=>{const {db,ctx}=await fixture();try{
 const document=publicWaiverDocument(config),signature={signature:'Jane Doe',role:'self',date:waiverToday(),accepted:true,version:document.version,documentHash:document.hash};
 const first=await tx(db,()=>ensureParticipationWaiver(db,{businessId:'biz',memberNumber:'JD010190',config,services:[{requiresWaiver:true}],input:signature}));
 const result=await tx(db,()=>kioskWaiver(db,ctx,{value:'JD010190'}));
 const sign=input=>tx(db,()=>kioskSignWaiver(db,ctx,{grant:result.grant,signature:input},new Request('https://example.test')));
 await assert.rejects(()=>sign({...signature,accepted:false}),/agree|sign/i);assert.equal((await db.query('SELECT deleted_at FROM participation_waivers WHERE id=$1',[first])).rows[0].deleted_at,null);
 await assert.rejects(()=>sign({...signature,documentHash:'stale'}),/changed/);
 await sign(signature);const rows=(await db.query('SELECT id,deleted_at,superseded_at FROM participation_waivers')).rows;assert.equal(rows.length,2);assert.equal(rows.filter(r=>!r.deleted_at).length,1);assert.ok(rows.find(r=>r.id===first).superseded_at);
 await assert.rejects(()=>sign(signature),/expired/);
 }finally{await db.close();}});
