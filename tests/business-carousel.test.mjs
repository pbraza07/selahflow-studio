import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
test('carousel supports next/previous, keyboard isolation, reduced motion and native scroll updates',async t=>{
 const calls=[],events={};let reduced=false;
 const el={children:[{offsetLeft:2},{offsetLeft:322},{offsetLeft:642}],scrollLeft:0,clientWidth:300,scrollWidth:940,scrollTo:args=>calls.push(args),addEventListener:(name,cb)=>events[name]=cb,removeEventListener:()=>{}};
 globalThis.__carouselEl=el;globalThis.__carouselEffects=[];globalThis.__carouselState=[];
 t.after(()=>{delete globalThis.__carouselEl;delete globalThis.__carouselEffects;delete globalThis.__carouselState;});
 globalThis.window={matchMedia:()=>({matches:reduced})};t.after(()=>delete globalThis.window);
 globalThis.ResizeObserver=class{observe(){} disconnect(){}};t.after(()=>delete globalThis.ResizeObserver);
 let source=ts.transpileModule(await readFile(new URL('../app/components/business-carousel.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 source=source.replace(/import \{[^\n]+\} from "react\/jsx-runtime";/,"const _jsx=(type,props)=>({type,props}),_jsxs=_jsx;")
 .replace(/import \{[^\n]+\} from 'react';/,"const useRef=()=>({current:globalThis.__carouselEl}),useState=v=>[v,x=>globalThis.__carouselState.push(x)],useEffect=fn=>globalThis.__carouselEffects.push(fn);")
 .replace(/import \{[^\n]+\} from 'lucide-react';/,"const ArrowLeft='left',ArrowRight='right';").replace(/import styles[^\n]+;/,'const styles={};');
 const {default:Carousel}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const view=Carousel({count:3,children:[]});const nodes=[];function visit(n){if(!n||typeof n!=='object')return;nodes.push(n);for(const c of [n.props?.children].flat(Infinity))visit(c);}visit(view);
 const buttons=nodes.filter(n=>n.type==='button'),track=nodes.find(n=>n.props?.id==='discover-business-track');
 assert.equal(buttons[0].props.disabled,true);assert.equal(buttons[1].props.disabled,false);
 globalThis.__carouselEffects[0]();assert.equal(calls[0].left,0);
 buttons[1].props.onClick();assert.deepEqual(calls.at(-1),{left:320,behavior:'smooth'});
 el.scrollLeft=320;buttons[0].props.onClick();assert.equal(calls.at(-1).left,0);
 reduced=true;buttons[1].props.onClick();assert.deepEqual(calls.at(-1),{left:640,behavior:'instant'});
 let prevented=false;track.props.onKeyDown({key:'ArrowLeft',target:el,currentTarget:el,preventDefault:()=>prevented=true});assert.equal(prevented,true);assert.equal(calls.at(-1).left,0);
 prevented=false;track.props.onKeyDown({key:'ArrowRight',target:{tagName:'A'},currentTarget:el,preventDefault:()=>prevented=true});assert.equal(prevented,false);
 el.scrollLeft=640;events.scroll();assert.deepEqual(globalThis.__carouselState.at(-1)({}),{index:2,start:false,end:true});
 const single=Carousel({count:1,children:[]});assert.equal(single.props['aria-roledescription'],'carousel');
});
