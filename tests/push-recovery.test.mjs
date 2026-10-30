import test from 'node:test';
import assert from 'node:assert/strict';
import {createECDH} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {pushConfiguration,configured} from '../server/push-crypto.mjs';
import {ensurePushSubscription,decodePushKey} from '../lib/browser-push.mjs';
// OpenSSL can omit leading zero bytes; a VAPID private scalar is exactly 32 bytes.
const pair=()=>{const ec=createECDH('prime256v1');ec.generateKeys();const scalar=Buffer.alloc(32),raw=ec.getPrivateKey();raw.copy(scalar,32-raw.length);return {VAPID_PUBLIC_KEY:ec.getPublicKey().toString('base64url'),VAPID_PRIVATE_KEY:scalar.toString('base64url'),VAPID_SUBJECT:'https://example.com'};};
test('push readiness validates paired keys and subject without leaking secrets; staging remains explicit',()=>{
 const env=pair();assert.deepEqual(pushConfiguration(env),{configured:true,reason:'ready'});
 assert.equal(configured({...env,APP_ENV:'staging'}),false);
 assert.equal(configured({...env,APP_ENV:'staging',STAGING_PUSH_ENABLED:'true'}),true);
 assert.equal(pushConfiguration({}).reason,'missing_keys');
 for(const change of [{VAPID_PRIVATE_KEY:'broken'},{VAPID_PUBLIC_KEY:pair().VAPID_PUBLIC_KEY},{VAPID_SUBJECT:'not-a-url'},{VAPID_SUBJECT:'http://example.com'}]){
  const result=pushConfiguration({...env,...change});assert.deepEqual(result,{configured:false,reason:'invalid_keys'});assert.ok(!JSON.stringify(result).includes(env.VAPID_PRIVATE_KEY));
 }
});
test('browser push persists current subscriptions, repairs obsolete keys and retries failed registration safely',async()=>{
 const key=pair().VAPID_PUBLIC_KEY;let created=0,removed=0;
 const existing={endpoint:'existing',options:{applicationServerKey:decodePushKey(key).buffer},unsubscribe:async()=>{removed++;return true;}};
 const reg={pushManager:{getSubscription:async()=>existing,subscribe:async options=>{created++;assert.equal(options.userVisibleOnly,true);return {endpoint:'new'};}}};
 assert.equal(await ensurePushSubscription(reg,key),existing);assert.equal(created,0);assert.equal(removed,0);
 assert.equal((await ensurePushSubscription(reg,pair().VAPID_PUBLIC_KEY)).endpoint,'new');assert.equal(removed,1);
 reg.pushManager.getSubscription=async()=>null;assert.equal((await ensurePushSubscription(reg,key)).endpoint,'new');
 reg.pushManager.subscribe=async()=>{throw Error('permission revoked');};await assert.rejects(ensurePushSubscription(reg,key),/permission revoked/);
});
test('device test uses actual provider result, scopes endpoints to the authenticated business and prunes expired device only',async()=>{
 const url=new URL('../app/api/push/route.ts',import.meta.url),source=await readFile(url,'utf8'),exports={};let result={status:'submitted'},owned=true,valid=true,sends=0;const queries=[];
 const pool={query:async(sql,params)=>{queries.push({sql,params});return {rows:sql.startsWith('SELECT')&&owned?[{endpoint:'https://web.push.apple.com/test',p256dh:'key',auth:'secret'}]:[]};}};
 const c={pool,businessId:'my-business',reviewer:'owner',businessName:'Training',businessSlug:'training'};
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','exports',code)(path=>{
  if(path==='node:crypto')return {randomUUID:()=> 'unused'};
  if(path.endsWith('push-context.mjs'))return {pushContext:async()=>c};
  if(path.endsWith('security.mjs'))return {validOrigin:()=>valid};
  if(path.endsWith('push-crypto.mjs'))return {configured:()=>true,sendWebPush:async()=>{sends++;return result;}};
  throw Error(path);
 },exports);
 const request=()=>new Request('https://example.com/api/push',{method:'POST',body:JSON.stringify({action:'test',endpoint:'https://web.push.apple.com/test'})});
 let response=await exports.POST(request());assert.equal(response.status,200);assert.equal((await response.json()).status,'provider_accepted');
 assert.deepEqual(queries[0].params,['my-business','owner','https://web.push.apple.com/test']);assert.match(queries[0].sql,/business_id=\$1 AND reviewer=\$2 AND endpoint=\$3/);
 owned=false;assert.equal((await exports.POST(request())).status,404);assert.equal(sends,1);
 owned=true;result={status:'gone'};assert.equal((await exports.POST(request())).status,410);assert.match(queries.at(-1).sql,/DELETE.*business_id=\$1 AND reviewer=\$2 AND endpoint=\$3/);
 result={status:'failed'};assert.equal((await exports.POST(request())).status,502);
 valid=false;assert.equal((await exports.POST(request())).status,403);assert.equal(sends,3);
});
