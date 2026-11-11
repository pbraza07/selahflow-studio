import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {checkGmailConnection} from '../server/gmail-connection-monitor.mjs';
import {refreshGmailAuthorization,sealGmail,openGmail,gmailStatus,sendGmail,disconnectGmail,GMAIL_SCOPE} from '../server/gmail-delivery.mjs';
const env={EMAIL_PROVIDER:'gmail',GMAIL_CLIENT_ID:'fixture',GMAIL_CLIENT_SECRET:'fixture-secret',GMAIL_TOKEN_ENCRYPTION_KEY:'a'.repeat(64)};
const good=async()=>({ok:true,json:async()=>({access_token:'private-access',scope:GMAIL_SCOPE})});
const rejected=error=>async()=>({ok:false,status:400,json:async()=>({error,error_description:'private-provider-detail'})});
async function fixture(){
 const pg=new PGlite();
 await pg.exec("CREATE TABLE users(id TEXT PRIMARY KEY); INSERT INTO users VALUES('admin'); CREATE TABLE events(id TEXT,owner TEXT,created TEXT,kind TEXT,data TEXT)");
 for(const name of ['038_platform_gmail.sql','099_gmail_connection_health.sql'])await pg.exec(await readFile(new URL('../migrations/'+name,import.meta.url),'utf8'));
 const db={query:async(sql,args)=>{const r=await pg.query(sql,args);return {...r,rowCount:r.rows.length||r.affectedRows||0};}};
 // PGlite has one connection. Queue pool leases to model distinct pg clients.
 let lease=Promise.resolve();
 db.connect=async()=>{let release;const previous=lease;lease=new Promise(r=>{release=r;});await previous;return {query:db.query,release};};
 await db.query("INSERT INTO platform_gmail_connection(id,email,encrypted_refresh_token,status,connected_by) VALUES('shared','sender@example.test',$1,'connected','admin')",[sealGmail('private-refresh','refresh',env)]);
 return {db,close:()=>pg.close(),row:async()=>(await db.query('SELECT * FROM platform_gmail_connection')).rows[0],due:()=>db.query("UPDATE platform_gmail_connection SET next_check_at=now()-interval '1 minute'")};
}
test('background authorization verifies without sending mail, persists schedule, and redacts diagnostics',async()=>{
 const f=await fixture();try{
  let calls=0;const fetcher=async(path)=>{calls++;assert.equal(path,'https://oauth2.googleapis.com/token');return good();};
  const result=await checkGmailConnection(f.db,{env,fetcher});
  assert.equal(result.state,'healthy');assert.equal(calls,1);assert.ok(result.checkedAt);assert.ok(result.lastSuccessAt);
  assert.equal(new Date(result.nextCheckAt)-new Date(result.checkedAt),300000);
  assert.doesNotMatch(JSON.stringify(result),/private-|sender@|access_token|refresh_token/);
  await checkGmailConnection(f.db,{env,fetcher});assert.equal(calls,1,'not yet due');
  await checkGmailConnection(f.db,{env,fetcher,force:true});assert.equal(calls,1,'manual checks are throttled');
  await f.due();await Promise.all([checkGmailConnection(f.db,{env,fetcher}),checkGmailConnection(f.db,{env,fetcher})]);assert.equal(calls,2,'only one due refresh across workers');
 }finally{await f.close();}
});
test('transient outage backs off without losing grant or consuming queued-message attempts, then recovers',async()=>{
 const f=await fixture();try{
  let calls=0;const down=async()=>{calls++;throw Error('private-network-error');};
  let result=await checkGmailConnection(f.db,{env,fetcher:down});const incident=result.incidentId;
  assert.equal(result.state,'retrying');assert.equal(new Date(result.nextCheckAt)-new Date(result.checkedAt),60000);
  assert.equal((await f.row()).status,'connected');assert.equal((await gmailStatus(f.db,env)).connected,false);
  const send=await sendGmail('client@example.test',{text:'Message',trackAmbiguous:true},env,down,f.db);
  assert.equal(send.status,'not_configured');assert.equal(calls,1,'wait rather than consume retries');
  await checkGmailConnection(f.db,{env,fetcher:down,force:true});assert.equal(calls,1,'manual retry cannot flood Google');
  await f.due();result=await checkGmailConnection(f.db,{env,fetcher:down});assert.equal(result.incidentId,incident);assert.equal(result.failures,2);assert.equal(new Date(result.nextCheckAt)-new Date(result.checkedAt),120000);
  await f.due();result=await checkGmailConnection(f.db,{env,fetcher:good});assert.equal(result.state,'healthy');assert.equal(result.failures,0);assert.equal(result.incidentId,incident);assert.equal((await gmailStatus(f.db,env)).connected,true);
  await f.due();result=await checkGmailConnection(f.db,{env,fetcher:down});assert.notEqual(result.incidentId,incident,'new outage gets new deduplication ID');
 }finally{await f.close();}
});
test('expired or revoked grants require consent, while other 400 errors are classified separately',async()=>{
 const f=await fixture();try{
  let calls=0;const invalid=async()=>{calls++;return rejected('invalid_grant')();};
  const result=await checkGmailConnection(f.db,{env,fetcher:invalid});assert.equal(result.state,'needs_reconnect');assert.equal(result.nextCheckAt,null);
  assert.equal((await gmailStatus(f.db,env)).needsReconnect,true);await f.due();await checkGmailConnection(f.db,{env,fetcher:invalid,force:true});assert.equal(calls,1,'no repeated consent attempts');
  await f.db.query("UPDATE platform_gmail_connection SET health_status='unchecked'");
  assert.equal((await checkGmailConnection(f.db,{env,fetcher:rejected('invalid_client')})).state,'configuration_error');
  assert.equal((await gmailStatus(f.db,env)).needsReconnect,false);
  await f.due();assert.equal((await checkGmailConnection(f.db,{env,fetcher:async()=>({ok:false,status:400,json:async()=>({})})})).state,'retrying','unknown 400 is not a revoked grant');
  await f.due();assert.equal((await checkGmailConnection(f.db,{env,fetcher:good})).state,'healthy','fixed server configuration recovers automatically');
 }finally{await f.close();}
});
test('missing configuration and unreadable encrypted tokens recover without replacing credentials',async()=>{
 const f=await fixture();try{
  const original=(await f.row()).encrypted_refresh_token;let calls=0;const fetcher=async()=>{calls++;return good();};
  assert.equal((await checkGmailConnection(f.db,{env:{...env,GMAIL_CLIENT_SECRET:''},fetcher})).state,'configuration_error');
  await f.due();assert.equal((await checkGmailConnection(f.db,{env:{...env,GMAIL_TOKEN_ENCRYPTION_KEY:'b'.repeat(64)},fetcher})).state,'configuration_error');assert.equal(calls,0);
  assert.equal((await f.row()).encrypted_refresh_token,original);
  await f.due();assert.equal((await checkGmailConnection(f.db,{env,fetcher})).state,'healthy');
 }finally{await f.close();}
});
test('rotated refresh tokens are encrypted and missing send scope requires new approval',async()=>{
 const f=await fixture();try{
  await refreshGmailAuthorization(f.db,env,async()=>({ok:true,json:async()=>({access_token:'access',refresh_token:'rotated-private',scope:GMAIL_SCOPE})}));
  const row=await f.row();assert.notEqual(row.encrypted_refresh_token,'rotated-private');assert.equal(openGmail(row.encrypted_refresh_token,'refresh',env),'rotated-private');
  await f.due();assert.equal((await checkGmailConnection(f.db,{env,fetcher:async()=>({ok:true,json:async()=>({access_token:'access',scope:'openid email'})})})).state,'needs_reconnect');
 }finally{await f.close();}
});
test('explicit disconnect wins against an in-flight refresh and remains disconnected',async()=>{
 const f=await fixture();try{
  let release,entered;const waiting=new Promise(r=>{entered=r;});const gate=new Promise(r=>{release=r;});
  const checking=checkGmailConnection(f.db,{env,fetcher:async()=>{entered();await gate;return good();}});await waiting;
  const disconnecting=disconnectGmail(f.db,'admin',env,async()=>({ok:true}));release();await checking;await disconnecting;
  let calls=0;const result=await checkGmailConnection(f.db,{env,fetcher:async()=>{calls++;return good();},force:true});
  assert.equal(result.state,'inactive');assert.equal(calls,0);assert.equal(await f.row(),undefined);
 }finally{await f.close();}
});
test('other email providers are untouched and legacy reconnect flags get one live verification',async()=>{
 const f=await fixture();try{
  let calls=0;const fetcher=async()=>{calls++;return good();};
  assert.equal((await checkGmailConnection(f.db,{env:{...env,EMAIL_PROVIDER:'resend'},fetcher})).state,'inactive');assert.equal(calls,0);
  await f.db.query("UPDATE platform_gmail_connection SET status='needs_reconnect'");
  assert.equal((await checkGmailConnection(f.db,{env,fetcher})).state,'healthy');assert.equal((await f.row()).status,'connected');
 }finally{await f.close();}
});
