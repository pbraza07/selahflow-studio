import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {JSDOM} from 'jsdom';
import ts from 'typescript';
import {ownerBookingQuote} from '../server/owner-booking-quote.mjs';
const require=createRequire(import.meta.url);
const source=readFileSync(new URL('../app/studio/owner-dashboard.tsx',import.meta.url),'utf8');
// Exercise the real dashboard dialog and callbacks, with external dashboard data supplied.
const expression=source.slice(source.indexOf('{modal&&<div className="modal-backdrop">')+1,source.indexOf('\n<BusinessAssistant hidden='));
const js=ts.transpileModule('const element=('+expression.slice(0,-1)+');',{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
const render=new Function('require','ctx','const exports={};with(ctx){'+js+';return element;}');
function nodes(root){if(!root||typeof root!=='object')return [];return [root,...React.Children.toArray(root.props?.children).flatMap(nodes)];}
const icon=()=>null;
const fieldsExports={};new Function('require','exports',ts.transpileModule(readFileSync(new URL('../app/components/owner-booking-client-fields.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText)(require,fieldsExports);
function fixture(overrides={}){
 const ctx={applyOwnerMembership:true,bookedCovered:false,setApplyOwnerMembership:()=>{},setBookedCovered:()=>{},ownerQuote:{price:90,covered:false,message:''},ownerBookingKey:{current:'stable-booking-key'},OwnerBookingClientFields:fieldsExports.default,ownerClient:{...fieldsExports.emptyOwnerBookingClient},ownerClientLookup:'',publicSlug:'test-business',setOwnerClient:()=>{},setOwnerClientLookup:()=>{},setOwnerAnswers:()=>{},modal:true,portal:false,booked:'',bookedMembershipUsage:null,step:2,config:{name:'Test Business',staff:[{id:'coach',name:'Coach'}],buffer:0,policy:'Test policy'},error:'',eligible:[{id:'coach',name:'Coach'}],provider:'coach',date:'2020-01-03',slots:[600,660],slot:null,selected:['training'],selections:[{id:'training',name:'Training'}],pastBooking:true,pastBookingReason:'',busy:false,ownerFirstAvailable:600,ownerEarliestStart:null,ownerAnswers:{},price:90,duration:60,slotRequest:{current:0},X:icon,Check:icon,Clock:icon,RegistrationFields:()=>null,timeLabel:t=>t===600?'10:00 AM':'11:00 AM',cash:n=>'$'+n,today:()=> '2026-11-05',easternClock:()=>({date:'2026-11-05'}),findBookingSession:()=>null,refresh:async()=>{},getSlots:async()=>{},...overrides};
 for(const [setter,key] of [['setApplyOwnerMembership','applyOwnerMembership'],['setBookedCovered','bookedCovered'],['setStep','step'],['setSlot','slot'],['setError','error'],['setBooked','booked'],['setBookedMembershipUsage','bookedMembershipUsage'],['setSlots','slots'],['setOwnerEarliestStart','ownerEarliestStart'],['setOwnerFirstAvailable','ownerFirstAvailable']])ctx[setter]=value=>{ctx[key]=typeof value==='function'?value(ctx[key]):value;};
 return {ctx,tree:()=>render(require,ctx)};
}
test('past booking with no note advances on time selection and submits an audited owner booking',async()=>{
 const f=fixture();let submitted;
 f.ctx.action=async payload=>{submitted=payload;return {id:'saved-past-booking'};};
 let tree=f.tree(),html=renderToStaticMarkup(tree);
 assert.match(html,/Select a time above to continue/);assert.doesNotMatch(html,/Reason for past booking|minLength/);
 assert.equal(nodes(tree).find(n=>n.type==='button'&&n.props.children==='Continue').props.disabled,true);
 nodes(tree).find(n=>n.type==='button'&&n.props['aria-pressed']===false).props.onClick();
 assert.equal(f.ctx.step,3);assert.equal(f.ctx.slot,600);
 tree=f.tree();html=renderToStaticMarkup(tree);assert.match(html,/Past booking note \(optional\)/);assert.match(html,/2020-01-03.*10:00 AM/);
 const dom=new JSDOM(html),form=dom.window.document.querySelector('form');form.elements.name.value='Past Client';form.elements.email.value='past@example.test';
 const previous=globalThis.FormData;globalThis.FormData=dom.window.FormData;
 try{await nodes(tree).find(n=>n.type==='form').props.onSubmit({preventDefault(){},currentTarget:form});}finally{globalThis.FormData=previous;dom.window.close();}
 assert.equal(submitted.action,'book');assert.equal(submitted.pastSessionOverride,true);assert.equal(submitted.overrideReason,'Owner recorded a past booking');assert.equal(submitted.start,600);assert.equal(submitted.date,'2020-01-03');assert.equal(f.ctx.booked,'saved-past-booking');
});
test('Continue with a selected past time does not require a hidden note; save errors remain in the dialog',()=>{
 const f=fixture({slot:600});let tree=f.tree();const next=nodes(tree).find(n=>n.type==='button'&&n.props.children==='Continue');assert.equal(next.props.disabled,false);next.props.onClick();assert.equal(f.ctx.step,3);
 f.ctx.error='This time is full. Choose another time.';tree=f.tree();assert.match(renderToStaticMarkup(tree),/role="alert"[^>]*>This time is full/);
 nodes(tree).find(n=>n.type==='button'&&n.props.children==='Back').props.onClick();assert.equal(f.ctx.step,2);assert.equal(f.ctx.slot,600);assert.match(renderToStaticMarkup(f.tree()),/aria-pressed="true"/);
});
test('availability refresh retains valid selection and ignores a late response after advancing',async()=>{
 const code=source.slice(source.indexOf('async function getSlots('),source.indexOf('\nuseEffect(()=>{if(modal&&step===2'));
 const compiled=ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 const f=fixture({slot:600});f.ctx.action=async()=>({slots:[600,660]});const getSlots=new Function('ctx','with(ctx){'+compiled+';return getSlots;}')(f.ctx);
 await getSlots();assert.equal(f.ctx.slot,600);
 f.ctx.action=async()=>({slots:[660]});await getSlots();assert.equal(f.ctx.slot,null);
 let resolve;f.ctx.action=()=>new Promise(r=>resolve=r);const pending=getSlots();f.ctx.slotRequest.current++;f.ctx.slot=660;f.ctx.step=3;resolve({slots:[]});await pending;assert.equal(f.ctx.slot,660);assert.equal(f.ctx.step,3);
});

test('past booking submits the loaded ID, birth date, contact and restored answers',async()=>{
 const client={memberNumber:'TD1001',name:'Taylor Doe',email:'parent@example.test',phone:'+14045550123',dateOfBirth:'2013-01-02'};
 const f=fixture({step:3,slot:600,ownerClient:client,ownerClientLookup:'loaded',ownerAnswers:{parent:'Parent Doe',level:'Advanced'}});let submitted;
 f.ctx.action=async body=>{submitted=body;return {id:'identified-booking',membershipUsage:{remaining:4}};};
 const tree=f.tree(),dom=new JSDOM(renderToStaticMarkup(tree)),form=dom.window.document.querySelector('form');
 assert.equal(nodes(tree).find(n=>n.props?.form==='booking-form').props.disabled,false);
 const previous=globalThis.FormData;globalThis.FormData=dom.window.FormData;
 try{await nodes(tree).find(n=>n.type==='form').props.onSubmit({preventDefault(){},currentTarget:form});}finally{globalThis.FormData=previous;dom.window.close();}
 assert.equal(submitted.key,'stable-booking-key');assert.equal(submitted.applyPastMembership,true);assert.match(renderToStaticMarkup(f.tree()),/1 membership session deducted/);assert.match(renderToStaticMarkup(f.tree()),/4 sessions remaining/);assert.equal(submitted.memberNumber,client.memberNumber);assert.equal(submitted.dateOfBirth,client.dateOfBirth);assert.equal(submitted.email,client.email);assert.equal(submitted.name,client.name);assert.deepEqual(submitted.customAnswers,f.ctx.ownerAnswers);assert.equal(f.ctx.booked,'identified-booking');
 f.ctx.booked='';f.ctx.ownerClientLookup='error';assert.equal(nodes(f.tree()).find(n=>n.props?.form==='booking-form').props.disabled,true);
});

test('owner past membership preview renders zero due and follows the deduction checkbox',()=>{
 const membership={pastCreditAvailable:true,sessionsLeft:10,creditEligibility:{mode:'selected',serviceIds:['training'],sessionIds:[]}};
 const f=fixture({step:3,slot:600,ownerClient:{memberNumber:'TD1001',name:'Taylor Doe',email:'parent@example.test',membership},ownerClientLookup:'loaded',selections:[{id:'training',name:'Training',price:90}]});
 const update=()=>f.ctx.ownerQuote=ownerBookingQuote({services:f.ctx.selections,membership,date:f.ctx.date,past:true,loaded:true,applyMembership:f.ctx.applyOwnerMembership});
 update();let tree=f.tree();assert.match(renderToStaticMarkup(tree),/\$0/);assert.match(renderToStaticMarkup(tree),/Covered by membership/);assert.match(renderToStaticMarkup(tree),/10 sessions remaining before this visit/);
 nodes(tree).find(n=>n.props?.name==='applyPastMembership').props.onChange({target:{checked:false}});update();assert.equal(f.ctx.ownerQuote.price,90);assert.doesNotMatch(renderToStaticMarkup(f.tree()),/Covered by membership/);
});
