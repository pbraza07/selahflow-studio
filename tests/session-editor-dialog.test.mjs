import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url);
function harness(){
 let index=0;const states=[],refs=[],effects=[];
 const react={...React,useRef:v=>{const i=index++;return refs[i]??=( {current:v});},useState:v=>{const i=index++;if(!(i in states))states[i]=v;return [states[i],next=>{states[i]=next;}];},useEffect:fn=>effects.push(fn)};
 const src=ts.transpileModule(readFileSync(new URL('../app/components/session-editor-dialog.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,exp={};
 new Function('require','exports',src)(id=>id==='react'?react:require(id),exp);
 return {render:props=>{index=0;return exp.default(props);},effects,refs};
}
function nodes(root){if(!root||typeof root!=='object')return [];return [root,...React.Children.toArray(root.props?.children).flatMap(nodes)];}
const props={open:true,sessionNumber:7,busy:false,onClose:()=>{},onSave:async()=>true,children:React.createElement('label',null,'First session date',React.createElement('input',{type:'date'}))};
test('new numbered session opens with existing editing fields and clear draft/save actions',()=>{
 const h=harness(),tree=h.render(props),html=renderToStaticMarkup(tree);
 assert.equal(tree.type,'dialog');assert.match(html,/New session 7/);assert.match(html,/First session date/);assert.match(html,/draft until you save/);assert.match(html,/Keep draft &amp; close/);assert.match(html,/Save business settings/);
 const inline=renderToStaticMarkup(h.render({...props,open:false}));assert.doesNotMatch(inline,/<dialog/);assert.match(inline,/First session date/);
});
test('failed save preserves editor and reports server validation; repeated clicks do not double-save',async()=>{
 const h=harness();let calls=0,reject;const p={...props,onSave:()=>{calls++;return new Promise((_,r)=>{reject=r;});}};
 const tree=h.render(p),save=nodes(tree).find(n=>n.type==='button'&&n.props.children==='Save business settings');
 const first=save.props.onClick();await save.props.onClick();assert.equal(calls,1);reject(Error('Choose an eligible session host.'));await first;
 const html=renderToStaticMarkup(h.render(p));assert.match(html,/Choose an eligible session host/);assert.match(html,/Your draft is still here/);assert.match(html,/role="alert"/);
});
test('escape keeps draft through close callback and is blocked while saving',()=>{
 const h=harness();let closed=0,prevented=0;const p={...props,onClose:()=>closed++};
 h.render(p).props.onCancel({preventDefault:()=>prevented++});assert.equal(closed,1);assert.equal(prevented,1);
 h.render({...p,busy:true}).props.onCancel({preventDefault:()=>prevented++});assert.equal(closed,1);
});
test('modal lifecycle uses native focus containment and restores background scroll and trigger focus',()=>{
 const h=harness();let shown=0,focused=0;const previous=globalThis.document;
 globalThis.document={activeElement:{focus:options=>{assert.equal(options.preventScroll,true);focused++;}},body:{style:{overflow:'auto'}}};
 try{h.render(props);h.refs[0].current={showModal:()=>shown++};const cleanup=h.effects[0]();assert.equal(shown,1);assert.equal(document.body.style.overflow,'hidden');cleanup();assert.equal(document.body.style.overflow,'auto');assert.equal(focused,1);}finally{globalThis.document=previous;}
});

test('Enter in session inputs uses modal save flow and leaves multiline editing alone',async()=>{
 const h=harness();let saved=0,prevented=0;const tree=h.render({...props,onSave:async()=>{saved++;return true;}});
 tree.props.onKeyDown({key:'Enter',nativeEvent:{isComposing:false},target:{tagName:'INPUT'},preventDefault:()=>prevented++});
 await Promise.resolve();assert.equal(saved,1);assert.equal(prevented,1);
 tree.props.onKeyDown({key:'Enter',nativeEvent:{isComposing:false},target:{tagName:'TEXTAREA'},preventDefault:()=>prevented++});
 assert.equal(prevented,1);assert.equal(saved,1);
});
