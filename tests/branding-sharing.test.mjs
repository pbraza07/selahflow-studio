import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {PNG} from 'pngjs';
import jsQR from 'jsqr';
import {PGlite} from '@electric-sql/pglite';
import {bookingQr} from '../server/booking-qr.mjs';
import {bookingShareUrl} from '../server/booking-share-url.mjs';
import {validateSocialLinks,publicSocialLinks} from '../server/business-social-links.mjs';
import {validatePageContent} from '../server/page-content.mjs';
const decode=buffer=>{const png=PNG.sync.read(buffer);return jsQR(new Uint8ClampedArray(png.data),png.width,png.height)?.data;};
test('downloadable booking QR codes independently decode to the correct business and environment, with no external QR service',async()=>{
 for(const origin of ['https://selahflow-staging.onrender.com','https://selahflow.onrender.com']){
  const qr=await bookingQr({slug:'example-business',origin,format:'png'});assert.equal(qr.type,'image/png');assert.equal(decode(qr.body),origin+'/book/example-business');
  const png=PNG.sync.read(qr.body);assert.equal(png.width,1024);assert.deepEqual([...png.data.subarray(0,4)],[255,255,255,255]);
  const svg=await bookingQr({slug:'example-business',origin});assert.equal(svg.type,'image/svg+xml');assert.match(svg.body,/<svg[^>]+viewBox/);assert.doesNotMatch(svg.body,/<script|https?:\/\/(?!www.w3.org)/);
 }
 assert.throws(()=>bookingShareUrl('../another','https://example.test'));await assert.rejects(bookingQr({slug:'valid-slug',origin:'https://example.test',format:'html'}),/SVG or PNG/);
});
test('QR download API resolves the authenticated business, ignores forged slug/origin and rejects unauthenticated or inactive owners',async t=>{
 const pg=new PGlite();t.after(()=>pg.close());await pg.exec("CREATE TABLE businesses(owner_id text,slug text,status text);INSERT INTO businesses VALUES('owner-a','business-one','active'),('owner-b','business-two','active'),('owner-c','inactive-business','archived')");
 globalThis.__qrActor=null;globalThis.__qrPool=pg;t.after(()=>{delete globalThis.__qrActor;delete globalThis.__qrPool;});
 let source=ts.transpileModule(await readFile(new URL('../app/api/studio/booking-qr/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 source=source.replace(/import \{ requireOwner \}[^\n]+;/,"const requireOwner=async()=>{if(!globalThis.__qrActor)throw Error('AUTH_REQUIRED');return globalThis.__qrActor;};").replace(/import \{ getPool \}[^\n]+;/,'const getPool=()=>globalThis.__qrPool;');
 for(const name of ['security','booking-qr'])source=source.replaceAll("'../../../../server/"+name+".mjs'",JSON.stringify(new URL('../server/'+name+'.mjs',import.meta.url).href));
 const route=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64')),origin=new URL(process.env.APP_URL||process.env.RENDER_EXTERNAL_URL||'https://example.test').origin;
 const request=suffix=>new Request(origin+'/api/studio/booking-qr'+suffix);assert.equal((await route.GET(request(''))).status,401);
 globalThis.__qrActor='owner-a';let r=await route.GET(request('?format=png&download=1&slug=business-two&origin=https://evil.test'));assert.equal(r.status,200);assert.match(r.headers.get('cache-control'),/private, no-store/);assert.equal(r.headers.get('content-disposition'),'attachment; filename="business-one-booking-qr.png"');assert.equal(decode(Buffer.from(await r.arrayBuffer())),origin+'/book/business-one');
 globalThis.__qrActor='owner-b';r=await route.GET(request('?format=png'));assert.equal(decode(Buffer.from(await r.arrayBuffer())),origin+'/book/business-two');
 assert.equal((await route.GET(request('?format=html'))).status,400);globalThis.__qrActor='owner-c';assert.equal((await route.GET(request(''))).status,404);
});
test('social links validate known platform domains, safely remove buttons, and reject executable or misleading URLs',()=>{
 assert.deepEqual(validateSocialLinks({instagram:' https://www.instagram.com/example ',facebook:'',website:'https://example.com'}),{instagram:'https://www.instagram.com/example',website:'https://example.com/'});
 for(const input of [{instagram:'javascript:alert(1)'},{instagram:'https://instagram.com.evil.test/'},{facebook:'https://user:password@facebook.com/'},{x:'http://x.com/test'},{unsupported:'https://example.com'},[],{website:'data:text/html,bad'},{youtube:'https://example.com'}])assert.throws(()=>validateSocialLinks(input));
 assert.deepEqual(publicSocialLinks({instagram:'javascript:alert(1)',facebook:'https://facebook.com/example'}),{facebook:'https://facebook.com/example'});
 const config={socialLinks:{instagram:'https://instagram.com/example'}};validatePageContent(config);assert.equal(config.socialLinks.instagram,'https://instagram.com/example');assert.throws(()=>validatePageContent({socialLinks:{website:'javascript:bad'}}));assert.throws(()=>validatePageContent({business_model:'x'.repeat(2001)}));
});
test('business header renders configured safe social buttons with accessible labels, external-link protections and empty-state omission',async()=>{
 const require=createRequire(import.meta.url);let source=ts.transpileModule(await readFile(new URL('../app/components/business-navigation.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 source=source.replace("'react'",JSON.stringify(pathToFileURL(require.resolve('react')).href)).replace('"react/jsx-runtime"',JSON.stringify(pathToFileURL(require.resolve('react/jsx-runtime')).href)).replace(/import \{ usePathname \}[^\n]+;/,"const usePathname=()=>'/example-business';").replace(/import \{ Menu, ArrowUpRight \}[^\n]+;/,'const Menu=()=>null,ArrowUpRight=()=>null;').replace(/import styles[^\n]+;/,"const styles={header:'header',social:'social'};").replace("'../../server/business-social-links.mjs'",JSON.stringify(new URL('../server/business-social-links.mjs',import.meta.url).href));
 const {default:Navigation}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const html=renderToStaticMarkup(React.createElement(Navigation,{slug:'example-business',name:'Example',socialLinks:{instagram:'https://instagram.com/example',website:'javascript:alert(1)'}}));assert.match(html,/aria-label="Business social media"/);assert.match(html,/aria-label="Example on Instagram"/);assert.match(html,/href="https:\/\/instagram.com\/example" target="_blank" rel="noopener noreferrer"/);assert.doesNotMatch(html,/javascript:/);
 assert.doesNotMatch(renderToStaticMarkup(React.createElement(Navigation,{slug:'example-business',name:'Example'})),/Business social media/);
});

test('booking sharing uses the native share sheet, supports clipboard fallback, respects cancellation and exposes both QR downloads',async t=>{
 let source=ts.transpileModule(await readFile(new URL('../app/components/booking-page-sharing.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 source=source.replace(/import \{ useEffect, useState \}[^\n]+;/,"let index=0;const useEffect=()=>{},useState=initial=>{const i=index++;return [i===0?'https://example.test/book/my-business':i===3?new File(['fixture-png'],'my-business-booking-qr.png',{type:'image/png'}):initial,()=>{}];};").replace(/import \{[^\n]+\} from "react\/jsx-runtime";/,"const _jsx=(type,props)=>({type,props}),_jsxs=_jsx,_Fragment='fragment';").replace("'../../server/booking-share-url.mjs'",JSON.stringify(new URL('../server/booking-share-url.mjs',import.meta.url).href));
 const {default:Sharing}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64')),buttons=[],links=[];function visit(n){if(!n||typeof n!=='object')return;if(n.type==='button')buttons.push(n);if(n.type==='a')links.push(n);for(const child of [n.props?.children].flat(Infinity))visit(child);}visit(Sharing({slug:'my-business',name:'My Business'}));
 const previous=Object.getOwnPropertyDescriptor(globalThis,'navigator'),shared=[],copied=[];Object.defineProperty(globalThis,'navigator',{configurable:true,value:{share:async data=>shared.push(data),clipboard:{writeText:async data=>copied.push(data)}}});t.after(()=>{if(previous)Object.defineProperty(globalThis,'navigator',previous);else delete globalThis.navigator;});
 const share=buttons.find(b=>b.props.children==='Share booking page');await share.props.onClick();assert.equal(shared[0].url,'https://example.test/book/my-business');assert.equal(copied.length,0);
 navigator.share=async()=>{throw Object.assign(Error('Cancelled'),{name:'AbortError'});};await share.props.onClick();assert.equal(copied.length,0);
 delete navigator.share;await share.props.onClick();assert.deepEqual(copied,['https://example.test/book/my-business']);
 const qrButton=buttons.find(b=>b.props.children==='Share QR image');navigator.canShare=()=>true;navigator.share=async data=>shared.push(data);t.mock.method(globalThis,'fetch',async()=>assert.fail('Native image sharing must use the prepared file without awaiting a network request after the user gesture'));await qrButton.props.onClick();const imageShare=shared.at(-1);assert.equal(imageShare.files[0].name,'my-business-booking-qr.png');assert.equal(imageShare.files[0].type,'image/png');assert.ok(links.some(a=>a.props.href==='/api/studio/booking-qr?format=png&download=1'));assert.ok(links.some(a=>a.props.href==='/api/studio/booking-qr?format=svg&download=1'));
});
