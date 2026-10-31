import test from 'node:test';
import assert from 'node:assert/strict';
import {renderOnboarding} from './helpers/render-onboarding.mjs';
import {PLAN_CATALOG} from '../server/plan-entitlements.mjs';

test('each signup package renders its exact price and benefits alongside Google and email choices',()=>{
 for(const [code,plan]of Object.entries(PLAN_CATALOG)){
  const html=renderOnboarding({plan:code});
  for(const text of ['Continue with Google','Continue with email',plan.name,(plan.monthlyCents/100).toFixed(2),...plan.included])assert.ok(html.includes(text.replaceAll('&','&amp;')),code+': '+text);
  assert.doesNotMatch(html,/Make payment ·/);
 }
});
test('agreement step exposes a labelled contract dialog, explicit review and disabled unsigned continuation',()=>{
 const html=renderOnboarding({step:3});
 assert.match(html,/Read the contract &amp; fee disclaimer/);assert.match(html,/<dialog/);assert.match(html,/<fieldset[^>]*disabled/);assert.match(html,/Sign &amp; save agreement/);assert.doesNotMatch(html,/Make payment ·/);
 const text=renderOnboarding({document:true});assert.match(text,/\$24\.99 USD per month/);assert.match(text,/10%/);assert.match(text,/\$5 minimum/);assert.match(text,/Make payment/);assert.match(text,/Primary administrator approval/);assert.match(text,/Up to 3 bookable team members/);
});
test('payment CTA appears only after saved registration and Free signup never requests a charge',()=>{
 assert.doesNotMatch(renderOnboarding({step:4,registered:false}),/Make payment ·/);
 assert.match(renderOnboarding({step:4,registered:true}),/Make payment · \$24\.99\/month/);
 assert.match(renderOnboarding({step:4,registered:true,plan:'business'}),/Make payment · \$69\.99\/month/);
 const free=renderOnboarding({step:4,registered:true,plan:'free'});assert.match(free,/No card or payment is required/);assert.doesNotMatch(free,/Make payment ·/);
});

test('returning payment setup loads a matching package agreement without erasing a current draft',async()=>{
 const {readFile}=await import('node:fs/promises'),ts=await import('typescript');
 const source=await readFile(new URL('../app/settings/package/page.tsx',import.meta.url),'utf8');
 const load=source.slice(source.indexOf(' async function load(){'),source.indexOf('\n useEffect'));
 const js=ts.default.transpileModule(load,{compilerOptions:{target:ts.default.ScriptTarget.ES2022}}).outputText;
 let agreement={planCode:'professional',signatureName:'Old draft'},plan;
 const run=new Function('fetch','setInfo','setPlan','setAgreement','blankAcceptance',js+';return load();');
 const fetcher=async()=>Response.json({requestedPlan:'business'});
 const blank=planCode=>({planCode,signatureName:''});
 await run(fetcher,()=>{},p=>plan=p,fn=>agreement=fn(agreement),blank);assert.equal(plan,'business');assert.equal(agreement.planCode,'business');assert.equal(agreement.signatureName,'');
 agreement.signatureName='Current draft';await run(fetcher,()=>{},p=>plan=p,fn=>agreement=fn(agreement),blank);assert.equal(agreement.signatureName,'Current draft');
});
