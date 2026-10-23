import assert from 'node:assert/strict';
const targets=JSON.parse(process.env.SMOKE_TARGETS||'[]');assert.ok(targets.length,'Explicit targets required');
for(const {url:base,version} of targets){
 const get=async path=>{const r=await fetch(base+path,{signal:AbortSignal.timeout(30000)});assert.equal(r.status,200,path);return r.json();};
 const ask=async(slug,message,expected=200,origin=base)=>{const r=await fetch(base+'/api/public/assistant',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({slug,message}),signal:AbortSignal.timeout(30000)});assert.equal(r.status,expected,message);assert.match(r.headers.get('cache-control')||'',/no-store/);const data=await r.json();if(expected===200){
   assert.ok(Array.isArray(data.sections),'Structured answer sections');
   const items=data.sections.flatMap(section=>{assert.ok(section.title);assert.ok(section.items.length);return section.items;});
   assert.equal(items.length,data.sources.length,'Every selected source has a subsection');
   for(const item of items){assert.ok(item.title&&item.text);assert.ok(data.answer.includes(item.title+'\n'+item.text));assert.ok(data.sources.some(source=>source.title===item.title&&source.href===item.href));}
  }return data;};
 const health=await get('/api/health');assert.equal(health.version,version);
 const {businesses}=await get('/api/marketplace');assert.ok(businesses.length);
 for(const b of businesses){
  const {config}=await get('/api/booking?slug='+b.slug);
  const prices=await ask(b.slug,'Services and prices');assert.equal(prices.businessName,b.name);
  for(const s of config.services){assert.ok(prices.answer.includes(s.name),s.name);assert.ok(prices.answer.includes(new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(s.price)),s.name+' price');}
  assert.ok(prices.sources.every(s=>s.href==='/'+b.slug||s.href==='/book/'+b.slug||s.href==='/membership/'+b.slug));
  const contact=await ask(b.slug,'Hours and location');if(config.address)assert.ok(contact.answer.includes(config.address));
  const m=await get('/api/public/memberships?slug='+b.slug),membership=await ask(b.slug,'Memberships and credits');
  for(const p of m.plans)assert.ok(membership.answer.includes(p.name),p.name);
  const waiver=await ask(b.slug,'Waiver and media release');if(config.services.some(s=>s.requiresWaiver))assert.match(waiver.answer,/A waiver is required/);
  // Arcila's current reviewed clause was separately activated and verified; templates alone are not review evidence.
  if(b.slug==='arcillatrng')assert.match(waiver.answer,/Media release/);
  assert.match((await ask(b.slug,'What is the weather forecast in Tokyo?')).answer,/couldn’t find a published answer/);
  const schedule=await ask(b.slug,'Upcoming session schedule');assert.ok(schedule.answer.length);
  const nextDate=schedule.sources[0]?.title.match(/20\d{2}-\d{2}-\d{2}/)?.[0];
  if(nextDate){const dated=await ask(b.slug,'Sessions on '+nextDate);assert.ok(dated.sources.length);assert.ok(dated.sources.every(s=>s.title.includes(nextDate)));}else assert.match(schedule.answer,/couldn’t find a published answer/);
  if(b.slug==='arcillatrng'){const mixed=await ask(b.slug,'Private Session price and membership credits?');assert.match(mixed.answer,/\$90\.00/);assert.match(mixed.answer,/Included sessions: 4/);}
  console.log(JSON.stringify({business:b.name,slug:b.slug,services:config.services.length,memberships:m.plans.length,priceSources:prices.sources.length,scheduleSources:schedule.sources.length,checks:'PASS'}));
 }
 await ask('not-a-real-business','Hours',404);await ask(businesses[0].slug,'Hours',403,'https://evil.test');
 console.log(base+' v'+version+' public assistant verification passed; no records modified.');
}
