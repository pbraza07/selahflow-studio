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
test('source release is documented separately from verified deployment snapshots',async()=>{
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
 assert.ok(project.includes('v'+version+' release handoff'),'Document the current source release without claiming it is live');
 assert.ok(readme.includes('Release source: v'+version),'README identifies the source release');
 const health=await readFile(new URL('app/api/health/route.ts',root),'utf8');
 const shared=await readFile(new URL('lib/app-version.ts',root),'utf8');
 assert.match(health,/version:APP_VERSION/);
 assert.match(shared,/APP_VERSION = packageInfo.version/);
});
