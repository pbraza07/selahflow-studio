import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';
import {confirmBooking} from '../server/booking-approvals.mjs';
import {previewBookingWaiver,signBookingWaiver} from '../server/booking-waiver-invitations.mjs';
import {processBookingReceipts} from '../server/booking-receipts.mjs';
import {waiverToday} from '../server/waiver-content.mjs';
import {tokenHash} from '../server/security.mjs';
async function fixture(){
 const pg=new PGlite();for(const f of (await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await pg.exec(await readFile(new URL('../migrations/'+f,import.meta.url),'utf8'));
 const db={query:async(s,p)=>{const r=await pg.query(s,p);return {...r,rowCount:r.affectedRows||r.rows.length};},release(){}};const pool={...db,connect:async()=>db};
 await pg.exec("INSERT INTO users(id,email,password_hash) VALUES('owner','owner@example.test','hash'); INSERT INTO businesses(id,owner_id,slug,name,status) VALUES('biz','owner','test-club','Test Club','active'); INSERT INTO business_subscriptions(business_id) VALUES('biz'); INSERT INTO membership_plans(id,business_id,name,price_cents,interval_unit,sessions_included) VALUES('plan','biz','Lifetime Member',5000,'month',10); INSERT INTO customer_memberships(id,business_id,plan_id,price_cents,stripe_account_id,customer_name,customer_email,member_number,date_of_birth,status,sessions_included,sessions_used,initial_paid_at) VALUES('member','biz','plan',5000,'manual','Child Example','parent@example.test','CE010115','2015-01-01','active',10,0,now()); INSERT INTO customer_booking_ids(business_id,first_name,last_name,email,date_of_birth,member_number) VALUES('biz','Child','Example','parent@example.test','2015-01-01','CE010115')");
 const service={id:'training',name:'Training',price:90,duration:60,requiresWaiver:true};
 await db.query('INSERT INTO settings(owner,data) VALUES($1,$2)',['owner',JSON.stringify({name:'Test Club',open:8,close:20,buffer:0,services:[service],staff:[{id:'coach',services:['training']}],bookableSessions:[]})]);
 const booking={pool,owner:'owner',ownerNotificationOrigin:'https://example.test',services:[service],staff:'coach',date:'2020-01-02',start:600,duration:60,buffer:0,id:'visit',applyPastMembership:true,data:{name:'Child Example',email:'parent@example.test',memberNumber:'CE010115',serviceIds:['training'],services:['Training'],price:90,membershipCreditAllowed:true,pastSessionOverride:{owner:'owner',reason:'Owner recorded past visit'}}};
 const transaction=async fn=>{await db.query('BEGIN');try{const r=await fn();await db.query('COMMIT');return r;}catch(e){await db.query('ROLLBACK');throw e;}};
 const token=async()=>{const message=(await db.query("SELECT message FROM booking_receipt_emails WHERE event_type='waiver_request'")).rows[0].message;return new URLSearchParams(new URL(message.actions[0].url).hash.slice(1)).get('token');};
 return {pg,db,pool,booking,transaction,token};
}
test('owner past booking bypasses missing waiver, debits once and queues one business email atomically',async()=>{
 const f=await fixture();try{
 const result=await confirmBooking(f.booking);assert.equal(result.waiverFollowup.status,'pending');assert.equal(result.membershipUsage.remaining,9);
 const saved=(await f.db.query("SELECT * FROM appointments WHERE id='visit'")).rows[0];assert.equal(saved.status,'Checked in');assert.equal(JSON.parse(saved.data).price,0);assert.equal(JSON.parse(saved.data).waiverFollowup.status,'pending');
 assert.equal((await f.db.query('SELECT * FROM participation_waivers')).rows.length,0);
 await confirmBooking(f.booking);assert.equal((await f.db.query('SELECT * FROM booking_receipt_emails')).rows.length,1);assert.equal((await f.db.query('SELECT sessions_used FROM customer_memberships')).rows[0].sessions_used,1);
 const token=await f.token(),invite=(await f.db.query('SELECT * FROM booking_waiver_invitations')).rows[0];assert.equal(invite.token_hash,tokenHash(token));assert.equal(invite.destination,'parent@example.test');assert.ok(!JSON.stringify(invite).includes(token));
 let sent=0;await processBookingReceipts(f.pool,{send:async(channel,to,message,a,b,ctx)=>{sent++;assert.equal(to,'parent@example.test');assert.equal(ctx.businessId,'biz');assert.match(message.actions[0].url,/\/waiver\/test-club#token=/);return {status:'submitted',detail:'Synthetic send'};}});assert.equal(sent,1);
 await processBookingReceipts(f.pool,{send:async()=>{throw Error('Duplicate send');}});
 }finally{await f.pg.close();}
});
test('future, public and team bookings still require an existing signed waiver',async()=>{
 const f=await fixture();try{
 const variants=[{ownerNotificationOrigin:null},{date:'2099-01-02'},{submissionOrigin:'https://example.test'}];
 for(const changes of variants)await assert.rejects(confirmBooking({...f.booking,...changes,applyPastMembership:false,data:{...f.booking.data}}),/signed participation waiver/);
 assert.equal((await f.db.query('SELECT * FROM appointments')).rows.length,0);assert.equal((await f.db.query('SELECT * FROM booking_waiver_invitations')).rows.length,0);
 }finally{await f.pg.close();}
});
test('private link enforces tenant, contact, expiry, current text, birth date and guardian signing without changing attendance or credits',async()=>{
 const f=await fixture();try{
 await confirmBooking(f.booking);const token=await f.token(),input={slug:'test-club',token};
 const preview=await f.transaction(()=>previewBookingWaiver(f.db,input));assert.equal(preview.participantName,'Child Example');assert.equal(preview.identityExists,true);assert.ok(!JSON.stringify(preview).includes('2015-01-01'));assert.equal(preview.signed,false);
 await assert.rejects(f.transaction(()=>previewBookingWaiver(f.db,{...input,slug:'other-club'})),/invalid or expired/);
 await assert.rejects(f.transaction(()=>previewBookingWaiver(f.db,{...input,token:'0'.repeat(64)})),/invalid or expired/);
 const signature={signature:'Parent Example',role:'parent',date:waiverToday(),accepted:true,version:preview.document.version,documentHash:preview.document.hash};
 const sign={...input,dateOfBirth:'2015-01-01',signature};
 await assert.rejects(f.transaction(()=>signBookingWaiver(f.db,{...sign,dateOfBirth:'2014-01-01'})),/birth date/);
 for(const patch of [{role:'self',signature:'Child Example'},{date:'2020-01-02'},{documentHash:'old'},{accepted:false}])await assert.rejects(f.transaction(()=>signBookingWaiver(f.db,{...sign,signature:{...signature,...patch}})));
 assert.equal((await f.db.query('SELECT * FROM participation_waivers')).rows.length,0);
 const before=(await f.db.query('SELECT sessions_used FROM customer_memberships')).rows[0].sessions_used;
 assert.equal((await f.transaction(()=>signBookingWaiver(f.db,sign))).signed,true);
 await f.transaction(()=>signBookingWaiver(f.db,sign));
 const waivers=(await f.db.query('SELECT signed_date::text AS date,signer_role FROM participation_waivers')).rows;assert.equal(waivers.length,1);assert.equal(waivers[0].date,waiverToday());assert.equal(waivers[0].signer_role,'parent');
 const visit=(await f.db.query("SELECT date,status,data FROM appointments WHERE id='visit'")).rows[0];assert.equal(visit.date,'2020-01-02');assert.equal(visit.status,'Checked in');assert.equal(JSON.parse(visit.data).waiverFollowup.status,'signed');assert.equal(JSON.parse(visit.data).price,0);
 assert.equal((await f.db.query('SELECT sessions_used FROM customer_memberships')).rows[0].sessions_used,before);
 let sent=0;await processBookingReceipts(f.pool,{send:async()=>{sent++;}});assert.equal(sent,0,'completed requests are not emailed');
 await f.db.query("UPDATE booking_waiver_invitations SET expires_at=now()-interval '1 minute'");await assert.rejects(f.transaction(()=>previewBookingWaiver(f.db,input)),/invalid or expired/);
 }finally{await f.pg.close();}
});
test('manual past client without an ID can register verified booking identity when signing, and contact changes invalidate the link',async()=>{
 const f=await fixture();try{
 const booking={...f.booking,applyPastMembership:false,data:{...f.booking.data,memberNumber:null,name:'New Adult',email:'new@example.test'}};
 await confirmBooking(booking);const input={slug:'test-club',token:await f.token()};
 const preview=await f.transaction(()=>previewBookingWaiver(f.db,input));assert.equal(preview.identityExists,false);
 const sign={...input,dateOfBirth:'1990-01-01',firstName:'New',lastName:'Adult',signature:{signature:'New Adult',role:'self',date:waiverToday(),accepted:true,version:preview.document.version,documentHash:preview.document.hash}};
 await assert.rejects(f.transaction(()=>signBookingWaiver(f.db,{...sign,firstName:'Different'})),/name must match/);
 await f.transaction(()=>signBookingWaiver(f.db,sign));assert.equal((await f.db.query("SELECT member_number FROM customer_booking_ids WHERE first_name='New'")).rows[0].member_number,'NA010190');
 const visit=JSON.parse((await f.db.query("SELECT data FROM appointments WHERE id='visit'")).rows[0].data);assert.equal(visit.memberNumber,'NA010190');
 await f.db.query("UPDATE appointments SET data=$1 WHERE id='visit'",[JSON.stringify({...visit,email:'different@example.test'})]);await assert.rejects(f.transaction(()=>previewBookingWaiver(f.db,input)),/contact changed/);
 }finally{await f.pg.close();}
});
test('waiver endpoint rejects cross-origin and malformed access and uses private no-store responses',async()=>{
 const f=await fixture();try{
 await confirmBooking(f.booking);const token=await f.token(),url=new URL('../app/api/public/booking-waiver/route.ts',import.meta.url),native=createRequire(url),exports={};
 new Function('require','exports',ts.transpileModule(await readFile(url,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(path=>path.endsWith('/server/database.mjs')?{getPool:()=>f.pool}:native(path),exports);
 const origin=process.env.APP_URL||process.env.RENDER_EXTERNAL_URL||'https://example.test';
 const req=(body,from=origin)=>new Request(origin+'/api/public/booking-waiver',{method:'POST',headers:{Origin:from,'Content-Type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await exports.POST(req({action:'preview',slug:'test-club',token},'https://foreign.invalid'))).status,403);
 assert.equal((await exports.POST(req(null))).status,400);
 const response=await exports.POST(req({action:'preview',slug:'test-club',token}));assert.equal(response.status,200,await response.clone().text());assert.match(response.headers.get('cache-control'),/no-store/);assert.equal((await response.json()).signed,false);
 }finally{await f.pg.close();}
});
