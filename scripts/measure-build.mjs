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
const manifest=await json('app-build-manifest.json');
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
const output={method:'next-16-webpack-app-build-manifest-route-asset-byte-sums',version:(await json('../package.json').catch(()=>({version:'unknown'}))).version,totals,routes};
console.log('SELAHFLOW_STATIC_BUILD_METRICS '+JSON.stringify(output));
