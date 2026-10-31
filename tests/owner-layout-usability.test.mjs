import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {renderWorkspace} from './helpers/render-workspace.mjs';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('real owner dashboard renders everyday destinations and all existing navigation',()=>{
 const html=renderWorkspace();
 for(const label of ['View schedule','Find a client','Create a session','Business settings','Owner guide','Financial reports','Account security'])assert.ok(html.includes(label),label);
 assert.match(html,/aria-label="Everyday tasks"/);
});
test('session setup renders contained fields and phone category selector without reschedule controls',()=>{
 const html=renderWorkspace({view:'Settings'});
 for(const label of ['Choose what to update','Bookable sessions','Small Group Session','First session date','Remove session','Save business settings'])assert.ok(html.includes(label),label);
 assert.doesNotMatch(html,/sf-session-change|KEEP ALL REGISTERED CUSTOMERS|sf-reschedule-dialog|Reschedule · keep customers/);
 assert.ok(html.indexOf('value="business"')<html.indexOf('value="sessions"'));
});
test('team calendar toolbar exposes share and preview with the public friendly profile URL',()=>{
 const html=renderWorkspace({team:true});
 assert.match(html,/Share page/);assert.match(html,/Preview my page/);
 assert.match(html,/href="\/team\/example-alex" target="_blank" rel="noopener noreferrer"/);
 assert.doesNotMatch(html,/href="\/team\/private-account-id/);
});
test('team sharing handles native success, cancellation, clipboard and manual fallback without client or workspace data',async()=>{
 const source=await read('app/team/workspace/page.tsx');
 const share=source.slice(source.indexOf(' async function share(){'),source.indexOf('\n const portrait'));
 const ts=await import('typescript');const js=ts.default.transpileModule(share,{compilerOptions:{target:ts.default.ScriptTarget.ES2022}}).outputText;
 const calls=[];const run=navigator=>new Function('data','profile','location','navigator','window','setMessage',js+';return share();')({publicSlug:'example-alex',id:'private-id'},{name:'Alex'},{origin:'https://example.test'},navigator,{prompt:(...args)=>calls.push(['prompt',...args])},m=>calls.push(['message',m]));
 await run({share:async value=>calls.push(['share',value])});assert.equal(calls[0][1].url,'https://example.test/team/example-alex');
 calls.length=0;await run({share:async()=>{const e=new Error();e.name='AbortError';throw e;},clipboard:{writeText:async()=>calls.push('copy')}});assert.deepEqual(calls,[]);
 await run({clipboard:{writeText:async url=>calls.push(['copy',url])}});assert.equal(calls[0][1],'https://example.test/team/example-alex');
 calls.length=0;await run({share:async()=>{throw Error('unavailable');},clipboard:{writeText:async()=>{throw Error('denied');}}});assert.equal(calls[0][0],'prompt');assert.equal(calls[0][2],'https://example.test/team/example-alex');
});
test('responsive styles reserve business-name room and contain date fields, nested grids, and mobile saves',async()=>{
 const [nav,css]=await Promise.all([read('app/components/business-navigation.module.css'),read('app/globals.css')]);
 assert.match(nav,/@media\(max-width:1100px\)[\s\S]*grid-template-columns:minmax\(0,1fr\)/);
 assert.match(nav,/word-break:normal;overflow-wrap:break-word;hyphens:none/);
 assert.match(css,/min-inline-size:0;max-inline-size:100%/);
 assert.match(css,/sf-recurring-session-editor\{grid-template-columns:minmax\(0,1fr\)/);
 assert.match(css,/sf-settings-save\{position:static;box-shadow:none/);
});
