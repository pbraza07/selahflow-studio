import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import ts from 'typescript';
const require=createRequire(import.meta.url);
const walk=(n,p)=>!n||typeof n!=='object'?[]:[...(p(n)?[n]:[]),...React.Children.toArray(n.props?.children).flatMap(c=>walk(c,p))];
function component(file,states){let index=0;const exports={},source=ts.transpileModule(readFileSync(new URL('../app/components/'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 new Function('require','exports',source)(id=>{if(id==='react')return {...React,useEffect:()=>{},useState:v=>{const i=index++;if(states[i]===undefined)states[i]=v;return [states[i],v=>states[i]=typeof v==='function'?v(states[i]):v];}};if(id.endsWith('defaults'))return {timeLabel:n=>'10:00 AM'};return require(id);},exports);
 return props=>{index=0;return exports.default(props);};
}
test('team form sends only a cancellation request with a required reason and displays owner decision',async t=>{
 const original=globalThis.fetch;t.after(()=>globalThis.fetch=original);const posts=[];let changed=0;
 globalThis.fetch=async(url,options)=>{if(options?.method==='POST')posts.push({url,body:JSON.parse(options.body)});return {ok:true,json:async()=>({ok:true,requests:[]})};};
 const states=[[],'','',false,'',''],render=component('team-cancellation-requests.tsx',states),props={appointments:[{id:'visit',date:'2030-01-02',start:600,name:'Synthetic Client',services:['Service'],status:'Confirmed'}],onChanged:()=>{changed++;}};
 let tree=render(props);assert.ok(renderToStaticMarkup(tree).includes('owner must approve'));walk(tree,n=>n.type==='select')[0].props.onChange({target:{value:'visit'}});walk(tree,n=>n.type==='textarea')[0].props.onChange({target:{value:'Schedule conflict'}});
 await walk(render(props),n=>n.type==='form')[0].props.onSubmit({preventDefault(){}});
 assert.deepEqual(posts,[{url:'/api/team/cancellations',body:{appointmentId:'visit',reason:'Schedule conflict'}}]);assert.equal(changed,1);assert.ok(renderToStaticMarkup(render(props)).includes('appointment remains active'));
 states[0]=[{id:'request',appointment_id:'visit',reason:'Schedule conflict',snapshot:{customerName:'Synthetic Client',date:'2030-01-02',start:600},status:'pending'}];assert.equal(walk(render(props),n=>n.type==='form').length,0);assert.ok(renderToStaticMarkup(render(props)).includes('Awaiting owner approval'));
 states[0][0].status='approved';assert.ok(renderToStaticMarkup(render(props)).includes('Approved - appointment cancelled'));
});
test('owner review requires explicit cancellation confirmation and submits separate approve/decline decisions',async t=>{
 const oldFetch=globalThis.fetch,oldWindow=globalThis.window;t.after(()=>{globalThis.fetch=oldFetch;globalThis.window=oldWindow;});const posts=[];let confirmed=false,changed=0,events=0;
 globalThis.window={confirm:()=>confirmed,dispatchEvent:()=>events++};globalThis.fetch=async(url,options)=>{if(options?.method==='POST')posts.push(JSON.parse(options.body));return {ok:true,json:async()=>({requests:[]})};};
 const states=[[{id:'request',snapshot:{customerName:'Synthetic Client',date:'2030-01-02',start:600,services:['Service']},reason:'Schedule conflict',staff_name:'Alex',status:'pending',appointment_status:'Confirmed',payment_status:'paid'}],'','',''];const render=component('owner-cancellation-requests.tsx',states),props={onChanged:()=>changed++};
 let tree=render(props);assert.ok(renderToStaticMarkup(tree).includes('does not automatically refund'));
 await walk(tree,n=>n.type==='button'&&n.props.children==='Approve cancellation')[0].props.onClick();assert.equal(posts.length,0);
 confirmed=true;await walk(render(props),n=>n.type==='button'&&n.props.children==='Approve cancellation')[0].props.onClick();assert.deepEqual(posts[0],{id:'request',accept:true,confirmed:true});assert.equal(changed,1);assert.equal(events,1);
});
