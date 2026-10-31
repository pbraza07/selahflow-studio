import {readFileSync,existsSync} from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const root=new URL('../../',import.meta.url).pathname,require=createRequire(import.meta.url);
/** Render real workspace JSX with a read-only fixture and no effects or API calls. */
export function renderWorkspace({team=false,view='Overview',category='sessions'}={}){
 const cache=new Map(),empty=()=>null;let defaults,fixture;
 const profile={name:'Alex Example',phone:'',email:'',description:'',socials:[]};
 const data={id:'private-account-id',publicSlug:'example-alex',profile,business:'Example Business',branding:{slug:'example',name:'Example Business'},mustChangePassword:false,config:{},appointments:[],timeOff:[],businessBlocks:[],media:[],notes:[]};
 function load(file){
  if(cache.has(file))return cache.get(file);
  if(file.endsWith('.mjs'))return require(file);
  const owner=file.endsWith('owner-dashboard.tsx'),teamPage=file.endsWith('/team/workspace/page.tsx');let stateIndex=0;
  const source=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,exp={};cache.set(file,exp);
  const local=id=>{
   if(id==='react'&&(owner||teamPage))return {...React,useEffect:()=>{},useCallback:f=>f,useMemo:f=>f(),useRef:v=>({current:v}),useState:v=>{const index=stateIndex++;let val=typeof v==='function'?v():v;if(owner){if(v===defaults)val=fixture;if(v==='Overview')val=view;if(v==='business')val=category;}if(teamPage){if(index===1)val=data;if(index===2)val=profile;}return [val,()=>{}];}};
   if(id==='next/dynamic')return {__esModule:true,default:()=>empty};
   if(owner&&id.startsWith('../components/'))return {__esModule:true,default:empty,TeamCalendarDialog:empty};
   if(teamPage&&id.startsWith('../../components/'))return {__esModule:true,default:id.includes('team-page-shell')?({children})=>React.createElement('div',null,children):empty};
   if(!id.startsWith('.'))return require(id);
   let target=path.resolve(path.dirname(file),id);if(!path.extname(target))for(const ext of ['.ts','.tsx','.json'])if(existsSync(target+ext)){target+=ext;break;}
   return target.endsWith('.json')?JSON.parse(readFileSync(target,'utf8')):load(target);
  };
  new Function('require','exports',source)(local,exp);return exp;
 }
 defaults=load(root+'lib/defaults.ts').defaultSettings;fixture=structuredClone(defaults);
 fixture.name='Example Business';fixture.services[0].name='Small Group Session';fixture.bookableSessions=[{id:'group',date:'2026-11-09',service:fixture.services[0].id,staff:fixture.staff[0].id,start:1140,capacity:10,repeat:{frequency:'weekly',every:1,until:'2026-12-14'}}];
 const Page=load(root+(team?'app/team/workspace/page.tsx':'app/studio/owner-dashboard.tsx')).default;
 return renderToStaticMarkup(React.createElement(Page,{businessSlug:'example'}));
}
