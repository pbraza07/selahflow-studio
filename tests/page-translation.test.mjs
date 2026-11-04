import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import React,{act,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {createPageTranslator,createCopyTranslator,validLanguage,languages} from '../server/page-translation.mjs';
const catalog={Save:'Guardar',Paid:'Pagado',Pending:'Pendiente','Email address':'Correo electrónico','Book a service':'Reservar un servicio','{0} of {1} spaces remaining':'{0} de {1} plazas disponibles'};
const wait=()=>new Promise(resolve=>setTimeout(resolve,45));
function page(html){return new JSDOM(`<!doctype html><body>${html}</body>`,{pretendToBeVisual:true,url:'https://example.test'});}
test('locales map to the requested regional language tags and flag assets',()=>{
 assert.deepEqual(languages.map(({code,tag,flag})=>[code,tag,flag]),[['en','en-US','us'],['es','es-ES','es'],['pt','pt-BR','br']]);
 assert.equal(validLanguage('de'),'en');assert.equal(validLanguage(null),'en');
 for(const {flag} of languages)assert.match(readFileSync(new URL(`../public/flags/${flag}.svg`,import.meta.url),'utf8'),/<svg/);
});
test('copy lookup preserves whitespace, variable values and unknown business copy',()=>{
 const t=createCopyTranslator(catalog);
 assert.equal(t('  Book a service\n'),'  Reservar un servicio\n');
 assert.equal(t('3 of 6 spaces remaining'),'3 de 6 plazas disponibles');
 assert.equal(t('Save:'),'Guardar:');assert.equal(t('Example Business LLC'),'Example Business LLC');
 assert.equal(t('AB031513'),'AB031513');assert.equal(t('$12.50'),'$12.50');
 assert.equal(t('__proto__'),'__proto__');
});
test('translator preserves form values, URLs, IDs, editable content and protected names',()=>{
 const dom=page('<p id="label">Save</p><input id="input" value="Paid" placeholder="Email address"><textarea>Paid</textarea><div contenteditable>Paid</div><strong translate="no">Paid</strong><pre>Paid</pre><a href="/Paid" data-id="Paid" title="Save">Book a service</a><select><option>Paid</option><option value="pending">Pending</option></select>');
 const doc=dom.window.document,tr=createPageTranslator(doc.body);tr.setCatalog(catalog);
 assert.equal(doc.querySelector('#label').textContent,'Guardar');
 assert.equal(doc.querySelector('#input').value,'Paid');assert.equal(doc.querySelector('#input').placeholder,'Correo electrónico');
 for(const selector of ['textarea','[contenteditable]','[translate=no]','pre'])assert.equal(doc.querySelector(selector).textContent,'Paid');
 assert.equal(doc.querySelector('a').getAttribute('href'),'/Paid');assert.equal(doc.querySelector('a').dataset.id,'Paid');assert.equal(doc.querySelector('a').title,'Guardar');
 assert.deepEqual([...doc.querySelectorAll('option')].map(option=>[option.value,option.textContent]),[['Paid','Paid'],['pending','Pendiente']]);
 tr.setCatalog({});assert.equal(doc.querySelector('#label').textContent,'Save');assert.equal(doc.querySelector('#input').placeholder,'Email address');tr.dispose();dom.window.close();
});
test('new modal nodes, asynchronous errors, React text updates and attribute reuse translate then restore correctly',async()=>{
 const dom=page('<div id="app"><p>Pending</p><input placeholder="Email address"></div>'),doc=dom.window.document,tr=createPageTranslator(doc.body);tr.setCatalog(catalog);
 const text=doc.querySelector('p').firstChild;assert.equal(text.data,'Pendiente');text.data='Paid';
 doc.querySelector('input').setAttribute('placeholder','Save');
 const dialog=doc.createElement('dialog');dialog.innerHTML='<button>Save</button>';doc.body.append(dialog);await wait();
 assert.equal(text.data,'Pagado');assert.equal(doc.querySelector('input').placeholder,'Guardar');assert.equal(dialog.textContent,'Guardar');
 tr.setCatalog({});assert.equal(text.data,'Paid');assert.equal(doc.querySelector('input').placeholder,'Save');assert.equal(dialog.textContent,'Save');
 tr.dispose();dialog.firstChild.firstChild.data='Save';await wait();assert.equal(dialog.textContent,'Save');dom.window.close();
});
test('real React reconciliation retains handlers, controlled fields, conditional nodes and language restoration',async()=>{
 const dom=page('<div id="app"></div>'),old={window:globalThis.window,document:globalThis.document,IS_REACT_ACT_ENVIRONMENT:globalThis.IS_REACT_ACT_ENVIRONMENT};
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true});
 const errors=[],root=createRoot(document.querySelector('#app'),{onUncaughtError:error=>errors.push(error)});
 let update;function Form(){const [paid,setPaid]=useState(false);update=setPaid;return React.createElement('div',null,React.createElement('button',{onClick:()=>setPaid(true)},paid?'Paid':'Pending'),!paid&&React.createElement('span',null,'Book a service'),React.createElement('input',{value:'AB031513',onChange:()=>{},placeholder:'Email address'}));}
 let tr;
 try{await act(async()=>root.render(React.createElement(Form)));tr=createPageTranslator(document.body);tr.setCatalog(catalog);
  const button=document.querySelector('button');assert.equal(button.textContent,'Pendiente');
  await act(async()=>button.click());await wait();assert.equal(button.textContent,'Pagado');assert.equal(document.querySelector('span'),null);assert.equal(document.querySelector('input').value,'AB031513');
  await act(async()=>update(false));await wait();assert.equal(document.querySelector('span').textContent,'Reservar un servicio');
  tr.setCatalog({});assert.equal(button.textContent,'Pending');assert.equal(document.querySelector('input').placeholder,'Email address');assert.deepEqual(errors,[]);
 }finally{tr?.dispose();await act(async()=>root.unmount());dom.window.close();Object.assign(globalThis,old);}
});
test('both bundled catalogs contain complete matching keys and business-critical translations',()=>{
 const es=JSON.parse(readFileSync(new URL('../public/i18n/es.json',import.meta.url))),pt=JSON.parse(readFileSync(new URL('../public/i18n/pt.json',import.meta.url)));
 assert.deepEqual(Object.keys(es).sort(),Object.keys(pt).sort());assert.ok(Object.keys(es).length>5000);
 assert.equal(es['Membership/Packages'],'Membresías/Paquetes');assert.equal(pt['Membership/Packages'],'Assinaturas/Pacotes');
 assert.equal(es['Make Payment'],'Realizar pago');assert.equal(pt['Make Payment'],'Efetuar pagamento');
 for(const pack of [es,pt])for(const [key,value] of Object.entries(pack)){assert.equal(typeof value,'string');assert.ok(value.trim(),key);assert.deepEqual((key.match(/\{\d+\}/g)||[]).sort(),(value.match(/\{\d+\}/g)||[]).sort(),key);}
});
test('page titles, date labels and native confirmations translate without changing their return values',()=>{
 const dom=page('<p>Wed, Nov 4, 2026</p>'),doc=dom.window.document;doc.title='Book a service';
 const calls=[];const confirm=message=>{calls.push(message);return false;};dom.window.confirm=confirm;
 const tr=createPageTranslator(doc.documentElement);tr.setCatalog({...catalog,Wed:'Mié',November:'Noviembre'});
 assert.equal(doc.title,'Reservar un servicio');assert.equal(doc.querySelector('p').textContent,'Mié, Noviembre 4, 2026');
 assert.equal(dom.window.confirm('Book a service'),false);assert.deepEqual(calls,['Reservar un servicio']);
 tr.setCatalog({});assert.equal(doc.title,'Book a service');assert.equal(doc.querySelector('p').textContent,'Wed, Nov 4, 2026');
 tr.dispose();assert.equal(dom.window.confirm,confirm);dom.window.close();
});
test('selector remembers language, retries load failures, ignores stale responses and synchronizes tabs',async()=>{
 const dom=page('<main><h1>Book a service</h1><div id="app"></div></main>');
 const names=['window','document','localStorage','fetch','IS_REACT_ACT_ENVIRONMENT'],old=Object.fromEntries(names.map(name=>[name,globalThis[name]]));
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,IS_REACT_ACT_ENVIRONMENT:true});
 const require=createRequire(import.meta.url),exports={};
 const code=ts.transpileModule(readFileSync(new URL('../app/components/language-selector.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const helpers=await import('../server/page-translation.mjs');
 new Function('require','exports',code)(id=>id.endsWith('app-version')?{APP_VERSION:'test'}:id.endsWith('page-translation.mjs')?helpers:require(id),exports);
 let calls=0,resolvePortuguese;globalThis.fetch=async(url,options)=>{
  assert.match(url,/^\/i18n\/(es|pt)\.json\?v=test$/);assert.equal(options.credentials,'same-origin');calls++;
  if(calls===1)throw Error('Offline');
  if(url.includes('/pt.'))return new Promise(resolve=>{resolvePortuguese=()=>resolve({ok:true,json:async()=>({'Book a service':'Agendar um serviço'})});});
  return {ok:true,json:async()=>catalog};
 };
 const root=createRoot(document.querySelector('#app'));
 try{
  await act(async()=>root.render(React.createElement(exports.default)));
  const button=language=>document.querySelector(`button[aria-label="${language}"]`);
  await act(async()=>button('Español').click());assert.match(document.querySelector('[role=status]').textContent,/Unable to load/);assert.equal(document.querySelector('h1').textContent,'Book a service');
  await act(async()=>button('Español').click());assert.equal(document.documentElement.lang,'es-ES');assert.equal(document.querySelector('h1').textContent,'Reservar un servicio');assert.equal(localStorage.getItem(helpers.LANGUAGE_STORAGE_KEY),'es');
  await act(async()=>button('Português').click());await act(async()=>button('English').click());
  await act(async()=>resolvePortuguese());assert.equal(document.documentElement.lang,'en-US');assert.equal(document.querySelector('h1').textContent,'Book a service');
  await act(async()=>window.dispatchEvent(new window.StorageEvent('storage',{key:helpers.LANGUAGE_STORAGE_KEY,newValue:'es'})));
  assert.equal(document.documentElement.lang,'es-ES');assert.equal(document.querySelector('h1').textContent,'Reservar un servicio');assert.equal(calls,3);
  await act(async()=>button('English').click());assert.equal(document.querySelector('h1').textContent,'Book a service');
 }finally{await act(async()=>root.unmount());dom.window.close();Object.assign(globalThis,old);}
});
