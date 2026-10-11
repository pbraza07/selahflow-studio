import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
test('repository VERSION marker matches package.json so new conversations have a consistent release indicator',async()=>{
 const [rawVersion,rawPackage]=await Promise.all([
  readFile(new URL('VERSION',root),'utf8'),
  readFile(new URL('package.json',root),'utf8')
 ]);
 const marker=rawVersion.trim(),pkg=JSON.parse(rawPackage);
 assert.match(marker,/^\d+\.\d+\.\d+$/,'VERSION must be a semantic release version');
 assert.equal(marker,pkg.version,'Update VERSION whenever package.json version is incremented');
});
test('durable project context points to live-deployment verification rather than hardcoded old versions',async()=>{
 const [agents,project]=await Promise.all([
  readFile(new URL('AGENTS.md',root),'utf8'),
  readFile(new URL('docs/CHATGPT_PROJECT_CONTINUITY.md',root),'utf8')
 ]);
 assert.match(agents,/latest LIVE Render deploy/i);
 assert.match(agents,/package\.json/i);
 assert.match(agents,/tenant/i);
 assert.match(agents,/v1\.3\.30/);
 assert.match(project,/Project Instructions/);
 assert.match(project,/v1\.3\.30/);
 assert.match(project,/not automatically injected/i);
});
