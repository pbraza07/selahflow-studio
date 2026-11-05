import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {confirmBooking} from '../server/booking-approvals.mjs';
import {rescheduleSessionForOwner} from '../server/safe-session-reschedule.mjs';

const training={id:'training',name:'Training',duration:30,durationUnit:'minutes',price:40,maxSlots:1};
const premium={id:'premium',name:'Premium service',duration:30,durationUnit:'minutes',price:65,maxSlots:1};
const futureMonth=()=>{const now=new Date();return new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+1,1,12));};
const day=(month,n)=>new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth(),n,12)).toISOString().slice(0,10);
async function fixture({credits=5,group=false}={}){
 const pg=new PGlite();
 for(const file of (await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await pg.exec(await readFile(new URL('../migrations/'+file,import.meta.url),'utf8'));
 const month=futureMonth(),start=day(month,1),paidThrough=new Date(Date.UTC(month.getUTCFullYear()+1,month.getUTCMonth(),1,12)).toISOString();
 // Compute the true next monthly boundary independently of the month length.
 const creditEnd=new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth()+1,1,12)).toISOString();
 await pg.exec("INSERT INTO users(id,email,password_hash) VALUES('owner','owner@example.test','x'); INSERT INTO businesses(id,owner_id,slug,name,status) VALUES('business','owner','override-integration','Integration Studio','active'); INSERT INTO membership_plans(id,business_id,name,interval_unit,price_cents,sessions_included,weekly_sessions) VALUES('plan','business','Weekly Training','month',10000,5,1)");
 const config={open:8,close:20,buffer:0,services:[training,premium],staff:[{id:'coach',name:'Coach',services:['training','premium']}],bookableSessions:group?[{id:'moving-session',date:day(month,9),start:660,staff:'coach',service:'training',capacity:3,onlyScheduledTime:false}]:[]};
 await pg.query('INSERT INTO settings(owner,data) VALUES($1,$2)',['owner',JSON.stringify(config)]);
 await pg.query("INSERT INTO customer_memberships(id,business_id,plan_id,customer_name,customer_email,price_cents,stripe_account_id,status,member_number,sessions_included,sessions_used,initial_paid_at,credit_period_start,credit_period_end,paid_through,monthly_sessions) VALUES('member','business','plan','Test Member','member@example.test',10000,'','active','TM1001',$1,0,$2,$3,$4,$5,$1)",[credits,start+'T18:00:00Z',start+'T12:00:00Z',creditEnd,paidThrough]);
 const query=async(sql,args)=>{const result=await pg.query(sql,args);return {...result,rowCount:result.affectedRows||result.rows.length};};
 // PGlite exposes one connection; serialize transactions to model the business
 // schedule lock used by PostgreSQL instead of accidentally nesting BEGINs.
 let queue=Promise.resolve();
 const pool={query,async connect(){const previous=queue;let release;queue=new Promise(resolve=>{release=resolve;});await previous;return {query,release};}};
 const book=(id,n=2,start=600,options={})=>{
  const services=options.services||[training];
  return confirmBooking({pool,owner:'owner',services,staff:'coach',date:day(month,n),start,duration:30,buffer:0,id,...options,data:{name:'Test Member',email:'member@example.test',memberNumber:'TM1001',serviceIds:services.map(s=>s.id),services:services.map(s=>s.name),membershipCovered:true,membershipCreditAllowed:true,price:0,...options.data}});
 };
 return {pg,pool,month,config,book,paidThrough,query};
}

test('approval with distinct request and appointment IDs consumes one reservation; disabling override retains the monthly cap',async()=>{
 const {pg,book,month}=await fixture({credits:2});try{
  await book('first');
  await pg.exec("UPDATE customer_memberships SET weekly_limit_override=true WHERE id='member'");
  const details={memberNumber:'TM1001',membershipCovered:true,serviceIds:['training'],services:['Training'],price:0};
  await pg.query("INSERT INTO booking_requests(id,business_id,owner_id,date,staff_id,start_minute,duration,details,reviewer) VALUES('second-request','business','owner',$1,'coach',630,30,$2,'owner')",[day(month,3),JSON.stringify(details)]);
  await assert.rejects(book('wrong-reviewer',3,630,{pendingId:'second-request',expectedReviewer:'team-other'}),/reviewed|unavailable/);
  await book('second-appointment',3,630,{pendingId:'second-request',expectedReviewer:'owner'});
  const request=(await pg.query("SELECT status,appointment_id FROM booking_requests WHERE id='second-request'")).rows[0];
  assert.deepEqual(request,{status:'accepted',appointment_id:'second-appointment'});
  const proof=(await pg.query("SELECT business_id,membership_id,appointment_id,authorized_date FROM membership_weekly_override_bookings WHERE appointment_id='second-appointment'")).rows[0];
  assert.deepEqual(proof,{business_id:'business',membership_id:'member',appointment_id:'second-appointment',authorized_date:day(month,3)});
  await pg.exec("UPDATE customer_memberships SET weekly_limit_override=false WHERE id='member'");
  await assert.rejects(book('sixth-in-another-week',9),/No membership sessions remaining/);
  assert.equal((await pg.query("SELECT count(*)::int n FROM appointments")).rows[0].n,2);
  assert.equal((await pg.query("SELECT sessions_used FROM customer_memberships WHERE id='member'")).rows[0].sessions_used,0,'Reservation never consumes an attendance credit');
 }finally{await pg.close();}
});

