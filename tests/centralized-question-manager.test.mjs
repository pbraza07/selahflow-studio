import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {registrationQuestions,validateRegistrationQuestions,questionNotificationEnabled,registrationNotificationLines} from '../server/registration-questions.mjs';
const root=new URL('../',import.meta.url),require=createRequire(import.meta.url);
async function manager(initial){
 const source=await readFile(new URL('app/components/registration-question-settings.tsx',root),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={},state=[];let index=0,config=structuredClone(initial);
 new Function('require','exports',compiled)(path=>path==='react'?{useState:initial=>{const i=index++;if(!(i in state))state[i]=initial;return [state[i],next=>{state[i]=typeof next==='function'?next(state[i]):next;}];}}:path.endsWith('registration-questions.mjs')?{registrationQuestions,questionNotificationEnabled}:require(path),exports);
 const render=()=>{index=0;return exports.default({config,setConfig:update=>{config=typeof update==='function'?update(config):update;},limit:25});};
 const nodes=(node,found=[])=>{if(!node||typeof node!=='object')return found;if(Array.isArray(node)){for(const child of node)nodes(child,found);}else if(node.props){found.push(node);nodes(node.props.children,found);}return found;};
 return {render,nodes,get config(){return config;},find:predicate=>nodes(render()).find(predicate)};
}
const fixture={services:[{id:'soccer',name:'Soccer'},{id:'camp',name:'Camp'}],bookableSessions:[{id:'weekend',service:'soccer',date:'2030-10-25',questionRequired:{health:true}}],bookingQuestionOrder:['health'],membershipQuestionOrder:['health'],bookingQuestionNotifications:{health:false},membershipQuestionNotifications:{health:true},bookingCustomFields:[{id:'health',label:'Health information',type:'text',required:false,showInNotification:false,forms:['booking','membership']}],bookingPushFields:['customerName','date']};
test('one question manager owns all creation/editing; service, session and membership pages have no duplicate editors',async()=>{
 const dash=await readFile(new URL('app/studio/owner-dashboard.tsx',root),'utf8'),membership=await readFile(new URL('app/components/owner-memberships.tsx',root),'utf8');
 assert.equal((dash.match(/<RegistrationQuestionSettings /g)||[]).length,1);
 assert.match(dash,/data-sf-settings-group="questions"><RegistrationQuestionSettings/);
 assert.doesNotMatch(dash,/sessionQuestionEditor|serviceQuestionEditor|Edit service questions|Edit session questions|Standard notification fields/);
 assert.doesNotMatch(membership,/onEditQuestions|Edit membership questions/);
});
test('standard and custom questions expose independent required/notification controls in the single manager',async()=>{
 const m=await manager(fixture),nodes=m.nodes(m.render());
 const required=nodes.filter(n=>n.props['aria-label']?.startsWith('Required: ')),notify=nodes.filter(n=>n.props['aria-label']?.startsWith('Show in notifications: '));
 assert.equal(required.length,7);assert.equal(notify.length,7);
 const save=nodes.find(n=>n.type==='button'&&n.props.children==='Save questions');assert.equal(save.props.type,'submit');
 m.find(n=>n.props['aria-label']==='Required: Health information').props.onChange({target:{checked:true}});
 assert.equal(m.config.bookingCustomFields[0].required,true);assert.equal(m.config.bookingQuestionNotifications.health,false);
 m.find(n=>n.props['aria-label']==='Show in notifications: Health information').props.onChange({target:{checked:true}});
 m.find(n=>n.props['aria-label']==='Required: Email').props.onChange({target:{checked:false}});
 assert.equal(m.config.bookingCustomFields[0].required,true);assert.equal(m.config.bookingStandardFields.email.required,false);
 assert.deepEqual(registrationNotificationLines(m.config,'booking',{}, {health:'Answer'}).filter(x=>x.startsWith('Health')),['Health information: Answer']);
 validateRegistrationQuestions(m.config);
});
test('central service/session scopes preserve required overrides and newly-created question targets',async()=>{
 const m=await manager(fixture);
 m.find(n=>n.type==='select'&&n.props.value==='all').props.onChange({target:{value:'service:soccer'}});
 m.find(n=>n.type==='button'&&Array.isArray(n.props.children)&&n.props.children[0]==='+ Add ').props.onClick();
 assert.deepEqual(m.config.bookingCustomFields.at(-1).serviceIds,['soccer']);
 m.find(n=>n.props['aria-label']==='Required: Phone').props.onChange({target:{checked:true}});
 assert.equal(m.config.services[0].questionRequired.phone,true);assert.equal(m.config.services[1].questionRequired,undefined);
 m.find(n=>n.type==='select'&&n.props.value==='service:soccer').props.onChange({target:{value:'session:weekend'}});
 assert.equal(m.find(n=>n.props['aria-label']==='Required: Health information').props.checked,true);
 m.find(n=>n.type==='button'&&Array.isArray(n.props.children)&&n.props.children[0]==='+ Add ').props.onClick();
 assert.deepEqual(m.config.bookingCustomFields.at(-1).sessionIds,['weekend']);validateRegistrationQuestions(m.config);
});
test('changing a question to membership-only cleans obsolete booking references without erasing membership choices',async()=>{
 const m=await manager(fixture);
 m.find(n=>n.type==='select'&&n.props.value==='both').props.onChange({target:{value:'membership'}});
 assert.equal(m.config.bookingQuestionNotifications.health,undefined);assert.equal(m.config.membershipQuestionNotifications.health,true);
 assert.deepEqual(m.config.bookableSessions[0].questionRequired,{});assert.equal(m.config.bookingQuestionOrder.includes('health'),false);
 validateRegistrationQuestions(m.config);assert.equal(registrationQuestions(m.config,'booking').some(f=>f.id==='health'),false);
 assert.equal(registrationQuestions(m.config,'membership').some(f=>f.id==='health'),true);
});

test('owners can uncheck every identity Required control and service overrides really make questions optional',async()=>{
 const m=await manager(fixture);
 for(const label of ['First name','Last name','Date of birth']){
  const control=m.find(n=>n.props['aria-label']==='Required: '+label);
  assert.equal(control.props.disabled,undefined);
  control.props.onChange({target:{checked:false}});
 }
 for(const id of ['firstName','lastName','dateOfBirth'])assert.equal(registrationQuestions(m.config,'booking').find(f=>f.id===id).required,false);
 const service={...fixture,services:[{id:'soccer',questionRequired:{firstName:false,lastName:false,dateOfBirth:false,email:false}}]};
 assert.equal(registrationQuestions(service,'booking',null,['soccer']).some(f=>f.standard&&f.required),false);
 const multi={...service,services:[...service.services,{id:'camp'}]};
 assert.equal(registrationQuestions(multi,'booking',null,['soccer','camp']).find(f=>f.id==='firstName').required,true);
 validateRegistrationQuestions(m.config);
});

test('a service-scoped optional override is not made required by another unrelated selected service',()=>{
 const config={services:[{id:'soccer',questionRequired:{size:false}},{id:'camp'}],bookingCustomFields:[{id:'size',label:'Size',type:'text',required:true,serviceIds:['soccer']}]};
 assert.equal(registrationQuestions(config,'booking',null,['soccer','camp']).find(f=>f.id==='size').required,false);
});
