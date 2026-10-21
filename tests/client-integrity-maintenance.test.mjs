import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {repairClientIntegrity} from '../server/client-integrity-maintenance.mjs';
import {issueMemberId} from '../server/member-id-policy.mjs';
import {deleteClientPermanently} from '../server/delete-client.mjs';
import {ensureMemberBookingIdentity} from '../server/shared-member-identity.mjs';
import {registrationNotificationLines} from '../server/registration-questions.mjs';
import {notificationMessage} from '../server/notification-delivery.mjs';
import {bookingReceiptMessage} from '../server/booking-receipts.mjs';

test('maintenance fails closed without exact target and verified backup/restore; no startup deletion',async()=>{
 await assert.rejects(()=>repairClientIntegrity({},undefined),/Exact business/);
 const startup=await readFile(new URL('../scripts/start.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(startup,/repair-client-integrity|reset-staging-registration/);
 const source=await readFile(new URL('../server/client-integrity-maintenance.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/Noah|NA122900|arcillatrng/);
});
test('notification checkboxes filter standard and custom answers independently per form; approval email retains link and appointment detail',()=>{
 const config={bookingCustomFields:[{id:'allergy',label:'Allergy',type:'text',required:false,showInNotification:false}],bookingQuestionNotifications:{firstName:false,lastName:false,email:false,phone:false,allergy:true},membershipQuestionNotifications:{allergy:false,email:true}};
 assert.deepEqual(registrationNotificationLines(config,'booking',{firstName:'Private',lastName:'Name',email:'private@example.test'},{allergy:'None'}),['Allergy: None']);
 assert.deepEqual(registrationNotificationLines(config,'membership',{email:'client@example.test'},{allergy:'None'}),['Email: client@example.test']);
 const alert=notificationMessage({config,businessName:'Business',request:{date:'2030-01-01',start_minute:600,duration:30,details:{customerName:'Private Name',customerEmail:'private@example.test',services:['Training'],customAnswers:{allergy:'None'},quotedPrice:15}},link:'https://example.test/review'});
 assert.match(alert.text,/Allergy: None/);assert.doesNotMatch(alert.text,/private@example.test/);
 const receipt=bookingReceiptMessage({business:'Arcila Training',name:'Client',memberNumber:'CA0101',reference:'booking',date:'2030-01-01',start:600,duration:30,services:['Training'],staff:'Coach',price:15,answers:[{label:'Level',value:'Academy'}],links:{status:'https://example.test/status',membership:'https://example.test/membership',booking:'https://example.test/book'}},{event:'payment_link',paymentLink:'https://example.test/payment#private'});
 for(const value of ['Training','Coach','2030-01-01','30 minutes','CA0101','Level: Academy','https://example.test/payment#private'])assert.ok(receipt.text.includes(value));
});


test('strict active-ID constraint preserves retired legacy evidence but forbids reactivation',async()=>{
 const pg=new PGlite();try{
  const files=(await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')&&f<'050').sort();
  for(const f of files.filter(f=>Number(f.slice(0,3))<46))await pg.exec(await readFile(new URL('../migrations/'+f,import.meta.url),'utf8'));
  await pg.exec("INSERT INTO users(id,email,password_hash) VALUES('retired-owner','retired@example.test','hash'); INSERT INTO businesses(id,owner_id,slug,name,status) VALUES('retired-business','retired-owner','retired-example','Example','active'); INSERT INTO business_member_ids(business_id,member_number,identity_key,retired_at) VALUES('retired-business','ZZ010100','retained evidence',now())");
  for(const f of files.filter(f=>Number(f.slice(0,3))>=46))await pg.exec(await readFile(new URL('../migrations/'+f,import.meta.url),'utf8'));
  await pg.exec('ALTER TABLE business_member_ids VALIDATE CONSTRAINT business_member_ids_six');
  assert.equal((await pg.query("SELECT count(*)::int AS n FROM business_member_ids WHERE member_number='ZZ010100' AND retired_at IS NOT NULL")).rows[0].n,1);
  await assert.rejects(pg.exec("UPDATE business_member_ids SET retired_at=NULL WHERE member_number='ZZ010100'"),/business_member_ids_six/);
  await assert.rejects(pg.exec("INSERT INTO business_member_ids(business_id,member_number,identity_key) VALUES('retired-business','ZZ020200','new invalid identity')"),/business_member_ids_six/);
 }finally{await pg.close();}
});
