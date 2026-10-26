import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';
import {weeklyMembershipWindow,weeklyMonthCredits,validateWeeklySessions,assertWeeklyMembershipBooking,membershipBookingActive} from '../server/membership-weekly.mjs';
import {applyManualPeriod} from '../server/manual-membership-period.mjs';
import {confirmBooking} from '../server/booking-approvals.mjs';
import {recordMembershipPaidPeriod} from '../server/stripe-checkout.mjs';
import {changeAppointmentStatus} from '../server/appointment-membership-usage.mjs';
const member={initial_paid_at:'2030-01-31T18:00:00Z',billing_start_override:null,status:'active',paid_through:'2031-01-31T12:00:00Z',weekly_sessions:1};
test('weekly membership follows month anniversaries, four/five weeks, leap years and DST date labels',()=>{
 assert.equal(weeklyMembershipWindow(member,'2030-02-27').weeks,4);
 assert.deepEqual(weeklyMembershipWindow(member,'2030-02-28'),{start:'2030-02-28',end:'2030-03-07',monthStart:'2030-02-28',monthEnd:'2030-03-31',weeks:5});
 assert.equal(weeklyMembershipWindow(member,'2030-03-30').end,'2030-03-31');
 assert.equal(weeklyMembershipWindow({...member,initial_paid_at:'2028-01-31T18:00Z'},'2028-02-28').end,'2028-02-29');
 assert.equal(weeklyMonthCredits({...member,initial_paid_at:'2030-03-01T18:00Z'},3,new Date('2030-03-15T18:00Z')),15);
 assert.equal(weeklyMonthCredits(member,2,new Date('2030-02-10T18:00Z')),8);
 assert.equal(weeklyMembershipWindow({...member,billing_start_override:'2030-01-15'},'2030-02-14').end,'2030-02-15');
 assert.equal(membershipBookingActive({...member,sessions_included:4,sessions_used:4},'2030-03-01'),true);
 assert.equal(membershipBookingActive(member,'2031-01-31'),false);
 assert.throws(()=>weeklyMembershipWindow(member,'2030-01-30'),/before/);
 for(const n of [0,4,1.5,'2',true])assert.throws(()=>validateWeeklySessions(n),/Choose/);
 for(const n of [1,2,3])assert.equal(validateWeeklySessions(n),n);
 assert.equal(validateWeeklySessions(null),null);
});
async function fixture(){
 const pg=new PGlite();for(const f of (await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await pg.exec(await readFile(new URL('../migrations/'+f,import.meta.url),'utf8'));
 await pg.exec("INSERT INTO users(id,email,password_hash) VALUES('owner','o@example.test','hash'),('other','x@example.test','hash'); INSERT INTO businesses(id,owner_id,slug,name,status) VALUES('biz','owner','weekly-test','Weekly','active'),('foreign','other','other-test','Other','active'); INSERT INTO business_subscriptions(business_id,plan_code) VALUES('biz','business'),('foreign','business'); INSERT INTO membership_plans(id,business_id,name,interval_unit,price_cents,sessions_included,weekly_sessions) VALUES('plan','biz','Weekly Training','month',10000,5,1),('other-plan','foreign','Other','month',10000,5,1);");
 const config={open:8,close:20,buffer:0,services:[{id:'training',name:'Training',duration:30,price:30,requiresApproval:false}],staff:[{id:'coach',name:'Coach',services:['training']}],bookableSessions:[]};
 await pg.query('INSERT INTO settings(owner,data) VALUES($1,$2)',['owner',JSON.stringify(config)]);
 await pg.exec("INSERT INTO customer_memberships(id,business_id,plan_id,customer_name,customer_email,price_cents,stripe_account_id,status,member_number,sessions_included,sessions_used,initial_paid_at,credit_period_start,credit_period_end,paid_through,monthly_sessions) VALUES('member','biz','plan','Member','m@example.test',10000,'','active','MM010190',5,0,'2030-01-01T18:00Z','2030-01-01T12:00Z','2030-02-01T12:00Z','2031-01-01T12:00Z',5),('other-member','foreign','other-plan','Other','x@example.test',10000,'','active','MM010190',5,0,'2030-01-01T18:00Z','2030-01-01T12:00Z','2030-02-01T12:00Z','2031-01-01T12:00Z',5)");
 const db={query:async(s,p)=>{const r=await pg.query(s,p);return {...r,rowCount:r.affectedRows||r.rows.length};},release(){}},pool={...db,connect:async()=>db};
 const url=new URL('../app/api/studio/memberships/route.ts',import.meta.url),exports={},nativeRequire=createRequire(url);
 new Function('require','exports',ts.transpileModule(await readFile(url,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText)(p=>p.endsWith('/server/database.mjs')?{getPool:()=>pool}:p.endsWith('/lib/auth')?{requireOwner:async req=>{const id=req.headers.get('x-test-owner');if(!id)throw Error('AUTH_REQUIRED');return id;}}:nativeRequire(p),exports);
 const origin=process.env.APP_URL||process.env.RENDER_EXTERNAL_URL||'https://example.test';
 const post=(body,owner='owner')=>exports.POST(new Request(origin+'/api/studio/memberships',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','x-test-owner':owner},body:JSON.stringify(body)}));
 const book=(id,date='2030-01-02',start=600)=>confirmBooking({pool,owner:'owner',services:config.services,staff:'coach',date,start,duration:30,buffer:0,id,data:{memberNumber:'MM010190',serviceIds:['training'],membershipCovered:true,membershipCreditAllowed:true,price:0}});
 return {pg,db,pool,post,book};
}
test('owner plan settings validate weekly allowances and preserve tenant and legacy records',async()=>{
 const {pg,post}=await fixture();try{
 const body={action:'save',name:'Twice weekly',description:'Training',interval:'month',intervalCount:1,priceCents:10000,sessionsIncluded:0,weeklySessions:2,creditEligibility:{mode:'all'}};
 assert.equal((await post(body,'')).status,401);
 const invalid=await post({...body,weeklySessions:4});assert.equal(invalid.status,400,await invalid.text());
 const saved=await post(body);assert.equal(saved.status,200,await saved.text());
 const plan=(await pg.query("SELECT * FROM membership_plans WHERE name='Twice weekly'")).rows[0];assert.equal(plan.weekly_sessions,2);
 assert.notEqual((await post({...body,id:plan.id},'other')).status,200);
 const updated=await post({...body,id:plan.id,weeklySessions:3});assert.equal(updated.status,200,await updated.text());
 const legacy=await post({...body,name:'Fixed monthly',weeklySessions:null,sessionsIncluded:8});assert.equal(legacy.status,200,await legacy.text());
 assert.equal((await pg.query("SELECT weekly_sessions FROM membership_plans WHERE name='Fixed monthly'")).rows[0].weekly_sessions,null);
 assert.equal((await pg.query("SELECT sessions_used FROM customer_memberships WHERE id='member'")).rows[0].sessions_used,0);
 }finally{await pg.close();}
});
test('booking enforcement reserves weekly allowance, releases cancellations, counts pending/no-shows and includes the fifth week',async()=>{
 const {pg,db,book}=await fixture();try{
 await book('first');await assert.rejects(book('second','2030-01-03'),/per week/);
 // Other tenant's identical member ID cannot consume this business's allowance.
 assert.equal((await assertWeeklyMembershipBooking(db,{owner:'other',memberNumber:'MM010190',date:'2030-01-03'})).weeklyRemaining,1);
 await pg.exec("UPDATE appointments SET status='Cancelled' WHERE id='first'");await book('replacement','2030-01-03');
 await pg.exec("UPDATE appointments SET status='No-show' WHERE id='replacement'");await assert.rejects(book('after-no-show','2030-01-04'),/per week/);
 await book('next-week','2030-01-08');await book('fifth-week','2030-01-30');await assert.rejects(book('fifth-excess','2030-01-31'),/per week/);
 await pg.query("INSERT INTO booking_requests(id,business_id,owner_id,date,staff_id,start_minute,duration,details,reviewer) VALUES('pending','biz','owner','2030-01-16','coach',600,30,$1,'owner')",[JSON.stringify({memberNumber:'MM010190',membershipCovered:true})]);
 await assert.rejects(book('pending-excess','2030-01-17'),/per week/);
 await pg.exec("UPDATE booking_requests SET status='declined' WHERE id='pending'");await book('after-decline','2030-01-17');
 await assert.rejects(book('outside-paid','2031-01-02'),/outside the paid/);
 assert.equal((await pg.query("SELECT count(*)::int n FROM appointments WHERE id IN ('second','after-no-show','fifth-excess','pending-excess','outside-paid')")).rows[0].n,0);
 }finally{await pg.close();}
});
test('one, two and three weekly uses are enforced independently; manual activation allocates four/five-week totals',async()=>{
 const {pg,db,book}=await fixture();try{
 for(const limit of [1,2,3]){
  await pg.query('UPDATE membership_plans SET weekly_sessions=$1 WHERE id=$2',[limit,'plan']);
  const date='2030-0'+limit+'-10';
  for(let i=0;i<limit;i++)await book('limit-'+limit+'-'+i,date,600+i*30);
  await assert.rejects(book('excess-'+limit,date,800),/per week/);
 }
 await pg.exec("UPDATE customer_memberships SET status='pending_payment',initial_paid_at=NULL,credit_period_start=NULL,credit_period_end=NULL,paid_through=NULL WHERE id='member'");
 const m=(await pg.query("SELECT * FROM customer_memberships WHERE id='member'")).rows[0];
 await applyManualPeriod(db,{member:m,credits:15,plan:{id:'plan',interval_unit:'month',interval_count:1},now:new Date('2030-01-31T18:00Z')});
 assert.equal((await pg.query("SELECT sessions_included FROM customer_memberships WHERE id='member'")).rows[0].sessions_included,12);
 await pg.exec("UPDATE customer_memberships SET initial_paid_at=NULL,credit_period_end=NULL,stripe_sessions_per_period=15 WHERE id='member'");
 const stripeMember=(await pg.query("SELECT * FROM customer_memberships WHERE id='member'")).rows[0];
 await recordMembershipPaidPeriod(db,{businessId:'biz',account:'acct_test',member:stripeMember,reference:'pi_weekly',amountCents:10000,paidAt:new Date('2030-01-31T18:00Z'),paidThrough:'2030-02-28T12:00Z',subscription:{id:'sub_test',status:'active'},customerId:'cus_test'});
 assert.equal((await pg.query("SELECT sessions_included FROM customer_memberships WHERE id='member'")).rows[0].sessions_included,12);
 }finally{await pg.close();}
});
test('weekly check-in/no-show is deducted once and uses the appointment week',async()=>{
 const {pg,db}=await fixture();try{
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const start=today+'T12:00:00Z',end=new Date(Date.parse(start)+40*86400000).toISOString();
 await pg.query("UPDATE customer_memberships SET initial_paid_at=$1,credit_period_start=$1,credit_period_end=$2,paid_through=$2 WHERE id='member'",[start,end]);
 await pg.query("INSERT INTO appointments(id,owner,date,staff,start,duration,status,data) VALUES('attendance','owner',$1,'coach',600,30,'Confirmed',$2)",[today,JSON.stringify({memberNumber:'MM010190',serviceIds:['training'],membershipCovered:true})]);
 const status=async(value)=>{await db.query('BEGIN');try{const r=await changeAppointmentStatus(db,{owner:'owner',appointmentId:'attendance',status:value,eventId:'event-'+value,ledgerId:'ledger-'+value,createdAt:new Date().toISOString()});await db.query('COMMIT');return r;}catch(e){await db.query('ROLLBACK');throw e;}};
 assert.equal((await status('Checked in')).membershipDeducted,true);
 assert.equal((await status('No-show')).alreadyDeducted,true);
 assert.equal((await pg.query("SELECT sessions_used FROM customer_memberships WHERE id='member'")).rows[0].sessions_used,1);
 assert.equal((await pg.query("SELECT count(*)::int n FROM membership_session_ledger WHERE membership_id='member' AND event_type='session_used'")).rows[0].n,1);
 }finally{await pg.close();}
});
