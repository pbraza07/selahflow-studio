import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {restoreBookingCustomAnswers,restoredContact} from '../server/returning-member-prefill.mjs';

const fields=[
 {id:'level',label:'Player Level',type:'select',options:['Beginner','Intermediate','Advanced']},
 {id:'group',label:'Age group',type:'select',options:['U11','U12','U13']},
 {id:'position',label:'Player Position',type:'select',options:['Goalkeeper','Midfielder','Forward']},
 {id:'consent',label:'Photo consent',type:'checkbox'},
 {id:'notes',label:'Coaching notes',type:'text'}
];
test('restore registration responses from latest booking, membership, and older saved profiles',()=>{
 const latest={level:'Advanced',notes:''};
 const prior={group:'U12'};
 const membership={level:'Intermediate',position:'Midfielder',consent:false};
 const legacy={notes:'Prefers evening training'};
 assert.deepEqual(
  restoreBookingCustomAnswers(fields,latest,prior,membership,legacy),
  {level:'Advanced',group:'U12',position:'Midfielder',consent:false,notes:'Prefers evening training'}
 );
});
test('discard outdated or invalid select options without preventing valid saved fields',()=>{
 assert.deepEqual(restoreBookingCustomAnswers(fields,
   {level:'Former division',group:'U12',position:'Midfielder',unknown:'Private'},
   {level:'Beginner',group:'U11',consent:true}),
  {level:'Beginner',group:'U12',position:'Midfielder',consent:true});
});
test('return saved contact details with first and last name separated',()=>{
 const profile={name:'Levi Alves',email:'levi@example.test',phone:'813-555-0100'};
 const result=restoredContact({customer_name:'Levi Alves'},profile,{});
 assert.deepEqual(result,{firstName:'Levi',lastName:'Alves',email:'levi@example.test',phone:'813-555-0100'});
});
test('booking form shows membership ID before first name and uses one required DOB field',async()=>{
 const page=await readFile(new URL('../app/book/page.tsx',import.meta.url),'utf8');
 const form=page.slice(page.indexOf('{step===3&&<form'));
 assert.ok(form.indexOf('className="sf-member-number-booking"')<form.indexOf('className="sf-booking-name-fields"'));
 assert.equal((form.match(/name="dateOfBirth"/g)||[]).length,1);
 assert.match(form,/Unique Membership ID \(returning players\)/);
 assert.match(form,/automatically fill your name, email, phone and previous registration answers/);
 assert.match(form,/Leave the ID blank; SelahFlow will create one when you book/);
 assert.doesNotMatch(form,/Not you\? Clear name.*?Load my saved details/s);
});
test('lookup requires birth-date verification, business identity and throttling before returning PII',async()=>{
 const endpoint=await readFile(new URL('../app/api/public/member-lookup/route.ts',import.meta.url),'utf8');
 assert.match(endpoint,/validOrigin\(req\)/);
 assert.match(endpoint,/member-prefill-ip:/);
 assert.match(endpoint,/member-prefill-id:/);
 assert.match(endpoint,/b\.status='active'|status='active'/);
 assert.match(endpoint,/date_of_birth=\$3::date/);
 assert.match(endpoint,/registration_answers/);
 assert.match(endpoint,/booking_requests/);
 assert.match(endpoint,/appointments/);
 assert.match(endpoint,/restoreBookingCustomAnswers/);
});
