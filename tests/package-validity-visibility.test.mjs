import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';
import {applyManualPeriod} from '../server/manual-membership-period.mjs';
import {refreshMemberPeriod} from '../server/membership-periods.mjs';
import {membershipBookingActive} from '../server/membership-weekly.mjs';
import {startMembershipCheckout} from '../server/membership-checkout.mjs';
import {registerMembershipWithoutApproval} from '../server/membership-requests.mjs';
test('package validity is snapshotted, starts with payment, blocks out-of-period sessions and never resets credits',async()=>{
 const pg=new PGlite();try{
 for(const f of(await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await pg.exec(await readFile(new URL('../migrations/'+f,import.meta.url),'utf8'));
 const query=async(s,v)=>{const r=await pg.query(s,v);return {...r,rowCount:r.rows.length||r.affectedRows||0};},db={query,release(){}},pool={query,connect:async()=>db};
 await pg.exec("INSERT INTO users(id,email,password_hash) VALUES('owner','owner@example.test','hash'); INSERT INTO businesses(id,owner_id,slug,name,status) VALUES('biz','owner','example','Example','active'); INSERT INTO membership_plans(id,business_id,name,interval_unit,price_cents,sessions_included,billing_type,package_valid_days) VALUES('plan','biz','Ten sessions','month',10000,10,'package',90); INSERT INTO customer_memberships(id,business_id,plan_id,customer_name,customer_email,status,price_cents,stripe_account_id) VALUES('member','biz','plan','Example Client','client@example.test','pending_payment',10000,'')");
 let member=(await query('SELECT * FROM customer_memberships')).rows[0];assert.equal(member.package_valid_days,90);assert.equal(member.paid_through,null);
 await query('UPDATE membership_plans SET package_valid_days=30 WHERE id=$1',['plan']);
 const now=new Date('2035-01-01T12:00:00Z');await applyManualPeriod(db,{member,plan:member,credits:10,now});
 member=(await query('SELECT * FROM customer_memberships')).rows[0];assert.equal(new Date(member.paid_through).toISOString(),'2035-04-01T12:00:00.000Z');assert.equal(member.package_valid_days,90);
 assert.equal(membershipBookingActive(member,'2035-03-31'),true);assert.equal(membershipBookingActive(member,'2035-04-01'),false);
 await query('UPDATE customer_memberships SET sessions_used=3 WHERE id=$1',['member']);member=(await query('SELECT * FROM customer_memberships')).rows[0];
 const refreshed=await refreshMemberPeriod(db,member,new Date('2035-02-15'));assert.equal(refreshed.sessions_used,3);assert.equal(refreshed.sessions_included,10);
 const expired=await refreshMemberPeriod(db,member,new Date('2035-04-02'));assert.equal(expired.status,'expired');assert.equal(expired.sessions_used,3);
 await assert.rejects(query("UPDATE membership_plans SET package_valid_days=0 WHERE id='plan'"),/check constraint/);
 // Visibility affects public discovery and new enrollment, while retaining the member.
 await query("UPDATE membership_plans SET hidden_from_clients=true WHERE id='plan'");
 const url=new URL('../app/api/public/memberships/route.ts',import.meta.url),exports={},native=createRequire(url);
 const source=ts.transpileModule(await readFile(url,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','exports',source)(p=>p.endsWith('/server/database.mjs')?{getPool:()=>pool}:native(p),exports);
 await query("INSERT INTO business_subscriptions(business_id,plan_code,status) VALUES('biz','business','active')");
 const ownerUrl=new URL('../app/api/studio/memberships/route.ts',import.meta.url),ownerExports={},ownerRequire=createRequire(ownerUrl);
 const ownerSource=ts.transpileModule(await readFile(ownerUrl,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','exports',ownerSource)(p=>p.endsWith('/server/database.mjs')?{getPool:()=>pool}:p.endsWith('/lib/auth')?{requireOwner:async()=> 'owner'}:ownerRequire(p),ownerExports);
 const originalOrigin=process.env.APP_URL;process.env.APP_URL='https://example.test';
 try{
  const created=await ownerExports.POST(new Request('https://example.test/api/studio/memberships',{method:'POST',headers:{Origin:'https://example.test','Content-Type':'application/json'},body:JSON.stringify({action:'save',name:'Private package',description:'',billingType:'package',priceCents:5000,sessionsIncluded:8,packageValidDays:45,hiddenFromClients:true,weeklySessions:null,interval:'month'})}));
  assert.equal(created.status,200,await created.clone().text());const saved=(await query("SELECT * FROM membership_plans WHERE name='Private package'")).rows[0];assert.equal(saved.package_valid_days,45);assert.equal(saved.hidden_from_clients,true);assert.equal(saved.sessions_included,8);
 }finally{if(originalOrigin===undefined)delete process.env.APP_URL;else process.env.APP_URL=originalOrigin;}
 const response=await exports.GET(new Request('https://example.test/api/public/memberships?slug=example'));assert.equal(response.status,200);assert.deepEqual((await response.json()).plans,[]);
 await assert.rejects(startMembershipCheckout(pool,{slug:'example',planId:'plan',requestId:randomUUID()},'https://example.test',async()=>{throw Error('Must not contact payment provider');}),/available membership/);
 await assert.rejects(registerMembershipWithoutApproval(pool,{businessId:'biz',ownerId:'owner',planId:'plan',requestId:randomUUID(),details:{},publicRegistration:true}),/available membership/);
 assert.equal((await query('SELECT count(*)::int n FROM customer_memberships')).rows[0].n,1);
 await query("UPDATE membership_plans SET hidden_from_clients=false WHERE id='plan'");
 const shown=await exports.GET(new Request('https://example.test/api/public/memberships?slug=example'));const plan=(await shown.json()).plans[0];assert.equal(plan.packageValidDays,30);assert.match(plan.usageSummary,/30 days/);
 }finally{await pg.close();}
});
