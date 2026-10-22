import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';
import {trackingDateRange,calendarTrackingRows,saveAppointmentTeam} from '../server/calendar-team-tracking.mjs';
import {saveTeamOccurrence,validAssignmentDate} from '../server/team-occurrence-assignments.mjs';
import {sessionTeamDefaults,bookingHostHistory} from '../server/team-booking-policy.mjs';
import {sessionsForDate,easternClock} from '../server/session-scheduling.mjs';
const config={open:8,close:20,buffer:0,services:[{id:'s',name:'Soccer',duration:60,maxSlots:10}],staff:[{id:'host',name:'Public Host',services:['s']},{id:'internal',name:'Internal Only',bookingVisible:false,services:['s']}],bookableSessions:[{id:'series',date:'2030-11-01',service:'s',staff:'host',start:600,capacity:10,repeat:{frequency:'weekly',every:1,until:'2030-11-15'}}]};
test('tracking ranges are valid and dated session overrides are distinct from public booking defaults',()=>{
 assert.equal(trackingDateRange('2030-11-01','2030-11-08').length,8);
 for(const range of [['2030-02-30','2030-03-01'],['2030-11-08','2030-11-01'],['2030-01-01','2030-12-31']])assert.throws(()=>trackingDateRange(...range),/date range/);
 const before=JSON.stringify(config),assignments=[{scope:'occurrence',session_id:'series__20301108',session_date:'2030-11-08',start_minute:600,staff_ids:['internal'],note:'Private duty'}];
 const rows=calendarTrackingRows(config,trackingDateRange('2030-11-01','2030-11-08'),[],assignments,[]);
 assert.equal(rows.length,2);assert.deepEqual(rows[0].staffIds,['host']);assert.deepEqual(rows[1].staffIds,['internal']);assert.equal(rows[1].name,'Soccer');assert.equal(rows[1].duration,60);assert.equal(JSON.stringify(config),before);
 const empty=calendarTrackingRows(config,['2030-11-01'],[],[{scope:'occurrence',session_id:'series',session_date:'2030-11-01',start_minute:600,staff_ids:[]}],[]);assert.deepEqual(empty[0].staffIds,[],'Explicit unassigned override never restores default hosts');
});
test('actual owner tracking API assigns services/session occurrences privately, rejects other tenants, follows reschedules and cleans deleted appointments',async()=>{
 const pg=new PGlite();try{
  for(const f of (await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await pg.exec(await readFile(new URL('../migrations/'+f,import.meta.url),'utf8'));
  for(const owner of ['a','b']){
   await pg.query('INSERT INTO users(id,email,password_hash) VALUES($1,$2,$3)',[owner,owner+'@example.test','synthetic']);
   await pg.query('INSERT INTO businesses(id,owner_id,slug,name,status) VALUES($1,$2,$3,$4,$5)',['biz-'+owner,owner,'business-'+owner,'Business '+owner,'active']);
   await pg.query('INSERT INTO settings(owner,data) VALUES($1,$2)',[owner,JSON.stringify(config)]);
   await pg.query('INSERT INTO appointments(id,owner,date,start,duration,staff,status,data) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',['apt-'+owner,owner,'2030-11-01',660,60,'host','Confirmed',JSON.stringify({name:'Synthetic '+owner,services:['Soccer'],serviceIds:['s'],hostTeamIds:['host']})]);
  }
  const pool={query:(sql,values)=>pg.query(sql,values)};
  globalThis.__calendarTeamRoute={trackingDateRange,calendarTrackingRows,saveAppointmentTeam,sessionTeamDefaults,bookingHostHistory,sessionsForDate,easternClock,saveTeamOccurrence,validAssignmentDate,getPool:()=>pool,requireOwner:async req=>{const owner=req.headers.get('x-owner');if(!owner)throw Error('AUTH_REQUIRED');return owner;},validOrigin:req=>req.headers.get('origin')==='https://studio.example'};
  let source=(await readFile(new URL('../app/api/studio/team-tracking/route.ts',import.meta.url),'utf8')).replace(/^import .*;$/gm,'');source='const {trackingDateRange,calendarTrackingRows,saveAppointmentTeam,sessionTeamDefaults,bookingHostHistory,sessionsForDate,easternClock,saveTeamOccurrence,validAssignmentDate,getPool,requireOwner,validOrigin}=globalThis.__calendarTeamRoute;\n'+source;
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  const route=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
  const get=(owner,date='2030-11-01')=>new Request('https://studio.example/api/studio/team-tracking?date='+date+'&from='+date+'&to='+date,{headers:owner?{'x-owner':owner}:{}});
  const post=(owner,body,origin='https://studio.example')=>new Request('https://studio.example/api/studio/team-tracking',{method:'POST',headers:{'x-owner':owner,origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await route.GET(get())).status,401);assert.equal((await route.POST(post('a',{},'https://other.example'))).status,403);assert.equal((await route.GET(get('a','2030-02-30'))).status,400);
  const input={appointmentId:'apt-a',staffIds:['internal'],note:'Private service duty'};
  assert.equal((await route.POST(post('a',input))).status,200);
  assert.equal((await route.POST(post('b',input))).status,400);assert.equal((await route.POST(post('a',{...input,staffIds:['foreign']}))).status,400);
  assert.equal((await route.POST(post('a',{sessionId:'series',date:'2030-11-01',start:600,staffIds:['internal'],note:'Private session duty'}))).status,200);
  let response=await route.GET(get('a'));assert.match(response.headers.get('Cache-Control'),/private, no-store/);let result=await response.json();
  assert.equal(result.trackingRows.length,2);assert.ok(result.trackingRows.every(r=>r.staffIds[0]==='internal'));
  assert.doesNotMatch(JSON.stringify(await (await route.GET(get('b'))).json()),/Private service duty|Private session duty|Synthetic a/);
  const appointment=(await pg.query("SELECT staff,data FROM appointments WHERE id='apt-a'")).rows[0];assert.equal(appointment.staff,'host');assert.deepEqual(JSON.parse(appointment.data).hostTeamIds,['host']);assert.doesNotMatch(appointment.data,/Private service duty|internal/);
  assert.equal(JSON.parse((await pg.query("SELECT data FROM settings WHERE owner='a'")).rows[0].data).staff[0].name,'Public Host');
  await pg.query("UPDATE appointments SET date='2030-11-02',start=720 WHERE id='apt-a'");
  result=await (await route.GET(get('a','2030-11-02'))).json();assert.equal(result.trackingRows[0].start,720);assert.deepEqual(result.trackingRows[0].staffIds,['internal']);
  assert.equal((await route.POST(post('a',{...input,staffIds:[]}))).status,200);result=await (await route.GET(get('a','2030-11-02'))).json();assert.deepEqual(result.trackingRows[0].staffIds,[]);
  await pg.query("DELETE FROM appointments WHERE id='apt-a'");assert.equal((await pg.query('SELECT * FROM appointment_team_assignments')).rows.length,0);assert.equal((await route.POST(post('a',input))).status,400,'Deleted appointments cannot be restored by saving stale assignments');
 }finally{delete globalThis.__calendarTeamRoute;await pg.close();}
});
test('assignment editor lives in Calendar only and lists session/service, date, time and private team names',async()=>{
 const owner=await readFile(new URL('../app/studio/owner-dashboard.tsx',import.meta.url),'utf8'),component=await readFile(new URL('../app/components/owner-team-tracking.tsx',import.meta.url),'utf8');
 assert.match(owner,/view==='Calendar'&&<OwnerTeamTracking selectedDate=\{date\}/);assert.doesNotMatch(owner,/view==='Overview'&&<OwnerTeamTracking/);
 for(const label of ['Session / service name','Time · Eastern','Team member names','List view','Save private team assignment','Assign team','Private accountability note'])assert.ok(component.includes(label),label);
 assert.match(component,/chosen.kind==='appointment'/);assert.match(component,/cache:'no-store'/);assert.match(component,/controller.abort/);
});
