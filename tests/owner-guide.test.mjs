import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {filteredWorkspaceGroups} from '../server/workspace-navigation.mjs';
const require=createRequire(import.meta.url);
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('owner guide is searchable and renders usable back, open and download controls',async()=>{
 assert.ok(filteredWorkspaceGroups('owner guide').flatMap(g=>g.items).includes('Guide'));
 const source=await read('app/components/owner-guide.tsx');
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const exports={};new Function('require','exports',compiled)(require,exports);
 let back=0;const tree=exports.default({onBack:()=>back++});
 const nodes=(n,out=[])=>{if(Array.isArray(n))n.forEach(v=>nodes(v,out));else if(n?.props){out.push(n);nodes(n.props.children,out);}return out;};
 const all=nodes(tree);const button=all.find(n=>n.type==='button');button.props.onClick();assert.equal(back,1);
 const links=all.filter(n=>n.type==='a');assert.equal(links.length,2);assert.ok(links.some(n=>n.props.download===true));
 assert.ok(links.every(n=>n.props.href==='/api/owner-guide'));
 const frame=all.find(n=>n.type==='iframe');assert.ok(frame.props.title);assert.equal(frame.props.src,'/api/owner-guide#view=FitH');
 const dashboard=await read('app/studio/owner-dashboard.tsx');assert.ok(dashboard.includes("setView('Guide')"));assert.ok(dashboard.includes("<OwnerGuide onBack={()=>setView('Overview')}/>"));
});
test('owner guide endpoint serves the current environment PDF with correct headers',async()=>{
 const compiled=ts.transpileModule(await read('app/api/owner-guide/route.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exp={};new Function('require','exports',compiled)(require,exp);
 const previous=process.env.APP_ENV;
 try{for(const environment of ['production','staging']){
 process.env.APP_ENV=environment;const response=await exp.GET();assert.equal(response.headers.get('content-type'),'application/pdf');assert.equal(response.headers.get('x-content-type-options'),'nosniff');
 const bytes=Buffer.from(await response.arrayBuffer());assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
 const file=await readFile(new URL('../public/guides/selahflow-business-owner-guide'+(environment==='staging'?'-staging':'')+'.pdf',import.meta.url));assert.deepEqual(bytes,file);
 }}finally{if(previous===undefined)delete process.env.APP_ENV;else process.env.APP_ENV=previous;}
});
