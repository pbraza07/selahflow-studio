// Read-only release checks: no accounts, credentials, appointments or messages are created.
import assert from 'node:assert/strict';
const targets=JSON.parse(process.env.SMOKE_TARGETS||'[]');assert.ok(targets.length,'Explicit targets required');
for(const {url,version} of targets){
 const health=await(await fetch(url+'/api/health',{signal:AbortSignal.timeout(20000)})).json();assert.equal(health.version,version);
 for(const [path,expected] of [['/api/team/portal',401],['/api/studio/team-access',401],['/api/team/public?id=00000000-0000-4000-8000-000000000000',404],['/api/team/media?id=00000000-0000-4000-8000-000000000000',404]]){const r=await fetch(url+path,{signal:AbortSignal.timeout(20000)});assert.equal(r.status,expected,path);assert.match(r.headers.get('cache-control')||'',/no-store/);}
 for(const path of ['/api/team/portal','/api/studio/team-access','/api/team/media','/api/team/login']){const r=await fetch(url+path,{method:'POST',headers:{Origin:'https://example.invalid','Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(20000)});assert.equal(r.status,403,path);}
 const isolated=await fetch(url+'/api/studio',{headers:{cookie:'selahflow_team='+'0'.repeat(64)},signal:AbortSignal.timeout(20000)});assert.equal(isolated.status,401);
 const page=await fetch(url+'/team/login',{signal:AbortSignal.timeout(20000)});assert.equal(page.status,200);const html=await page.text();assert.match(html,/Team member sign in/);assert.match(html,/Business link name/);assert.match(html,/Open my workspace/);
 console.log(url+' v'+version+': team sign-in, account separation, private endpoints, unknown pages/media and origin protections passed.');
}
