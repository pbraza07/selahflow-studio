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
test('durable project context snapshot matches the actual version and requires update on new releases',async()=>{
 const [agents,project,readme,rawPackage]=await Promise.all([
  readFile(new URL('AGENTS.md',root),'utf8'),
  readFile(new URL('docs/CHATGPT_PROJECT_CONTINUITY.md',root),'utf8'),
  readFile(new URL('README.md',root),'utf8'),
  readFile(new URL('package.json',root),'utf8')
 ]);
 const version=JSON.parse(rawPackage).version;
 assert.match(agents,/latest LIVE Render deploy/i);
 assert.match(agents,/package\.json/i);
 assert.match(agents,/tenant/i);
 assert.match(project,/Project Instructions/);
 assert.match(project,/not automatically injected/i);
 assert.equal(agents.match(/Snapshot verified[^\n]*\*\*v(\d+\.\d+\.\d+) LIVE\*\*/)?.[1],version,
  'Update the AGENTS.md snapshot when bumping the app version');
 assert.equal(project.match(/\| Live version \| \*\*(\d+\.\d+\.\d+)\*\*/)?.[1],version,
  'Update the ChatGPT project handoff snapshot when bumping the app version');
 assert.equal(readme.match(/Current snapshot[^\n]*v(\d+\.\d+\.\d+) LIVE/)?.[1],version,
  'Update the README snapshot on each new functional release');
});
