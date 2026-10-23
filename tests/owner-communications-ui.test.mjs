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
 const frame=find(n=>n.type==='iframe');assert.ok(render().findIndex(n=>n.type==='button'&&Array.isArray(n.props.children)&&n.props.children[0]==='Send now to ')<render().findIndex(n=>n.type==='iframe'),'Send is visible before the tall preview');assert.equal(frame.props.sandbox,'');assert.match(frame.props.srcDoc,/Business-branded preview/);
 find(n=>n.type==='textarea').props.onChange({target:{value:'Changed message'}});assert.equal(find(n=>n.type==='iframe'),undefined,'editing requires a fresh preview');
 previewButton().props.onClick();await tick();
 const send=find(n=>n.type==='button'&&Array.isArray(n.props.children)&&n.props.children[0]==='Send now to ');assert.equal(send.props.disabled,false);send.props.onClick();await tick();await tick();
 assert.equal(calls.filter(x=>x.action==='send').length,1);assert.equal(calls.at(-1).campaignId,'fixture');assert.equal(find(n=>n.type==='iframe'),undefined);
 }finally{globalThis.fetch=previousFetch;if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;}
});

test('saved drafts reopen after a reload and send only after explicit confirmation; stale previews stay blocked',async()=>{
 const source=await readFile(new URL('../app/components/owner-communications.tsx',import.meta.url),'utf8'),compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const directory={setup:{staging:false,workerEnabled:true},contacts:[{id:'a'.repeat(64),email:'one@example.test',names:['One'],unsubscribed:false}],provider:{emailConfigured:true,emailProvider:'Gmail'},campaigns:[{id:'saved-draft',subject:'Saved subject',status:'draft',created_at:new Date().toISOString(),total:1,submitted:0,pending:0,failed:0,unknown:0,skipped:0}],clientCount:1,missingEmail:0,syncedAt:new Date().toISOString()};
 const state=[],exports={};let index=0,stale=false;const calls=[],confirmations=[];
 const hooks={useState:initial=>{const i=index++;if(!(i in state))state[i]=i===0?directory:initial;return [state[i],next=>state[i]=typeof next==='function'?next(state[i]):next];},useCallback:f=>f,useEffect(){}};
 new Function('require','exports',compiled)(p=>p==='react'?hooks:require(p),exports);
 const nodes=(n,out=[])=>{if(Array.isArray(n))n.forEach(x=>nodes(x,out));else if(n?.props){out.push(n);nodes(n.props.children,out);}return out;},render=()=>{index=0;return nodes(exports.default());},text=n=>n==null?'':typeof n!=='object'?String(n):Array.isArray(n)?n.map(text).join(''):text(n.props?.children),find=s=>render().find(n=>n.type==='button'&&text(n)===s),tick=()=>new Promise(r=>setImmediate(r));
 const oldFetch=globalThis.fetch,oldWindow=globalThis.window;
 globalThis.window={confirm:s=>{confirmations.push(s);return true;}};globalThis.fetch=async(u,o)=>{if(!o)return {ok:true,json:async()=>directory};const b=JSON.parse(o.body);calls.push(b);return {ok:true,json:async()=>b.action==='review'?{id:b.campaignId,subject:'Saved subject',body:'Saved message',actionLabel:'',actionUrl:'',contactIds:['a'.repeat(64)],recipientCount:1,recipients:[{email:'one@example.test',names:['One']}],html:'<html>Saved preview</html>',refreshReason:stale?'Preview expired. Create a fresh preview before sending.':''}:{ok:true,queued:1}};};
 try{
 assert.ok(find('Review & send'));find('Review & send').props.onClick();await tick();
 assert.deepEqual(calls,[{action:'review',campaignId:'saved-draft'}]);assert.equal(confirmations.length,0,'reviewing does not send');assert.ok(render().some(n=>n.type==='textarea'&&n.props.value==='Saved message'));
 find('Send now to 1 email addresses').props.onClick();await tick();await tick();assert.match(confirmations[0],/Saved subject/);assert.equal(calls.filter(c=>c.action==='send').length,1);assert.equal(calls.at(-1).campaignId,'saved-draft');
 stale=true;find('Review & send').props.onClick();await tick();assert.ok(find('Refresh preview'));assert.equal(find('Send now to 1 email addresses'),undefined,'expired review cannot send without a fresh preview');assert.equal(calls.filter(c=>c.action==='send').length,1);
 const css=await readFile(new URL('../app/globals.css',import.meta.url),'utf8');assert.match(css,/sf-communication-history tr\{display:grid/);assert.match(css,/content:attr\(data-label\)/);assert.match(css,/sf-communication-sendbar\{position:sticky/);
 }finally{globalThis.fetch=oldFetch;if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow;}
});

test('staging explains automatic campaign approval and exposes each recipient receipt without calling it delivered',async()=>{
 const source=await readFile(new URL('../app/components/owner-communications.tsx',import.meta.url),'utf8'),compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const directory={setup:{staging:true,workerEnabled:true,stagingDeliveryEnabled:true},contacts:[],provider:{emailConfigured:true,emailProvider:'Gmail'},clientCount:0,missingEmail:0,syncedAt:new Date().toISOString(),campaigns:[{id:'sent',subject:'Club update',created_at:new Date().toISOString(),status:'queued',total:2,submitted:1,pending:0,failed:1,unknown:0,skipped:0,delivery_issues:[],delivery_results:[{email:'one@example.test',status:'submitted',provider:'Gmail',providerMessageId:'receipt-one',detail:'Accepted by Gmail'},{email:'two@example.test',status:'failed',detail:'Provider rejected request'}]}]};
 const state=[],exports={};let index=0;const hooks={useState:initial=>{const i=index++;if(!(i in state))state[i]=i===0?directory:initial;return [state[i],()=>{}];},useCallback:f=>f,useEffect(){}};
 new Function('require','exports',compiled)(p=>p==='react'?hooks:require(p),exports);
 const text=n=>n==null?'':typeof n!=='object'?String(n):Array.isArray(n)?n.map(text).join(' '):text(n.props?.children);index=0;const rendered=text(exports.default());
 for(const value of ['client emails sync automatically','no Render update is needed','Recipient results','one@example.test','two@example.test','receipt-one','Finished · review recipient results','Provider acceptance does not confirm inbox delivery'])assert.ok(rendered.includes(value),value);
 assert.doesNotMatch(rendered,/administrator-approved test recipients|Finished processing/);
});
