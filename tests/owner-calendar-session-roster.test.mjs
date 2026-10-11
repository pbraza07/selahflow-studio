import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {sessionRosterForOwner} from '../server/session-roster.mjs';
import {sessionInstances} from '../server/session-recurrence.mjs';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const base={
 bookableSessions:[{id:'soccer-series',date:'2026-10-12',staff:'coach-a',service:'soccer',
  start:1020,capacity:10,repeat:{frequency:'weekly',every:1,until:'2026-11-09'}}],
 sessionOverrides:[{id:'soccer-series__20261019',seriesId:'soccer-series',originalDate:'2026-10-19',
  date:'2026-10-20',staff:'coach-b',service:'soccer',start:900,capacity:10}],
 services:[{id:'soccer',name:'Group soccer',duration:60}],staff:[{id:'coach-a'},{id:'coach-b'}]
};
const enrolled={
 id:'client-1',sessionId:'soccer-series__20261019',date:'2026-10-20',
 staff:'coach-b',start:900,name:'Alex Rivera',email:'alex@example.com',phone:'+18135550001',
 services:['Group soccer'],status:'Confirmed',price:50,
 customAnswers:{playerLevel:'3',ageGroup:'U13'},
 customFieldLabels:{playerLevel:'Player Level',ageGroup:'Age group'},
 originalSubmission:{customerName:'Alex Rivera'}
};
test('owner roster reads an occurrence after team transfer, preserving client details and 9/10 seats',()=>{
 const session=sessionInstances(base,'2026-10-20','coach-b')[0];
 assert.equal(session.id,'soccer-series__20261019');
 const otherBusinesses=[
  {...enrolled,id:'foreign',sessionId:'foreign-business',name:'Secret Contact'},
  {...enrolled,id:'wrong-date',date:'2026-10-27',name:'Wrong Date'},
  {...enrolled,id:'cancelled',name:'Cancelled Person',status:'Cancelled'},
  {...enrolled,id:'no-show',name:'No-Show Person',status:'No-show'},
  {...enrolled,id:'demo',name:'Fake Sample',sample:true}
 ];
 const roster=sessionRosterForOwner(session,[...otherBusinesses,enrolled]);
 assert.equal(roster.booked,1);
 assert.equal(roster.capacity,10);
 assert.equal(roster.remaining,9);
 assert.equal(roster.staff,'coach-b');
 assert.equal(roster.date,'2026-10-20');
 assert.deepEqual(roster.clients.map(c=>c.name),['Alex Rivera']);
 assert.equal(roster.clients[0].email,'alex@example.com');
 assert.equal(roster.clients[0].phone,'+18135550001');
 assert.equal(roster.clients[0].customAnswers.playerLevel,'3');
 assert.equal(roster.clients[0].customFieldLabels.playerLevel,'Player Level');
 assert.equal(roster.clients[0].quotedPrice,50);
 assert.equal(roster.clients[0].originalSubmission.customerName,'Alex Rivera');
});
test('the same recurring series on another day has separate enrollment, status, and capacity',()=>{
 const first=sessionInstances(base,'2026-10-12','coach-a')[0];
 const moved=sessionInstances(base,'2026-10-20','coach-b')[0];
 assert.notEqual(first.id,moved.id);
 assert.equal(sessionRosterForOwner(first,[enrolled]).booked,0);
 const customers=Array.from({length:3},(_,i)=>({...enrolled,id:'customer-'+i,name:'Client '+i,
  status:i===0?'Checked in':i===1?'Completed':'Confirmed'}));
 const roster=sessionRosterForOwner(moved,customers);
 assert.equal(roster.booked,3);
 assert.equal(roster.remaining,7);
 assert.deepEqual(roster.clients.map(c=>c.status).sort(),['Checked in','Completed','Confirmed']);
});
test('roster never shows canceled, no-show, demo or unrelated booking and handles empty sessions',()=>{
 const session={id:'solo-group',date:'2026-10-30',staff:'coach-a',capacity:5};
 const other=[
  {...enrolled,id:'c',sessionId:'solo-group',date:'2026-10-30',status:'Cancelled'},
  {...enrolled,id:'n',sessionId:'solo-group',date:'2026-10-30',status:'No-show'},
  {...enrolled,id:'s',sessionId:'solo-group',date:'2026-10-30',sample:true},
  {...enrolled,id:'o',sessionId:'other-id',date:'2026-10-30'}
 ];
 const roster=sessionRosterForOwner(session,other);
 assert.deepEqual(roster.clients,[]);
 assert.equal(roster.remaining,5);
 assert.throws(()=>sessionRosterForOwner(null,[]),/valid session/);
});
test('owner calendar daily weekly monthly session click opens roster dialog; public booking page does not',async()=>{
 const [ui,publicPage,css,server]=await Promise.all([
  read('app/studio/owner-dashboard.tsx'),read('app/book/page.tsx'),
  read('app/globals.css'),read('lib/studio-handler.ts')]);
 assert.match(ui,/setRosterSelection\(\{id:session\.id,date:session\.date\}\)/);
 assert.match(ui,/sessionRosterForOwner\(selectedRosterSession,appointments\)/);
 assert.match(ui,/calendarMode!=='day'/);
 assert.match(ui,/calendarMode==='day'/);
 assert.match(ui,/onClick=\{\(\)=>openSessionRoster\(session\)\}/);
 assert.match(ui,/View registered customers for /);
 assert.match(ui,/sf-roster-dialog/);
 assert.match(ui,/role="dialog" aria-modal="true" aria-labelledby="sf-roster-title"/);
 assert.match(ui,/PRIVATE BUSINESS SESSION ROSTER/);
 assert.match(ui,/client\.customAnswers/);
 assert.match(ui,/selectedSessionRoster\.remaining/);
 assert.match(ui,/setRosterSelection\(null\)/);
 assert.match(ui,/openSessionReschedule\(session,true\)/);
 assert.doesNotMatch(publicPage,/sf-roster-dialog|PRIVATE BUSINESS SESSION ROSTER/);
 assert.match(server,/const \{owner,config\}=await context\(req\)/);
 assert.match(css,/@media\(max-width:550px\)/);
 assert.match(css,/sf-roster-content/);
});
