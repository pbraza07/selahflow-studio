import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {groupBookingHistory} from '../server/booking-history-groups.mjs';
import {loadOwnerHistory} from '../server/owner-history.mjs';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createRequire} from 'node:module';
const row=(id,status,extra={})=>({id,bookingKey:'a',category:'bookings',title:'Training',status,at:'2030-01-01T10:00:00',order:'2030-01-01T10:00:00',date:'2030-01-01',reference:id,details:[],quoteCents:9000,...extra});
test('booking groups keep independent bookings separate and distinguish acceptance from payment evidence',()=>{
 const input=[row('booking:a','Confirmed'),row('request:r','accepted'),row('stripe:a','pending',{category:'payments',amountCents:9000}),row('booking:other','Confirmed',{bookingKey:'other'}),row('request:unlinked','pending',{bookingKey:'unlinked'}),row('cash:retail','recorded',{bookingKey:undefined,category:'payments',amountCents:9000})];
 const before=structuredClone(input),groups=groupBookingHistory(input);
 assert.equal(groups.length,4);assert.equal(groups.find(r=>r.id==='booking-group:a').activities.length,3);
 assert.equal(groups.find(r=>r.id==='booking-group:a').status,'Accepted · Pending payment');
 assert.equal(groups.find(r=>r.id==='booking-group:unlinked').bookingStatus,'Submitted · Pending approval');
 assert.equal(groupBookingHistory([row('booking:a','Confirmed'),row('stripe:a','paid',{category:'payments',paymentEvidence:true,amountCents:9000})])[0].amountCents,9000);
 assert.equal(groupBookingHistory([row('booking:a','Confirmed',{membershipCovered:true})])[0].paymentStatus,'Membership covered');
 assert.equal(groupBookingHistory([row('booking:a','Confirmed',{quoteCents:0})])[0].paymentStatus,'No payment required');
 assert.equal(groupBookingHistory([row('booking:a','Declined',{quoteCents:undefined})])[0].paymentStatus,'Payment not recorded');
 assert.equal(groupBookingHistory([row('booking:a','Confirmed',{paymentTracking:'completed'})])[0].paymentStatus,'Payment marked complete');
 assert.equal(groupBookingHistory([row('booking:a','Cancelled',{paymentConfirmed:true})])[0].status,'Cancelled · Paid');
 assert.deepEqual(input,before);
});
test('actual history groups canonical request, appointment, payment and delivery before filtering/pagination and preserves source selection safeguards',async()=>{
 const pg=new PGlite();try{
  for(const f of (await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await pg.exec(await readFile(new URL('../migrations/'+f,import.meta.url),'utf8'));
  await pg.exec("INSERT INTO users(id,email,password_hash) VALUES('u1','one@example.test','hash'),('u2','two@example.test','hash'); INSERT INTO businesses(id,owner_id,slug,name,status) VALUES('b1','u1','one','One','active'),('b2','u2','two','Two','active');");
  const d={name:'Example Client',email:'example@example.test',memberNumber:'EC010100',services:['Private session'],price:90};
  await pg.query("INSERT INTO appointments(id,owner,date,staff,start,duration,status,data) VALUES('a','u1','2030-02-01','coach',600,60,'Confirmed',$1),('foreign','u2','2030-02-01','coach',600,60,'Confirmed',$2)",[JSON.stringify(d),JSON.stringify({...d,name:'FOREIGN SECRET'})]);
  await pg.query("INSERT INTO booking_requests(id,business_id,owner_id,date,staff_id,start_minute,duration,details,reviewer,status,appointment_id,created_at,reviewed_at) VALUES('r','b1','u1','2030-01-02','coach',600,60,$1,'owner','accepted','a','2030-01-01T10:00:00Z','2030-01-01T11:00:00Z')",[JSON.stringify({...d,customerName:d.name,customerEmail:d.email,quotedPrice:90})]);
  await pg.exec("INSERT INTO booking_payments(booking_id,business_id,stripe_account_id,amount_cents,lines,status,paid_at) VALUES('a','b1','acct_secret',9000,'[]','paid','2030-01-01T12:00:00Z'); INSERT INTO booking_receipt_emails(booking_key,event_type,business_id,destination,destination_masked,message,status,updated_at) VALUES('r','submission','b1','example@example.test','ex***@example.test','{\"subject\":\"Receipt\",\"text\":\"PRIVATE BODY\"}','submitted','2030-01-01T10:00:00Z');");
  for(let i=0;i<31;i++)await pg.query("INSERT INTO appointments(id,owner,date,staff,start,duration,status,data) VALUES($1,'u1','2030-02-02','coach',600,60,'Confirmed',$2)",['other-'+i,JSON.stringify(d)]);
  const before=(await pg.query('SELECT id,status,data FROM appointments ORDER BY id')).rows;
  const grouped=await loadOwnerHistory(pg,'u1',{groupBookings:true,category:'bookings',q:'Receipt'});
  const all=await loadOwnerHistory(pg,'u1',{groupBookings:true,category:'bookings'}),next=await loadOwnerHistory(pg,'u1',{groupBookings:true,category:'bookings',page:2});
  for(const sort of ['date','client','activity','status','amount','details']){const first=await loadOwnerHistory(pg,'u1',{groupBookings:true,sort,direction:'asc'}),second=await loadOwnerHistory(pg,'u1',{groupBookings:true,sort,direction:'asc',page:2});assert.equal(new Set([...first.items,...second.items].map(r=>r.id)).size,32);}
  assert.equal(all.total,32);assert.equal(all.items.length,30);assert.equal(next.items.length,2);assert.equal(new Set([...all.items,...next.items].map(r=>r.id)).size,32);
  const booking=[...all.items,...next.items].find(r=>r.id==='booking-group:a');assert.equal(booking.activities.length,4);assert.equal(booking.selectionKeys.length,4);assert.equal(booking.status,'Accepted · Paid');assert.equal(booking.amountCents,9000);assert.equal(booking.at,'2030-02-01T10:00:00');
  assert.ok(booking.activities.some(r=>r.details.some(d=>d.startsWith('Submitted: '))));
  assert.doesNotMatch(JSON.stringify(all)+JSON.stringify(next),/FOREIGN SECRET|PRIVATE BODY|acct_secret|example@example.test/);
  assert.ok(grouped.items.some(r=>r.id==='booking-group:a'));
  const byDate=await loadOwnerHistory(pg,'u1',{groupBookings:true,from:'2030-01-01',to:'2030-01-01'});assert.equal(byDate.total,1,'submission-date filter keeps complete lifecycle, despite rescheduled appointment date');
  const payments=await loadOwnerHistory(pg,'u1',{groupBookings:true,category:'payments'});assert.equal(payments.total,1);assert.equal(payments.items[0].amountCents,9000);
  const message=await loadOwnerHistory(pg,'u1',{groupBookings:true,category:'messages'});assert.equal(message.total,1);assert.equal(message.items[0].retryable,false);
  const paidKey=booking.activities.find(r=>r.id==='stripe:a').selectionKey;assert.equal((await loadOwnerHistory(pg,'u1',{selected:[paidKey]})).cleared,1);
  const afterHide=(await loadOwnerHistory(pg,'u1',{groupBookings:true,from:'2030-01-01',to:'2030-01-01'})).items.find(r=>r.id==='booking-group:a');assert.equal(afterHide.paymentStatus,'Paid','hiding a payment history entry does not change the actual payment state');assert.equal(afterHide.activities.length,3);
  await pg.query("UPDATE appointments SET data=$1 WHERE id='a'",[JSON.stringify({...d,bookingRequestId:'r'})]);await pg.exec("UPDATE booking_requests SET appointment_id=NULL WHERE id='r'");
  assert.equal((await loadOwnerHistory(pg,'u1',{groupBookings:true,from:'2030-01-01',to:'2030-01-01'})).total,1,'legacy explicit bookingRequestId also consolidates');
  const keys=afterHide.selectionKeys;
  await pg.exec("UPDATE appointments SET status='Cancelled' WHERE id='a'");
  assert.equal((await loadOwnerHistory(pg,'u1',{selected:keys})).cleared,2,'unchanged linked history entries hide; changed appointment selection is stale');
  const remaining=(await loadOwnerHistory(pg,'u1',{groupBookings:true,q:'Cancelled'})).items[0];assert.equal(remaining.status,'Cancelled · Paid');
  assert.deepEqual((await pg.query('SELECT id,status,data FROM appointments WHERE id<>\'a\' ORDER BY id')).rows,before.filter(r=>r.id!=='a'));
  assert.equal((await pg.query("SELECT count(*)::int AS n FROM booking_payments WHERE status='paid'")).rows[0].n,1);
 }finally{await pg.close();}
});
test('shared expansion control renders accessible native disclosures with a visible bulk arrow',async()=>{
 const source=await readFile(new URL('../app/components/expandable-details-group.tsx',import.meta.url),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};new Function('require','exports',code)(createRequire(import.meta.url),exports);
 const html=renderToStaticMarkup(React.createElement(exports.default,null,React.createElement('details',null,React.createElement('summary',null,'Booking timeline'),React.createElement('p',null,'Submitted · Accepted · Paid'))));
 assert.match(html,/aria-label="Expand all booking details"/);assert.match(html,/▾/);assert.match(html,/<details><summary>Booking timeline/);assert.doesNotMatch(html,/<details open/);
});
