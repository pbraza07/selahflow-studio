import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {reconcileMembershipPayments,loadMembershipReportPayments} from '../server/report-payments.mjs';
const created='2026-10-14T17:41:41.363Z';
test('historical cents and duplicate ledger copies reconcile to $2,560, preserving removed-client payments',()=>{
 const events=[60000,80000,32000,84000].map((total,i)=>({id:'e'+i,kind:'membership_payment',membershipId:'m'+i,total,created}));
 const ledger=[{id:'l1',membership_id:'m3',amount_cents:84000,created:'2026-10-14T17:41:41.357931Z'}];
 const rows=reconcileMembershipPayments(events,ledger);
 assert.equal(rows.length,4);assert.equal(rows.reduce((n,p)=>n+p.total,0),2560);
 assert.equal(events[0].total,60000,'source history remains unchanged');
});
test('renewals remain separate, request IDs match across timestamps, ledger-only payments survive',()=>{
 const events=[{id:'e1',kind:'membership_payment',membershipId:'m',requestId:'r1',amountCents:10000,created},
 {id:'e2',kind:'membership_payment',membershipId:'m',requestId:'r2',amountCents:10000,created,renewal:true}];
 const ledger=['r1','r2','r3'].map((appointment_id,i)=>({id:'l'+i,membership_id:'m',appointment_id,amount_cents:10000,created:'2026-10-15T00:00:00Z'}));
 const rows=reconcileMembershipPayments(events,ledger);
 assert.equal(rows.length,3);assert.equal(rows.reduce((n,p)=>n+p.total,0),300);
 assert.equal(rows.filter(p=>p.renewal).length,1);
});
test('legacy matching consumes only one audit per ledger and does not collapse distinct renewals',()=>{
 const events=[{id:'e',kind:'membership_payment',membershipId:'m',total:10000,created}];
 const ledger=[1,2].map(i=>({id:'l'+i,membership_id:'m',amount_cents:10000,created}));
 assert.equal(reconcileMembershipPayments(events,ledger).length,2);
});
test('database reporting is tenant-scoped and includes payments beyond 500 audit rows',async()=>{
 const pg=new PGlite();try{
  for(const f of (await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await pg.exec(await readFile(new URL('../migrations/'+f,import.meta.url),'utf8'));
  await pg.exec("INSERT INTO users(id,email,password_hash) VALUES('u1','a@example.com','hash'),('u2','b@example.com','hash'); INSERT INTO businesses(id,owner_id,slug,name,status) VALUES('b1','u1','one','One','active'),('b2','u2','two','Two','active');");
  await pg.exec(`INSERT INTO events(id,owner,created,kind,data) SELECT 'e'||i,'u1','2026-10-01T12:00:00Z','membership_payment','{"membershipId":"removed","total":10000}' FROM generate_series(1,501) AS i`);
  await pg.exec(`INSERT INTO events(id,owner,created,kind,data) VALUES('other','u2','2026-10-01T12:00:00Z','membership_payment','{"total":990000}'),('pending','u1','2026-10-01T12:00:00Z','membership_request_approved','{"total":90000}')`);
  const result=await loadMembershipReportPayments(pg,'u1');
  assert.equal(result.length,501);assert.equal(result.reduce((n,p)=>n+p.total,0),50100);
  assert.equal((await loadMembershipReportPayments(pg,'u2'))[0].total,9900);
 }finally{await pg.close();}
});
