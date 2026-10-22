import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {PGlite} from '@electric-sql/pglite';
import {allBookingStatusRows,filterBookingStatusRows} from '../server/booking-status.mjs';
import {buildClientDirectory,pendingBookingAsAppointment} from '../server/client-history.mjs';
import {decorateBookingTimeline} from '../server/booking-timeline.mjs';
import {clientProfileEditToken} from '../server/update-client-profile.mjs';
import {applyClientProfiles} from '../server/client-profile-logic.mjs';
const compile=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
const url=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const settings={services:[{id:'training',name:'Private Session',category:'Activity'}],staff:[{id:'coach',name:'Private Coach'}]};
const data=(name)=>({name,email:name.toLowerCase()+'@example.test',phone:'4045550111',memberNumber:name==='Alex'?'AL010190':'BL010190',services:['Private Session'],serviceIds:['training'],price:67.5,created:'2026-10-22T11:00:00Z',customAnswers:{position:'Goalkeeper'},customFieldLabels:{position:'Player Position'}});
const appointment=(id,name)=>({id,date:'2026-10-23',start:600,duration:60,staff:'coach',status:'Confirmed',data:JSON.stringify(data(name))});
const pending={id:'request-b',date:'2026-10-24',staff_id:'coach',start_minute:720,duration:60,status:'pending',created_at:'2026-10-22T12:00:00Z',details:JSON.stringify({...data('Blair'),customerName:'Blair',customerEmail:'blair@example.test',quotedPrice:67.5})};

test('all-client feed includes every incoming request and appointment once, with independent combined filters',()=>{
 const derived=buildClientDirectory([...decorateBookingTimeline([appointment('a','Alex')]),pendingBookingAsAppointment(pending)],settings,'owner-a');
 const rows=allBookingStatusRows([...derived,derived[0]]);
 const dateObjects=rows.map((r,i)=>({...r,id:'date'+i,submittedAt:new Date(i?'2026-10-23T12:00:00Z':'2026-10-22T12:00:00Z'),bookingTimeline:[]}));
 assert.equal(allBookingStatusRows([{history:dateObjects}])[0].id,'date1','Postgres Date objects sort chronologically, not by weekday');
 assert.equal(rows.length,2);assert.equal(rows[0].clientName,'Blair');assert.equal(rows[1].clientName,'Alex');
 assert.equal(rows[0].status,'Pending approval');assert.equal(rows[0].answers[0].label,'Player Position');
 assert.equal(rows[1].serviceTypes[0],'Activity');assert.equal(rows[1].staff,'Private Coach');
 assert.equal(filterBookingStatusRows(rows,{search:'AL010190',payment:'pending',from:'2026-10-23',to:'2026-10-23'}).length,1);
 assert.equal(filterBookingStatusRows(rows,{search:'goalkeeper'}).length,0,'Search is identity/service/team; private answers remain expandable');
 assert.equal(filterBookingStatusRows(rows,{status:'Pending approval',search:'Blair'}).length,1);
 assert.equal(filterBookingStatusRows(rows,{payment:'completed'}).length,0);
 assert.equal(filterBookingStatusRows(rows,{attendedOnly:true}).length,0);
 const declined=pendingBookingAsAppointment({...pending,status:'declined',reviewed_at:'2026-10-22T13:00:00Z'});
 assert.deepEqual(JSON.parse(declined.data).bookingTimeline.at(-1),{status:'Declined',at:'2026-10-22T13:00:00Z'});
});

test('payment categories reconcile Stripe, recorded cash, membership coverage and zero-charge bookings',()=>{
 const rows=Array.from({length:5},(_,i)=>appointment('a'+i,'Alex'));
 rows[2].data=JSON.stringify({...data('Alex'),membershipCovered:true});rows[3].data=JSON.stringify({...data('Alex'),price:0});
 const decorated=decorateBookingTimeline(rows,[],[{booking_id:'a0',status:'paid',paid_at:'2026-10-22T12:00:00Z'}],[{kind:'cash_sale',data:{bookingId:'a1'}}]);
 const feed=allBookingStatusRows(buildClientDirectory(decorated,settings,'owner-a'));
 assert.equal(filterBookingStatusRows(feed,{payment:'completed'}).length,4);
 assert.deepEqual(filterBookingStatusRows(feed,{payment:'pending'}).map(row=>row.id),['a4']);
});

