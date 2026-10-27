import test from 'node:test';
import assert from 'node:assert/strict';
import {assistantStatusRequest,assistantStatusPrompt,assistantStatusUrl,formatAssistantStatus} from '../server/assistant-status.mjs';
test('assistant status conversation asks only for ID and separates membership, booking and combined intents',()=>{
 for(const [message,mode] of [['Membership status','membership'],['Is my membership active?','membership'],['Booking status','booking'],['Check my appointment','booking'],['Check membership and booking status','both']]){
  assert.deepEqual(assistantStatusRequest(message),{mode,id:null,invalid:false});
  const prompt=assistantStatusPrompt(mode);assert.match(prompt,/Enter only your unique client ID/);assert.match(prompt,/No email or date of birth is needed/);
 }
 for(const message of ['Memberships and credits','Services and prices','What membership plans do you offer?','Upcoming session schedule','Hours and location'])assert.equal(assistantStatusRequest(message),null,message);
});
test('ID-only and one-message requests normalize current and legacy IDs; invalid input never becomes a lookup',()=>{
 assert.deepEqual(assistantStatusRequest(' ab031513 '),{mode:'both',id:'AB031513',invalid:false});
 assert.deepEqual(assistantStatusRequest('Membership status ab031513'),{mode:'membership',id:'AB031513',invalid:false});
 assert.deepEqual(assistantStatusRequest('AB031513','booking'),{mode:'booking',id:'AB031513',invalid:false});
 assert.equal(assistantStatusRequest('AB0315','membership').id,'AB0315');
 for(const message of ['AB123','AB03151399','contact@example.test','2013-03-15']){const r=assistantStatusRequest(message,'membership');assert.equal(r.id,null);assert.equal(r.invalid,true);assert.match(assistantStatusPrompt(r.mode,r.invalid),/valid unique ID/);}
});
test('status answers project live summary fields, respect selected mode and exclude private contacts, amounts and payment access',()=>{
 const data={name:'PRIVATE_NAME',email:'PRIVATE_EMAIL',dateOfBirth:'PRIVATE_DOB',customAnswers:'PRIVATE_ANSWERS',membership:{name:'Youth Pro',type:'Group',status:'active',sessionsLeft:5,customer_name:'PRIVATE_CLIENT'},latest:{status:'Confirmed',date:'2026-10-30',service:'Small Group Training',serviceType:'Soccer',email:'PRIVATE_CONTACT'},payment:{state:'due',amountCents:12345,bookingId:'PRIVATE_BOOKING',token:'PRIVATE_TOKEN',url:'PRIVATE_LINK'}};
 const both=formatAssistantStatus(data);for(const word of ['Membership status: active','Plan: Youth Pro','Sessions remaining: 5','Latest booking status: Confirmed','Booking date: 2026-10-30','Service: Small Group Training','Service type: Soccer','Payment status: Pending payment'])assert.ok(both.includes(word),word);assert.ok(!both.includes('PRIVATE_'));assert.ok(!both.includes('12345'));
 assert.ok(!formatAssistantStatus(data,'membership').includes('Booking date'));assert.ok(!formatAssistantStatus(data,'booking').includes('Youth Pro'));
 assert.match(formatAssistantStatus({membership:null,latest:null}),/no membership found[\s\S]*no booking found/);
 assert.match(formatAssistantStatus({...data,membership:{...data.membership,status:'exhausted',sessionsLeft:0}}),/exhausted[\s\S]*Sessions remaining: 0/);
 assert.match(formatAssistantStatus({...data,payment:{state:'paid'}}),/Payment status: Completed/);
});
test('status requests require an explicit valid business slug and never fall back to another tenant',()=>{
 assert.equal(assistantStatusUrl('club-one'),'/api/booking?slug=club-one');assert.equal(assistantStatusUrl('club-two'),'/api/booking?slug=club-two');
 for(const slug of ['',undefined,'club-one&slug=club-two','../studio','club one'])assert.throws(()=>assistantStatusUrl(slug),/Choose a business/);
});
