import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import ts from 'typescript';
import {hashPassword,tokenHash} from '../server/security.mjs';
import {teamLogin,teamCookie,teamIdentity} from '../server/team-portal.mjs';
import {requestTeamCancellation,reviewTeamCancellation,listTeamCancellations,listOwnerCancellations} from '../server/team-cancellations.mjs';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
async function setup(t){
 const db=new PGlite();t.after(()=>db.close());
 for(const f of(await readdir(new URL('../migrations/',import.meta.url))).filter(x=>x.endsWith('.sql')).sort())await db.exec(await read('migrations/'+f));
 for(const owner of ['o','other']){await db.query('INSERT INTO users(id,email,password_hash) VALUES($1,$2,$3)',[owner,owner+'@example.test','unused']);await db.query('INSERT INTO businesses(id,owner_id,slug,name) VALUES($1,$2,$1,$2)',['biz-'+owner,owner]);await db.query('INSERT INTO settings(owner,data) VALUES($1,$2)',[owner,JSON.stringify({open:8,close:18,staff:[{id:'a',name:'Alex',services:['s']},{id:'b',name:'Blair',services:['s']}],services:[{id:'s',name:'Service',price:100,duration:30}],bookableSessions:[]})]);}
 for(const [id,business,staff] of [['aa','biz-o','a'],['bb','biz-o','b'],['cc','biz-other','a']])await db.query("INSERT INTO team_accounts(id,business_id,staff_id,email,password_hash,must_change_password) VALUES($1,$2,$3,$4,$5,false)",[id,business,staff,id+'@example.test',hashPassword('test-secret')]);
 await db.query("INSERT INTO appointments VALUES('visit','o','2030-01-02','a',600,30,$1,'Confirmed'),('foreign','other','2030-01-02','a',600,30,$1,'Confirmed')",[JSON.stringify({name:'Synthetic Client',services:['Service'],price:100,serviceIds:['s'],memberNumber:'SC1001',paymentStatus:'paid'})]);
 await db.exec("INSERT INTO slots VALUES('o','2030-01-02','a',600,'visit');INSERT INTO business_client_profiles(id,owner,name,member_number) VALUES('profile','o','Synthetic Client','SC1001');");
 let q=Promise.resolve();const pool={query:(s,v)=>db.query(s,v),async connect(){const prior=q;let release;q=new Promise(r=>release=r);await prior;return {query:(s,v)=>s.includes('pg_advisory_xact_lock')?Promise.resolve({rows:[]}):db.query(s,v),release};}};
 const login=async id=>(await teamLogin(pool,{email:id+'@example.test',password:'test-secret'})).token;
 const token=await login('aa');const req=(body,cookie=teamCookie(token))=>new Request('https://example.test/api/team/cancellations',{method:body?'POST':'GET',headers:{cookie,origin:'https://example.test'},...(body?{body:JSON.stringify(body)}:{})});
 const request=(extra={},cookie)=>requestTeamCancellation(pool,req(null,cookie),{appointmentId:'visit',reason:'Schedule conflict',...extra});
 return {db,pool,token,login,req,request};
}
test('team requests reserve no changes, deduplicate, reject foreign/unassigned/closed appointments and preserve clients',async t=>{
 const s=await setup(t);const before=(await s.db.query("SELECT * FROM appointments WHERE id='visit'")).rows[0];
 const r=await s.request();assert.equal((await s.request()).id,r.id);assert.equal((await s.db.query('SELECT * FROM team_cancellation_requests')).rows.length,1);
 assert.deepEqual((await s.db.query("SELECT * FROM appointments WHERE id='visit'")).rows[0],before);assert.equal((await s.db.query('SELECT * FROM slots')).rows.length,1);
 assert.equal((await listTeamCancellations(s.pool,await teamIdentity(s.pool,s.req()))).length,1);
 await assert.rejects(s.request({appointmentId:'foreign'}),/assigned/);
 await assert.rejects(s.request({},teamCookie(await s.login('bb'))),/assigned/);
 await assert.rejects(s.request({reason:' '.repeat(5)}),/reason/);await assert.rejects(s.request({reason:'x'.repeat(501)}),/reason/);
 await s.db.exec("UPDATE appointments SET status='Completed' WHERE id='visit'");await assert.rejects(s.request(),/closed/);
 assert.equal((await s.db.query('SELECT * FROM business_client_profiles')).rows.length,1);
});
test('owner approval uses standard cancellation, retains paid data and customer history, releases slots once and scopes decisions',async t=>{
 const s=await setup(t),r=await s.request();
 assert.equal((await listOwnerCancellations(s.pool,'other')).length,0);
 await assert.rejects(reviewTeamCancellation(s.pool,'other',{id:r.id,accept:true,confirmed:true}),/unavailable/);
 await assert.rejects(reviewTeamCancellation(s.pool,'o',{id:r.id,accept:true}),/Confirm/);
 assert.equal((await reviewTeamCancellation(s.pool,'o',{id:r.id,accept:true,confirmed:true})).status,'approved');
 assert.equal((await reviewTeamCancellation(s.pool,'o',{id:r.id,accept:true,confirmed:true})).alreadyProcessed,true);
 const ap=(await s.db.query("SELECT * FROM appointments WHERE id='visit'")).rows[0];assert.equal(ap.status,'Cancelled');assert.equal(JSON.parse(ap.data).paymentStatus,'paid');assert.equal((await s.db.query('SELECT * FROM slots')).rows.length,0);
 assert.equal((await s.db.query("SELECT * FROM events WHERE kind='status'")).rows.length,1);assert.equal((await s.db.query('SELECT * FROM business_client_profiles')).rows.length,1);
 assert.equal((await listOwnerCancellations(s.pool,'o'))[0].status,'approved');await assert.rejects(reviewTeamCancellation(s.pool,'o',{id:r.id,accept:false}),/already/);
});
test('declines leave bookings active; changed appointments and open payment attempts cannot be approved',async t=>{
 const s=await setup(t),r=await s.request();await reviewTeamCancellation(s.pool,'o',{id:r.id,accept:false});assert.equal((await s.db.query("SELECT status FROM appointments WHERE id='visit'")).rows[0].status,'Confirmed');
 const next=await s.request();await s.db.exec("UPDATE appointments SET start=615 WHERE id='visit'");await assert.rejects(reviewTeamCancellation(s.pool,'o',{id:next.id,accept:true,confirmed:true}),/changed/);
 await reviewTeamCancellation(s.pool,'o',{id:next.id,accept:false});const current=await s.request();
 await s.db.exec("INSERT INTO booking_payments(booking_id,business_id,stripe_account_id,amount_cents,lines,stripe_checkout_session_id) VALUES('visit','biz-o','acct_synthetic',10000,'[]','cs_synthetic')");
 await assert.rejects(reviewTeamCancellation(s.pool,'o',{id:current.id,accept:true,confirmed:true}),/open card payment/);assert.equal((await s.db.query('SELECT status FROM team_cancellation_requests WHERE id=$1',[current.id])).rows[0].status,'pending');
 await s.db.exec("UPDATE booking_payments SET status='expired'");await reviewTeamCancellation(s.pool,'o',{id:current.id,accept:true,confirmed:true});assert.equal((await s.db.query("SELECT status FROM appointments WHERE id='visit'")).rows[0].status,'Cancelled');
});
test('removed, password-rotation and unpaid team accounts cannot submit requests',async t=>{
 const s=await setup(t);await s.db.exec("UPDATE team_accounts SET must_change_password=true WHERE id='aa'");await assert.rejects(s.request(),/password/);
 await s.db.exec("UPDATE team_accounts SET must_change_password=false,workspace_fee_cents=1000 WHERE id='aa'");await assert.rejects(s.request(),/payment/);
 await s.db.exec("UPDATE team_accounts SET active=false WHERE id='aa'");await assert.rejects(s.request(),/unavailable/);assert.equal((await s.db.query('SELECT * FROM team_cancellation_requests')).rows.length,0);
});
test('owner notification inbox includes cancellation alerts and marks them read without changing the request',async t=>{
 const s=await setup(t),r=await s.request(),old=process.env.APP_URL;process.env.APP_URL='https://example.test';t.after(()=>{if(old)process.env.APP_URL=old;else delete process.env.APP_URL;});
 let source=ts.transpileModule(await read('app/api/push/inbox/route.ts'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 globalThis.__cancelInbox={pool:s.pool,businessId:'biz-o',reviewer:'owner'};t.after(()=>delete globalThis.__cancelInbox);
 source=source.replace(/import \{ pushContext \}[^\n]+;/,'const pushContext=async()=>globalThis.__cancelInbox;').replace(/(['"])\.\.\/\.\.\/\.\.\/\.\.\/server\/([^'"]+)\1/g,(_,q,f)=>JSON.stringify(new URL('../server/'+f,import.meta.url).href));
 const api=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 let d=await(await api.GET(s.req())).json();assert.equal(d.unread,1);assert.equal(d.items[0].kind,'cancellation');assert.equal(d.items[0].customerName,'Synthetic Client');
 assert.equal((await api.POST(s.req({action:'markRead',ids:[r.id]}))).status,200);d=await(await api.GET(s.req())).json();assert.equal(d.unread,0);assert.equal(d.pending,1);
 globalThis.__cancelInbox.reviewer='a';assert.equal((await(await api.GET(s.req())).json()).items.length,0);
 assert.equal((await s.db.query('SELECT status FROM team_cancellation_requests WHERE id=$1',[r.id])).rows[0].status,'pending');
});
async function routes(pool){globalThis.__cancelTest={pool};
 async function load(path){let source=ts.transpileModule(await read(path),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 source=source.replace(/import \{ getPool \}[^\n]+;/,'const getPool=()=>globalThis.__cancelTest.pool;').replace(/import \{ requireOwner \}[^\n]+;/,'const requireOwner=req=>globalThis.__cancelTest.requireOwner(req);').replace(/(['"])\.\.\/server\/([^'"]+)\1/g,(_,q,f)=>JSON.stringify(new URL('../server/'+f,import.meta.url).href)).replace(/(['"])\.\.\/\.\.\/\.\.\/\.\.\/server\/([^'"]+)\1/g,(_,q,f)=>JSON.stringify(new URL('../server/'+f,import.meta.url).href));return import('data:text/javascript;base64,'+Buffer.from(source+'\n//'+Math.random()).toString('base64'));}
 globalThis.__cancelTest.requireOwner=(await load('lib/auth.ts')).requireOwner;
 return {team:await load('app/api/team/cancellations/route.ts'),owner:await load('app/api/studio/cancellations/route.ts')};
}
test('actual routes authenticate real team/owner sessions, reject cross-origin/large requests and keep pending reviews owner-only',async t=>{
 const s=await setup(t),old=process.env.APP_URL;process.env.APP_URL='https://example.test';t.after(()=>{if(old)process.env.APP_URL=old;else delete process.env.APP_URL;delete globalThis.__cancelTest;});const api=await routes(s.pool);
 assert.equal((await api.team.GET(new Request('https://example.test'))).status,401);assert.equal((await api.owner.GET(s.req())).status,401);
 assert.equal((await api.team.POST(new Request('https://example.test',{method:'POST',headers:{origin:'https://foreign.test'}}))).status,403);
 const r=await api.team.POST(s.req({appointmentId:'visit',reason:'Need to cancel'}));assert.equal(r.status,200);const {id}=await r.json();
 assert.equal((await api.owner.POST(s.req({id,accept:true,confirmed:true}))).status,401);
 assert.equal((await api.owner.GET(new Request('https://example.test',{headers:{cookie:'salonflow_session='+s.token}}))).status,401);
 const ownerToken='f'.repeat(64);await s.db.query("INSERT INTO sessions VALUES($1,'o',now()+interval '1 hour')",[tokenHash(ownerToken)]);
 const cookie='salonflow_session='+ownerToken;const get=await api.owner.GET(new Request('https://example.test',{headers:{cookie}}));assert.equal((await get.json()).requests.length,1);assert.match(get.headers.get('cache-control'),/private, no-store/);
 assert.equal((await api.owner.POST(s.req({id,accept:false},cookie))).status,200);assert.equal((await api.team.GET(s.req())).status,200);
 assert.equal((await api.team.POST(new Request('https://example.test',{method:'POST',headers:{origin:'https://example.test',cookie:teamCookie(s.token)},body:'x'.repeat(2001)}))).status,413);
});
