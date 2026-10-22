import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createRequire} from 'node:module';import ts from 'typescript';
const require=createRequire(import.meta.url);
test('Settings communications editor selects contacts, previews before sending and invalidates changed previews',async()=>{
 const source=await readFile(new URL('../app/components/owner-communications.tsx',import.meta.url),'utf8'),compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const directory={setup:{staging:false,workerEnabled:true,stagingDeliveryEnabled:true},contacts:[{id:'a'.repeat(64),email:'one@example.test',names:['Client One'],unsubscribed:false},{id:'b'.repeat(64),email:'blocked@example.test',names:['Unsubscribed'],unsubscribed:true}],clientCount:2,missingEmail:0,syncedAt:new Date().toISOString(),business:'Club',provider:{emailConfigured:true,emailProvider:'Gmail'},campaigns:[]};
 const state=[],exports={};let index=0;
 const hooks={useState:initial=>{const i=index++;if(!(i in state))state[i]=i===0?directory:initial;return [state[i],next=>state[i]=typeof next==='function'?next(state[i]):next];},useCallback:fn=>fn,useEffect(){}};
 new Function('require','exports',compiled)(path=>path==='react'?hooks:require(path),exports);
 const nodes=(n,out=[])=>{if(Array.isArray(n))n.forEach(x=>nodes(x,out));else if(n?.props){out.push(n);nodes(n.props.children,out);}return out;};
 const render=()=>{index=0;return nodes(exports.default());},find=p=>render().find(p),tick=()=>new Promise(r=>setImmediate(r));
 const previousFetch=globalThis.fetch,previousWindow=globalThis.window,calls=[];
 globalThis.window={confirm:()=>true};globalThis.fetch=async(url,opts)=>{if(!opts)return {ok:true,json:async()=>directory};const b=JSON.parse(opts.body);calls.push(b);return {ok:true,json:async()=>b.action==='preview'?{id:'fixture',recipientCount:1,recipients:[{email:'one@example.test',names:['Client One']}],html:'<html>Business-branded preview</html>'}:{ok:true,queued:1}};};
 try{
 assert.equal(render().filter(n=>n.type==='input'&&n.props.type==='checkbox').length,1,'unsubscribed contacts have no selectable checkbox');
 find(n=>n.props['aria-label']==='Email Client One').props.onChange({target:{checked:true}});
 find(n=>n.type==='input'&&n.props.maxLength===180).props.onChange({target:{value:'Club update'}});
 find(n=>n.type==='textarea').props.onChange({target:{value:'Hello {{client_name}}'}});
 const previewButton=()=>find(n=>n.type==='button'&&n.props.children==='Preview email & recipients');assert.equal(previewButton().props.disabled,false);previewButton().props.onClick();await tick();
 assert.equal(calls.length,1);assert.equal(calls[0].action,'preview');assert.deepEqual(calls[0].contactIds,['a'.repeat(64)]);
 const frame=find(n=>n.type==='iframe');assert.equal(frame.props.sandbox,'');assert.match(frame.props.srcDoc,/Business-branded preview/);
 find(n=>n.type==='textarea').props.onChange({target:{value:'Changed message'}});assert.equal(find(n=>n.type==='iframe'),undefined,'editing requires a fresh preview');
 previewButton().props.onClick();await tick();
 const send=find(n=>n.type==='button'&&Array.isArray(n.props.children)&&n.props.children[0]==='Send to ');assert.equal(send.props.disabled,false);send.props.onClick();await tick();await tick();
 assert.equal(calls.filter(x=>x.action==='send').length,1);assert.equal(calls.at(-1).campaignId,'fixture');assert.equal(find(n=>n.type==='iframe'),undefined);
 }finally{globalThis.fetch=previousFetch;if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;}
});
