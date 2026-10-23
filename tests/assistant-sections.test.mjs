import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {groupAssistantDocuments} from '../server/assistant-sections.mjs';
import {assistantStatusSections} from '../server/assistant-status.mjs';
import {answerBusinessQuestion} from '../server/business-knowledge.mjs';
test('published answers group every selected document once and keep sources associated with their subsection',()=>{
 const documents=[{id:'s1',kind:'service',title:'Soccer',text:'Price: $35',href:'/book/club'},{id:'m1',kind:'membership',title:'Monthly',text:'Four sessions',href:'/membership/club'},{id:'s2',kind:'service',title:'Camp',text:'Price: $70',href:'/book/club'}];
 const groups=groupAssistantDocuments(documents);
 assert.deepEqual(groups.map(g=>g.title),['Services and prices','Membership plans']);
 assert.deepEqual(groups[0].items.map(i=>i.title),['Soccer','Camp']);
 assert.equal(groups[1].items[0].href,'/membership/club');
 const answer=answerBusinessQuestion({name:'Club',documents,links:[]},'Everything');
 assert.deepEqual(answer.sections,groups);assert.match(answer.answer,/Soccer[\s\S]*Monthly[\s\S]*Camp/);
 assert.deepEqual(answerBusinessQuestion({name:'Club',documents:[],links:[]},'Unknown').sections,[]);
});
test('all published content kinds receive clear topic headings, including individual waiver clauses and session dates',()=>{
 const kinds=['overview','contact','hours','policy','payment','wording','team','question','waiver','session','membership-rules','membership-wording'];
 const groups=groupAssistantDocuments(kinds.map((kind,i)=>({kind,title:kind==='session'?'Soccer · 2026-10-30':'Detail '+i,text:'Published detail',href:'/club'})));
 assert.equal(groups.length,kinds.length);assert.ok(groups.some(g=>g.title==='Waiver and consent'));assert.equal(groups.find(g=>g.title==='Upcoming sessions').items[0].title,'Soccer · 2026-10-30');
});
test('combined status answers separate membership and booking without expanding private-field access',()=>{
 const data={membership:{name:'Youth',status:'active',sessionsLeft:4,email:'PRIVATE'},latest:{status:'Confirmed',date:'2026-10-30'},payment:{state:'paid',token:'PRIVATE',amountCents:12345}};
 const sections=assistantStatusSections(data);
 assert.deepEqual(sections.map(s=>s.title),['Membership status','Latest booking status']);
 assert.match(sections[0].items[0].text,/Sessions remaining: 4/);assert.ok(!sections[0].items[0].text.includes('Booking'));
 assert.match(sections[1].items[0].text,/Payment status: Completed/);assert.ok(!JSON.stringify(sections).includes('PRIVATE'));assert.ok(!JSON.stringify(sections).includes('12345'));
 assert.equal(assistantStatusSections(data,'booking').length,1);assert.equal(assistantStatusSections(data,'membership').length,1);
});
test('answer renderer uses labeled, initially collapsed native disclosures and escapes published text',async()=>{
 let source=ts.transpileModule(await readFile(new URL('../app/components/assistant-answer.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React}}).outputText;
 source='const React=globalThis.__assistantSectionsReact;\n'+source.replace(/import styles[^\n]+;/,'const styles={sections:"sections",subsection:"subsection",sectionBody:"body",text:"text"};');
 globalThis.__assistantSectionsReact=React;
 try{
  const Component=(await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).default;
  const html=renderToStaticMarkup(React.createElement(Component,{sections:[{title:'Services and prices',items:[{title:'Soccer',text:'<script>test</script> $35',href:'/book/club'},{title:'Camp',text:'$70'}]}]}));
  assert.match(html,/<h3>Services and prices<\/h3>/);assert.equal((html.match(/<details/g)||[]).length,2);assert.ok(!/<details[^>]*\bopen/.test(html));assert.match(html,/<summary>Soccer<\/summary>/);assert.match(html,/&lt;script&gt;/);assert.match(html,/href="\/book\/club"/);
 }finally{delete globalThis.__assistantSectionsReact;}
});
