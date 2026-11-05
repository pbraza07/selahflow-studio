import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {JSDOM} from 'jsdom';
import ts from 'typescript';
process.env.NODE_ENV='test';
const React=await import('react'),{act}=React,require=createRequire(import.meta.url),rootPath=new URL('../',import.meta.url).pathname;
function componentLoader(){
 const cache=new Map();
 function load(file){
  if(cache.has(file))return cache.get(file);
  if(file.endsWith('.mjs'))return require(file);
  const exp={};cache.set(file,exp);
  const source=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  const local=id=>{
   if(id.endsWith('.css'))return {__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})};
   if(id==='./owner-term-tracker')return {__esModule:true,default:()=>null};
   if(!id.startsWith('.'))return require(id);
   let target=path.resolve(path.dirname(file),id);if(!path.extname(target))for(const ext of ['.ts','.tsx','.json'])if(existsSync(target+ext)){target+=ext;break;}
   return target.endsWith('.json')?JSON.parse(readFileSync(target,'utf8')):load(target);
  };
  new Function('require','exports',source)(local,exp);return exp;
 }
 return load;
}

test('financial summary tables retain exact amounts, stage filters and paid/activity drill-downs',async()=>{
 const dom=new JSDOM('<div id="app"></div>',{pretendToBeVisual:true,url:'https://example.test/studio/example'});
 const old={window:globalThis.window,document:globalThis.document,fetch:globalThis.fetch,IS_REACT_ACT_ENVIRONMENT:globalThis.IS_REACT_ACT_ENVIRONMENT};
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true});
 dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new window.Event('close'));};
 globalThis.fetch=async()=>Response.json({rows:[{id:'request',reference:'r1',source:'Booking',category:'submitted',date:'2026-11-04',client:'Synthetic client',description:'Long service description',amountCents:12345678912,basis:'Quoted price'}]});
 const {createRoot}=await import('react-dom/client'),root=createRoot(document.querySelector('#app'));
 const payment={id:'paid',kind:'membership_payment',client:'Synthetic client',memberNumber:'S1001',created:'2026-11-04T15:00:00Z',planName:'Private Academy',paymentMethod:'Stripe',total:320};
 const appointment={id:'booking',date:'2026-11-04',start:600,name:'Synthetic client',services:['Private session'],status:'Confirmed',staff:'coach',duration:60,estimatedAmount:25};
 const props={appointments:[appointment],allAppointments:[appointment],projected:[appointment],upcoming:[appointment],sales:[],memberships:[payment],allPaid:[payment],range:'This month',onRange(){},onExport(){},onReset:async()=>{},businessName:'Fixture business',config:{services:[],staff:[{id:'coach',name:'Coach'}]},selectedDate:'2026-11-04'};
 const click=async(el)=>{assert.ok(el);await act(async()=>el.click());};
 const table=label=>document.querySelector(`table[aria-label="${label}"]`);
 try{
  const Reports=componentLoader()(rootPath+'app/components/owner-reports.tsx').default;
  await act(async()=>root.render(React.createElement(Reports,props)));
  assert.equal(table('Payment stages').querySelectorAll('tbody tr').length,4);
  assert.equal(table('Revenue summary').querySelectorAll('tbody tr').length,4);
  const revenueRows=[...table('Revenue summary').querySelectorAll('tbody tr')];
  assert.deepEqual(revenueRows.map(row=>row.querySelector('.sf-money').textContent),['$320.00','$320.00','$25.00','$25.00']);
  assert.match(revenueRows[1].textContent,/included in paid revenue/);
  assert.match(table('Payment stages').textContent,/\$123,456,789\.12/);
  assert.equal(table('Financial transactions').querySelectorAll('tbody tr').length,2);
  await click(document.querySelector('button[aria-label="View submitted details"]'));
  assert.equal(table('Financial transactions').querySelectorAll('tbody tr').length,1);
  assert.match(table('Financial transactions').textContent,/\$123,456,789\.12/);
  await click(document.querySelector('button[aria-label="View paid details"]'));
  assert.equal(table('Financial transactions').querySelectorAll('tbody tr').length,1);
  assert.match(table('Financial transactions').textContent,/Private Academy/);
  assert.equal(table('Recorded transactions').querySelector('.sf-money').textContent,'$320.00');
  await click(document.querySelector('button[aria-label="View Paid revenue details"]'));
  assert.equal(document.querySelector('dialog').open,true);
  assert.equal(document.querySelector('#sf-report-modal-title').textContent,'Paid revenue');
  assert.match(document.querySelector('dialog').textContent,/Total recorded payments: \$320\.00/);
  await click(document.querySelector('button[aria-label="Close report details"]'));
  await click(document.querySelector('button[aria-label="View Booked / scheduled details"]'));
  assert.equal(document.querySelector('#sf-report-modal-title').textContent,'Booked / scheduled');
  assert.match(document.querySelector('dialog').textContent,/Private session/);
  assert.equal(document.querySelector('dialog').querySelector('.sf-money').textContent,'$25.00');
  const currencyCells=[...document.querySelectorAll('.sf-money')];
  assert.ok(currencyCells.every(cell=>!cell.querySelector('br')));
 }finally{await act(async()=>root.unmount());dom.window.close();Object.assign(globalThis,old);}
});

test('shared metric layout prevents global button flex from squeezing values into adjacent text',()=>{
 const css=readFileSync(new URL('../app/responsive.css',import.meta.url),'utf8');
 const block=css.match(/\.app-shell \.stat,\.sf-team-shell \.stat,\.public-page \.stat\{([^}]+)\}/)?.[1];
 assert.ok(block,'Shared stat selector covers owner, team and public surfaces');
 assert.match(block,/flex-direction:column/);assert.match(block,/align-items:stretch/);
 const money=css.match(/body \.sf-money\{([^}]+)\}/)?.[1];
 assert.match(money,/white-space:nowrap/);assert.match(money,/font-variant-numeric:tabular-nums/);
 const module=readFileSync(new URL('../app/components/owner-reports.module.css',import.meta.url),'utf8');
 assert.match(module,/\.table table\{[^}]*min-width:720px/);
 assert.match(module,/\.table \.amount\{[^}]*text-align:right/);
});
