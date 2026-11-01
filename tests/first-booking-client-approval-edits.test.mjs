import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildClientDirectory,pendingBookingAsAppointment,clientWorkbookSheets} from '../server/client-history.mjs';
import {applyClientProfiles} from '../server/client-profile-logic.mjs';
import {editableBookingDetails} from '../server/booking-review-edits.mjs';
const settings={
 services:[{id:'training',name:'Youth Soccer',category:'Training'}],
 staff:[{id:'coach',name:'Coach James'}],
 bookingCustomFields:[
  {id:'level',label:'Player Level',type:'select',required:true,showInNotification:true,options:['Level 1','Level 2']},
  {id:'age',label:'Age Group',type:'select',required:true,showInNotification:true,options:['U13','U15']},
  {id:'firstTime',label:'First session?',type:'checkbox',required:false,showInNotification:false}
 ]
};
const details={
 customerName:'Chris Lee',customerEmail:'chris@example.com',customerPhone:'8135550188',
 serviceIds:['training'],services:['Youth Soccer'],staffId:'coach',date:'2026-10-23',start:900,duration:60,
 quotedPrice:50,customAnswers:{level:'Level 1',age:'U13',firstTime:true},
 customFieldLabels:{level:'Player Level',age:'Age Group',firstTime:'First session?'},
 sessionId:null,created:'2026-10-12T10:00:00.000Z'
};
const pending={
 id:'68a7a4e4-9e21-4eb7-a3e8-b8ed9a843e80',date:'2026-10-23',start_minute:900,
 duration:60,staff_id:'coach',status:'pending',details:JSON.stringify(details)
};
test('first booking generates a client card before approval and copies full custom answers',()=>{
 const booking=pendingBookingAsAppointment(pending);
 assert.equal(booking.status,'Pending approval');
 const client=buildClientDirectory([booking],settings,'owner-a')[0];
 assert.ok(client);
 assert.equal(client.name,'Chris Lee');
 assert.equal(client.email,'chris@example.com');
 assert.equal(client.phone,'8135550188');
 assert.equal(client.bookedSessions,0,'Unapproved requests do not count as confirmed sessions');
 assert.equal(client.attendedSessions,0);
 assert.deepEqual(client.serviceTypes,['Training']);
 assert.equal(client.firstBooking.staff,'Coach James');
 assert.equal(client.firstBooking.answers.length,3);
 assert.equal(client.firstBooking.answers.find(a=>a.id==='level').label,'Player Level');
 assert.equal(client.firstBooking.answers.find(a=>a.id==='age').value,'U13');
 assert.equal(client.firstBooking.quotedPrice,50);
 const workbook=clientWorkbookSheets([client]);
 assert.equal(workbook[3].name,'Booking Answers');
 assert.equal(workbook[3].rows.length,4);
});
test('owner can correct answers while service/date/time remain locked and original remains retained',()=>{
 const change=editableBookingDetails(details,{
  customerName:'Christopher Lee',customerEmail:'chris2@example.com',customerPhone:'8135550199',
  customAnswers:{level:'Level 2',age:'U15',firstTime:false}
 },settings.bookingCustomFields);
 assert.equal(change.customerName,'Christopher Lee');
 assert.equal(change.serviceIds[0],'training');
 assert.equal(change.date,'2026-10-23');
 assert.equal(change.start,900);
 assert.equal(change.quotedPrice,50);
 assert.equal(change.originalSubmission.customerName,'Chris Lee');
 assert.equal(change.originalSubmission.customAnswers.level,'Level 1');
 const twice=editableBookingDetails(change,{
  customerName:'Chris Lee',customerEmail:'chris@example.com',customerPhone:'8135550188',
  customAnswers:{level:'Level 1',age:'U13',firstTime:true}
 },settings.bookingCustomFields);
 assert.equal(twice.originalSubmission.customerName,'Chris Lee');
 assert.throws(()=>editableBookingDetails(details,{customerName:'Chris Lee',customerEmail:'chris@example.com',customerPhone:'',customAnswers:details.customAnswers,date:'2027-01-01'},settings.bookingCustomFields),/Only customer/);
 assert.throws(()=>editableBookingDetails(details,{customerName:'Chris Lee',customerEmail:'chris@example.com',customerPhone:'',customAnswers:{level:'Level 3',age:'U13'}},settings.bookingCustomFields),/dropdown/i);
});
test('client card shows original answers even after approval corrected them',()=>{
 const amended=editableBookingDetails(details,{
  customerName:'Chris Lee',customerEmail:'chris@example.com',customerPhone:'8135550188',
  customAnswers:{level:'Level 2',age:'U15',firstTime:false}
 },settings.bookingCustomFields);
 const accepted={id:'apt-1',date:'2026-10-23',start:900,duration:60,staff:'coach',status:'Confirmed',
  data:JSON.stringify({name:amended.customerName,email:amended.customerEmail,phone:amended.customerPhone,
   serviceIds:['training'],services:['Youth Soccer'],price:50,customAnswers:amended.customAnswers,
   customFieldLabels:amended.customFieldLabels,originalSubmission:amended.originalSubmission})};
 const c=applyClientProfiles(buildClientDirectory([accepted],settings,'owner-a'),[]).clients[0];
 assert.equal(c.firstBooking.originalSubmission.customAnswers.level,'Level 1');
 assert.equal(c.latestBookingAnswers.find(a=>a.id==='level').value,'Level 2');
 const answers=clientWorkbookSheets([c])[3].rows;
 assert.ok(answers.some(row=>row[5]==='Player Level'&&row[6]==='Level 2'&&row[7]==='Level 1'));
});
test('approval editing respects owner/team authorization and audit records',async()=>{
 const base=new URL('../',import.meta.url);
 const paths=[
  'server/booking-review-edits.mjs',
  'app/api/studio/approvals/route.ts',
  'app/api/team/review/route.ts',
  'app/components/booking-request-cards.tsx',
  'app/components/owner-client-directory.tsx',
  'app/api/studio/clients/route.ts'
 ];
 const files=await Promise.all(paths.map(f=>readFile(new URL(f,base),'utf8')));
 assert.match(files[0],/FOR UPDATE OF r/);
 assert.match(files[0],/INSERT INTO booking_request_edits/);
 assert.match(files[0],/assertRequestReviewer\(client,row,reviewer,teamAccountId\)/);
 assert.match(files[1],/editPendingRequest\(owner/);
 assert.match(files[2],/editPendingRequest\(link\.owner_id/);
 assert.match(files[3],/Edit booking details/);
 assert.match(files[4],/First booking information/);
 assert.match(files[5],/pendingBookingAsAppointment/);
});
