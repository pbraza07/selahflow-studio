import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import {businessIntroLines} from '../server/business-profile-copy.mjs';
import {businessTeamShowcase} from '../server/team-showcase.mjs';
const require=createRequire(import.meta.url);
test('business introduction shows matching fields once without overwriting distinct copy',()=>{
 assert.deepEqual(businessIntroLines({tagline:'landscaping',business_model:'landscaping'}),['landscaping']);
 assert.deepEqual(businessIntroLines({tagline:'  Landscaping ',business_model:'LANDSCAPING  '}),['Landscaping']);
 assert.deepEqual(businessIntroLines({tagline:'Home  services',description:'Home\nservices'}),['Home  services']);
 assert.deepEqual(businessIntroLines({tagline:'Build your vision',business_model:'Paver installation',description:'Lower-priority text'}),['Build your vision','Paver installation']);
 assert.deepEqual(businessIntroLines({tagline:'Only a tagline'}),['Only a tagline']);
 assert.deepEqual(businessIntroLines({business_model:'  ',description:'Business description'}),['Business description']);
 assert.equal(businessIntroLines({tagline:' ',description:null}).length,1);
 assert.match(businessIntroLines()[0],/Discover services/);
});
test('actual shared tenant landing page renders repeated introduction once for any business',async()=>{
 const source=ts.transpileModule(await readFile(new URL('../app/[slug]/page.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const module={exports:{}};
 let row;
 const Empty=()=>null;
 const load=id=>{
  if(id.endsWith('team-showcase.mjs'))return {businessTeamShowcase};
  if(id.endsWith('business-profile-copy.mjs'))return {businessIntroLines};
  if(id.endsWith('database.mjs'))return {getPool:()=>({query:async()=>({rows:[row]})})};
  if(id.endsWith('business-social-links.mjs'))return {publicSocialLinks:()=>[]};
  if(id.endsWith('themes.mjs'))return {themeStyles:()=>({})};
  if(id.endsWith('/maps'))return {displayBusinessAddress:()=>'',googleMapsDirections:()=>''};
  if(id.endsWith('/service-terms'))return {durationLabel:()=>'',isTermUnit:()=>false};
  if(id.endsWith('.css'))return new Proxy({},{get:(_,key)=>String(key)});
  if(id==='next/navigation')return {notFound:()=>{throw Error('not found')}};
  if(id==='next/link')return {__esModule:true,default:({children,...props})=>React.createElement('a',props,children)};
  if(id==='next/image'||id.includes('/components/'))return {__esModule:true,default:Empty};
  return require(id);
 };
 new Function('require','module','exports',source)(load,module,module.exports);
 for(const slug of ['capstone','another-business']){
  row={name:'Example Business',slug,industry:'landscaping',description:'landscaping',business_model:'landscaping',data:JSON.stringify({tagline:'landscaping'}),brand_primary:'#123F3A',brand_background:'#ffffff',has_logo:false};
  const html=renderToStaticMarkup(await module.exports.default({params:Promise.resolve({slug})}));
  assert.equal((html.match(/<p>landscaping<\/p>/g)||[]).length,1);
  row.data=JSON.stringify({tagline:'A distinct tagline'});
  const distinct=renderToStaticMarkup(await module.exports.default({params:Promise.resolve({slug})}));
  assert.match(distinct,/<p>A distinct tagline<\/p>/);assert.match(distinct,/<p>landscaping<\/p>/);
 }
});
