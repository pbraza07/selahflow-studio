import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {randomBytes} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {generateKeyPair,exportJWK,SignJWT,createLocalJWKSet} from 'jose';
import ts from 'typescript';
import {startGoogleFederation,completeGoogleFederation,verifyGoogleIdentity,googleSignInConfig,signupIdentity} from '../server/owner-federation.mjs';
import {googleOwnerCallback} from '../server/owner-federation-callback.mjs';
import {tokenHash} from '../server/security.mjs';
import {SERVICE_AGREEMENT_VERSION,validateServiceAcceptance} from '../server/business-service-terms.mjs';
import {activatePendingBusiness} from '../server/business-activation.mjs';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8'),env={GMAIL_CLIENT_ID:'test-client',GMAIL_CLIENT_SECRET:'test-secret'},origin=new URL(process.env.APP_URL||process.env.RENDER_EXTERNAL_URL||'https://example.test').origin;
const keys=await generateKeyPair('RS256'),jwk=await exportJWK(keys.publicKey);jwk.kid='test';jwk.alg='RS256';const localKeys=createLocalJWKSet({keys:[jwk]});
const sign=(claims={},privateKey=keys.privateKey)=>new SignJWT({sub:'google-subject',email:'new@example.test',email_verified:true,nonce:'nonce',name:'Example Owner',...claims}).setProtectedHeader({alg:'RS256',kid:'test'}).setIssuer(claims.iss||'https://accounts.google.com').setAudience(claims.aud||'test-client').setIssuedAt().setExpirationTime(claims.exp||'5 minutes').sign(privateKey);
async function fixture(t){const db=new PGlite();t.after(()=>db.close());for(const f of(await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await db.exec(await read('migrations/'+f));const pool={query:(...a)=>db.query(...a),connect:async()=>({query:(...a)=>db.query(...a),release(){}})};return {db,pool};}
const acceptance=planCode=>({version:SERVICE_AGREEMENT_VERSION,planCode,signatureName:'Example Owner',documentReviewed:true,accepted:true,electronicConsent:true,revenueAccepted:true});
async function flow(db){const started=await startGoogleFederation(db,{origin,mode:'signup',planCode:'business'},env),url=new URL(started.authorizationUrl);return {...started,url,nonce:url.searchParams.get('nonce'),state:url.searchParams.get('state')};}
const response=token=>async(url,options)=>{assert.equal(url,'https://oauth2.googleapis.com/token');assert.equal(new URLSearchParams(options.body).get('grant_type'),'authorization_code');return Response.json({id_token:token,access_token:'unused'});};
test('Google identity verifies signature, issuer, audience, nonce, verified email and token lifetime',async()=>{
 assert.equal((await verifyGoogleIdentity(await sign(),{clientId:'test-client',nonceHash:tokenHash('nonce'),keys:localKeys})).subject,'google-subject');
 for(const patch of [{iss:'https://evil.test'},{aud:'another-client'},{nonce:'other'},{email_verified:false},{exp:1},{azp:'other-client'}])await assert.rejects(verifyGoogleIdentity(await sign(patch),{clientId:'test-client',nonceHash:tokenHash('nonce'),keys:localKeys}));
 const other=await generateKeyPair('RS256');await assert.rejects(verifyGoogleIdentity(await sign({},other.privateKey),{clientId:'test-client',nonceHash:tokenHash('nonce'),keys:localKeys}));
});
test('Google authorization is browser-bound, one-use and package-preserving, with no mail or offline grants',async t=>{
 const {db}=await fixture(t),f=await flow(db);
 assert.equal(f.url.origin,'https://accounts.google.com');assert.equal(f.url.searchParams.get('scope'),'openid email profile');assert.equal(f.url.searchParams.has('access_type'),false);assert.equal(f.url.searchParams.get('code_challenge_method'),'S256');assert.equal(f.url.searchParams.get('redirect_uri'),origin+'/api/platform/gmail/callback');
 assert.equal(googleSignInConfig(env).callback,'/api/platform/gmail/callback');
 const token=await sign({nonce:f.nonce});const options={fetcher:response(token),keys:localKeys};
 await assert.rejects(completeGoogleFederation(db,{state:f.state,binding:randomBytes(32).toString('hex'),code:'code'},env,options),/expired/);
 const result=await completeGoogleFederation(db,{state:f.state,binding:f.binding,code:'code'},env,options);assert.equal(result.planCode,'business');assert.equal(result.email,'new@example.test');
 await assert.rejects(completeGoogleFederation(db,{state:f.state,binding:f.binding,code:'code'},env,options),/expired/);
 assert.equal((await db.query('SELECT count(*)::int n FROM users')).rows[0].n,0);
});
test('callback never links an existing email, and grants new identities only a short-lived signup proof',async t=>{
 const {db,pool}=await fixture(t);await db.query("INSERT INTO users(id,email,password_hash) VALUES('existing','new@example.test','hash')");
 let f=await flow(db),request=new Request(origin+'/api/platform/gmail/callback?state='+f.state+'&code=code',{headers:{cookie:'selahflow_oauth_binding='+f.binding}});
 let r=await googleOwnerCallback(pool,request,env,{fetcher:response(await sign({nonce:f.nonce})),keys:localKeys});assert.equal(r.headers.get('location'),origin+'/login?identity=existing-email');assert.equal((await db.query('SELECT count(*)::int n FROM sessions')).rows[0].n,0);assert.equal((await db.query('SELECT count(*)::int n FROM owner_federated_identities')).rows[0].n,0);
 f=await flow(db);request=new Request(origin+'/api/platform/gmail/callback?state='+f.state+'&code=code',{headers:{cookie:'selahflow_oauth_binding='+f.binding}});
 r=await googleOwnerCallback(pool,request,env,{fetcher:response(await sign({nonce:f.nonce,email:'other@example.test'})),keys:localKeys});assert.equal(r.headers.get('location'),origin+'/signup?plan=business&identity=verified');
 const proof=r.headers.get('set-cookie').match(/selahflow_signup_identity=([a-f0-9]{64})/)[1];assert.equal((await signupIdentity(db,new Request(origin,{headers:{cookie:'selahflow_signup_identity='+proof}}))).email,'other@example.test');
 assert.equal((await db.query('SELECT count(*)::int n FROM businesses')).rows[0].n,0);assert.equal((await db.query('SELECT count(*)::int n FROM users')).rows[0].n,1);
 await db.exec("UPDATE owner_signup_identities SET expires_at=now()-interval '1 second'");assert.equal(await signupIdentity(db,new Request(origin,{headers:{cookie:'selahflow_signup_identity='+proof}})),null);
});
test('federated signup consumes proof atomically, records the signed package, and never grants paid access',async t=>{
 const {db,pool}=await fixture(t),proof=randomBytes(32).toString('hex');
 await db.query("INSERT INTO owner_signup_identities(token_hash,provider,subject,email,display_name,plan_code) VALUES($1,'google','new-sub','verified@example.test','Example Owner','business')",[tokenHash(proof)]);
 const file=new URL('../app/api/auth/signup/route.ts',import.meta.url),native=createRequire(file),exp={};
 const source=ts.transpileModule(await read('app/api/auth/signup/route.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 new Function('require','exports',source)(id=>id.endsWith('/server/database.mjs')?{getPool:()=>pool}:id.endsWith('/lib/defaults')?{defaultSettings:{}}:id.endsWith('/lib/business-options')?{BUSINESS_INDUSTRIES:[['other','Other']],canonicalState:v=>v}:native(id),exp);
 const payload={planCode:'business',agreement:acceptance('business'),businessName:'Example Business',description:'Training services',slug:'example-business',industry:'other',email:'spoofed@example.test'};
 const request=patch=>new Request(origin+'/api/auth/signup',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',cookie:'selahflow_signup_identity='+proof},body:JSON.stringify({...payload,...patch})});
 const rejected=await exp.POST(request({agreement:{...payload.agreement,documentReviewed:false}}));assert.equal(rejected.status,400);assert.equal((await db.query('SELECT count(*)::int n FROM users')).rows[0].n,0);
 const r=await exp.POST(request({}));assert.equal(r.status,201,await r.clone().text());
 assert.equal((await db.query('SELECT email FROM users')).rows[0].email,'verified@example.test');assert.equal((await db.query('SELECT provider,subject FROM owner_federated_identities')).rows[0].subject,'new-sub');
 const b=(await db.query('SELECT id,status,is_listed FROM businesses')).rows[0],s=(await db.query('SELECT plan_code,requested_plan_code FROM business_subscriptions')).rows[0];assert.equal(b.status,'pending');assert.equal(b.is_listed,false);assert.equal(s.plan_code,'free');assert.equal(s.requested_plan_code,'business');
 const a=(await db.query('SELECT snapshot FROM business_service_agreements')).rows[0].snapshot;assert.equal(a.consents.documentReviewed,true);assert.equal(a.planCode,'business');
 assert.equal((await exp.POST(request({}))).status,400);
 assert.equal((await db.query('SELECT count(*)::int n FROM users')).rows[0].n,1);await assert.rejects(activatePendingBusiness(db,b.id),/payment|agreement/);
});
test('new agreement requires explicit review, describes payment before approval, and preserves every plan benefit',async()=>{
 for(const code of ['free','professional','business']){const a=validateServiceAcceptance(acceptance(code),code);assert.equal(a.consents.documentReviewed,true);assert.throws(()=>validateServiceAcceptance({...acceptance(code),documentReviewed:false},code));}
 const source=await read('app/signup/page.tsx');assert.match(source,/setRegistered\(true\);setStep\(4\)/);assert.match(source,/Make payment ·/);assert.match(source,/step===4&&registered/);
 const terms=await read('server/business-service-terms.mjs');assert.doesNotMatch(terms,/No package payment is taken when submitting/);assert.match(terms,/Included benefits/);
});

test('expired authorization cannot be exchanged, and known identities honor mandatory password rotation',async t=>{
 const {db,pool}=await fixture(t);let f=await flow(db);
 await db.exec("UPDATE owner_federation_states SET expires_at=now()-interval '1 second'");
 await assert.rejects(completeGoogleFederation(db,{state:f.state,binding:f.binding,code:'code'},env,{fetcher:()=>{throw Error('Must not contact Google');},keys:localKeys}),/expired/);
 await db.exec("INSERT INTO users(id,email,password_hash,must_change_password) VALUES('known','known@example.test','hash',true);INSERT INTO owner_federated_identities(user_id,provider,subject) VALUES('known','google','google-subject')");
 f=await flow(db);const request=new Request(origin+'/api/platform/gmail/callback?state='+f.state+'&code=code',{headers:{cookie:'selahflow_oauth_binding='+f.binding}});
 const r=await googleOwnerCallback(pool,request,env,{fetcher:response(await sign({nonce:f.nonce,email:'known@example.test'})),keys:localKeys});assert.equal(r.headers.get('location'),origin+'/account/require-password-change');assert.match(r.headers.get('set-cookie'),/salonflow_session=/);assert.equal((await db.query('SELECT count(*)::int n FROM users')).rows[0].n,1);
});
test('historical signed Free applications retain approval eligibility without weakening new signature validation',async t=>{
 const {db}=await fixture(t);await db.exec("INSERT INTO users(id,email,password_hash) VALUES('legacy','legacy@example.test','hash');INSERT INTO businesses(id,owner_id,slug,name,status) VALUES('legacy-b','legacy','legacy','Legacy','pending');INSERT INTO business_subscriptions(business_id,plan_code,status,requested_plan_code) VALUES('legacy-b','free','active','free');INSERT INTO business_service_agreements(id,business_id,owner_id,version,plan_code,signature_name,snapshot,digest) VALUES('legacy-a','legacy-b','legacy','selahflow-business-services-2026-10-30-v1','free','Legacy Owner','{}','old-digest')");
 const adapter={async query(...args){const r=await db.query(...args);return {...r,rowCount:r.rows.length};}};
 assert.equal((await activatePendingBusiness(adapter,'legacy-b')).slug,'legacy');
 assert.throws(()=>validateServiceAcceptance({...acceptance('free'),version:'selahflow-business-services-2026-10-30-v1'},'free'));
});
