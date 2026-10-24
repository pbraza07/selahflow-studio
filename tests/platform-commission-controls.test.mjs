import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';

test('platform controls distinguish readiness blockers, always permit disabling, and change only the selected commission',async()=>{
 let compiled=ts.transpileModule(await readFile(new URL('../app/components/platform-commissions.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 compiled=compiled.replace(/import \{[^\n]+\} from "react\/jsx-runtime";/,"const _jsx=(type,props)=>({type,props}),_jsxs=_jsx,_Fragment='fragment';")
  .replace(/import \{ useEffect, useState \} from 'react';/,'').replace(/import styles[^\n]+;/,'const styles={};');
 const {BusinessCommissionControls}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
 const base={id:'b',name:'Test Business',slug:'test',status:'active',paymentReady:true,commissions:{bookingEnabled:false,membershipEnabled:false,acceptedAt:'2026-10-24T00:00:00Z',totals:[]}};
 function inspect(tree){const inputs=[],text=[];function visit(n){if(typeof n==='string'){text.push(n);return;}if(!n||typeof n!=='object')return;if(n.type==='input')inputs.push(n);for(const c of [n.props?.children].flat(Infinity))visit(c);}visit(tree);return {inputs,text:text.join(' ')};}
 for(const [business,stripe,reason] of [[{...base,status:'archived'},{ready:true},'must be active'],[{...base,commissions:{...base.commissions,acceptedAt:null}},{ready:true},'owner must accept'],[base,{ready:false},'platform Stripe'],[{...base,paymentReady:false},{ready:true},'business’s Stripe']]){
  let view=inspect(BusinessCommissionControls({business,stripe,busy:false,onChange:()=>assert.fail()}));assert.match(view.text,new RegExp(reason));assert.ok(view.inputs.every(i=>i.props.disabled));
  view=inspect(BusinessCommissionControls({business:{...business,commissions:{...business.commissions,bookingEnabled:true,membershipEnabled:true}},stripe,busy:false,onChange:()=>{}}));assert.ok(view.inputs.every(i=>!i.props.disabled),'disabling is always available');
 }
 const changes=[],props={business:base,stripe:{ready:true,reason:'Ready'},busy:false,onChange:(...args)=>changes.push(args)};
 const view=inspect(BusinessCommissionControls(props));assert.equal(view.inputs.length,2);assert.ok(view.inputs.every(i=>!i.props.disabled));
 assert.match(view.inputs[0].props['aria-label'],/booking.*Test Business/);assert.equal(view.inputs[0].props.style.accentColor,'#168647');
 view.inputs[0].props.onChange({target:{checked:true}});view.inputs[1].props.onChange({target:{checked:false}});assert.deepEqual(changes,[['booking',true],['membership',false]]);
 assert.ok(inspect(BusinessCommissionControls({...props,busy:true})).inputs.every(i=>i.props.disabled));
});