test('actual clients GET is owner scoped, includes archived booking history, deduplicates accepted requests and updates payments',async()=>{
 const pg=new PGlite();
 try{
  for(const file of (await readdir(new URL('../migrations/',import.meta.url))).filter(x=>x.endsWith('.sql')).sort())await pg.exec(await readFile(new URL('../migrations/'+file,import.meta.url),'utf8'));
  for(const owner of ['owner-a','owner-b']){
   await pg.query('INSERT INTO users(id,email,password_hash) VALUES($1,$2,$3)',[owner,owner+'@example.test','synthetic']);
   await pg.query('INSERT INTO businesses(id,owner_id,slug,name,industry) VALUES($1,$2,$3,$4,$5)',['biz-'+owner,owner,owner,owner,'sports']);
   await pg.query('INSERT INTO settings(owner,data) VALUES($1,$2)',[owner,JSON.stringify(settings)]);
  }
  for(const [id,owner,name] of [['a','owner-a','Alex'],['secret','owner-b','OtherTenantSecret']])await pg.query('INSERT INTO appointments(id,owner,date,start,duration,staff,status,data) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[id,owner,'2026-10-23',600,60,'coach','Confirmed',JSON.stringify(data(name))]);
  for(const [id,status,apt,name] of [['accepted','accepted','a','Alex'],['pending','pending',null,'Blair'],['declined','declined',null,'Casey']])await pg.query('INSERT INTO booking_requests(id,business_id,owner_id,date,start_minute,duration,staff_id,status,appointment_id,details,reviewer) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[id,'biz-owner-a','owner-a','2026-10-24',720,60,'coach',status,apt,JSON.stringify({...data(name),customerName:name,customerEmail:name.toLowerCase()+'@example.test',quotedPrice:67.5}),'owner']);
  const anchor=buildClientDirectory([appointment('a','Alex')],settings,'owner-a')[0].id;
  await pg.query('INSERT INTO business_client_profiles(id,owner,source_key,name,email,archived) VALUES($1,$2,$3,$4,$5,TRUE)',['archived-profile','owner-a',anchor,'Alex','alex@example.test']);
  globalThis.__bookingStatusRoute={clientProfileEditToken,allBookingStatusRows,decorateBookingTimeline,buildClientDirectory,pendingBookingAsAppointment,applyClientProfiles,getPool:()=>({query:(sql,values)=>pg.query(sql,values)}),requireOwner:async req=>{const owner=req.headers.get('x-test-owner');if(!owner)throw Error('AUTH_REQUIRED');return owner;}};
  let source=await readFile(new URL('../app/api/studio/clients/route.ts',import.meta.url),'utf8');source=source.replace(/^import .*;$/gm,'');source='const {clientProfileEditToken,allBookingStatusRows,decorateBookingTimeline,buildClientDirectory,pendingBookingAsAppointment,applyClientProfiles,getPool,requireOwner}=globalThis.__bookingStatusRoute;\n'+source;
  const route=await import(url(compile(source)));
  const request=owner=>new Request('https://studio.example/api/studio/clients',{headers:owner?{'x-test-owner':owner}:{}});
  assert.equal((await route.GET(request())).status,401);
  const response=await route.GET(request('owner-a'));assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/private, no-store/);
  let result=await response.json();assert.equal(result.bookings.length,3);assert.equal(result.clients.length,2,'Archived profile is absent from directory but its booking remains');
  assert.equal(result.bookings.filter(x=>x.id==='a').length,1);assert.doesNotMatch(JSON.stringify(result),/OtherTenantSecret/);
  assert.equal(result.bookings.find(x=>x.id==='a').paymentTracking,'pending');
  await pg.query("INSERT INTO events(id,owner,created,kind,data) VALUES('paid','owner-a',$1,'cash_sale',$2)",['2026-10-22T14:00:00Z',JSON.stringify({bookingId:'a'})]);
  result=await (await route.GET(request('owner-a'))).json();assert.equal(result.bookings.find(x=>x.id==='a').paymentTracking,'completed');
  assert.ok(result.bookings.find(x=>x.id==='a').bookingTimeline.some(x=>x.status==='Payment completed'));
  const other=await (await route.GET(request('owner-b'))).json();assert.equal(other.bookings.length,1);assert.equal(other.bookings[0].clientName,'OtherTenantSecret');assert.doesNotMatch(JSON.stringify(other),/blair@example/);
 }finally{delete globalThis.__bookingStatusRoute;await pg.close();}
});

test('all-client table renders screenshot columns, expandable answers, timelines and payment states',async()=>{
 const require=createRequire(import.meta.url);
 const react=pathToFileURL(require.resolve('react')).href,jsx=pathToFileURL(require.resolve('react/jsx-runtime')).href;
 const transpile=source=>compile(source).replaceAll('"react"',JSON.stringify(react)).replaceAll("'react'",JSON.stringify(react)).replaceAll('"react/jsx-runtime"',JSON.stringify(jsx));
 const sortable=url(transpile(await readFile(new URL('../app/components/sortable-table.tsx',import.meta.url),'utf8')));
 const defaults=url(compile(await readFile(new URL('../lib/defaults.ts',import.meta.url),'utf8')));
 let source=await readFile(new URL('../app/components/owner-booking-status.tsx',import.meta.url),'utf8');
 for(const [from,to] of [['./sortable-table',sortable],['../../lib/defaults',defaults],['../../server/booking-status.mjs',new URL('../server/booking-status.mjs',import.meta.url).href],['../../server/client-registration-fields.mjs',new URL('../server/client-registration-fields.mjs',import.meta.url).href]])source=source.replace("'"+from+"'",JSON.stringify(to));
 const {default:Component}=await import(url(transpile(source)));
 const rows=allBookingStatusRows(buildClientDirectory([...decorateBookingTimeline([appointment('a','Alex')],[],[{booking_id:'a',status:'paid',paid_at:'2026-10-22T13:00:00Z'}]),pendingBookingAsAppointment(pending)],settings,'owner-a'));
 const html=renderToStaticMarkup(React.createElement(Component,{bookings:rows}));
 for(const label of ['Booking Status','Activity date / time','Service used','Service type','Session','Team','Status / booking timeline','Payment','Quote','Alex','Blair','Booking answers (1)','Player Position','Goalkeeper','+ Booking timeline','Payment completed','Pending approval','$67.50'])assert.ok(html.includes(label),label);
 assert.match(html,/sf-booking-payment completed/);assert.match(html,/sf-booking-payment pending/);assert.match(html,/Search all bookings/);assert.match(html,/2 of 2 bookings/);
 const empty=renderToStaticMarkup(React.createElement(Component,{bookings:[]}));assert.match(empty,/Incoming bookings will appear here for all clients/);
});
