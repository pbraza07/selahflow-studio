import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {supportActor,startSupport,endSupport,supportSelection,supportOwner,isSupportWorkspacePath} from '../server/platform-support.mjs';
import {tokenHash} from '../server/security.mjs';
const read=f=>readFile(new URL('../'+f,import.meta.url),'utf8');
const origin=new URL(process.env.APP_URL||process.env.RENDER_EXTERNAL_URL||'https://example.test').origin;
const token='a'.repeat(64),hash=tokenHash(token),actor={id:'admin',hash};
async function fixture(){const pg=new PGlite();for(const f of ['001_initial.sql','002_public_booking.sql','003_platform_foundation.sql','004_business_customization.sql'])await pg.exec(await read('migrations/'+f));await pg.exec('ALTER TABLE users ADD COLUMN must_change_password boolean NOT NULL DEFAULT false');await pg.exec(await read('migrations/063_platform_support_access.sql'));await pg.query("INSERT INTO users(id,email,password_hash) VALUES('admin','pbraza@gmail.com','admin-password-hash'),('one','one@example.test','owner-one-password-hash'),('two','two@example.test','different-owner-password-hash')");await pg.query("INSERT INTO platform_admins(user_id,role) VALUES('admin','primary')");await pg.query("INSERT INTO businesses(id,owner_id,slug,name,industry) VALUES('b1','one','first-business','First','fitness'),('b2','two','second-business','Second','fitness')");await pg.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,'admin',now()+interval '12 hours'),($2,'one',now()+interval '12 hours')",[hash,tokenHash('b'.repeat(64))]);return pg;}
const req=(path='/api/studio',method='GET',slug='first-business')=>new Request(origin+path,{method,headers:{cookie:'salonflow_session='+token,referer:origin+'/studio/'+slug,origin}});
test('support authenticates the administrator independently of owner passwords, isolates tenants and audits requests',async()=>{const pg=await fixture();try{
 assert.deepEqual(await supportActor(pg,req()),actor);
 await assert.rejects(supportOwner(pg,req(),actor),/AUTH_REQUIRED/);
 await startSupport(pg,actor,'b1');
 await pg.query("UPDATE users SET must_change_password=true WHERE id='one'");
 assert.equal((await supportSelection(pg,actor)).owner_id,'one');
 assert.equal(await supportOwner(pg,req(),actor),'one');
 assert.equal(await supportOwner(pg,req('/api/studio/memberships','POST'),actor),'one');
 for(const path of ['/api/account/password','/api/platform/admins','/api/platform/businesses/manage'])assert.equal(await supportOwner(pg,req(path,'POST'),actor),'admin');
 assert.equal(await supportOwner(pg,req('/api/business'),actor),'one');
 assert.equal(await supportOwner(pg,new Request(origin+'/api/studio/waivers/fixture-waiver',{headers:{referer:origin+'/studio/waiver/fixture-waiver'}}),actor),'one');
 await assert.rejects(supportOwner(pg,new Request(origin+'/api/studio/waivers/different-waiver',{headers:{referer:origin+'/studio/waiver/fixture-waiver'}}),actor),/AUTH_REQUIRED/);
 const audits=(await pg.query('SELECT actor_id,business_id,action,method,path FROM platform_support_audit ORDER BY created_at,id')).rows;
 assert.equal(audits.filter(x=>x.action==='start').length,1);assert.ok(audits.some(x=>x.actor_id==='admin'&&x.business_id==='b1'&&x.method==='POST'&&x.path==='/api/studio/memberships'));
 await startSupport(pg,actor,'b2');
 await assert.rejects(supportOwner(pg,req('/api/studio','POST'),actor),/AUTH_REQUIRED/);
 assert.equal(await supportOwner(pg,req('/api/studio','GET','second-business'),actor),'two');
 await endSupport(pg,actor);assert.equal(await supportSelection(pg,actor),null);await assert.rejects(supportOwner(pg,req('/api/studio','POST','second-business'),actor),/AUTH_REQUIRED/);
 assert.deepEqual((await pg.query('SELECT password_hash FROM users ORDER BY id')).rows.map(x=>x.password_hash),['admin-password-hash','owner-one-password-hash','different-owner-password-hash']);
 assert.equal((await pg.query("SELECT count(*)::int n FROM platform_support_audit WHERE action='end'")).rows[0].n,2);
 }finally{await pg.close();}});
