import test from 'node:test';
import assert from 'node:assert/strict';
import {removeBookableSession,cleanRemovedBookableSessions} from '../server/remove-bookable-session.mjs';
import {rescheduledConfig} from '../server/safe-session-reschedule.mjs';
import {sessionInstances} from '../server/session-recurrence.mjs';
import {validateBookableSessions,validateExistingSessionReservations,computeDayAvailability} from '../server/session-scheduling.mjs';
import {validateRegistrationQuestions} from '../server/registration-questions.mjs';
const session={id:'series',date:'2030-11-01',start:600,staff:'coach',service:'training',capacity:5,repeat:{frequency:'weekly',every:1,until:'2030-11-15'}};
const config={open:8,close:20,buffer:0,staff:[{id:'coach',name:'Coach',services:['training']}],services:[{id:'training',name:'Training',duration:60,price:20,maxSlots:1}],bookableSessions:[session,{...session,id:'other',date:'2030-12-01',repeat:null,onlyScheduledTime:false}]};
const question=(id,sessionIds,forms=['booking'])=>({id,label:id,type:'text',required:false,showInNotification:false,sessionIds,forms});
test('removing one-time or rescheduled recurring definitions cleans every linked override and preserves unrelated sessions',()=>{
 let moved=config;
 for(const date of ['2030-11-01','2030-11-08']){
  const current=sessionInstances(moved,date).find(s=>s.seriesId==='series');
  moved=rescheduledConfig(moved,current,{date,start:720,staff:'coach',service:'training',capacity:5});
 }
 const before=JSON.stringify(moved),next=removeBookableSession(moved,'series');
 assert.equal(JSON.stringify(moved),before);assert.deepEqual(next.bookableSessions.map(s=>s.id),['other']);assert.deepEqual(next.sessionOverrides,[]);assert.doesNotThrow(()=>validateBookableSessions(next));assert.deepEqual(sessionInstances(next,'2030-11-08'),[]);
 assert.equal(removeBookableSession(next,'other').bookableSessions.length,0);
 const stalePayload={...moved,bookableSessions:moved.bookableSessions.filter(s=>s.id!=='series')};
 assert.deepEqual(cleanRemovedBookableSessions(moved,stalePayload),next,'Server handles already-open clients with stale linked overrides');
 assert.throws(()=>validateBookableSessions({...config,sessionOverrides:[{...moved.sessionOverrides[0],seriesId:'unknown'}]}),/no longer belongs/,'Invalid overrides of retained series remain rejected');
});
test('removal cleans question references without broadening session-only questions to global bookings',()=>{
 const previous={...config,bookingCustomFields:[question('only',['series']),question('both',['series','other']),question('shared',['series'],['booking','membership'])],bookingQuestionOrder:['only','both','shared'],membershipQuestionOrder:['only','shared'],bookingPushFields:['customerName','only','shared'],bookingQuestionNotifications:{only:true,shared:true},bookingApprovalVisibleFields:['customerName','only'],services:[{...config.services[0],questionRequired:{only:true,both:true}}]};
 const next=removeBookableSession(previous,'series');assert.doesNotThrow(()=>validateRegistrationQuestions(next));
 assert.equal(next.bookingCustomFields.some(f=>f.id==='only'),false);assert.deepEqual(next.bookingCustomFields.find(f=>f.id==='both').sessionIds,['other']);assert.deepEqual(next.bookingCustomFields.find(f=>f.id==='shared').forms,['membership']);assert.deepEqual(next.bookingQuestionOrder,['both']);assert.deepEqual(next.membershipQuestionOrder,['shared']);assert.deepEqual(next.bookingPushFields,['customerName']);assert.deepEqual(next.bookingQuestionNotifications,{});assert.deepEqual(next.services[0].questionRequired,{both:true});
});
test('removed definitions retain booked-time protection; retained series edits still cannot abandon booked occurrences',()=>{
 const appointment={id:'retained',date:'2030-11-08',staff:'coach',start:600,duration:60,status:'Confirmed',data:JSON.stringify({sessionId:'series__20301108',name:'Synthetic Client',price:20,paymentStatus:'paid'})};
 const next=removeBookableSession(config,'series'),before=JSON.stringify(appointment);
 assert.doesNotThrow(()=>validateExistingSessionReservations(config,next,[appointment]));
 const availability=computeDayAvailability({config:next,date:appointment.date,staff:'coach',services:config.services,appointments:[appointment],reservedSlots:[],today:'2030-10-01',nowMinutes:0,capacityOpen:()=>true});
 assert.equal(availability.slots.includes(600),false);assert.equal(availability.slots.includes(540),true);assert.equal(JSON.stringify(appointment),before);
 assert.throws(()=>validateExistingSessionReservations(config,{...config,bookableSessions:config.bookableSessions.map(s=>s.id==='series'?{...s,repeat:{...s.repeat,until:'2030-11-01'}}:s)},[appointment]),/confirmed customers/);
});
