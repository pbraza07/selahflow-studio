import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {pastSessionOverride,sessionHasEnded,pastMemberVisits,applyPastMemberCredit} from '../server/past-session-override.mjs';
import {confirmBooking} from '../server/booking-approvals.mjs';
import {computeDayAvailability} from '../server/session-scheduling.mjs';
import {serviceCapacityOpen} from '../server/booking-approvals.mjs';
const clock={date:'2030-01-02',minutes:600};
test('past-time override is explicit, owner-only, ended-session-only and requires an audit reason',()=>{
 const input={pastSessionOverride:true,overrideReason:'Late attendance entry',date:'2030-01-01',start:600,duration:60};
 assert.ok(pastSessionOverride(input,{clock}));
 assert.equal(pastSessionOverride({...input,pastSessionOverride:false},{clock}),null);
 for(const role of [{isPublic:true},{isTeam:true}])assert.throws(()=>pastSessionOverride(input,{...role,clock}),/Only the business owner/);
 assert.throws(()=>pastSessionOverride({...input,overrideReason:'x'},{clock}),/reason/);
 assert.throws(()=>pastSessionOverride({...input,date:'2030-01-02'},{clock}),/already ended/);
 assert.equal(sessionHasEnded({...input,date:'2030-01-02',start:540},clock),true);
});
async function fixture(){
 const pg=new PGlite();for(const f of (await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await pg.exec(await readFile(new URL('../migrations/'+f,import.meta.url),'utf8'));
 const db={query:async(s,p)=>{const r=await pg.query(s,p);return {...r,rowCount:r.rows.length||r.affectedRows||0};},release(){}};
 await pg.exec("INSERT INTO users(id,email,password_hash) VALUES('owner','owner@example.test','hash'),('other','other@example.test','hash'); INSERT INTO businesses(id,owner_id,slug,name,status) VALUES('biz','owner','test','Test','active'),('other-biz','other','other','Other','active'); INSERT INTO business_subscriptions(business_id) VALUES('biz'),('other-biz'); INSERT INTO settings(owner,data) VALUES('owner','{}'); INSERT INTO membership_plans(id,business_id,name,price_cents,interval_unit,weekly_sessions) VALUES('plan','biz','Plan',5000,'month',1); INSERT INTO customer_memberships(id,business_id,plan_id,price_cents,stripe_account_id,customer_name,customer_email,member_number,date_of_birth,status,sessions_included,sessions_used,initial_paid_at,paid_through) VALUES('member','biz','plan',5000,'manual','Test Person','test@example.test','TP010190','1990-01-01','active',5,0,now(),now()+interval '1 month')");
 const data={name:'Test Person',email:'test@example.test',memberNumber:'TP010190',serviceIds:['s'],services:['Session'],membershipCreditAllowed:true,price:50};
 await db.query("INSERT INTO appointments(id,owner,date,start,duration,staff,status,data) VALUES('visit','owner','2020-01-01',600,60,'coach','Confirmed',$1)",[JSON.stringify(data)]);
 return {pg,db,data,close:()=>pg.close()};
}
async function transaction(db,fn){await db.query('BEGIN');try{const r=await fn();await db.query('COMMIT');return r;}catch(e){await db.query('ROLLBACK');throw e;}}
const args={owner:'owner',businessId:'biz',id:'member',appointmentId:'visit',reason:'Owner approved retroactive coverage'};
test('past visit before activation debits current balance once, retains activation and audit, and appears in attendance',async()=>{
 const f=await fixture();try{
 const before=(await f.db.query('SELECT initial_paid_at FROM customer_memberships')).rows[0].initial_paid_at;
 assert.equal((await transaction(f.db,()=>pastMemberVisits(f.db,args))).length,1);
 const result=await transaction(f.db,()=>applyPastMemberCredit(f.db,args));assert.equal(result.remaining,4);
 const replay=await transaction(f.db,()=>applyPastMemberCredit(f.db,args));assert.equal(replay.alreadyDeducted,true);
 const member=(await f.db.query('SELECT * FROM customer_memberships')).rows[0];assert.equal(member.sessions_used,1);assert.deepEqual(member.initial_paid_at,before);
 const visit=(await f.db.query('SELECT status,data FROM appointments')).rows[0];assert.equal(visit.status,'Checked in');assert.equal(JSON.parse(visit.data).price,0);
 assert.equal((await f.db.query("SELECT count(*)::int n FROM membership_session_ledger WHERE event_type='session_used'")).rows[0].n,1);
 assert.equal((await f.db.query("SELECT data FROM events WHERE kind='past_membership_override'")).rows.map(r=>JSON.parse(r.data))[0].reason,args.reason);
 assert.equal((await transaction(f.db,()=>pastMemberVisits(f.db,args))).length,0);
 }finally{await f.close();}
});
test('retroactive credits reject tenant mismatch, canceled/future visits, other clients, paid bookings, exhausted and reserved balances',async()=>{
 const f=await fixture();try{
 await assert.rejects(transaction(f.db,()=>applyPastMemberCredit(f.db,{...args,owner:'other'})),/business/);
 for(const scenario of ['Cancelled','future','identity','paid','exhausted','reserved','ineligible']){
  await f.db.query('BEGIN');
  try{
   if(scenario==='Cancelled')await f.db.query("UPDATE appointments SET status='Cancelled'");
   if(scenario==='future')await f.db.query("UPDATE appointments SET date='2099-01-01'");
   if(scenario==='identity')await f.db.query('UPDATE appointments SET data=$1',[JSON.stringify({...f.data,memberNumber:'XX010190'})]);
   if(scenario==='paid')await f.db.query('UPDATE appointments SET data=$1',[JSON.stringify({...f.data,paymentStatus:'paid'})]);
   if(scenario==='exhausted')await f.db.query('UPDATE customer_memberships SET sessions_used=5');
   if(scenario==='reserved'){
    await f.db.query('UPDATE customer_memberships SET sessions_used=4');
    await f.db.query("INSERT INTO appointments(id,owner,date,start,duration,staff,status,data) VALUES('reserved','owner','2099-01-01',600,60,'coach','Confirmed',$1)",[JSON.stringify({...f.data,membershipCovered:true})]);
   }
   if(scenario==='ineligible')await f.db.query('UPDATE appointments SET data=$1',[JSON.stringify({...f.data,membershipCreditAllowed:false})]);
   await assert.rejects(()=>applyPastMemberCredit(f.db,args),/past visit|belong|payment|remaining|unreserved|cover/);
  }finally{await f.db.query('ROLLBACK');}
 }
 assert.equal((await f.db.query('SELECT sessions_used FROM customer_memberships')).rows[0].sessions_used,0);
 assert.equal((await f.db.query('SELECT count(*)::int n FROM membership_session_ledger')).rows[0].n,0);
 }finally{await f.close();}
});
test('owner past-session admission keeps published session capacity and ordinary availability remains closed',async()=>{
 const f=await fixture();try{
 const service={id:'s',name:'Session',duration:60,price:50};const config={open:8,close:20,buffer:0,services:[service],staff:[{id:'coach',services:['s']}],bookableSessions:[{id:'past',date:'2020-01-02',staff:'coach',service:'s',start:600,capacity:1}]};
 await f.db.query('UPDATE settings SET data=$1 WHERE owner=$2',[JSON.stringify(config),'owner']);
 const options={config,date:'2020-01-02',staff:'coach',services:[service],appointments:[],reservedSlots:[],today:'2030-01-01',nowMinutes:600,capacityOpen:serviceCapacityOpen};
 assert.equal(computeDayAvailability(options).slots.length,0);
 assert.deepEqual(computeDayAvailability({...options,today:'0000-01-01'}).slots,[600]);
 const pool={...f.db,connect:async()=>f.db},booking={pool,owner:'owner',services:[service],staff:'coach',date:'2020-01-02',start:600,duration:60,buffer:0,id:'past-booking',data:{...f.data,sessionId:'past',pastSessionOverride:{reason:'Late entry',owner:'owner'}}};
 await confirmBooking(booking);
 await assert.rejects(()=>confirmBooking({...booking,id:'second-booking'}),/full/);
 assert.equal((await f.db.query("SELECT count(*)::int n FROM appointments WHERE date='2020-01-02'")).rows[0].n,1);
 }finally{await f.close();}
});

test('past-credit endpoints require owner authentication and same-origin requests',async()=>{
 const f=await fixture();const previous=process.env.APP_URL;process.env.APP_URL='https://example.test';
 try{
  const {createRequire}=await import('node:module'),ts=(await import('typescript')).default;
  const url=new URL('../app/api/studio/memberships/route.ts',import.meta.url),nativeRequire=createRequire(url),exported={};
  const compiled=ts.transpileModule(await readFile(url,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  new Function('require','exports',compiled)(path=>path.endsWith('/server/database.mjs')?{getPool:()=>({...f.db,connect:async()=>f.db})}:path.endsWith('/lib/auth')?{requireOwner:async req=>{const owner=req.headers.get('x-test-owner');if(!owner)throw Error('AUTH_REQUIRED');return owner;}}:nativeRequire(path),exported);
  const request=(owner='owner',origin='https://example.test')=>new Request('https://example.test/api/studio/memberships',{method:'POST',headers:{origin,'content-type':'application/json',...(owner?{'x-test-owner':owner}:{})},body:JSON.stringify({action:'applyPastMemberCredit',...args})});
  assert.equal((await exported.POST(request(''))).status,401);
  assert.equal((await exported.POST(request('owner','https://foreign.test'))).status,403);
  const other=await exported.POST(request('other'));assert.notEqual(other.status,200);
  assert.equal((await f.db.query('SELECT sessions_used FROM customer_memberships')).rows[0].sessions_used,0);
  const applied=await exported.POST(request());assert.equal(applied.status,200,await applied.clone().text());
 }finally{if(previous===undefined)delete process.env.APP_URL;else process.env.APP_URL=previous;await f.close();}
});
