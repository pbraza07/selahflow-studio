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
