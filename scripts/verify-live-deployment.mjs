import assert from 'node:assert/strict';
const targets=JSON.parse(process.env.SMOKE_TARGETS||'[]');
assert.ok(targets.length,'Explicit deployment targets required');
for(const {url,version} of targets){
 for(let attempt=0;;attempt++){try{const r=await fetch(url+'/api/health',{signal:AbortSignal.timeout(20000)});const h=await r.json();if(r.ok&&h.status==='ok'&&h.version===version)break;}catch{}if(attempt>=120)throw Error(url+' expected deployment not ready');await new Promise(resolve=>setTimeout(resolve,5000));}
 const get=async(path,status,needle)=>{const response=await fetch(url+path,{redirect:'manual',signal:AbortSignal.timeout(60000)});assert.equal(response.status,status,path);const text=await response.text();if(needle)assert.ok(text.includes(needle),path+' missing expected UI text');console.log(url+path+' HTTP '+status);return text;};
 const health=JSON.parse(await get('/api/health',200));assert.equal(health.status,'ok');assert.equal(health.version,version);console.log(url+' verified v'+health.version);
 await get('/book',200);
 await get('/membership-pay/invalid',200,'Membership payment');
 await get('/api/studio/team-tracking',401);
 await get('/api/studio/memberships',401);
 const invalid=await fetch(url+'/api/public/membership-invitation',{method:'POST',headers:{'Content-Type':'application/json',Origin:url},body:JSON.stringify({action:'details',token:'invalid'}),signal:AbortSignal.timeout(30000)});
 assert.equal(invalid.status,400);assert.match(invalid.headers.get('cache-control')||'',/no-store/);console.log(url+' invalid invitation safely rejected; no-store');
}
console.log('Live read-only deployment verification passed');
