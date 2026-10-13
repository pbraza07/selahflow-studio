import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {registrationQuestions,customRegistrationFields,validateRegistrationQuestions,validateStandardRegistration} from '../server/registration-questions.mjs';
import {sanitizeBookingAnswers,validateBookingFields} from '../server/booking-custom-fields.mjs';
import {checkSubscriptionLimits} from '../server/plan-entitlements.mjs';
const field=(id,forms)=>({id,label:id,type:'text',required:true,showInNotification:false,options:[],...(forms?{forms}:{})});
test('legacy shared questions remain on both forms and independent ordering retains stable IDs',()=>{
 const c={bookingCustomFields:[field('legacy'),field('bookingOnly',['booking']),field('membershipOnly',['membership'])],bookingQuestionOrder:['email','memberNumber','legacy'],membershipQuestionOrder:['legacy','firstName'],bookingStandardFields:{firstName:{label:'Player first name',help:'As registered'}}};
 validateBookingFields(c.bookingCustomFields,[]);validateRegistrationQuestions(c);
 assert.deepEqual(customRegistrationFields(c,'booking').map(f=>f.id),['legacy','bookingOnly']);
 assert.deepEqual(customRegistrationFields(c,'membership').map(f=>f.id),['legacy','membershipOnly']);
 assert.deepEqual(registrationQuestions(c,'booking').slice(0,3).map(f=>f.id),['email','memberNumber','legacy']);
 assert.deepEqual(registrationQuestions(c,'membership').slice(0,2).map(f=>f.id),['legacy','firstName']);
 assert.equal(registrationQuestions(c,'booking').find(f=>f.id==='firstName').label,'Player first name');
 assert.equal(registrationQuestions(c,'membership').find(f=>f.id==='firstName').label,'First name');
 assert.deepEqual(sanitizeBookingAnswers(customRegistrationFields(c,'booking'),{legacy:'yes',bookingOnly:'yes'}),{legacy:'yes',bookingOnly:'yes'});
 assert.throws(()=>sanitizeBookingAnswers(customRegistrationFields(c,'membership'),{legacy:'yes'}),/membershipOnly is required/);
});
test('standard edits/reorder consume no quota; membership-only and shared new questions cannot bypass subscription allowance',()=>{
 const five=Array.from({length:5},(_,i)=>field('q'+i,['membership']));
 const old={bookingCustomFields:five};
 assert.doesNotThrow(()=>checkSubscriptionLimits({plan_code:'free',status:'active'},old,{...old,bookingStandardFields:{email:{label:'Parent email'}},membershipQuestionOrder:['email']}));
 assert.doesNotThrow(()=>checkSubscriptionLimits({plan_code:'free',status:'active'},old,{bookingCustomFields:five.map(f=>({...f,label:'Edited',forms:['booking','membership']}))}));
 assert.throws(()=>checkSubscriptionLimits({plan_code:'free',status:'active'},old,{bookingCustomFields:[...five,field('extra',['membership'])]}),/allows up to 5/);
});
test('invalid question order, ID collisions and attempts to disable identity validation are rejected',()=>{
 for(const config of [{bookingQuestionOrder:['email','email']},{membershipQuestionOrder:['unknown']},{bookingCustomFields:[field('email')]},{bookingCustomFields:[field('bad',[])]},{bookingStandardFields:{email:{required:false}}},{bookingStandardFields:{email:{type:'text'}}},{membershipStandardFields:{memberNumber:{required:true}}}])assert.throws(()=>validateRegistrationQuestions(config));
 assert.throws(()=>validateStandardRegistration({bookingStandardFields:{phone:{required:true}}},'booking',{firstName:'A',lastName:'B',email:'a@b.com',dateOfBirth:'2000-01-01'}),/Phone is required/);
 assert.deepEqual(sanitizeBookingAnswers([{...field('date'),type:'date'}],{date:'2026-10-13'}),{date:'2026-10-13'});
});
test('rendered registration order matches keyboard/DOM order, custom labels and membership-only required questions',async()=>{
 const require=createRequire(import.meta.url);
 let source=await readFile(new URL('../app/components/registration-fields.tsx',import.meta.url),'utf8');
 source=source.replace('../../server/registration-questions.mjs',new URL('../server/registration-questions.mjs',import.meta.url).href);
 let compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 compiled=compiled.replace('"react/jsx-runtime"',JSON.stringify(pathToFileURL(require.resolve('react/jsx-runtime')).href));
 const {default:Fields}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
 const html=renderToStaticMarkup(React.createElement(Fields,{config:{membershipQuestionOrder:['email','firstName'],membershipStandardFields:{email:{label:'Parent email',help:'For receipts'}},bookingCustomFields:[field('emergency',['membership']),field('bookingOnly',['booking'])]},form:'membership',values:{},answers:{},onValue(){},onAnswer(){}}));
 assert.ok(html.indexOf('name="email"')<html.indexOf('name="firstName"'));
 assert.match(html,/Parent email/);assert.match(html,/For receipts/);assert.match(html,/name="emergency"/);assert.doesNotMatch(html,/bookingOnly/);
 assert.equal((html.match(/name="dateOfBirth"/g)||[]).length,1);
});
