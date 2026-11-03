import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import ts from 'typescript';
import {tokenHash} from '../server/security.mjs';
import {queueOwnerPaymentEmail} from '../server/owner-payment-email.mjs';
import {processClientMessages} from '../server/booking-client-notifications.mjs';
import {bookingPaymentPreview} from '../server/booking-payment-preview.mjs';
import {bookingServicePaymentOptions} from '../server/service-payment-options.mjs';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
async function setup(t){
 const pg=new PGlite();t.after(()=>pg.close());
 for(const key of ['STRIPE_SECRET_KEY','STRIPE_CONNECT_WEBHOOK_SECRET','APP_URL']){const old=process.env[key];process.env[key]=key==='APP_URL'?'https://example.test':'fixture';t.after(()=>{if(old===undefined)delete process.env[key];else process.env[key]=old;});}
 for(const f of(await readdir(new URL('../migrations/',import.meta.url))).filter(x=>x.endsWith('.sql')).sort())await pg.exec(await read('migrations/'+f));
 const db={query:async(s,v)=>{if(s.includes('pg_advisory_xact_lock'))return {rows:[],rowCount:0};const r=await pg.query(s,v);return {...r,rowCount:r.rows.length||r.affectedRows||0};},release(){}};const pool={...db,connect:async()=>db};
 await pg.exec("INSERT INTO users(id,email,password_hash) VALUES('o','owner@example.test','unused');INSERT INTO businesses(id,owner_id,slug,name,status) VALUES('biz','o','sample','Synthetic Business','active');INSERT INTO merchant_accounts(business_id,provider,external_account_id,charges_enabled,onboarding_complete) VALUES('biz','stripe','acct_fixture',true,true)");
 const config={services:[{id:'s',name:'Session',price:25,duration:30,paymentOptions:'onsite'}],staff:[{id:'coach',name:'Coach',services:['s']}]};await db.query("INSERT INTO settings(owner,data) VALUES('o',$1)",[JSON.stringify(config)]);
 const id=randomUUID(),data={name:'Synthetic Client',email:'client@example.test',phone:'+14155552671',services:['Session'],serviceIds:['s'],price:25,paymentPolicy:'onsite_only'};
 await db.query("INSERT INTO appointments VALUES($1,'o','2030-01-02','coach',600,30,$2,'Confirmed')",[id,JSON.stringify(data)]);
 const input={bookingId:id,key:randomUUID(),confirmed:true,expectedEmail:data.email,expectedAmountCents:2500};
 const request=(extra={},owner='o')=>queueOwnerPaymentEmail(pool,{owner,input:{...input,...extra},origin:'https://example.test'});
 const patch=async values=>db.query('UPDATE appointments SET data=$1 WHERE id=$2',[JSON.stringify({...data,...values}),id]);
 const message=async()=>(await db.query('SELECT * FROM booking_client_messages')).rows[0];
 return {pg,db,pool,id,data,input,request,patch,message,config};
}
test('owner queues one private email, authorizes online for this appointment, creates no charge and deduplicates requests',async t=>{
 const s=await setup(t);assert.equal(bookingServicePaymentOptions(s.config,s.data).online,false);
 const r=await s.request();assert.equal(r.queued,true);assert.ok(!JSON.stringify(r).includes('token='));
 const message=await s.message();assert.equal(message.channel,'email');assert.equal(message.destination,s.data.email);assert.equal((await s.db.query('SELECT * FROM booking_client_messages')).rows.length,1);
 assert.ok(message.message.actions.some(x=>x.label==='Make Payment'));assert.ok(message.message.actions.some(x=>x.label==='Pay on Site'));
 const saved=JSON.parse((await s.db.query('SELECT data FROM appointments WHERE id=$1',[s.id])).rows[0].data);assert.equal(saved.paymentPolicy,'onsite_only');assert.equal(saved.ownerEmailPaymentAllowed,true);assert.notEqual(saved.paymentStatus,'paid');assert.equal(bookingServicePaymentOptions(s.config,saved).online,true);assert.equal(s.config.services[0].paymentOptions,'onsite');
 const link=(await s.db.query('SELECT payment_url FROM booking_client_flows')).rows[0].payment_url,token=new URLSearchParams(new URL(link).hash.slice(1)).get('token');
 assert.equal((await bookingPaymentPreview(s.pool,{slug:'sample',bookingId:s.id,token,origin:'https://example.test'})).status,'ready');
 assert.equal((await s.db.query('SELECT * FROM booking_payments')).rows.length,0);assert.equal((await s.request()).alreadyQueued,true);assert.equal((await s.request({key:randomUUID()})).alreadyQueued,true);assert.equal((await s.db.query('SELECT * FROM events')).rows.length,1);
 let sends=0;await processClientMessages(s.pool,{send:async(channel,destination,m)=>{sends++;assert.equal(channel,'email');assert.equal(m.idempotencyKey,'client-message-'+message.id);return {status:'submitted',detail:'Fixture accepted'};}});assert.equal(sends,1);
 assert.equal((await s.request()).queued,false);assert.equal((await s.request({key:randomUUID()})).queued,false);
 await s.db.query("UPDATE booking_client_messages SET updated_at=now()-interval '2 minutes'");const key=randomUUID();assert.equal((await s.request({key})).queued,true);assert.equal((await s.message()).id,key);assert.equal((await s.db.query('SELECT payment_url FROM booking_client_flows')).rows[0].payment_url,link);
 await s.db.query("UPDATE booking_client_messages SET status='unknown'");assert.equal((await s.request({key})).queued,false);await assert.rejects(s.request({key:randomUUID()}),/delivery outcome/);
 await s.db.query("UPDATE booking_client_messages SET status='failed',attempts=3");assert.equal((await s.request({key})).queued,false);const fresh=randomUUID();assert.equal((await s.request({key:fresh})).queued,true);assert.equal((await s.message()).id,fresh);assert.equal((await s.message()).attempts,0);
});
test('owner rejects stale, unapproved, paid, covered, invalid, foreign and unavailable payment requests without side effects',async t=>{
 const s=await setup(t);await assert.rejects(s.request({confirmed:false}),/confirm/);await assert.rejects(s.request({},'other'),/unavailable/);await assert.rejects(s.request({expectedEmail:'other@example.test'}),/changed/);await assert.rejects(s.request({expectedAmountCents:1}),/changed/);
 for(const values of [{price:0},{price:.1},{membershipCovered:true},{paymentStatus:'paid'},{email:''}]){await s.patch(values);await assert.rejects(s.request());}await s.patch({});
 await s.db.query("UPDATE appointments SET status='Cancelled'");await assert.rejects(s.request(),/eligible/);await s.db.query("UPDATE appointments SET status='Confirmed'");
 const rid=randomUUID();await s.db.query("INSERT INTO booking_requests(id,business_id,owner_id,date,staff_id,start_minute,duration,details,reviewer,appointment_id) VALUES($1,'biz','o','2030-01-02','coach',600,30,'{}','owner',$2)",[rid,s.id]);await assert.rejects(s.request(),/Approve/);await s.db.query("UPDATE booking_requests SET status='accepted'");
 await s.db.query("INSERT INTO booking_payments(booking_id,business_id,stripe_account_id,amount_cents,lines,terminal_payment_intent_id) VALUES($1,'biz','acct_fixture',2500,'[]','pi_fixture')",[s.id]);await assert.rejects(s.request(),/phone card/);await s.db.query("UPDATE booking_payments SET status='paid'");await assert.rejects(s.request(),/already/);await s.db.query('DELETE FROM booking_payments');
 await s.db.query('UPDATE merchant_accounts SET charges_enabled=false');await assert.rejects(s.request(),/Stripe setup/);assert.equal((await s.db.query('SELECT * FROM booking_client_messages')).rows.length,0);assert.equal((await s.db.query('SELECT * FROM booking_client_flows')).rows.length,0);assert.equal(JSON.parse((await s.db.query('SELECT data FROM appointments')).rows[0].data).ownerEmailPaymentAllowed,undefined);
});
test('expired private links rotate, retain accepted request scope and never queue SMS',async t=>{
 const s=await setup(t),rid=randomUUID();await s.db.query("INSERT INTO booking_requests(id,business_id,owner_id,date,staff_id,start_minute,duration,details,reviewer,appointment_id,status) VALUES($1,'biz','o','2030-01-02','coach',600,30,'{}','owner',$2,'accepted')",[rid,s.id]);await s.patch({bookingRequestId:rid});await s.request();
 const old=(await s.db.query('SELECT payment_url FROM booking_client_flows')).rows[0].payment_url;await s.db.query("UPDATE booking_client_flows SET expires_at=now()-interval '1 second'");await s.db.query("UPDATE booking_client_messages SET status='submitted',updated_at=now()-interval '2 minutes'");await s.request({key:randomUUID()});
 const flow=(await s.db.query('SELECT * FROM booking_client_flows')).rows[0];assert.notEqual(flow.payment_url,old);assert.equal(flow.request_id,rid);assert.equal(new URLSearchParams(new URL(flow.payment_url).hash.slice(1)).get('booking_id'),rid);assert.equal((await s.db.query('SELECT * FROM customer_booking_access')).rows.length,2);assert.equal((await s.db.query("SELECT * FROM booking_client_messages WHERE channel='sms'")).rows.length,0);
});
test('email worker suppresses queued payment requests after cash payment, coverage, cancellation, price or recipient changes',async t=>{
 const s=await setup(t);await s.request();let sends=0;
 for(const values of [{paymentStatus:'paid'},{membershipCovered:true},{price:0},{price:30},{email:'new@example.test'}]){await s.patch(values);await s.db.query("UPDATE booking_client_messages SET status='queued',next_attempt_at=now()");await processClientMessages(s.pool,{send:async()=>{sends++;return {status:'submitted',detail:'Fixture'};}});assert.equal((await s.message()).status,'superseded');}
 await s.patch({});await s.db.query("UPDATE appointments SET status='Cancelled'");await s.db.query("UPDATE booking_client_messages SET status='queued',next_attempt_at=now()");await processClientMessages(s.pool,{send:async()=>{sends++;}});assert.equal(sends,0);
});
test('payment email API enforces real owner sessions, origin, size and review; team cookies do not authorize sending',async t=>{
 const s=await setup(t);globalThis.__paymentEmailTest={pool:s.pool};t.after(()=>delete globalThis.__paymentEmailTest);
 async function load(path){let source=ts.transpileModule(await read(path),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;source=source.replace(/import \{ getPool \}[^\n]+;/,'const getPool=()=>globalThis.__paymentEmailTest.pool;').replace(/import \{ requireOwner \}[^\n]+;/,'const requireOwner=req=>globalThis.__paymentEmailTest.requireOwner(req);').replace(/(['"])\.\.\/(?:\.\.\/)*server\/([^'"]+)\1/g,(_,q,f)=>JSON.stringify(new URL('../server/'+f,import.meta.url).href));return import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));}
 globalThis.__paymentEmailTest.requireOwner=(await load('lib/auth.ts')).requireOwner;const api=await load('app/api/studio/payment-email/route.ts');
 const request=(body,cookie='',origin='https://example.test')=>new Request('https://example.test/api/studio/payment-email',{method:'POST',headers:{origin,cookie},body:typeof body==='string'?body:JSON.stringify(body)});
 assert.equal((await api.POST(request(s.input))).status,401);assert.equal((await api.POST(request(s.input,'selahflow_team_session='+'f'.repeat(64)))).status,401);assert.equal((await api.POST(request(s.input,'','https://foreign.test'))).status,403);
 const token='a'.repeat(64);await s.db.query("INSERT INTO sessions VALUES($1,'o',now()+interval '1 hour')",[tokenHash(token)]);const cookie='salonflow_session='+token;
 assert.equal((await api.POST(request('x'.repeat(2001),cookie))).status,413);assert.equal((await api.POST(request('{',cookie))).status,400);assert.equal((await api.POST(request(null,cookie))).status,400);
 const response=await api.POST(request(s.input,cookie));assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/private, no-store/);assert.equal((await response.json()).queued,true);
});
