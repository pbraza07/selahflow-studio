import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {businessTeamShowcase} from '../server/team-showcase.mjs';
import {businessSlugFromPath,pageShortcuts,safeBusinessSlug,shortcutBackFallback} from '../server/page-shortcuts.mjs';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url),read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('team showcase requires active same-business accounts, a public portrait and visible saved staff; projection contains no private fields',async t=>{
 const db=new PGlite();t.after(()=>db.close());await db.exec(`CREATE TABLE businesses(id text PRIMARY KEY,status text);CREATE TABLE team_accounts(id text,business_id text,staff_id text,profile jsonb,active boolean);CREATE TABLE team_media(id text,account_id text,kind text,appointment_id text);INSERT INTO businesses VALUES('one','active'),('two','active'),('closed','archived');`);
 const profile={name:'Alex Public',description:'My experience and approach.',email:'private-login@example.test',password_hash:'secret',client_notes:'private'};
 for(const [id,business,staff,active,kind]of [['a','one','first',true,'portrait'],['b','one','hidden',true,'portrait'],['c','one','removed',true,'portrait'],['d','one','off',false,'portrait'],['e','one','no-picture',true,'client'],['f','two','first',true,'portrait'],['g','closed','first',true,'portrait']]){
 await db.query('INSERT INTO team_accounts VALUES($1,$2,$3,$4,$5)',[id,business,staff,profile,active]);await db.query('INSERT INTO team_media VALUES($1,$2,$3,$4)',['photo-'+id,id,kind,kind==='portrait'?null:'private-visit']);}
 const config={staff:[{id:'first',name:'Alex',role:'Specialist'},{id:'hidden',name:'Hidden',bookingVisible:false},{id:'off',name:'Off'},{id:'no-picture',name:'No picture'}]};
 const result=await businessTeamShowcase(db,'one',config);assert.deepEqual(result,[{id:'a',name:'Alex Public',description:profile.description,portraitId:'photo-a'}]);assert.doesNotMatch(JSON.stringify(result),/private|password|secret|client_notes/);
 assert.deepEqual(await businessTeamShowcase(db,'closed',config),[]);assert.deepEqual(await businessTeamShowcase(db,'one',{staff:[]}),[]);
 await db.exec("DELETE FROM team_media WHERE account_id='a'");assert.deepEqual(await businessTeamShowcase(db,'one',config),[]);
});
test('page shortcuts keep business context across core routes and keep private destinations protected',()=>{
 for(const path of ['/tenant-one','/book/tenant-one','/membership/tenant-one','/studio/tenant-one'])assert.equal(businessSlugFromPath(path),'tenant-one');
 for(const path of ['/','/login','/discover','/team/login','/team/workspace','/team/review/token','/studio/owner','/api/business','/membership-pay/private-token'])assert.equal(businessSlugFromPath(path),null);
 for(const value of ['../admin','https://evil.test','tenant?bad','',null])assert.equal(safeBusinessSlug(value),null);
 assert.equal(shortcutBackFallback('/tenant-one','tenant-one'),'/discover');assert.equal(shortcutBackFallback('/team/login','tenant-one'),'/tenant-one');assert.equal(shortcutBackFallback('/login',null),'/discover');
 const links=pageShortcuts('tenant-one','profile-id');assert.ok(links.some(x=>x.href==='/tenant-one'));assert.ok(links.some(x=>x.href==='/team/profile-id'));assert.ok(links.some(x=>x.href==='/team/workspace'));assert.ok(links.some(x=>x.href==='/studio/owner'));assert.ok(links.some(x=>x.href==='/team/login?business=tenant-one'));
 assert.ok(pageShortcuts(null,null).some(x=>x.href==='/discover'));assert.ok(pageShortcuts('../admin','../private').every(x=>!x.href.includes('..')));
});
test('team cards show only public picture and biography, link to the correct profile, and disappear when empty',async()=>{
 const compiled=ts.transpileModule(await read('app/components/team-showcase.tsx'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;const exp={};
 const Carousel=({children,...props})=>React.createElement('section',{'aria-label':props.label},children);
 new Function('require','exports',compiled)(id=>id==='./business-carousel'?{__esModule:true,default:Carousel}:id.endsWith('.css')?{__esModule:true,default:new Proxy({},{get:(_,k)=>String(k)})}:require(id),exp);
 assert.equal(exp.default({members:[]}),null);
 const html=renderToStaticMarkup(React.createElement(exp.default,{members:[{id:'person-one',portraitId:'portrait-one',name:'Alex <Public>',description:'Experienced & friendly.\nPersonal approach.',role:'Specialist'}]}));
 assert.match(html,/Browse team members/);assert.match(html,/\/api\/team\/media\?id=portrait-one/);assert.match(html,/\/team\/person-one/);assert.match(html,/Alex &lt;Public&gt;/);assert.match(html,/Experienced &amp; friendly/);assert.doesNotMatch(html,/appointment|password_hash|client_notes/);
});
test('compact page menu follows loaded team branding, supports back fallback, Escape and outside closing',async t=>{
 const saved={window:globalThis.window,document:globalThis.document,sessionStorage:globalThis.sessionStorage,MutationObserver:globalThis.MutationObserver};t.after(()=>{for(const [key,value]of Object.entries(saved)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}});
 let state,effect,observeUpdate,assigned='',wentBack=0,focused=false,removed=false;
 const store=new Map(),events={};const menu={open:true,contains:()=>false,querySelector:()=>({focus:()=>focused=true})};
 globalThis.window={location:{search:'',assign:url=>assigned=url},history:{length:1,back:()=>wentBack++}};
 globalThis.sessionStorage={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)};
 globalThis.document={body:{},querySelector:selector=>selector.includes('business-slug')?{dataset:{businessSlug:'tenant-one'}}:{dataset:{teamProfileId:'member-one'}},addEventListener:(name,fn)=>events[name]=fn,removeEventListener:()=>removed=true};
 globalThis.MutationObserver=class{constructor(fn){observeUpdate=fn;}observe(){}disconnect(){}};
 const hooks={useRef:()=>({current:menu}),useState:initial=>[state??=initial,update=>state=typeof update==='function'?update(state):update],useEffect:fn=>effect=fn};
 const compiled=ts.transpileModule(await read('app/components/page-shortcuts.tsx'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;const exp={};
 const helpers=await import('../server/page-shortcuts.mjs');new Function('require','exports',compiled)(id=>id==='react'?hooks:id==='next/navigation'?{usePathname:()=>'/team/workspace'}:id.endsWith('page-shortcuts.mjs')?helpers:require(id),exp);
 const nodes=(n,out=[])=>{if(Array.isArray(n))n.forEach(x=>nodes(x,out));else if(n?.props){out.push(n);nodes(n.props.children,out);}return out;};
 exp.default();const cleanup=effect();assert.equal(menu.open,false);assert.equal(store.get('selahflow:last-public-business'),'tenant-one');
 const tree=nodes(exp.default());assert.ok(tree.some(n=>n.type==='a'&&n.props.href==='/team/member-one'));assert.ok(tree.some(n=>n.type==='a'&&n.props.href==='/tenant-one'));
 const back=tree.find(n=>n.type==='button');back.props.onClick();assert.equal(assigned,'/tenant-one');window.history.length=2;back.props.onClick();assert.equal(wentBack,1);
 menu.open=true;tree.find(n=>n.type==='details').props.onKeyDown({key:'Escape'});assert.equal(menu.open,false);assert.equal(focused,true);
 menu.open=true;events.pointerdown({target:{}});assert.equal(menu.open,false);observeUpdate();cleanup();assert.equal(removed,true);
});
