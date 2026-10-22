import test from 'node:test';
import assert from 'node:assert/strict';
import {computeDayAvailability} from '../server/session-scheduling.mjs';
import {registrationQuestions,validateRegistrationQuestions,validateStandardRegistration} from '../server/registration-questions.mjs';
import {sanitizeBookingAnswers} from '../server/booking-custom-fields.mjs';
import {brandedEmailHtml} from '../server/branded-email.mjs';
test('existing scheduled sessions restrict times across dates; opting out restores appointment times',()=>{
 const service={id:'s',duration:30},session={id:'group',date:'2030-11-01',staff:'coach',service:'s',start:600,capacity:10};
 const config={open:9,close:18,buffer:0,services:[service],bookableSessions:[session]};
 const availability=c=>computeDayAvailability({config:c,date:'2030-11-01',staff:'coach',services:[service],appointments:[],reservedSlots:[],today:'2030-10-01',nowMinutes:0,capacityOpen:()=>true}).slots;
 assert.deepEqual(availability(config),[600]);
 assert.ok(availability({...config,bookableSessions:[{...session,onlyScheduledTime:false}]}).includes(540));
 assert.deepEqual(availability({...config,bookableSessions:[{...session,date:'2030-11-02'}]}),[]);
 assert.ok(availability({...config,bookableSessions:[{...session,staff:'other'}]}).includes(540));
});
test('all session questions can be required or optional without changing other sessions',()=>{
 const config={bookableSessions:[{id:'one',questionRequired:{firstName:false,lastName:false,dateOfBirth:false,email:false,phone:true,question:false}},{id:'two'}],bookingCustomFields:[{id:'question',label:'Question',type:'text',required:true}]};
 validateRegistrationQuestions(config);
 const questions=registrationQuestions(config,'booking','one__20301101');
 assert.equal(questions.find(f=>f.id==='firstName').required,false);assert.equal(questions.find(f=>f.id==='phone').required,true);
 assert.doesNotThrow(()=>validateStandardRegistration(config,'booking',{phone:'123'},'one'));
 assert.throws(()=>validateStandardRegistration(config,'booking',{},'one'),/Phone/);
 assert.doesNotThrow(()=>validateStandardRegistration(config,'booking',{phone:'123',firstName:'Test',lastName:'Person',dateOfBirth:'2000-01-02'},'one'));
 assert.deepEqual(sanitizeBookingAnswers(questions.filter(f=>!f.standard),{}),{question:''});
 assert.throws(()=>validateStandardRegistration(config,'booking',{},'two'),/Date of birth/);
 assert.throws(()=>validateRegistrationQuestions({...config,bookableSessions:[{id:'one',questionRequired:{unknown:false}}]}),/Invalid session/);
});
test('email action boxes escape labels and URLs, reject unsafe schemes and preserve private payment fragments',()=>{
 const html=brandedEmailHtml({subject:'Paid',text:'Hello\nPay: https://app.example/payment#token=private&x=1',actions:[{label:'Make Payment',url:'https://app.example/payment#token=private&x=1'},{label:'Membership <details>',url:'https://app.example/book/one#registration-status'},{label:'Unsafe',url:'javascript:alert(1)'}]});
 assert.match(html,/border-radius:12px/);assert.match(html,/Membership &lt;details&gt;/);assert.match(html,/#token=private&amp;x=1/);assert.doesNotMatch(html,/href="javascript:|>Unsafe</);
 assert.equal((html.match(/#token=private/g)||[]).length,1);
});
