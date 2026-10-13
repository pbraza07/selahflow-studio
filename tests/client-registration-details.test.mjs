import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {registrationAnswerRows,displayAnswer,dateOnly} from '../server/client-registration-fields.mjs';
import {registrationFieldCatalog,clientFieldValues,filterRegistrationClients} from '../server/client-registration-filters.mjs';
import {buildClientDirectory,pendingBookingAsAppointment} from '../server/client-history.mjs';
import {applyClientProfiles} from '../server/client-profile-logic.mjs';

test('membership registration snapshot uses submitted labels rather than renamed or deleted form questions',()=>{
 const current=[{id:'group',label:'Current level name',type:'select',options:['U11','U12']}];
 const answers=registrationAnswerRows({group:'U11',permission:false,notes:''},{group:'Original age group',permission:'Parent consent',notes:'Notes'},current);
 assert.deepEqual(answers.map(x=>[x.label,x.value]),[['Original age group','U11'],['Parent consent',false],['Notes','']]);
 assert.equal(displayAnswer(false),'No');
 assert.equal(displayAnswer(true),'Yes');
 assert.equal(displayAnswer(''),'Not provided');
 assert.equal(dateOnly('2015-07-04T00:00:00.000Z'),'2015-07-04');
});

test('filter by package, current and historical form answers, birthday, consent, and imported fields',()=>{
 const academy={
  name:'Taylor Allen',email:'taylor@example.com',phone:'8135550123',dateOfBirth:'2015-07-04',
  memberNumber:'TA0704',membershipName:'Academy',membershipStatus:'active',
  membershipDetails:{interval:'month'},membershipAnswers:[{id:'group',label:'Age Group',value:'U12',type:'select'},{id:'consent',label:'Parent approval',value:true,type:'checkbox'}],
  importColumns:{'School':'West Middle'},serviceNames:['Training'],serviceTypes:['Soccer'],
  history:[{date:'2026-10-18',staff:'Coach Emma',status:'Confirmed',policyAccepted:true,answers:[{id:'team',label:'Preferred team',value:'Gold',type:'select'}]}]
 };
 const noPlan={name:'Jordan Bennett',email:'jordan@example.com',phone:'8135550000',memberNumber:'JB0122',membershipStatus:'pending_payment',
  membershipAnswers:[{id:'group',label:'Age Group',value:'U13',type:'select'}],history:[],serviceNames:[],serviceTypes:[],importColumns:{}};
 const clients=[academy,noPlan],fields=registrationFieldCatalog(clients,[{id:'group',label:'Age Group',type:'select',options:['U11','U12','U13']}]);
 assert.ok(fields.some(f=>f.key==='question:group'));
 assert.ok(fields.some(f=>f.key==='question:consent'));
 assert.ok(fields.some(f=>f.key==='question:team'));
 assert.ok(fields.some(f=>f.key==='import:School'));
 assert.ok(fields.some(f=>f.key==='dateOfBirth'));
 assert.deepEqual(clientFieldValues(academy,'question:consent'),['Yes']);
 assert.deepEqual(clientFieldValues(academy,'staff'),['Coach Emma']);
 assert.deepEqual(filterRegistrationClients(clients,{membershipLevel:'Academy',fieldKey:'question:group',fieldValue:'U12'}).map(c=>c.name),['Taylor Allen']);
 assert.deepEqual(filterRegistrationClients(clients,{membershipLevel:'__no_active__'}).map(c=>c.name),['Jordan Bennett']);
 assert.deepEqual(filterRegistrationClients(clients,{fieldKey:'dateOfBirth',fieldValue:'2015-07-04'}).map(c=>c.name),['Taylor Allen']);
 assert.deepEqual(filterRegistrationClients(clients,{fieldKey:'import:School',fieldValue:'West'}).map(c=>c.name),['Taylor Allen']);
 assert.deepEqual(clientFieldValues(noPlan,'import:School'),[],'a missing imported field is not the same as an unanswered field');
 assert.deepEqual(filterRegistrationClients(clients,{search:'parent approval'}).map(c=>c.name),['Taylor Allen']);
});

test('pending booking saves all original client fields and merges with the registered membership ID',()=>{
 const appointment=pendingBookingAsAppointment({
  id:'pending-101',date:'2026-11-01',start_minute:600,duration:60,staff_id:'trainer',status:'pending',
  details:JSON.stringify({
   customerName:'Taylor Allen',customerEmail:'taylor@example.com',customerPhone:'8135550123',
   firstName:'Taylor',lastName:'Allen',dateOfBirth:'2015-07-04',memberNumber:'TA0704',
   customAnswers:{group:'U12',permission:false},customFieldLabels:{group:'Original age group',permission:'Parent consent'},
   customFieldTypes:{group:'select',permission:'checkbox'},services:['Training'],serviceIds:['training']
  })
 });
 const settings={services:[{id:'training',name:'Training',category:'Soccer'}],staff:[{id:'trainer',name:'Coach Emma'}]};
 const derived=buildClientDirectory([appointment],settings,'owner-1');
 assert.equal(derived.length,1);
 assert.equal(derived[0].dateOfBirth,'2015-07-04');
 assert.equal(derived[0].firstBooking.customerMemberNumber,'TA0704');
 assert.equal(derived[0].firstBooking.firstName,'Taylor');
 assert.deepEqual(derived[0].firstBooking.answers.map(a=>[a.label,a.value,a.type]),
  [['Original age group','U12','select'],['Parent consent',false,'checkbox']]);
 const managed=applyClientProfiles(derived,[{id:'profile-1',name:'Taylor Allen',email:'old@example.com',phone:'',member_number:'TA0704',date_of_birth:'2015-07-04',archived:false}]);
 assert.equal(managed.clients.length,1);
 assert.equal(managed.clients[0].history.length,1);
});

