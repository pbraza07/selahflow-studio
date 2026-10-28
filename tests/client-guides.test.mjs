import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {publicClientGuide,clientGuideIntent} from '../server/client-guides.mjs';
import {assistantStatusRequest} from '../server/assistant-status.mjs';
import {buildBusinessKnowledge,answerBusinessQuestion} from '../server/business-knowledge.mjs';
test('published guide registry uses an exact business match and a real public PDF',async()=>{
 const guide=publicClientGuide('arcillatrng');assert.equal(guide.pages,20);assert.equal(guide.href,'/guides/arcila-training-client-guide.pdf');assert.ok(Object.isFrozen(guide));
 for(const slug of ['other','arcila-test','crawford','__proto__','constructor','../arcillatrng',null,{},''])assert.equal(publicClientGuide(slug),null);
 const pdf=await readFile(new URL('../public'+guide.href,import.meta.url));assert.equal(pdf.subarray(0,5).toString(),'%PDF-');assert.ok(pdf.length>500000&&pdf.length<5000000);
});
test('instruction requests get the current business guide while live ID status requests remain intact',()=>{
 const k=buildBusinessKnowledge({slug:'arcillatrng',name:'Arcila Training'},{services:[]},[],new Date('2026-10-27T12:00:00Z'));
 for(const query of ['Booking instructions','How do I make a booking?','How do I pay?','How do I sign up for a membership?','How do I check membership status?','Step-by-step help','PDF guide','I need help with payment']){
  assert.equal(clientGuideIntent(query),true,query);const answer=answerBusinessQuestion(k,query);assert.equal(answer.sections[0].title,'Client instructions',query);assert.equal(answer.sources[0].href,publicClientGuide('arcillatrng').href);assert.equal(answer.links[0].href,publicClientGuide('arcillatrng').href);
 }
 assert.equal(assistantStatusRequest('How do I check membership status?'),null);
 assert.equal(assistantStatusRequest('Membership status').mode,'membership');assert.equal(assistantStatusRequest('How many membership credits are left?').mode,'membership');
 assert.equal(assistantStatusRequest('AB031513','booking').id,'AB031513');
 for(const query of ['What are your prices?','Membership status','How many membership credits are left?','Hours and location'])assert.equal(clientGuideIntent(query),false,query);
 const other=buildBusinessKnowledge({slug:'other-business',name:'Other Business'},{},[]);assert.doesNotMatch(JSON.stringify(answerBusinessQuestion(other,'Booking instructions')),/Arcila|arcila-training-client-guide/);
});
test('right-side help renders an accessible PDF link only for the matching business',async()=>{
 const require=createRequire(import.meta.url),url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
 let source=await readFile(new URL('../app/components/client-guide-help.tsx',import.meta.url),'utf8');source=source.replace("'../../server/client-guides.mjs'",JSON.stringify(new URL('../server/client-guides.mjs',import.meta.url).href)).replace(/import styles[^\n]+;/,'const styles={guideHelp:"guideHelp"};');
 let js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;js=js.replaceAll('"react/jsx-runtime"',JSON.stringify(pathToFileURL(require.resolve('react/jsx-runtime')).href));const {default:Help}=await import(url(js));
 const html=renderToStaticMarkup(React.createElement(Help,{slug:'arcillatrng'}));assert.match(html,/Request help/);assert.match(html,/target="_blank"/);assert.match(html,/noopener noreferrer/);assert.match(html,/<span aria-hidden="true">\?<\/span>/);assert.doesNotMatch(html,/<strong>|<small>/);assert.match(html,/href="\/guides\/arcila-training-client-guide.pdf"/);
 assert.equal(renderToStaticMarkup(React.createElement(Help,{slug:'another-business'})),'');
 const ui=await readFile(new URL('../app/components/business-assistant.tsx',import.meta.url),'utf8');assert.match(ui,/!open&&<ClientGuideHelp/);assert.match(ui,/Booking instructions \(PDF\)/);
});

test('floating help has a compact touch target and owner menus suppress both floating controls',async()=>{
 const css=await readFile(new URL('../app/components/business-assistant.module.css',import.meta.url),'utf8');
 assert.match(css,/\.guideHelp\{[^}]*width:44px;height:44px/);assert.match(css,/\.guideHelp\{[^}]*border-radius:50%/);assert.match(css,/\.root\{[^}]*pointer-events:none/);assert.match(css,/\.root\[hidden\]\{display:none\}/);
 const ui=await readFile(new URL('../app/components/business-assistant.tsx',import.meta.url),'utf8'),owner=await readFile(new URL('../app/studio/owner-dashboard.tsx',import.meta.url),'utf8');
 assert.match(ui,/className=\{styles.root\} hidden=\{hidden\} inert=\{hidden\}/);assert.match(owner,/<BusinessAssistant hidden=\{mobile\|\|modal\}/);
});
