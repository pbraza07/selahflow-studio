import test from 'node:test';import assert from 'node:assert/strict';
import {isBlocked,validateBlockouts} from '../server/booking-blockouts.mjs';
import {readFile} from 'node:fs/promises';
import {computeDayAvailability} from '../server/session-scheduling.mjs';
import {customRegistrationFields,validateRegistrationQuestions} from '../server/registration-questions.mjs';
import {sanitizeBookingAnswers} from '../server/booking-custom-fields.mjs';
test('blockouts apply by date, staff and intersecting interval including full days',()=>{
 const config={staff:[{id:'coach'}],bookingBlockouts:[{id:'one',date:'2026-11-01',start:600,end:660,staff:'coach',reason:'Away'}]};validateBlockouts(config);
 assert.equal(isBlocked(config,'2026-11-01','coach',585,30),true);assert.equal(isBlocked(config,'2026-11-01','coach',660,30),false);assert.equal(isBlocked(config,'2026-11-01','other',600,30),false);
 const availability=computeDayAvailability({config:{...config,open:9,close:12,buffer:0,services:[],bookableSessions:[]},date:'2026-11-01',staff:'coach',services:[{id:'s',duration:30}],appointments:[],reservedSlots:[],today:'2026-10-13',nowMinutes:0,capacityOpen:()=>true});assert.ok(availability.slots.includes(540));assert.ok(!availability.slots.includes(585));assert.ok(!availability.slots.includes(600));assert.ok(availability.slots.includes(660));
 assert.throws(()=>validateBlockouts({...config,bookingBlockouts:[{...config.bookingBlockouts[0],start:700,end:600}]}),/Check blockout/);
});

test('owner blockout schedules are collapsed until expanded',async()=>{
 const source=await readFile(new URL('../app/components/booking-blockout-settings.tsx',import.meta.url),'utf8');
 assert.match(source,/<details key=\{b\.id\} className="sf-booking-blockout"/);
 assert.match(source,/<summary>/);
 assert.doesNotMatch(source,/<details[^>]+open/);
});
test('existing sessions and recurring occurrences receive only their selected questions; regular appointments retain global fields',()=>{
 const q=(id,sessionIds)=>({id,label:id,type:'text',required:true,showInNotification:false,forms:['booking'],sessionIds});
 const config={bookableSessions:[{id:'training'},{id:'evaluation'}],bookingCustomFields:[q('global',[]),q('level',['training']),q('history',['evaluation'])]};validateRegistrationQuestions(config);
 assert.deepEqual(customRegistrationFields(config,'booking','training__20261101').map(f=>f.id),['global','level']);
 assert.deepEqual(customRegistrationFields(config,'booking',null).map(f=>f.id),['global']);
 assert.deepEqual(sanitizeBookingAnswers(customRegistrationFields(config,'booking','training'),{global:'ok',level:'intermediate'}),{global:'ok',level:'intermediate'});
 assert.throws(()=>sanitizeBookingAnswers(customRegistrationFields(config,'booking','evaluation'),{global:'ok'}),/history is required/);
});
test('each bookable session exposes standard and applicable custom fields in its editor',async()=>{
 const component=await readFile(new URL('../app/components/registration-question-settings.tsx',import.meta.url),'utf8');
 const dashboard=await readFile(new URL('../app/studio/owner-dashboard.tsx',import.meta.url),'utf8');
 assert.match(component,/registrationQuestions\(config,editorForm,sessionId/);
 assert.match(component,/including standard registration fields/);
 assert.match(dashboard,/Edit session questions/);
 assert.match(dashboard,/sessionQuestionEditor===x.id/);
});
