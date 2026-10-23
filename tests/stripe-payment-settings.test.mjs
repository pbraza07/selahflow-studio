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
  compiled=compiled.replace(/import \{ useCallback, useEffect, useState \} from 'react';/,`let stateIndex=0; const useState=initial=>[stateIndex++===0?${JSON.stringify(status)}:initial,()=>{}];const useEffect=()=>{};const useCallback=f=>f;`)
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