test('support denies ordinary owners, expired/revoked admin sessions, inactive businesses and cross-origin or stale tabs',async()=>{const pg=await fixture();try{
 await assert.rejects(startSupport(pg,{id:'one',hash:tokenHash('b'.repeat(64))},'b2'),/FORBIDDEN/);
 await assert.rejects(supportActor(pg,new Request(origin)),/AUTH_REQUIRED/);
 await pg.query("UPDATE users SET must_change_password=true WHERE id='admin'");await assert.rejects(supportActor(pg,req()),/PASSWORD_CHANGE_REQUIRED/);await pg.query("UPDATE users SET must_change_password=false WHERE id='admin'");
 await pg.query("UPDATE businesses SET status='suspended' WHERE id='b2'");await assert.rejects(startSupport(pg,actor,'b2'),/unavailable/);
 await startSupport(pg,actor,'b1');
 for(const headers of [{referer:origin+'/studio/second-business',origin},{referer:'https://foreign.test/studio/first-business',origin:'https://foreign.test'},{referer:origin+'/studio/first-business',origin:'https://foreign.test'},{}])await assert.rejects(supportOwner(pg,new Request(origin+'/api/studio',{method:'POST',headers}),actor),/AUTH_REQUIRED/);
 await assert.rejects(supportOwner(pg,req('/api/business/google','POST'),actor),/requires the business owner/);
 await pg.query("UPDATE platform_support_sessions SET expires_at=now()-interval '1 minute'");await assert.rejects(supportOwner(pg,req(),actor),/AUTH_REQUIRED/);await endSupport(pg,actor);
 await startSupport(pg,actor,'b1');await pg.query("DELETE FROM platform_admins WHERE user_id='admin'");await assert.rejects(supportOwner(pg,req(),actor),/AUTH_REQUIRED/);
 await pg.query('DELETE FROM sessions WHERE token_hash=$1',[hash]);assert.equal((await pg.query('SELECT count(*)::int n FROM platform_support_sessions')).rows[0].n,0);await assert.rejects(supportActor(pg,req()),/AUTH_REQUIRED/);
 }finally{await pg.close();}});
test('support is wired into owner APIs and pages, with explicit entry/exit and no device notification enrollment',async()=>{
 assert.match(await read('lib/auth.ts'),/return supportOwner\(getPool\(\),req/);
 assert.match(await read('app/studio/[slug]/page.tsx'),/supportBusinessName=\{support.name\}/);
 const dashboard=await read('app/studio/owner-dashboard.tsx');assert.match(dashboard,/Administrator support/);assert.match(dashboard,/Exit support/);assert.match(dashboard,/!supportBusinessName&&<DevicePushControls/);assert.match(dashboard,/!supportBusinessName&&<OwnerNotificationBell/);
 assert.match(await read('app/components/platform-business-directory.tsx'),/Open owner workspace for support/);
 for(const p of ['/api/studio','/api/studio/clients','/api/branding/logo'])assert.equal(isSupportWorkspacePath(p),true);
 for(const p of ['/api/platform/admins','/api/account/password','/api/studioevil','/api/public/payments/booking','/api/push'])assert.equal(isSupportWorkspacePath(p),false);
});
test('actual requireOwner preserves account identity, selects support owner and rejects a revoked login',async()=>{
 const {default:ts}=await import('typescript');const pg=await fixture();
 try{
  let source=ts.transpileModule(await read('lib/auth.ts'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  source=source.replace(/import \{ getPool \}[^\n]+;/,'const getPool=()=>globalThis.__supportAuthFixture;');
  for(const file of ['platform-support','security'])source=source.replace("'../server/"+file+".mjs'",JSON.stringify(new URL('../server/'+file+'.mjs',import.meta.url).href));
  globalThis.__supportAuthFixture=pg;const {requireOwner}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  await assert.rejects(requireOwner(new Request(origin+'/api/studio')),/AUTH_REQUIRED/);
  await startSupport(pg,actor,'b1');assert.equal(await requireOwner(req()),'one');assert.equal(await requireOwner(req('/api/account/password','POST')),'admin');
  await pg.query('DELETE FROM sessions WHERE token_hash=$1',[hash]);await assert.rejects(requireOwner(req()),/AUTH_REQUIRED/);
 }finally{delete globalThis.__supportAuthFixture;await pg.close();}
});
