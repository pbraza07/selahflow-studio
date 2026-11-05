import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import ts from 'typescript';
import {containDialogFocus} from '../server/dialog-focus.mjs';
import {workspaceDestinations,activeWorkspaceSection,filteredWorkspaceGroups} from '../server/workspace-navigation.mjs';
process.env.NODE_ENV='test';
const React=await import('react');
const {act}=React,require=createRequire(import.meta.url),rootPath=new URL('../',import.meta.url).pathname;

test('task destinations preserve original settings routes and translated search discovers the right tools',()=>{
 assert.deepEqual(workspaceDestinations.Sessions,{view:'Settings',area:'sessions'});
 assert.deepEqual(workspaceDestinations.Team,{view:'Settings',area:'team'});
 assert.deepEqual(workspaceDestinations.Payments,{view:'Settings',area:'payments'});
 for(const [area,key] of [['team','Team'],['team-access','Team'],['sessions','Sessions'],['payments','Payments'],['notifications','Settings']])assert.equal(activeWorkspaceSection('Settings',area),key);
 for(const term of ['equipe','equipo','funcionários'])assert.ok(filteredWorkspaceGroups(term).flatMap(g=>g.items).includes('Team'));
 assert.ok(filteredWorkspaceGroups('sesiones').flatMap(g=>g.items).includes('Sessions'));
 assert.ok(filteredWorkspaceGroups('pagamentos').flatMap(g=>g.items).includes('Payments'));
});

test('modal focus wraps, blocks background focus, handles Escape and restores opener without changing form values',()=>{
 const dom=new JSDOM('<button id="open">Open</button><section id="modal" tabindex="-1"><button id="close">Close</button><input value="Draft client"><button id="last">Continue</button></section>',{pretendToBeVisual:true});
 const doc=dom.window.document,open=doc.querySelector('#open'),dialog=doc.querySelector('#modal');let closed=0;
 open.focus();const dispose=containDialogFocus(dialog,()=>closed++);
 assert.equal(doc.activeElement.id,'close');
 doc.activeElement.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true,cancelable:true}));assert.equal(doc.activeElement.id,'last');
 doc.activeElement.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));assert.equal(doc.activeElement.id,'close');
 open.focus();assert.equal(doc.activeElement.id,'close');
 doc.activeElement.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert.equal(closed,1);
 assert.equal(doc.querySelector('input').value,'Draft client');dispose();assert.equal(doc.activeElement,open);assert.equal(doc.body.style.overflow,'');dom.window.close();
});

test('stacked legacy dialogs handle only the top Escape and defer to native modal dialogs',()=>{
 const dom=new JSDOM('<button id="open">Open</button><section id="one" tabindex="-1"><button>One</button><section id="two" tabindex="-1"><button>Two</button></section></section>',{pretendToBeVisual:true});
 const doc=dom.window.document;let one=0,two=0;
 const a=containDialogFocus(doc.querySelector('#one'),()=>one++),b=containDialogFocus(doc.querySelector('#two'),()=>two++);
 doc.activeElement.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert.deepEqual([one,two],[0,1]);
 const native=doc.createElement('dialog');native.open=true;doc.body.append(native);
 doc.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert.deepEqual([one,two],[0,1]);
 native.remove();b();a();dom.window.close();
});

function componentLoader(){
 const cache=new Map();
 function load(file){
  if(cache.has(file))return cache.get(file);
  if(file.endsWith('.mjs'))return require(file);
  const exp={};cache.set(file,exp);
  const source=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  const local=id=>{
   if(id==='next/dynamic')return {__esModule:true,default:()=>props=>props.customDates?React.createElement('output',{'data-report':true},JSON.stringify({range:props.range,dates:props.customDates})):null};
   if(file.endsWith('owner-dashboard.tsx')&&id.startsWith('../components/'))return {__esModule:true,default:()=>null,TeamCalendarDialog:()=>null};
   if(!id.startsWith('.'))return require(id);
   let target=path.resolve(path.dirname(file),id);if(!path.extname(target))for(const ext of ['.ts','.tsx','.json'])if(existsSync(target+ext)){target+=ext;break;}
   return target.endsWith('.json')?JSON.parse(readFileSync(target,'utf8')):load(target);
  };
  new Function('require','exports',source)(local,exp);return exp;
 }
 return load;
}

