import {readFileSync,existsSync} from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const root=new URL('../../',import.meta.url).pathname,require=createRequire(import.meta.url);
export function renderOnboarding({plan='professional',step=1,registered=false,document=false}={}){
 const cache=new Map();
 function load(file){
  if(cache.has(file))return cache.get(file);if(file.endsWith('.mjs'))return require(file);
  const signup=file.endsWith('/signup/page.tsx');let index=0;
  const source=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,exp={};cache.set(file,exp);
  const local=id=>{
   if(id==='react'&&signup)return {...React,useEffect:()=>{},useState:v=>{const i=index++;let value=typeof v==='function'?v():v;if(i===0)value=plan;if(i===1)value={...value,planCode:plan};if(i===2)value=step;if(i===5)value=registered;return [value,()=>{}];}};
   if(!id.startsWith('.'))return require(id);
   let target=path.resolve(path.dirname(file),id);if(target.endsWith('.module.css'))return {__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})};
   if(!path.extname(target))for(const extension of ['.ts','.tsx','.json'])if(existsSync(target+extension)){target+=extension;break;}
   return target.endsWith('.json')?JSON.parse(readFileSync(target,'utf8')):load(target);
  };new Function('require','exports',source)(local,exp);return exp;
 }
 const module=load(root+(document?'app/components/business-service-agreement.tsx':'app/signup/page.tsx'));
 return renderToStaticMarkup(React.createElement(document?module.AgreementDocument:module.default,{planCode:plan}));
}
