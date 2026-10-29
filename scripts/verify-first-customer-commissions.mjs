import assert from 'node:assert/strict';
const targets=JSON.parse(process.env.SMOKE_TARGETS||'[]');assert.ok(targets.length,'Explicit targets required');
for(const {url,version}of targets){
 const health=await(await fetch(url+'/api/health')).json();assert.equal(health.version,version);
 for(const path of ['/api/studio/commissions','/api/platform/commissions']){
  const get=await fetch(url+path,{signal:AbortSignal.timeout(20000)});assert.equal(get.status,401);assert.match(get.headers.get('cache-control')||'',/no-store/);
  for(const enabled of [true,false]){const change=await fetch(url+path,{method:'POST',headers:{Origin:url,'Content-Type':'application/json'},body:JSON.stringify({action:'setEnabled',businessId:'00000000-0000-4000-8000-000000000000',kind:'booking',enabled}),signal:AbortSignal.timeout(20000)});assert.equal(change.status,401);assert.match(change.headers.get('cache-control')||'',/no-store/);}
  const denied=await fetch(url+path,{method:'POST',headers:{Origin:'https://evil.test','Content-Type':'application/json'},body:JSON.stringify({action:'configureWebhooks'}),signal:AbortSignal.timeout(20000)});assert.equal(denied.status,403);
 }
 const home=await fetch(url+'/businesses',{signal:AbortSignal.timeout(30000)});assert.equal(home.status,200);assert.ok((await home.text()).includes('10% or $5 minimum on each first purchase type.'));
 console.log(url+' v'+version+' commission disclosure and protected/origin checks passed. No fees activated or payments created.');
}
