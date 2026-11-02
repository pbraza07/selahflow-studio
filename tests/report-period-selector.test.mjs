import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import {financialPeriodBounds} from '../server/financial-pipeline.mjs';
const require=createRequire(import.meta.url);
function walk(node,p){if(!node||typeof node!=='object')return [];return [...(p(node)?[node]:[]),...React.Children.toArray(node.props?.children).flatMap(c=>walk(c,p))];}
test('report controls switch presets and apply validated custom dates through native calendars',()=>{
 let index=0,range='Today',custom={from:'2026-11-02',to:'2026-11-02'};
 const states=[false,custom.from,custom.to,''],exports={};
 const source=ts.transpileModule(readFileSync(new URL('../app/components/report-period-selector.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 new Function('require','exports',source)(id=>{
  if(id==='react')return {...React,useState:initial=>{const n=index++;return [states[n]??initial,v=>states[n]=typeof v==='function'?v(states[n]):v];}};
  if(id.endsWith('.css'))return {__esModule:true,default:new Proxy({},{get:(_,key)=>key})};
  if(id.endsWith('financial-pipeline.mjs'))return {financialPeriodBounds};return require(id);
 },exports);
 const tree=()=>{index=0;return exports.default({range,date:'2026-11-02',custom,onRange:v=>range=v,onCustom:v=>custom=v});};
 let t=tree();
 for(const label of ['This week','Past 6 months','Year to date']){const b=walk(t,n=>n.type==='button'&&n.props.children===label)[0];assert.equal(b.props.type,'button');b.props.onClick();assert.equal(range,label);t=tree();}
 walk(t,n=>n.type==='button'&&n.props['aria-controls'])[0].props.onClick();t=tree();let inputs=walk(t,n=>n.type==='input');assert.equal(inputs.length,2);assert.ok(inputs.every(n=>n.props.type==='date'));
 inputs[0].props.onChange({target:{value:'2026-11-03'}});walk(tree(),n=>n.type==='button'&&n.props.children==='Apply date range')[0].props.onClick();assert.equal(range,'Year to date');assert.ok(renderToStaticMarkup(tree()).includes('Choose valid'));
 inputs=walk(tree(),n=>n.type==='input');inputs[0].props.onChange({target:{value:'2026-01-01'}});inputs[1].props.onChange({target:{value:'2026-10-31'}});walk(tree(),n=>n.type==='button'&&n.props.children==='Apply date range')[0].props.onClick();
 assert.equal(range,'Custom date range');assert.deepEqual(custom,{from:'2026-01-01',to:'2026-10-31'});assert.equal(states[0],false);assert.ok(renderToStaticMarkup(tree()).includes('Eastern time'));
});
