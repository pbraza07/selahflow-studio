import {registrationQuestions} from '../server/registration-questions.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {restoreCurrentProfileAnswers,restoreBookingCustomAnswers,restoredContact} from '../server/returning-member-prefill.mjs';

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
test('prefill preserves the verified membership identity even if an editable client card was renamed',()=>{
 const result=restoredContact(
  {customer_name:'Levi Alves',customer_email:'legacy@example.test'},
  {name:'Different Display Name',email:'current@example.test',phone:'8135550222'},
  {firstName:'Other',lastName:'Name'}
 );
 assert.equal(result.firstName,'Levi');
 assert.equal(result.lastName,'Alves');
 assert.equal(result.email,'current@example.test');
});
test('booking defaults place member ID first while the shared form supports configured ordering',async()=>{
 const page=await readFile(new URL('../app/book/page.tsx',import.meta.url),'utf8');
 const form=page.slice(page.indexOf('{step===3&&<form'));
 const fields=registrationQuestions({},'booking');
 assert.ok(fields.findIndex(f=>f.id==='memberNumber')<fields.findIndex(f=>f.id==='firstName'));
 assert.equal(fields.filter(f=>f.id==='dateOfBirth'&&f.required).length,1);
 assert.match(form,/<RegistrationFields config=\{config\} form="booking"/);
 assert.match(form,/Returning client\?<\/strong> Enter your client ID to fill in your saved details\./);
 assert.match(form,/First booking\?<\/strong> Leave the ID blank and complete the form below\./);
 assert.doesNotMatch(form,/MMDDYY|next number starting at 1001/);
 assert.doesNotMatch(form,/Not you\? Clear name.*?Load my saved details/s);
});
test('ID-only lookup retains business scope and throttling and optionally accepts a supplied birth date',async()=>{
 const endpoint=await readFile(new URL('../app/api/public/member-lookup/route.ts',import.meta.url),'utf8');
 assert.match(endpoint,/validOrigin\(req\)/);
 assert.match(endpoint,/member-prefill-ip:/);
 assert.match(endpoint,/member-prefill-id:/);
 assert.match(endpoint,/b\.status='active'|status='active'/);
 assert.match(endpoint,/\$3::date IS NULL OR date_of_birth=\$3::date/);
 assert.match(endpoint,/dateOfBirth:String\(identity.dob/);
 assert.match(endpoint,/registration_answers/);
 assert.match(endpoint,/booking_requests/);
 assert.match(endpoint,/appointments/);
 assert.match(endpoint,/restoreCurrentProfileAnswers/);
});

test('owner profile corrections prefill current answers, intentional clears and explicit name parts over historical values',()=>{
 assert.deepEqual(restoreCurrentProfileAnswers(fields,{level:'Beginner',notes:'',consent:false},{level:'Advanced',notes:'Old',consent:true}),{level:'Beginner',notes:'',consent:false});
 assert.deepEqual(restoredContact({customer_name:'Alicia Mia Doe',customer_email:'old@example.test'},{name:'Alicia Mia Doe',first_name:'Alicia Mia',last_name:'Doe',email:'',phone:''},{email:'stale@example.test',phone:'8135550000'}),{firstName:'Alicia Mia',lastName:'Doe',email:'',phone:''});
});