test('migration backfills legacy membership answers without mistaking imported spreadsheet fields for registration',async()=>{
 const db=new PGlite();
 try{
  await db.exec("CREATE TABLE businesses(id text PRIMARY KEY,owner_id text NOT NULL);");
  await db.exec("CREATE TABLE business_client_profiles(owner text NOT NULL, member_number text, name text NOT NULL, email text NOT NULL, phone text NOT NULL DEFAULT '',notes text NOT NULL DEFAULT '',deleted_at timestamptz,import_columns jsonb NOT NULL DEFAULT '{}'::jsonb);");
  await db.exec("CREATE TABLE customer_memberships(id text PRIMARY KEY,business_id text,customer_name text,customer_email text,member_number text);");
  await db.exec("INSERT INTO businesses VALUES('business-1','owner-1')");
  await db.exec("INSERT INTO customer_memberships VALUES('mem-1','business-1','Taylor Allen','taylor@example.com','TA0704')");
  await db.exec("INSERT INTO business_client_profiles(owner,member_number,name,email,phone,notes,import_columns) VALUES('owner-1','TA0704','Taylor Allen','taylor@example.com','8135550123','Membership registration','{\"group\":\"U12\"}'::jsonb)");
  const sql=await readFile(new URL('../migrations/028_membership_registration_details.sql',import.meta.url),'utf8');
  await db.exec(sql);
  const result=await db.query("SELECT customer_phone,registration_answers FROM customer_memberships WHERE id='mem-1'");
  assert.equal(result.rows[0].customer_phone,'8135550123');
  assert.deepEqual(result.rows[0].registration_answers,{group:'U12'});
 }finally{await db.close();}
});

test('client API retains original membership fields and booking registration snapshots',async()=>{
 const api=await readFile(new URL('../app/api/studio/clients/route.ts',import.meta.url),'utf8');
 const handler=await readFile(new URL('../lib/studio-handler.ts',import.meta.url),'utf8');
 const member=await readFile(new URL('../app/api/studio/memberships/route.ts',import.meta.url),'utf8');
 assert.match(api,/registrationAnswerRows/);
 assert.match(api,/membershipRegistration/);
 assert.match(api,/formFields/);
 assert.match(handler,/dateOfBirth:isPublic/);
 assert.match(handler,/data\.customFieldTypes/);
 assert.match(member,/registration_field_labels/);
 assert.match(member,/registration_answers/);
});

test('review edits keep both original and revised answers visible and filterable',()=>{
 const row={id:'visit-updated',date:'2026-10-30',start:600,duration:60,staff:'trainer',status:'Confirmed',data:JSON.stringify({
  name:'Taylor Allen',email:'taylor@example.com',phone:'8135550123',memberNumber:'TA0704',
  services:['Training'],customAnswers:{group:'U13',consent:true},
  customFieldLabels:{group:'Age group',consent:'Parent consent'},
  customFieldTypes:{group:'select',consent:'checkbox'},
  originalSubmission:{customerName:'Taylor Allen',customerEmail:'taylor-original@example.com',customerPhone:'8135550123',
   customAnswers:{group:'U12',consent:false}}
 })};
 const clients=buildClientDirectory([row],{staff:[{id:'trainer',name:'Trainer'}]},'owner-1');
 assert.equal(clients.length,1);
 const visit=clients[0].history[0];
 assert.deepEqual(visit.answers.map(a=>a.value),['U13',true]);
 assert.deepEqual(visit.originalAnswers.map(a=>a.value),['U12',false]);
 assert.deepEqual(filterRegistrationClients(clients,{fieldKey:'question:group',fieldValue:'U12'}).map(c=>c.memberNumber),['TA0704']);
 assert.deepEqual(filterRegistrationClients(clients,{fieldKey:'question:group',fieldValue:'U13'}).map(c=>c.memberNumber),['TA0704']);
 assert.ok(registrationFieldCatalog(clients).some(x=>x.key==='question:group'));
 assert.deepEqual(filterRegistrationClients(clients,{fieldKey:'email',fieldValue:'taylor-original@example.com'}).map(c=>c.memberNumber),['TA0704']);
 assert.deepEqual(filterRegistrationClients(clients,{search:'taylor-original@example.com'}).map(c=>c.memberNumber),['TA0704']);
});

test('re-enrolling a member never replaces their original form answers',async()=>{
 const member=await readFile(new URL('../app/api/studio/memberships/route.ts',import.meta.url),'utf8');
 assert.match(member,/registration_answers=CASE WHEN registration_answers='\{\}'::jsonb/);
 assert.match(member,/registration_field_labels=CASE WHEN registration_field_labels='\{\}'::jsonb/);
});
