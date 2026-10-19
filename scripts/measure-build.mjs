/**
 * Non-invasive build measurement: byte sizes of emitted client assets.
 * Uses the same production webpack build in baseline and optimized branches.
 * App-build-manifest is used as a route JS proxy, NOT as LCP/INP measurements.
 */
import {readFile,stat,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {gzipSync} from 'node:zlib';

const build='.next';
const json=async file=>JSON.parse(await readFile(join(build,file),'utf8'));
const exists=async file=>{try{return (await stat(file)).isFile();}catch{return false;}};
const bytes=async file=>{const content=await readFile(file);return {raw:content.byteLength,gzip:gzipSync(content).byteLength};};
const sum=items=>items.reduce((o,item)=>({raw:o.raw+item.raw,gzip:o.gzip+item.gzip}),{raw:0,gzip:0});
async function collect(dir,result=[]){
 for(const entry of await readdir(dir,{withFileTypes:true})){
  const f=join(dir,entry.name);
  if(entry.isDirectory())await collect(f,result);
  else if(/\.(js|css)$/.test(entry.name))result.push(f);
 }
 return result;
}
let manifest={pages:{}};let manifestSource='none';
for(const name of ['app-build-manifest.json','build-manifest.json','server/app-build-manifest.json']){
 try{manifest=await json(name);manifestSource=name;break;}catch(error){
  if(error?.code!=='ENOENT')throw error;
 }
}
const files=await collect(join(build,'static'));
const stats=await Promise.all(files.map(async path=>({path,...await bytes(path)})));
const totals={
 javascript:sum(stats.filter(x=>x.path.endsWith('.js'))),
 css:sum(stats.filter(x=>x.path.endsWith('.css'))),
 all:sum(stats),
 jsFiles:stats.filter(x=>x.path.endsWith('.js')).length,
 cssFiles:stats.filter(x=>x.path.endsWith('.css')).length
};
const selected=['/page','/discover/page','/book/page','/admin/platform/page','/studio/[slug]/page','/membership/[slug]/page'];
const routes={};
for(const name of selected){
 const entry=Object.keys(manifest.pages||{}).find(key=>key===name||key.replace(/\/+$/,'')===name);
 if(!entry){routes[name]={available:false};continue;}
 const chunks=[...new Set((manifest.pages[entry]||[]).filter(x=>/\.(js|css)$/.test(x)))];
 const found=[];
 for(const chunk of chunks){const filepath=join(build,chunk);if(await exists(filepath))found.push({path:chunk,...await bytes(filepath)});}
 routes[name]={available:true,assetCount:found.length,missing:chunks.length-found.length,
  js:sum(found.filter(x=>x.path.endsWith('.js'))),
  css:sum(found.filter(x=>x.path.endsWith('.css')))};
}
const output={method:'next-16-webpack-static-asset-byte-sums',manifestSource,version:(await json('../package.json').catch(()=>({version:'unknown'}))).version,totals,routes};
console.log('SELAHFLOW_STATIC_BUILD_METRICS '+JSON.stringify(output));


/**
 * Route reference-manifest bundles are not network traces. The root client
 * component's chunk references are a more precise proxy for its eager chunk
 * graph than summing all build chunks; actual first-load still needs browser
 * instrumentation and caching-aware measurement.
 */
const routeSpecs=[
 {route:'/studio/[slug]/page',component:'owner-dashboard.tsx'},
 {route:'/admin/platform/page',component:'platform-dashboard.tsx'},
 {route:'/discover/page',component:'/app/discover/page.tsx'},
 {route:'/book/page',component:'/app/book/page.tsx'},
 {route:'/membership/[slug]/page',component:'/app/membership/[slug]/page.tsx'}
];
const routeReferences={};
for(const spec of routeSpecs){
 const filepath=join(build,'server','app',spec.route+'_client-reference-manifest.js');
 try{
  const raw=await readFile(filepath,'utf8'),at=raw.indexOf(']={');
  if(at<0)throw Error('Client-reference JSON marker not found');
  const parsed=JSON.parse(raw.slice(at+2).trim().replace(/;\s*$/,''));
  const modules=Object.entries(parsed.clientModules||{});
  const primary=modules.filter(([name])=>name.includes(spec.component));
  const assets=[...new Set(primary.flatMap(([,entry])=>Array.isArray(entry?.chunks)?entry.chunks.filter(x=>typeof x==='string'&&/\.(js|css)$/.test(x)):[]))];
  const measured=[];
  for(const asset of assets){
   const assetPath=join(build,asset.replace(/^\/_next\//,''));
   if(await exists(assetPath))measured.push({path:asset,...await bytes(assetPath)});
  }
  routeReferences[spec.route]={modules:modules.length,rootComponentMatchCount:primary.length,rootChunkCount:assets.length,rootChunksMeasured:measured.length,
   rootComponentChunkBytes:sum(measured),moduleKeys:primary.map(([name])=>name.slice(-100)).slice(0,4)};
 }catch(error){routeReferences[spec.route]={available:false,error:String(error.message).slice(0,110)};}
}
console.log('SELAHFLOW_ROUTE_REFERENCE_METRICS '+JSON.stringify(routeReferences));
