import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {isReservedBusinessSlug} from '../server/route-slugs.mjs';

test('public privacy page renders accessible section links, current practices and a contact route without sign-in',async()=>{
 const require=createRequire(import.meta.url);
 let source=await readFile(new URL('../app/privacy/page.tsx',import.meta.url),'utf8');
 source=source.replace(/import PublicNavigation[^\n]+;/,'const PublicNavigation=()=>null;').replace(/import PublicFooter[^\n]+;/,'const PublicFooter=()=>null;').replace(/import site[^\n]+;/,'const site={};').replace(/import styles[^\n]+;/,'const styles={};');
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText.replace('"react/jsx-runtime"',JSON.stringify(pathToFileURL(require.resolve('react/jsx-runtime')).href));
 const {default:Policy,metadata}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
 const html=renderToStaticMarkup(React.createElement(Policy));
 assert.equal(metadata.title,'Privacy Policy | SelahFlow');
 assert.match(html,/<main id="main-content"/);assert.match(html,/<h1>Privacy Policy<\/h1>/);
 assert.equal((html.match(/<section id=/g)||[]).length,11);
 for(const match of html.matchAll(/href="#([^"]+)"/g))assert.ok(html.includes('id="'+match[1]+'"'));
 assert.match(html,/mailto:selahflow7@gmail.com/);
 assert.match(html,/Parents or legal guardians/);assert.match(html,/waivers/i);assert.match(html,/Stripe/);assert.match(html,/unsubscribe/i);assert.match(html,/backup/i);
 assert.doesNotMatch(source,/requireOwner|requireAdmin|redirect\(/);
});
test('Privacy Policy is reachable from desktop, mobile and footer navigation and cannot collide with a tenant slug',async()=>{
 const [navigation,footer]=await Promise.all(['app/components/public-navigation.tsx','app/components/public-footer.tsx'].map(p=>readFile(new URL('../'+p,import.meta.url),'utf8')));
 assert.equal((navigation.match(/href="\/privacy"/g)||[]).length,2);
 assert.match(footer,/href="\/privacy">Privacy Policy/);
 assert.equal(isReservedBusinessSlug('privacy'),true);
});
