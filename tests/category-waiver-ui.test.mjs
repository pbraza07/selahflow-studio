import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import * as templates from '../server/waiver-category-templates.mjs';
import * as content from '../server/waiver-content.mjs';
import * as themes from '../server/themes.mjs';
const require=createRequire(import.meta.url);
async function component(path,dependencies={}){
 const source=ts.transpileModule(await readFile(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const module={exports:{}};
 new Function('require','module','exports',source)(id=>dependencies[id]||require(id),module,module.exports);return module.exports;
}
test('owner preview and client signature form render the same category terms with optional media unchecked',async()=>{
 const deps={'../../server/waiver-content.mjs':content,'../../server/themes.mjs':themes,'../../server/waiver-category-templates.mjs':templates};
 const waiver=await component('../app/components/participation-waiver.tsx',deps);
 const editor=await component('../app/components/category-waiver-editor.tsx',{...deps,'./participation-waiver':waiver});
 const config={name:'Example Landscaping',industry:'landscaping',services:[{id:'paving',name:'Paving',description:'Install agreed paving',requiresWaiver:true}],categoryWaiver:{enabled:false,category:'professional_services',additionalTerms:'Keep pets away from work area.',serviceTerms:{paving:'Mark utility locations.'}}};
 const html=renderToStaticMarkup(React.createElement(editor.default,{config,setConfig:()=>{}}));
 assert.match(html,/Home &amp; Professional Services/);assert.match(html,/Mark utility locations/);assert.match(html,/Record review and select category waiver/);
 assert.doesNotMatch(html,/indoor soccer|birthday parties/);
 const document=content.waiverDocument({...config,categoryWaiver:{...config.categoryWaiver,enabled:true}});
 const client=renderToStaticMarkup(React.createElement(waiver.default,{document,dob:'1990-01-01',participantName:'Jane Doe',value:{signature:'',role:'',date:content.waiverToday(),accepted:false},onChange:()=>{},signed:false,checking:false,error:'',onRetry:()=>{}}));
 assert.match(client,/Mark utility locations/);assert.match(client,/optional media permission/);assert.doesNotMatch(client,/checked=""/);
 assert.equal(templates.suggestedWaiverCategory('landscaping'),'professional_services');
 assert.equal(templates.suggestedWaiverCategory('medical'),'general');
});
