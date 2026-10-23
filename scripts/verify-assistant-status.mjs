import assert from 'node:assert/strict';
const targets=JSON.parse(process.env.SMOKE_TARGETS||'[]');assert.ok(targets.length,'Explicit deployment targets required');
for(const {url:base,version} of targets){
const get=async path=>{const r=await fetch(base+path,{signal:AbortSignal.timeout(30000)});assert.equal(r.status,200,path);return r.json();};
assert.equal((await get('/api/health')).version,version);
const {businesses}=await get('/api/marketplace');assert.ok(businesses.length);
for(const b of businesses){
 const r=await fetch(base+'/api/booking?slug='+encodeURIComponent(b.slug),{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({action:'registration_latest_status',memberNumber:'ZZ000000'}),signal:AbortSignal.timeout(30000)});
 assert.equal(r.status,200,b.slug);assert.match(r.headers.get('cache-control')||'',/no-store/);
 const d=await r.json();assert.equal(d.ok,true);assert.equal(d.membership,null);assert.equal(d.latest,null);assert.equal(d.payment,null);
 assert.ok(Object.keys(d).every(key=>['ok','latest','membership','payment'].includes(key)));
 console.log(b.slug+': ID-only unknown-status lookup passed, no personal fields or customer record changes');
}
console.log(base+' v'+version+' assistant status API checks passed for '+businesses.length+' businesses.');

}
