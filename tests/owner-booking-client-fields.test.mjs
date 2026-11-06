import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import {resolveOwnerBookingMember} from '../server/owner-appointment-members.mjs';
const require=createRequire(import.meta.url);
function nodes(root){if(!root||typeof root!=='object')return [];return [root,...React.Children.toArray(root.props?.children).flatMap(nodes)];}
function fixture(){
 let index=0;const states=[],effects=[];const react={...React,useState:value=>{const i=index++;if(!(i in states))states[i]=value;return [states[i],next=>states[i]=typeof next==='function'?next(states[i]):next];},useEffect:fn=>effects.push(fn)};
 const exports={};new Function('require','exports',ts.transpileModule(readFileSync(new URL('../app/components/owner-booking-client-fields.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText)(id=>id==='react'?react:require(id),exports);
 const props={slug:'one-business',client:{...exports.emptyOwnerBookingClient},answers:{},lookup:'',setClient:next=>props.client=typeof next==='function'?next(props.client):next,setAnswers:next=>props.answers=next,setLookup:next=>props.lookup=next};
 return {props,render:()=>{index=0;effects.length=0;return exports.default(props);},start:()=>effects[0]()};
}
const client={memberNumber:'TD1001',firstName:'Taylor',lastName:'Doe',email:'parent@example.test',phone:'+14045550123',dateOfBirth:'2013-01-02',customAnswers:{parent:'Parent Doe',level:'Advanced',age:'U14'}};
async function withNetwork(fn){const old={fetch:globalThis.fetch,setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout};let timer;globalThis.setTimeout=fn=>{timer=fn;return 1;};globalThis.clearTimeout=()=>{timer=null;};try{await fn(()=>timer());}finally{Object.assign(globalThis,old);}}
test('owner ID lookup restores contact details and custom answers using the selected business, with native form fields',async()=>withNetwork(async run=>{
 const f=fixture();let body;globalThis.fetch=async(url,options)=>{assert.equal(url,'/api/public/member-lookup');assert.equal(options.cache,'no-store');body=JSON.parse(options.body);return {ok:true,json:async()=>client};};
 nodes(f.render()).find(n=>n.props?.name==='memberNumber').props.onChange({target:{value:'td1001'}});f.render();f.start();assert.equal(f.props.lookup,'loading');await run();
 assert.deepEqual(body,{slug:'one-business',memberNumber:'TD1001'});assert.equal(f.props.client.name,'Taylor Doe');assert.equal(f.props.client.email,client.email);assert.equal(f.props.client.phone,client.phone);assert.equal(f.props.client.dateOfBirth,client.dateOfBirth);assert.deepEqual(f.props.answers,client.customAnswers);assert.equal(f.props.lookup,'loaded');
 const html=renderToStaticMarkup(f.render());assert.match(html,/name="memberNumber"[^>]*value="TD1001"/);assert.match(html,/name="dateOfBirth" value="2013-01-02"/);assert.match(html,/Saved client details and registration answers loaded/);
}));
test('switching or clearing IDs removes old client details and ignores a stale successful lookup',async()=>withNetwork(async run=>{
 const f=fixture();let finish;globalThis.fetch=()=>new Promise(resolve=>finish=resolve);
 nodes(f.render()).find(n=>n.props?.name==='memberNumber').props.onChange({target:{value:'TD1001'}});f.render();const cleanup=f.start();const pending=run();
 nodes(f.render()).find(n=>n.props?.name==='memberNumber').props.onChange({target:{value:'AB1002'}});cleanup();finish({ok:true,json:async()=>client});await pending;
 assert.equal(f.props.client.memberNumber,'AB1002');assert.equal(f.props.client.name,'');assert.deepEqual(f.props.answers,{});assert.notEqual(f.props.lookup,'loaded');
 nodes(f.render()).find(n=>n.type==='button'&&n.props.children==='Clear ID').props.onClick();assert.equal(f.props.client.memberNumber,'');assert.equal(f.props.client.email,'');f.render();f.start();assert.equal(f.props.lookup,'');
}));
test('unknown ID shows an actionable error and manual entry remains available after clearing it',async()=>withNetwork(async run=>{
 const f=fixture();globalThis.fetch=async()=>({ok:false,json:async()=>({error:'No registration found at this business.'})});f.props.client.memberNumber='ZZ9999';f.render();f.start();await run();assert.equal(f.props.lookup,'error');assert.match(renderToStaticMarkup(f.render()),/No registration found/);assert.equal(f.props.client.name,'');
 nodes(f.render()).find(n=>n.type==='button'&&n.props.children==='Clear ID').props.onClick();nodes(f.render()).find(n=>n.props?.name==='name').props.onChange({target:{value:'New Client'}});assert.equal(f.props.client.name,'New Client');
}));
test('explicit owner booking ID disambiguates matching contacts and rejects unknown or mismatched identities',()=>{
 const roster=[{member_number:'TD1001',name:'Taylor Doe',email:'parent@example.test'},{member_number:'TD1002',name:'Taylor Doe',email:'parent@example.test'}];
 assert.equal(resolveOwnerBookingMember({memberNumber:'td1002',name:'Taylor Doe',email:'PARENT@example.test'},roster),'TD1002');
 assert.equal(resolveOwnerBookingMember({name:'Taylor Doe',email:'parent@example.test'},roster),'');
 assert.throws(()=>resolveOwnerBookingMember({memberNumber:'ZZ9999',name:'Taylor Doe',email:'parent@example.test'},roster),/not found in this business/);
 assert.throws(()=>resolveOwnerBookingMember({memberNumber:'TD1001',name:'Sibling Doe',email:'parent@example.test'},roster),/do not match/);
});