test('override authority comes from the member row and preserves capacity, dates, coverage and the last remaining reservation',async()=>{
 const {pg,book,month,config,paidThrough}=await fixture({credits:2});try{
  await book('first');
  await assert.rejects(book('forged',3,600,{data:{weekly_limit_override:true,weeklyLimitOverride:true,weeklyOverrideAuthorized:true}}),/per week/);
  assert.equal((await pg.query('SELECT count(*)::int n FROM membership_weekly_override_bookings')).rows[0].n,0);
  await pg.exec("UPDATE customer_memberships SET weekly_limit_override=true WHERE id='member'");
  await assert.rejects(book('capacity-conflict',2,600),/already has another appointment|no longer available/);
  await assert.rejects(book('after-paid',2,630,{date:paidThrough.slice(0,10)}),/outside the paid membership period/);
  await assert.rejects(book('before-paid',2,630,{date:day(month,0)}),/before the membership initial date/);
  const restricted={...config,services:[training,{...premium,membershipCreditAllowed:false}]};
  await pg.query('UPDATE settings SET data=$1 WHERE owner=$2',[JSON.stringify(restricted),'owner']);
  await assert.rejects(book('service-opt-out',3,630,{services:[premium]}),/credits do not cover/);
  await pg.query('UPDATE settings SET data=$1 WHERE owner=$2',[JSON.stringify(config),'owner']);
  await pg.query('UPDATE membership_plans SET credit_eligibility=$1::jsonb WHERE id=$2',[JSON.stringify({mode:'selected',serviceIds:['training'],sessionIds:[]}), 'plan']);
  await assert.rejects(book('excluded-service',3,630,{services:[premium]}),/credits do not cover/);
  const outcomes=await Promise.allSettled([book('last-a',3,630),book('last-b',4,660)]);
  assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);
  assert.match(outcomes.find(x=>x.status==='rejected').reason.message,/No membership sessions remaining/);
  assert.equal((await pg.query('SELECT count(*)::int n FROM appointments')).rows[0].n,2);
  const proofs=(await pg.query('SELECT appointment_id FROM membership_weekly_override_bookings ORDER BY appointment_id')).rows.map(x=>x.appointment_id);
  const accepted=(await pg.query('SELECT id FROM appointments ORDER BY id')).rows.map(x=>x.id);
  assert.deepEqual(proofs,accepted,'Only accepted appointments retain proof, including the earlier normal visit protected from a later toggle-off');
  await pg.exec("UPDATE customer_memberships SET status='past_due' WHERE id='member'");
  await assert.rejects(book('unpaid',9),/outside the paid membership period/);
 }finally{await pg.close();}
});

test('session rescheduling rechecks weekly authority atomically and binds accepted override proof to the new date',async()=>{
 const {pg,pool,book,month,config}=await fixture({credits:5,group:true});try{
  await book('first',2,600);
  await book('moving-appointment',9,660,{data:{sessionId:'moving-session'}});
  const move={sessionId:'moving-session',sourceDate:day(month,9),expectedStart:660,expectedStaff:'coach',expectedService:'training',expectedCapacity:3,date:day(month,3),start:660,staff:'coach',service:'training',capacity:3,capacityEdited:false};
  await assert.rejects(rescheduleSessionForOwner({owner:'owner',pool,input:move}),/per week/);
  assert.equal((await pg.query("SELECT date FROM appointments WHERE id='moving-appointment'")).rows[0].date,day(month,9));
  assert.deepEqual(JSON.parse((await pg.query("SELECT data FROM settings WHERE owner='owner'")).rows[0].data),config);
  await pg.exec("UPDATE customer_memberships SET weekly_limit_override=true WHERE id='member'");
  const moved=await rescheduleSessionForOwner({owner:'owner',pool,input:move});
  assert.equal(moved.confirmedCustomersRetained,1);assert.deepEqual(moved.seatsAfter,{capacity:3,booked:1,remaining:2});
  assert.equal((await pg.query("SELECT authorized_date FROM membership_weekly_override_bookings WHERE appointment_id='moving-appointment'")).rows[0].authorized_date,day(month,3));
  await pg.exec("UPDATE customer_memberships SET weekly_limit_override=false WHERE id='member'");
  await assert.rejects(rescheduleSessionForOwner({owner:'owner',pool,input:{...move,sourceDate:day(month,3),date:day(month,4)}}),/per week/);
  assert.equal((await pg.query("SELECT date FROM appointments WHERE id='moving-appointment'")).rows[0].date,day(month,3));
  assert.equal((await pg.query("SELECT authorized_date FROM membership_weekly_override_bookings WHERE appointment_id='moving-appointment'")).rows[0].authorized_date,day(month,3));
  const unchangedDate=await rescheduleSessionForOwner({owner:'owner',pool,input:{...move,sourceDate:day(month,3),date:day(month,3),start:720}});
  assert.equal(unchangedDate.confirmedCustomersRetained,1,'An accepted override visit can keep its date and move to another available time');
  assert.equal((await pg.query("SELECT count(*)::int n FROM events WHERE kind='session_rescheduled'")).rows[0].n,2,'Rejected moves roll back their event and data changes');
 }finally{await pg.close();}
});
