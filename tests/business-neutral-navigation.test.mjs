import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import {onboardingPreset} from '../server/onboarding-presets.mjs';
import {registrationQuestions} from '../server/registration-questions.mjs';
import {workspaceGroups,workspaceLabels,filteredWorkspaceGroups} from '../server/workspace-navigation.mjs';
import * as social from '../server/business-social-links.mjs';
const require=createRequire(import.meta.url),read=f=>readFile(new URL('../'+f,import.meta.url),'utf8');
async function component(file,path='/'){
 const source=ts.transpileModule(await read(file),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const module={exports:{}};
 const load=id=>id.endsWith('.css')?new Proxy({},{get:(_,key)=>String(key)}):id==='next/navigation'?{usePathname:()=>path}:id==='next/link'?{__esModule:true,default:({children,...props})=>React.createElement('a',props,children)}:id.endsWith('business-social-links.mjs')?social:require(id);
 new Function('require','module','exports',source)(load,module,module.exports);return module.exports;
}
const hrefs=html=>[...html.matchAll(/href="([^"]+)"/g)].map(m=>m[1]);
test('platform navigation gives clients and owners explicit destinations, with the same desktop/mobile paths',async()=>{
 const {default:Navigation}=await component('app/components/public-navigation.tsx','/discover');
 const html=renderToStaticMarkup(React.createElement(Navigation));
 const navs=[...html.matchAll(/<nav\b[^>]*>([\s\S]*?)<\/nav>/g)].map(m=>m[1]);assert.equal(navs.length,2);assert.deepEqual(hrefs(navs[0]),hrefs(navs[1]));
 for(const path of ['/discover','/customers#visit-help','/businesses','/pricing','/login','/signup','/privacy'])assert.ok(hrefs(navs[0]).includes(path),path);
 assert.equal((html.match(/href="\/privacy"/g)||[]).length,2);assert.match(html,/Business sign in/);assert.match(html,/Client help/);assert.match(html,/aria-current="page"/);
});
test('business navigation stays in the selected business and the status path works from later booking steps',async()=>{
 const {default:Navigation}=await component('app/components/business-navigation.tsx','/book/tenant-one');
 const html=renderToStaticMarkup(React.createElement(Navigation,{slug:'tenant-one',name:'Business One'}));
 for(const path of ['/tenant-one','/book/tenant-one','/membership/tenant-one','/book/tenant-one?view=status#registration-status','/discover','/login'])assert.ok(hrefs(html).includes(path),path);
 assert.match(html,/Book a service/);assert.match(html,/Business owner sign in/);
 assert.doesNotMatch(html,/\/tenant-two|Book a session|Check registration/);
 const custom=renderToStaticMarkup(React.createElement(Navigation,{slug:'tenant-one',name:'Business One',bookLabel:'Reserve equipment'}));assert.match(custom,/Reserve equipment/);
 const source=await read('app/components/business-navigation.tsx');assert.match(source,/window.location.reload\(\)/,'Repeated status navigation resets the booking flow to the status panel');
});
test('generic defaults and new-business instructions cover unrelated industries while preserving configured content',async()=>{
 const defaults=(await component('lib/defaults.ts')).defaultSettings;
 assert.doesNotMatch(JSON.stringify([defaults.name,defaults.tagline,defaults.greeting,defaults.services.map(x=>x.name),defaults.staff.map(x=>x.role)]),/salon|stylist|barber|haircut|grooming/i);
 assert.ok(defaults.services.some(s=>s.id==='cut'),'Legacy service IDs remain stable');
 for(const industry of ['hair','pet-grooming','landscaping','accounting','sports-coaching','other']){
  const preset=onboardingPreset(industry);assert.equal(preset.bookingOwnerLoginLabel,'Business owner sign in');assert.equal(preset.bookingHeadline,'Choose a service and a time.');assert.equal(preset.services.length,3);
 }
 const base=registrationQuestions({},'booking').find(x=>x.id==='memberNumber');assert.match(base.label,/Client ID/);assert.equal(base.required,false);
 const custom=registrationQuestions({bookingStandardFields:{memberNumber:{label:'Reference number',help:'Use your saved reference.'}}},'booking').find(x=>x.id==='memberNumber');assert.equal(custom.label,'Reference number');assert.equal(custom.help,'Use your saved reference.');
});
test('owner destinations keep their stable keys and search both new labels and familiar names',()=>{
 const keys=workspaceGroups.flatMap(g=>g.items);assert.equal(keys.length,12);assert.equal(new Set(keys).size,12);
 for(const key of keys)assert.ok(workspaceLabels[key]);
 assert.ok(filteredWorkspaceGroups('calendar').flatMap(g=>g.items).includes('Calendar'));
 assert.ok(filteredWorkspaceGroups('client assistant').flatMap(g=>g.items).includes('Receptionist'));
 assert.ok(filteredWorkspaceGroups('payment').flatMap(g=>g.items).includes('Checkout'));
});
test('booking status does not imply a membership is required or invent a zero credit balance',async()=>{
 const {default:Result}=await component('app/components/registration-lookup-result.tsx');
 const html=renderToStaticMarkup(React.createElement(Result,{membership:null,result:{status:'Submitted',date:'2026-12-01',service:'Equipment reservation'}}));
 assert.match(html,/Equipment reservation/);assert.match(html,/Latest booking/);assert.doesNotMatch(html,/0 sessions left/);
 const status=await read('app/customer/booking/page.tsx');assert.match(status,/No booking selected/);assert.match(status,/setReady\(true\)/);assert.match(status,/Find a business/);
});