test('real owner React interactions open settings aliases, actionable metrics and retain session drafts after failed saves',async()=>{
 const dom=new JSDOM('<div id="app"></div>',{pretendToBeVisual:true,url:'https://example.test/studio/example'});
 const old={window:globalThis.window,document:globalThis.document,fetch:globalThis.fetch,IS_REACT_ACT_ENVIRONMENT:globalThis.IS_REACT_ACT_ENVIRONMENT};
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true});window.HTMLElement.prototype.scrollIntoView=()=>{};window.scrollTo=()=>{};window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});window.confirm=()=>false;
 const load=componentLoader(),config=structuredClone(load(rootPath+'lib/defaults.ts').defaultSettings);config.bookableSessions=[];config.name='Fixture Business';
 const posts=[];globalThis.fetch=async(url,options={})=>{
  if(options.method==='POST'){posts.push(JSON.parse(options.body));return Response.json({error:'Service is required.'},{status:422});}
  return Response.json(String(url)==='/api/studio'?{config,appointments:[],events:[]}:{business:{slug:'fixture',teamLimit:5}});
 };
 const {createRoot}=await import('react-dom/client');const root=createRoot(document.querySelector('#app'));
 const button=name=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===name);
 const click=async b=>{assert.ok(b);await act(async()=>b.click());};
 try{
  const Owner=load(rootPath+'app/studio/owner-dashboard.tsx').default;await act(async()=>root.render(React.createElement(Owner,{businessSlug:'fixture'})));
  await click(button('Payment setup'));assert.equal(document.querySelector('form').dataset.settingsTab,'payments');assert.equal(document.querySelector('[aria-current=page]').textContent,'Payment setup');
  await click(button('Team management'));assert.equal(document.querySelector('form').dataset.settingsTab,'team');
  await click(button('Bookable sessions'));assert.equal(document.querySelector('form').dataset.settingsTab,'sessions');
  await click(button('Create session'));assert.match(document.body.textContent,/Unsaved/);
  await act(async()=>document.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));
  assert.equal(posts.at(-1).action,'settings');assert.equal(posts.at(-1).config.bookableSessions.length,1);
  assert.match(document.querySelector('[role=alert]').textContent,/Service is required/);assert.match(document.querySelector('[role=alert]').textContent,/still here/);
  await click(button('Dashboard'));assert.equal(document.querySelector('form').dataset.settingsTab,'sessions','Cancel navigation keeps the draft');
  await act(async()=>{window.history.replaceState(null,'','#reports');window.dispatchEvent(new window.HashChangeEvent('hashchange'));});
  assert.equal(document.querySelector('form').dataset.settingsTab,'sessions','Payment notification navigation also preserves an unsaved draft when cancelled');
  window.confirm=()=>true;await click(button('Dashboard'));
  const revenue=document.querySelectorAll('.sf-stat-action')[1];await click(revenue);
  const report=JSON.parse(document.querySelector('[data-report]').textContent);assert.equal(report.range,'Custom date range');assert.equal(report.dates.from,report.dates.to);
  await click(button('Dashboard'));
  await act(async()=>{window.dispatchEvent(new window.HashChangeEvent('hashchange'));});
  assert.ok(document.querySelector('[data-report]'),'Payment notification hash opens Reports');
  await act(async()=>{window.history.replaceState(null,'','#booking-notifications');window.dispatchEvent(new window.HashChangeEvent('hashchange'));});
  assert.equal(document.querySelector('[aria-current=page]').textContent,'Dashboard','Request notification hash opens the dashboard inbox');
 }finally{await act(async()=>root.unmount());dom.window.close();Object.assign(globalThis,old);}
});

test('sortable tables keep canonical values, sorting and row actions inside a labelled keyboard-scroll region',async()=>{
 const dom=new JSDOM('<div id="app"></div>',{pretendToBeVisual:true,url:'https://example.test'}),old={window:globalThis.window,document:globalThis.document,IS_REACT_ACT_ENVIRONMENT:globalThis.IS_REACT_ACT_ENVIRONMENT};
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true});
 const {createRoot}=await import('react-dom/client'),root=createRoot(document.querySelector('#app'));
 const Table=componentLoader()(rootPath+'app/components/sortable-table.tsx').default;let opened='';
 const h=React.createElement;
 try{
  await act(async()=>root.render(h(Table,{'aria-label':'Customer history'},h('thead',null,h('tr',null,h('th',null,'Name'),h('th',null,'Actions'))),h('tbody',null,...['Zoe','Alex'].map(name=>h('tr',{key:name},h('td',null,name),h('td',null,h('button',{onClick:()=>opened=name},'Open '+name))))))));
  assert.equal(document.querySelector('[role=region]').tabIndex,0);assert.equal(document.querySelector('[role=region]').getAttribute('aria-label'),'Customer history');
  await act(async()=>document.querySelector('th button').click());assert.equal(document.querySelector('tbody td').textContent,'Alex');
  await act(async()=>document.querySelector('tbody button').click());assert.equal(opened,'Alex');
  await act(async()=>document.querySelector('th button').click());assert.equal(document.querySelector('tbody td').textContent,'Zoe');
 }finally{await act(async()=>root.unmount());dom.window.close();Object.assign(globalThis,old);}
});
