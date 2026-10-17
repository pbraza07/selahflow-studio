import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {gmailConfigured,gmailStatus,beginGmailConnection,completeGmailConnection,sealGmail,openGmail,sendGmail,gmailMime,disconnectGmail,GMAIL_SCOPE,selectedEmailProvider} from '../server/gmail-delivery.mjs';
import {deliveryProviderStatusWithConnection,sendNotificationChannel} from '../server/notification-delivery.mjs';
const env={GMAIL_CLIENT_ID:'fixture.apps.googleusercontent.com',GMAIL_CLIENT_SECRET:'fixture-secret',GMAIL_TOKEN_ENCRYPTION_KEY:'a'.repeat(64),EMAIL_PROVIDER:'gmail'};
test('Gmail authorization is encrypted, one-time, session-bound and requests send-only Gmail access',async()=>{
 const pg=new PGlite();
 try{
  for(const f of (await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await pg.exec(await readFile(new URL('../migrations/'+f,import.meta.url),'utf8'));
  const db={query:async(s,v)=>{const r=await pg.query(s,v);return {...r,rowCount:r.rows.length||r.affectedRows||0};}};
  await pg.exec("INSERT INTO users(id,email,password_hash) VALUES('admin','admin@example.com','fixture'),('other','other@example.com','fixture')");
  assert.equal(gmailConfigured({}),false);assert.equal(gmailConfigured(env),true);
  const encrypted=sealGmail('private-refresh','refresh',env);assert.ok(!encrypted.includes('private-refresh'));assert.equal(openGmail(encrypted,'refresh',env),'private-refresh');
  assert.throws(()=>openGmail(encrypted,'verifier',env));assert.throws(()=>openGmail(encrypted,'refresh',{...env,GMAIL_TOKEN_ENCRYPTION_KEY:'b'.repeat(64)}));
  const auth=await beginGmailConnection(db,{actor:'admin',session:'admin-session',origin:'https://staging.example'},env),url=new URL(auth.authorizationUrl),state=url.searchParams.get('state');
  assert.equal(url.origin,'https://accounts.google.com');assert.equal(url.searchParams.get('access_type'),'offline');assert.equal(url.searchParams.get('code_challenge_method'),'S256');
  assert.equal(url.searchParams.get('scope'),'openid email '+GMAIL_SCOPE);assert.doesNotMatch(url.searchParams.get('scope'),/gmail\.readonly|gmail\.modify|mail\.google\.com/);
  assert.equal(url.searchParams.get('redirect_uri'),'https://staging.example/api/platform/gmail/callback');
  const stored=(await db.query('SELECT * FROM platform_gmail_oauth_states')).rows[0];assert.notEqual(stored.state_hash,state);assert.ok(!stored.encrypted_verifier.includes(url.searchParams.get('code_challenge')));
  const input={actor:'admin',session:'admin-session',state,code:'google-fixture-code'};let exchanges=0;
  const connectFetch=async(path,o)=>{
   if(path.includes('/token')){exchanges++;const b=new URLSearchParams(o.body);assert.equal(b.get('code_verifier'),openGmail(stored.encrypted_verifier,'verifier',env));assert.equal(b.get('grant_type'),'authorization_code');return {ok:true,json:async()=>({access_token:'access',refresh_token:'private-refresh',scope:GMAIL_SCOPE+' openid email'})};}
   assert.equal(path,'https://openidconnect.googleapis.com/v1/userinfo');return {ok:true,json:async()=>({email:'sender@gmail.com',email_verified:true})};
  };
  for(const incorrect of [{actor:'other'},{session:'other-session'},{state:'0'.repeat(64)}])await assert.rejects(completeGmailConnection(db,{...input,...incorrect},env,connectFetch),/invalid/);
  assert.equal(exchanges,0);assert.equal((await completeGmailConnection(db,input,env,connectFetch)).connected,true);
  await assert.rejects(completeGmailConnection(db,input,env,connectFetch),/invalid/);assert.equal(exchanges,1);
  const connection=(await db.query('SELECT * FROM platform_gmail_connection')).rows[0];assert.notEqual(connection.encrypted_refresh_token,'private-refresh');
  assert.deepEqual(await gmailStatus(db,env),{setupComplete:true,connected:true,sender:'sender@gmail.com',needsReconnect:false,missingConfiguration:[]});
  assert.equal((await deliveryProviderStatusWithConnection(db,env)).emailConfigured,true);
  assert.equal((await deliveryProviderStatusWithConnection(db,{...env,APP_ENV:'staging'})).emailConfigured,false);
  const message={subject:'SelahFlow — Payment confirmation',text:'Business One: $25 paid.\nThank you!',trackAmbiguous:true};let delivered=0;
  const sendFetch=async(path,o)=>{
   if(path.includes('/token')){assert.equal(new URLSearchParams(o.body).get('refresh_token'),'private-refresh');return {ok:true,json:async()=>({access_token:'new-access'})};}
   delivered++;assert.equal(path,'https://gmail.googleapis.com/gmail/v1/users/me/messages/send');assert.equal(o.headers.Authorization,'Bearer new-access');
   const mime=Buffer.from(JSON.parse(o.body).raw,'base64url').toString();assert.match(mime,/From: SelahFlow <sender@gmail.com>/);assert.match(mime,/To: <client@example.com>/);assert.doesNotMatch(mime,/Bcc:/);assert.match(mime,/Content-Transfer-Encoding: base64/);
   return {ok:true};
  };
  assert.equal((await sendGmail('client@example.com',message,env,sendFetch,db)).status,'submitted');assert.equal(delivered,1);
  assert.equal((await sendGmail('client@example.com',message,env,async p=>{if(p.includes('/token'))return {ok:true,json:async()=>({access_token:'a'})};throw Error('timeout');},db)).status,'unknown');
  assert.equal((await sendGmail('client@example.com',message,env,async()=>({ok:false,status:400}),db)).status,'not_configured');assert.equal((await gmailStatus(db,env)).needsReconnect,true);
  assert.equal((await sendGmail('client@example.com',message,env,sendFetch,db)).status,'not_configured');assert.equal(delivered,1);
  await disconnectGmail(db,'admin',env,async()=>({ok:true}));assert.equal((await gmailStatus(db,env)).connected,false);assert.equal((await db.query('SELECT * FROM platform_gmail_connection')).rows.length,0);
  // Expired consent cannot connect a mailbox.
  const expired=new URL((await beginGmailConnection(db,{actor:'admin',session:'s',origin:'https://staging.example'},env)).authorizationUrl).searchParams.get('state');
  await db.query("UPDATE platform_gmail_oauth_states SET expires_at=now()-interval '1 second'");await assert.rejects(completeGmailConnection(db,{actor:'admin',session:'s',state:expired,code:'x'},env,connectFetch),/invalid/);
 }finally{await pg.close();}
});
test('Gmail routing never falls back to Resend and preserves staging recipient restrictions',async()=>{
 assert.equal(selectedEmailProvider({}),'gmail');assert.equal(selectedEmailProvider({RESEND_API_KEY:'existing'}),'resend');assert.equal(selectedEmailProvider({...env,RESEND_API_KEY:'existing'}),'gmail');
 let calls=0;const fetcher=async()=>{calls++;throw Error();};
 assert.equal((await sendNotificationChannel('email','client@example.com',{subject:'Booking',text:'Hello'},{EMAIL_PROVIDER:'gmail',RESEND_API_KEY:'unused',RESEND_FROM_EMAIL:'sender@example.com'},fetcher)).status,'not_configured');assert.equal(calls,0);
 assert.equal((await sendNotificationChannel('email','client@example.com',{text:'Hello'},{...env,APP_ENV:'staging',STAGING_NOTIFICATIONS_ENABLED:'true',STAGING_NOTIFICATION_EMAILS:'different@example.com'},fetcher)).status,'not_configured');assert.equal(calls,0);
 assert.throws(()=>gmailMime('sender@gmail.com','client@example.com\r\nBcc: other@example.com',{text:'Hello'}),/Invalid/);
 const mime=Buffer.from(gmailMime('sender@gmail.com','client@example.com',{subject:'Booking\r\nBcc: other@example.com',text:'Hello'}),'base64url').toString();assert.doesNotMatch(mime,/\r\nBcc:/);
});
test('shared Gmail settings and callback require primary platform authorization',async()=>{
 const auth=await readFile(new URL('../lib/platform-gmail-auth.ts',import.meta.url),'utf8');assert.match(auth,/requireOwner\(req\)/);assert.match(auth,/getPlatformRole\(getPool\(\),actor\)!=='primary'/);
 for(const path of ['app/api/platform/gmail/route.ts','app/api/platform/gmail/callback/route.ts']){const s=await readFile(new URL('../'+path,import.meta.url),'utf8');assert.match(s,/requireGmailAdmin\(req\)/);assert.doesNotMatch(s,/console\.log|console\.error/);}
 const route=await readFile(new URL('../app/api/platform/gmail/route.ts',import.meta.url),'utf8');assert.match(route,/validOrigin\(req\)/);
});
