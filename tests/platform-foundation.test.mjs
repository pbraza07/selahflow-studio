import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';
const url=new URL('../migrations/',import.meta.url);
test('v1.3 migration is additive and business owner scope is isolated',async()=>{
 const pg=new PGlite();
 try{
  for(const name of ['001_initial.sql','002_public_booking.sql','003_platform_foundation.sql'])await pg.exec(await readFile(new URL(name,url),'utf8'));
  await pg.query("INSERT INTO users(id,email,password_hash) VALUES('owner-a','a@example.test','x'),('owner-b','b@example.test','x')");
  await pg.query("INSERT INTO businesses(id,owner_id,slug,name,industry,is_listed) VALUES('biz-a','owner-a','barber-a','Barber A','barber',true),('biz-b','owner-b','groomer-b','Groomer B','pet-grooming',false)");
  await pg.query("INSERT INTO business_memberships(business_id,user_id,role) VALUES('biz-a','owner-a','owner'),('biz-b','owner-b','owner')");
  await pg.query("INSERT INTO business_subscriptions(business_id,plan_code,status) VALUES('biz-a','free','active'),('biz-b','professional','active')");
  const visible=(await pg.query("SELECT slug FROM businesses WHERE is_listed=TRUE AND status='active'")).rows;
  assert.deepEqual(visible,[{slug:'barber-a'}]);
  const one=(await pg.query("SELECT owner_id FROM businesses WHERE slug=$1 AND status='active'",['groomer-b'])).rows[0];
  assert.equal(one.owner_id,'owner-b');
  await assert.rejects(pg.query("INSERT INTO businesses(id,owner_id,slug,name) VALUES('duplicate','owner-a','another','Duplicate')"));
  await assert.rejects(pg.query("INSERT INTO businesses(id,owner_id,slug,name) VALUES('duplicate2','owner-b','barber-a','Duplicate')"));
  assert.equal((await pg.query("SELECT COUNT(*)::int AS count FROM appointments")).rows[0].count,0);
 }finally{await pg.close();}
});
test('reserved Crawford original business retains existing appointments and cannot be re-registered',async()=>{
 const pg=new PGlite();
 try{
  for(const name of ['001_initial.sql','002_public_booking.sql','003_platform_foundation.sql'])await pg.exec(await readFile(new URL(name,url),'utf8'));
  await pg.query("INSERT INTO users(id,email,password_hash) VALUES('original','original@example.test','x'),('new','new@example.test','x')");
  await pg.query("INSERT INTO appointments(id,owner,date,staff,start,duration,data,status) VALUES('old-booking','original','2026-12-01','ava',540,60,'{}','Confirmed')");
  await pg.query("INSERT INTO businesses(id,owner_id,slug,name,industry) VALUES('first','original','crawford','Crawford','barber')");
  await assert.rejects(pg.query("INSERT INTO businesses(id,owner_id,slug,name) VALUES('second','new','crawford','Copy')"));
  assert.equal((await pg.query("SELECT owner FROM appointments WHERE id='old-booking'")).rows[0].owner,'original');
  assert.equal((await pg.query("SELECT owner_id FROM businesses WHERE slug='crawford'")).rows[0].owner_id,'original');
 }finally{await pg.close();}
});
test('v1.3 proposed plans and commission math reject invalid values',async()=>{
 const source=await readFile(new URL('../lib/plans.ts',import.meta.url),'utf8');
 const {PLAN_CATALOG}=await import('../server/plan-entitlements.mjs');
 // The test dynamically imports a data: URL, which cannot resolve relative
 // imports. Inline the canonical read-only plan catalog for this isolated unit.
 const isolated=source.replace("import {PLAN_CATALOG} from '../server/plan-entitlements.mjs';",
  'const PLAN_CATALOG='+JSON.stringify(PLAN_CATALOG)+';');
 const output=ts.transpileModule(isolated,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 const mod=await import('data:text/javascript;base64,'+Buffer.from(output).toString('base64'));
 assert.equal(mod.PLANS.free.monthlyCents,0);
 assert.equal(mod.PLANS.professional.monthlyCents,2499);
 assert.equal(mod.referralFeeCents(7000),700);
 assert.equal(mod.referralFeeCents(100),200);
 assert.equal(mod.referralFeeCents(40000),1500);
 assert.equal(mod.referralFeeCents(0),0);
 assert.throws(()=>mod.referralFeeCents(-1));
});
