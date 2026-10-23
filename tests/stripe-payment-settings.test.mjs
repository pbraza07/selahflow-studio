import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

test('Stripe settings render loading, unavailable, onboarding and ready states without submitting business settings',async()=>{
 const require=createRequire(import.meta.url),source=await readFile(new URL('../app/components/owner-stripe-payments.tsx',import.meta.url),'utf8');
 for(const [status,expected,connect,verify] of [[null,'Loading Stripe payment settings',false,false],[{configured:false,connected:false,ready:false},'Platform setup required',true,false],[{configured:true,connected:false,ready:false},'Connect your business Stripe account',true,false],[{configured:true,connected:true,ready:false},'verify onboarding and payment readiness',true,true],[{configured:true,connected:true,ready:true},'ready to accept payments',true,true]]){
  let compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
  compiled=compiled.replace(/import BusinessCommissions[^\n]+;/,'const BusinessCommissions=()=>null;').replace(/import \{ useCallback, useEffect, useState \} from 'react';/,`let stateIndex=0; const useState=initial=>[stateIndex++===0?${JSON.stringify(status)}:initial,()=>{}];const useEffect=()=>{};const useCallback=f=>f;`)
   .replace(/import \{[^\n]+\} from 'lucide-react';/,`const CreditCard=()=>null,RefreshCw=()=>null,ShieldCheck=()=>null;`)
   .replace('"react/jsx-runtime"',JSON.stringify(pathToFileURL(require.resolve('react/jsx-runtime')).href));
  const {default:Settings}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
  const html=renderToStaticMarkup(React.createElement(Settings));
  assert.ok(html.includes(expected),expected);
  assert.match(html,/aria-expanded="false" aria-controls="sf-stripe-setup-help"/);
  assert.match(html,/<section id="sf-stripe-setup-help"[^>]*hidden=""/);
  assert.ok(html.includes('Business owners do not need to configure server API keys or webhooks.'));
  assert.ok(html.includes('Returning to SelahFlow alone does not confirm approval.'));
  assert.equal(/<button[^>]*>(?:Connect Stripe payments|Complete Stripe setup)<\/button>/.test(html),connect);
  assert.equal(/<button[^>]*> Verify Stripe<\/button>/.test(html),verify);
  for(const button of html.matchAll(/<button\b[^>]*>/g))assert.ok(button[0].includes('type="button"'));
  if(status&&!status.configured)assert.match(html,/<button[^>]*disabled=""/);
 }
});
test('one Stripe setup entry is wired under Settings and onboarding returns reopen that category',async()=>{
 const [dashboard,memberships,css]=await Promise.all(['app/studio/owner-dashboard.tsx','app/components/owner-memberships.tsx','app/globals.css'].map(p=>readFile(new URL('../'+p,import.meta.url),'utf8')));
 assert.match(dashboard,/id:'payments',title:'Stripe payments'/);
 assert.match(dashboard,/settingsTab==='payments'&&<OwnerStripePayments\/>/);
 assert.match(dashboard,/status==='connected'\|\|status==='retry'/);
 assert.match(dashboard,/setViewState\('Settings'\);setSettingsTab\('payments'\)/);
 assert.match(dashboard,/<OwnerMemberships onOpenPayments=/);
 assert.match(css,/data-settings-tab="payments"\] \[data-sf-settings-group="payments"\]/);
 assert.doesNotMatch(memberships,/async function (connect|verify)\(|onClick=\{(connect|verify)\}|Secure membership payments/);
 assert.match(memberships,/onClick=\{onOpenPayments\}/);
});

test('Complete Stripe setup requests a fresh link, navigates to Stripe and retains a usable fallback',async(t)=>{
 const source=await readFile(new URL('../app/components/owner-stripe-payments.tsx',import.meta.url),'utf8');
 let compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 compiled=compiled.replace(/import BusinessCommissions[^\n]+;/,'const BusinessCommissions=()=>null;').replace(/import \{ useCallback, useEffect, useState \} from 'react';/,`let index=0;export const writes=[];const useState=initial=>{const i=index++;return [i===0?{configured:true,connected:true,ready:false}:initial,value=>writes.push([i,value])];};const useEffect=()=>{};const useCallback=f=>f;`)
 .replace(/import \{[^\n]+\} from 'lucide-react';/,`const CreditCard=()=>null,RefreshCw=()=>null,ShieldCheck=()=>null;`)
 .replace(/import \{[^\n]+\} from "react\/jsx-runtime";/,`const _jsx=(type,props)=>({type,props}),_jsxs=_jsx,_Fragment='fragment';`);
 const {default:Settings,writes}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
 const buttons=[];function visit(n){if(!n||typeof n!=='object')return;if(n.type==='button')buttons.push(n);for(const c of [n.props?.children].flat(Infinity))visit(c);}visit(Settings());
 const connect=buttons.find(b=>b.props.children?.includes('Complete Stripe setup'));
 assert.ok(connect);
 const destinations=[],requests=[];
 const previousWindow=globalThis.window;globalThis.window={location:{assign:url=>destinations.push(url)}};
 t.after(()=>{if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;});
 let response={url:'https://accounts.stripe.com/r/acct_existing#one-use'};
 t.mock.method(globalThis,'fetch',async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>response};});
 await connect.props.onClick();
 assert.equal(requests[0].url,'/api/studio/memberships');
 assert.deepEqual(JSON.parse(requests[0].options.body),{action:'connect'});
 assert.equal(requests[0].options.method,'POST');
 assert.deepEqual(destinations,[response.url]);
 assert.ok(writes.some(([i,v])=>i===2&&v===response.url),'fallback URL survives an interrupted navigation');
 assert.ok(writes.some(([i,v])=>i===3&&v===false),'button can be retried if navigation does not happen');
 response={url:'https://connect.stripe.com.evil.test/'};
 await connect.props.onClick();
 assert.equal(destinations.length,1);
 assert.ok(writes.some(([i,v])=>i===4&&/Unexpected payment onboarding/.test(v)));
});
