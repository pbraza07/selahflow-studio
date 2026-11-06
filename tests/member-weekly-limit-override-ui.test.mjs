import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {JSDOM} from 'jsdom';
import ts from 'typescript';
process.env.NODE_ENV='test';
const React=await import('react'),{act}=React,require=createRequire(import.meta.url);
const source=ts.transpileModule(readFileSync(new URL('../app/components/owner-memberships.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
const exported={};
new Function('require','exports',source)(id=>{
 if(id==='../../server/registration-questions.mjs')return {customRegistrationFields:()=>[]};
 if(id==='./sortable-table')return {__esModule:true,default:({children})=>React.createElement('table',null,children)};
 if(id==='./membership-modal')return {__esModule:true,default:({children})=>React.createElement('section',null,children)};
 if(id.startsWith('./'))return {__esModule:true,default:()=>null};
 return require(id);
},exported);
const member=(id,plan_id,extra={})=>({id,plan_id,customer_name:id==='weekly'?'Alex Example':'Jamie Example',customer_email:id+'@example.test',member_number:id.toUpperCase(),plan_name:plan_id,price_cents:10000,sessions_included:5,sessions_used:1,recorded_sessions:1,history:[],status:'active',paid_through:'2030-03-01',weekly_limit_override:false,billing_type:'membership',...extra});
async function fixture(){
 const dom=new JSDOM('<div id="app"></div>',{url:'https://example.test/studio/example',pretendToBeVisual:true}),globals=['window','document','navigator','Event','fetch','IS_REACT_ACT_ENVIRONMENT'],old=Object.fromEntries(globals.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 for(const [k,v] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,Event:dom.window.Event,IS_REACT_ACT_ENVIRONMENT:true}))Object.defineProperty(globalThis,k,{value:v,configurable:true,writable:true});
 const state={enabled:false,fail:false,hold:false,deleted:false,posted:null,resolvePost:null,deferGet:false,resolveGet:null},calls=[];
 const payload=()=>({plans:[{id:'weekly-plan',name:'Weekly',weeklySessions:1,active:true,priceCents:10000,interval:'month',sessionsIncluded:5},{id:'monthly-plan',name:'Monthly',weeklySessions:null,active:true,priceCents:10000,interval:'month',sessionsIncluded:5}],members:[member('weekly','weekly-plan',{weekly_sessions:1,weekly_limit_override:state.enabled}),member('monthly','monthly-plan',{weekly_sessions:null,status:'canceled',stripe_account_id:'acct_fixture',stripe_subscription_id:'sub_fixture'})],groups:[],planBenefits:{name:'Business',limits:{membershipPlans:10}},payments:{configured:true,connected:true,ready:true},creditOptions:{services:[],sessions:[]},memberIdPolicy:'initials_birthdate',businessName:'Example'});
 globalThis.fetch=async(url,options={})=>{
  calls.push({url,options});
  if(options.method==='POST'){
   state.posted=JSON.parse(options.body);
   if(state.hold)await new Promise(resolve=>{state.resolvePost=resolve;});
   if(state.posted.action==='deleteMember'&&!state.fail)state.deleted=true;
   if(state.fail)return Response.json({error:'Weekly limit could not be saved.'},{status:400});
   state.enabled=state.posted.enabled;return Response.json({ok:true,weeklyLimitOverride:state.enabled});
  }
  if(url.startsWith('/api/booking'))return Response.json({config:{}});
  const body=payload();if(state.deleted)body.members=body.members.filter(m=>m.id!=='monthly');
  if(state.deferGet){state.deferGet=false;await new Promise(resolve=>{state.resolveGet=resolve;});}
  return Response.json(body);
 };
 const {createRoot}=await import('react-dom/client'),root=createRoot(document.querySelector('#app'));
 await act(async()=>root.render(React.createElement(exported.default,{slug:'example',onOpenPayments:()=>{}})));
 const checkbox=id=>document.getElementById('weekly-limit-override-'+id);
 return {state,calls,checkbox,click:async id=>{await act(async()=>checkbox(id).click());},refresh:async()=>{await act(async()=>window.dispatchEvent(new Event('focus')));},cleanup:async()=>{await act(async()=>root.unmount());dom.window.close();for(const k of globals){if(old[k])Object.defineProperty(globalThis,k,old[k]);else delete globalThis[k];}}};
}
test('per-member weekly override saves on change, keeps other members unchanged and survives refresh without widening the table',async()=>{
 const f=await fixture();try{
  const control=f.checkbox('weekly'),monthly=f.checkbox('monthly');
  assert.equal(control.checked,false);assert.equal(control.disabled,false);assert.equal(monthly.disabled,true);
  assert.equal(document.querySelectorAll('thead th').length,4);
  assert.equal(control.closest('td').cellIndex,1);
  const name=control.getAttribute('aria-labelledby').split(' ').map(id=>document.getElementById(id).textContent).join(' ');
  assert.equal(name,'Override weekly session limit Alex Example');
  assert.match(document.getElementById(control.getAttribute('aria-describedby')).textContent,/Remaining credits and membership dates still apply/);
  await f.click('weekly');
  assert.deepEqual(f.state.posted,{action:'setWeeklyLimitOverride',id:'weekly',enabled:true});
  assert.equal(f.checkbox('weekly').checked,true);assert.equal(f.checkbox('monthly').checked,false);
  assert.match(f.checkbox('weekly').closest('td').textContent,/Weekly session limit overridden for this member/);
  await f.refresh();assert.equal(f.checkbox('weekly').checked,true);
  await f.click('weekly');assert.equal(f.state.posted.enabled,false);assert.equal(f.checkbox('weekly').checked,false);
  assert.match(f.checkbox('weekly').closest('td').textContent,/Weekly session limit restored for this member/);
 }finally{await f.cleanup();}
});
test('saving blocks repeat clicks, retains the saved state on failure and ignores stale background responses',async()=>{
 const f=await fixture();try{
  f.state.hold=true;
  await f.click('weekly');assert.equal(f.checkbox('weekly').disabled,true);assert.equal(f.checkbox('weekly').checked,false);
  assert.match(f.checkbox('weekly').closest('td').textContent,/Saving weekly limit/);
  await f.click('weekly');assert.equal(f.calls.filter(x=>x.options.method==='POST').length,1);
  await act(async()=>f.state.resolvePost());assert.equal(f.checkbox('weekly').checked,true);
  f.state.hold=false;f.state.fail=true;await f.click('weekly');
  assert.equal(f.checkbox('weekly').checked,true);assert.equal(f.checkbox('weekly').disabled,false);
  assert.equal(f.checkbox('weekly').closest('td').querySelector('[role=alert]').textContent,'Weekly limit could not be saved.');
  f.state.fail=false;f.state.deferGet=true;
  await act(async()=>{window.dispatchEvent(new Event('focus'));});
  await f.click('weekly');assert.equal(f.checkbox('weekly').checked,false);
  await act(async()=>f.state.resolveGet());assert.equal(f.checkbox('weekly').checked,false,'Old polling response cannot overwrite the newly saved override');
 }finally{await f.cleanup();}
});
test('translated override copy preserves the member identity and checkbox value',async()=>{
 const f=await fixture();const {createPageTranslator}=await import('../server/page-translation.mjs');let translator;
 try{
  await f.click('weekly');translator=createPageTranslator(document.documentElement);
  for(const language of ['es','pt']){
   translator.setCatalog(JSON.parse(readFileSync(new URL('../public/i18n/'+language+'.json',import.meta.url),'utf8')));
   const control=f.checkbox('weekly'),name=control.getAttribute('aria-labelledby').split(' ').map(id=>document.getElementById(id).textContent).join(' ');
   assert.match(name,language==='es'?/Ignorar el límite semanal de sesiones Alex Example/:/Ignorar o limite semanal de sessões Alex Example/);
   assert.equal(control.checked,true);assert.equal(control.id,'weekly-limit-override-weekly');
   assert.doesNotMatch(document.getElementById(control.getAttribute('aria-describedby')).textContent,/Remaining credits/);
  }
 }finally{translator?.dispose();await f.cleanup();}
});

test('Stripe-managed pending membership offers provider verification instead of manual confirmation',async()=>{
 const f=await fixture();try{
  const button=[...document.querySelectorAll('button')].find(b=>b.textContent==='Check payment / activation');assert.ok(button);
  await act(async()=>button.click());assert.equal(f.state.posted.action,'checkPayment');assert.equal(f.state.posted.id,'monthly');
  assert.ok(![...document.querySelectorAll('button')].some(b=>b.textContent==='Confirm membership payment'));
 }finally{await f.cleanup();}
});

test('canceled member deletion uses in-app confirmation, retains visible errors and blocks duplicate submissions',async()=>{
 const f=await fixture();try{
  window.prompt=()=>{throw Error('Browser prompts must not be used');};
  const button=[...document.querySelectorAll('button')].filter(b=>b.textContent==='Delete member')[1];
  await act(async()=>button.click());assert.equal(f.state.posted,null);
  const form=document.querySelector('form'),input=form.querySelector('input'),submit=()=>form.querySelector('button[type=submit]');
  assert.match(form.textContent,/canceled memberships with used sessions/);
  assert.match(form.textContent,/Existing bookings and required accounting records are retained/);
  assert.equal(submit().disabled,true);
  await act(async()=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  assert.equal(f.state.posted,null);
  await act(async()=>{Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(input,' delete ');input.dispatchEvent(new Event('input',{bubbles:true}));});
  assert.equal(submit().disabled,false);
  f.state.fail=true;
  await act(async()=>submit().click());
  assert.deepEqual(f.state.posted,{action:'deleteMember',id:'monthly',confirmPhrase:'DELETE'});
  assert.equal(form.querySelector('[role=alert]').textContent,'Weekly limit could not be saved.');
  await f.refresh();assert.ok(form.querySelector('[role=alert]'),'Polling does not erase deletion errors');
  f.state.fail=false;f.state.hold=true;
  await act(async()=>submit().click());assert.equal(submit().disabled,true);
  await act(async()=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  assert.equal(f.calls.filter(c=>c.options.method==='POST').length,2);
  await act(async()=>f.state.resolvePost());
  assert.equal(document.querySelector('form'),null);
  assert.equal(document.querySelectorAll('tbody tr').length,1);
  assert.match(document.body.textContent,/Membership deleted for Jamie Example/);
 }finally{await f.cleanup();}
});

 test('package editor exposes total sessions, optional validity and client visibility while preserving membership schedules',async()=>{
 const f=await fixture();try{
  await act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Create membership or package').click());
  const field=text=>[...document.querySelectorAll('label')].find(l=>l.textContent.trim().startsWith(text));
  assert.ok(field('Usage schedule'));
  await act(async()=>{const select=field('Offer type').querySelector('select');select.value='package';select.dispatchEvent(new Event('change',{bubbles:true}));});
  assert.ok(field('Total sessions in package'));assert.equal(field('Usage schedule'),undefined);
  await act(async()=>field('Limit time to use sessions').querySelector('input').click());assert.equal(field('Valid for days after confirmed payment').querySelector('input').value,'90');
  await act(async()=>field('Hide from clients').querySelector('input').click());
  await act(async()=>document.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  assert.equal(f.state.posted.billingType,'package');assert.equal(f.state.posted.packageValidDays,90);assert.equal(f.state.posted.hiddenFromClients,true);assert.equal(f.state.posted.weeklySessions,null);
 }finally{await f.cleanup();}
});
