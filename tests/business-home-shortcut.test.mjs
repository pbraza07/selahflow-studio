import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {createRequire} from 'node:module';
import {businessManifest} from '../server/business-device-name.mjs';
import {businessPageMetadata} from '../server/search-metadata.mjs';
async function load(path,resolve){
 const source=await readFile(new URL('../'+path,import.meta.url),'utf8'),exports={};
 new Function('require','exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText)(resolve,exports);
 return exports;
}
test('public business shortcuts launch their own URL and remain distinct from owner and other business installs',()=>{
 const a=businessManifest('test-training','Test Training',{colors:{header:'#123456',page:'#ABCDEF'}},'public');
 assert.equal(a.start_url,'/test-training');assert.equal(a.id,a.start_url);assert.equal(a.name,'Test Training');assert.equal(a.short_name,'Test Training');
 assert.equal(a.theme_color,'#123456');assert.equal(a.background_color,'#ABCDEF');assert.equal(a.display,'standalone');
 assert.notEqual(a.id,businessManifest('test-training','Test Training',{}).id);
 assert.notEqual(a.id,businessManifest('other-business','Other Business',{},'public').id);
 assert.equal(businessManifest('test-training','Test Training',{}).start_url,'/studio/test-training');
 assert.throws(()=>businessManifest('//outside.example','Bad',{},'public'),/Invalid business slug/);
});
test('business manifest endpoint resolves active tenant and selects only the allowed public launch route',async()=>{
 const url=new URL('../app/api/business/manifest/route.ts',import.meta.url),native=createRequire(url);
 const {GET}=await load('app/api/business/manifest/route.ts',p=>p.endsWith('/server/database.mjs')?{getPool:()=>({query:async(sql,[slug])=>{assert.match(sql,/status='active'/);return {rows:slug==='test-training'?[{slug,name:'Test Training',brand_primary:'#123456',brand_background:'#ABCDEF',data:'{}'}]:[]};}})}:native(p));
 for(const [query,launch] of [['&audience=public','/test-training'],['','/studio/test-training'],['&audience=https://outside.example','/studio/test-training']]){
  const res=await GET(new Request('https://example.test/api/business/manifest?slug=test-training'+query));assert.equal(res.status,200);assert.match(res.headers.get('content-type'),/application\/manifest\+json/);assert.equal(res.headers.get('cache-control'),'no-store');assert.equal((await res.json()).start_url,launch);
 }
 for(const slug of ['missing','../outside'])assert.equal((await GET(new Request('https://example.test/api/business/manifest?slug='+encodeURIComponent(slug)+'&audience=public'))).status,404);
});
test('public page overrides root manifest and Apple title while preserving business search metadata',async()=>{
 const row={name:'Test Training',slug:'test-training',industry:'fitness',description:'Training sessions',city:'Test City',region:'FL'};
 const {generateMetadata}=await load('app/[slug]/page.tsx',p=>p.endsWith('/server/database.mjs')?{getPool:()=>({query:async()=>({rows:[row]})})}:p.endsWith('/server/search-metadata.mjs')?{businessPageMetadata}:{});
 const result=await generateMetadata({params:Promise.resolve({slug:row.slug})});
 assert.equal(result.manifest,'/api/business/manifest?slug=test-training&audience=public');assert.equal(result.appleWebApp.title,row.name);assert.equal(result.appleWebApp.capable,true);assert.deepEqual(result.alternates,businessPageMetadata(row).alternates);
});
