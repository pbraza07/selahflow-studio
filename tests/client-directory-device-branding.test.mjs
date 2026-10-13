import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildClientDirectory,clientWorkbookSheets,isAttended} from '../server/client-history.mjs';
import {createClientXlsx} from '../server/client-xlsx.mjs';
import {businessDeviceName,businessManifest} from '../server/business-device-name.mjs';

const settings={
 services:[
  {id:'coaching',name:'Small Group Session',category:'Sports Coaching'},
  {id:'private',name:'Private Training',category:'Training'}
 ],
 staff:[{id:'coach',name:'Head Coach'}]
};
const appointment=(id,owner,name,email,date,status,serviceIds=['coaching'])=>({
 id,owner,date,start:1020,duration:60,staff:'coach',status,
 data:JSON.stringify({name,email,phone:'',services:serviceIds.map(x=>settings.services.find(s=>s.id===x).name),serviceIds,price:50,
  sessionId:serviceIds[0]==='coaching'?'group-1':null})
});

test('attendance counts completed and checked-in sessions but never assumes confirmed equals attended',()=>{
 assert.equal(isAttended('Checked in'),true);
 assert.equal(isAttended('Completed'),true);
 assert.equal(isAttended('Confirmed'),false);
 assert.equal(isAttended('Cancelled'),false);
 const records=[
  appointment('b1','biz-a','Alex','alex@example.com','2026-10-01','Completed'),
  appointment('b2','biz-a','Alex','alex@example.com','2026-10-01','Checked in',['private']),
  appointment('b3','biz-a','Alex','alex@example.com','2026-10-02','Confirmed'),
  appointment('b4','biz-a','Alex','alex@example.com','2026-10-03','No-show')
 ];
 const list=buildClientDirectory(records,settings,'biz-a');
 assert.equal(list.length,1);
 const c=list[0];
 assert.equal(c.bookedSessions,3);
 assert.equal(c.attendedSessions,2);
 assert.deepEqual(c.attendanceDays,['2026-10-01']);
 assert.deepEqual(c.serviceTypes,['Sports Coaching','Training']);
 assert.equal(c.history.length,4);
 assert.equal(c.history[0].status,'No-show');
});
test('email normalization is stable and unrelated customers never group solely by a display name',()=>{
 const a=appointment('one','a','Common Name','One@Example.com','2026-10-01','Completed');
 const b=appointment('two','a','Common Name','two@example.com','2026-10-02','Completed');
 const list=buildClientDirectory([a,b],settings,'a');
 assert.equal(list.length,2);
 const id=buildClientDirectory([a],settings,'a')[0].id;
 assert.notEqual(buildClientDirectory([a],settings,'another-owner')[0].id,id);
 assert.notEqual(list[0].id,list[1].id);
});
test('different customer names with the same email and phone remain separate client cards',()=>{
 const sameEmail='family@example.com';
 const first=appointment('dad','a','Carlos Perez',sameEmail,'2026-10-01','Completed');
 const second=appointment('son','a','Diego Perez',sameEmail,'2026-10-02','Checked in');
 const list=buildClientDirectory([first,second],settings,'a');
 assert.equal(list.length,2);
 assert.deepEqual(list.map(c=>c.name).sort(),['Carlos Perez','Diego Perez']);
 assert.equal(list.find(c=>c.name==='Carlos Perez').attendedSessions,1);
 assert.equal(list.find(c=>c.name==='Diego Perez').attendedSessions,1);
 const all=clientWorkbookSheets(list);
 assert.equal(all[0].rows.length,3,'Each different name must export on a distinct client row');
});
test('same full name can be matched by email OR phone across multiple bookings',()=>{
 const first={...appointment('one','a','Taylor Lee','taylor@example.com','2026-10-01','Completed'),
  data:JSON.stringify({name:'Taylor Lee',email:'taylor@example.com',phone:'813-555-0141',services:['Small Group Session'],serviceIds:['coaching']})};
 const second={...appointment('two','a','Taylor Lee','another@example.com','2026-10-02','Completed'),
  data:JSON.stringify({name:'Taylor Lee',email:'another@example.com',phone:'813-555-0141',services:['Small Group Session'],serviceIds:['coaching']})};
 const third={...appointment('three','a','Taylor Lee','another@example.com','2026-10-03','Completed'),
  data:JSON.stringify({name:'Taylor Lee',email:'another@example.com',phone:'',services:['Small Group Session'],serviceIds:['coaching']})};
 const list=buildClientDirectory([first,second,third],settings,'a');
 assert.equal(list.length,1);
 assert.equal(list[0].attendedSessions,3);
 assert.equal(list[0].attendanceDays.length,3);
 const sharedPhoneDifferentName={...second,id:'four',data:JSON.stringify({name:'Morgan Lee',email:'another@example.com',phone:'813-555-0141',services:['Small Group Session'],serviceIds:['coaching']})};
 assert.equal(buildClientDirectory([first,second,third,sharedPhoneDifferentName],settings,'a').length,2);
});
test('name auto-population stays local to a business and never includes contact or custom fields',async()=>{
 const booking=await readFile(new URL('../app/book/page.tsx',import.meta.url),'utf8');
 assert.match(booking,/selahflow:remembered-booking-name:/);
 assert.match(booking,/localStorage\.getItem/);
 assert.match(booking,/localStorage\.setItem/);
 assert.match(booking,/Not you\? Clear name/);
 const fields=await readFile(new URL('../app/components/registration-fields.tsx',import.meta.url),'utf8');
 assert.match(booking,/<RegistrationFields/);
 assert.match(fields,/autoComplete=\{f.id==='firstName'\?'given-name':f.id==='lastName'\?'family-name':'off'\}/);
 assert.doesNotMatch(booking,/localStorage\.setItem\([^)]*email/);
 assert.doesNotMatch(booking,/localStorage\.setItem\([^)]*customAnswers/);
});
test('Excel workbook has three named worksheets and preserves attendance facts',()=>{
 const c=buildClientDirectory([
  appointment('1','a','Alex','alex@example.com','2026-10-01','Completed'),
  appointment('2','a','Alex','alex@example.com','2026-10-02','Confirmed',['private'])
 ],settings,'a')[0];
 const sheets=clientWorkbookSheets([c]);
 assert.deepEqual(sheets.map(s=>s.name),['Clients','Service History','Attendance Days','Booking Answers']);
 assert.equal(sheets[0].rows[1][3],2);
 assert.equal(sheets[0].rows[1][4],1);
 assert.equal(sheets[0].rows[1][5],1);
 assert.equal(sheets[1].rows.length,3);
 assert.equal(sheets[2].rows.length,2);
 const file=createClientXlsx(sheets,{button:'#673846',text:'#482831',border:'#D2B7BE'});
 assert.equal(file.subarray(0,4).toString('ascii'),'PK\x03\x04');
 assert.ok(file.includes(Buffer.from('xl/worksheets/sheet1.xml')));
 assert.ok(file.includes(Buffer.from('xl/worksheets/sheet2.xml')));
 assert.ok(file.includes(Buffer.from('xl/worksheets/sheet3.xml')));
 assert.ok(file.includes(Buffer.from('673846')));
 assert.ok(file.includes(Buffer.from('Alex')));
});
test('Excel protects string cells from spreadsheet formula execution',()=>{
 const sheets=clientWorkbookSheets([{name:'=CMD()',email:'x@example.com',phone:'',bookedSessions:0,attendedSessions:0,attendanceDays:[],
  serviceTypes:[],latestDate:'',history:[]}]);
 const workbook=createClientXlsx(sheets);
 assert.ok(workbook.includes(Buffer.from("&apos;=CMD()")));
 assert.ok(!workbook.includes(Buffer.from('<f>')));
});
test('business-specific push and install names are distinct, safe and PWA manifests get unique identifiers',()=>{
 assert.equal(businessDeviceName('Arcila Training'),'SelahFlow - Arcila Training');
 assert.equal(businessDeviceName('Nail Care'),'SelahFlow - Nail Care');
 assert.equal(businessDeviceName('  Blue <Test>   Spa '),'SelahFlow - Blue Test Spa');
 const first=businessManifest('arcila-training','Arcila Training',{colors:{header:'#123F3A',page:'#F7F4EC'}});
 const second=businessManifest('nail-care','Nail Care',{colors:{header:'#673846',page:'#FFF8F3'}});
 assert.equal(first.name,'SelahFlow - Arcila Training');
 assert.equal(first.id,'/studio/arcila-training');
 assert.equal(first.start_url,'/studio/arcila-training');
 assert.equal(second.name,'SelahFlow - Nail Care');
 assert.equal(second.theme_color,'#673846');
 assert.notEqual(first.id,second.id);
 assert.throws(()=>businessManifest('../secret','Hacker'),/Invalid business slug/);
});
test('device push routes preserve business scoping and use the named identity',async()=>{
 const base=new URL('../',import.meta.url);
 const files=await Promise.all([
  'server/push-delivery.mjs','server/push-context.mjs','app/api/push/route.ts',
  'app/studio/[slug]/page.tsx','app/team/review/[token]/page.tsx',
  'app/components/device-push-controls.tsx',
  'app/api/business/manifest/route.ts'
 ].map(f=>readFile(new URL(f,base),'utf8')));
 assert.match(files[0],/businessDeviceName\(r\.name\)/);
 assert.match(files[1],/business_slug/);
 assert.match(files[1],/business_name/);
 assert.match(files[2],/businessSlug:c\.businessSlug/);
 assert.match(files[3],/appleWebApp/);
 assert.match(files[4],/appleWebApp/);
 assert.match(files[5],/Business notification name/);
 assert.match(files[6],/application\/manifest\+json/);
 assert.match(files[2],/business_id=\$1 AND reviewer=\$2/);
});
