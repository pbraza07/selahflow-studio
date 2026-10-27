import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {verifyStripeWebhook} from '../server/membership-payments.mjs';
import {assertStagingDatabase,assertSandboxPayments,stagingNotificationAllowed} from '../server/staging-safety.mjs';
import {sendNotificationChannel} from '../server/notification-delivery.mjs';
import {configured,sendWebPush} from '../server/push-crypto.mjs';
const env={APP_ENV:'staging',DATABASE_URL:'postgresql://selahflow_staging_user:test@approved-host/selahflow_staging',STAGING_DATABASE_HOST:'approved-host',RENDER:'true',RENDER_SERVICE_NAME:'selahflow-staging',RENDER_GIT_BRANCH:'staging',RENDER_EXTERNAL_URL:'https://selahflow-staging.onrender.com'};
test('staging rejects production database, privileged user, wrong host, branch and origin before opening a pool',()=>{
 assert.doesNotThrow(()=>assertStagingDatabase(env));
 for(const change of [{DATABASE_URL:env.DATABASE_URL.replace('/selahflow_staging','/amanda_realtor_db')},{DATABASE_URL:env.DATABASE_URL.replace('selahflow_staging_user','amanda_realtor_db_user')},{STAGING_DATABASE_HOST:'other-host'},{RENDER_GIT_BRANCH:'main'},{APP_URL:'https://salonflow-hf3w.onrender.com'},{APP_URL:'https://selahflow.onrender.com'},{APP_ENV:''}])
  assert.throws(()=>assertStagingDatabase({...env,...change}));
 assert.doesNotThrow(()=>assertStagingDatabase({APP_ENV:'production'}));
});
test('staging allows absent or test payment keys and rejects live keys without revealing them',()=>{
 assert.doesNotThrow(()=>assertSandboxPayments(env));
 assert.doesNotThrow(()=>assertSandboxPayments({...env,STRIPE_SECRET_KEY:'sk_test_example'}));
 for(const change of [{STRIPE_SECRET_KEY:'sk_live_sensitive'},{STRIPE_SECRET_KEY:'unexpected'},{NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:'pk_live_sensitive'},{STRIPE_SECRET_KEY:'rk_live_sensitive'}]){
  assert.throws(()=>assertSandboxPayments({...env,...change}),e=>!e.message.includes('sensitive'));
 }
});
test('staging cannot deliver to real recipients without explicit channel enablement and allowlist',async()=>{
 let calls=0;const fetcher=async()=>{calls++;return {ok:true}};
 const provider={...env,RESEND_API_KEY:'example',RESEND_FROM_EMAIL:'test@example.com'};
 assert.equal((await sendNotificationChannel('email','real@example.com',{},provider,fetcher)).status,'not_configured');
 assert.equal((await sendNotificationChannel('email','real@example.com',{}, {...provider,STAGING_NOTIFICATIONS_ENABLED:'true',STAGING_NOTIFICATION_EMAILS:'test@example.com'},fetcher)).status,'not_configured');
 assert.equal(calls,0);
 assert.equal(stagingNotificationAllowed('email','test@example.com',{...provider,STAGING_NOTIFICATIONS_ENABLED:'true',STAGING_NOTIFICATION_EMAILS:'test@example.com'}),true);
});
test('staging push is disabled even if credentials are accidentally inherited',async()=>{
 const push={...env,VAPID_PUBLIC_KEY:'example',VAPID_PRIVATE_KEY:'example',VAPID_SUBJECT:'mailto:test@example.com'};
 assert.equal(configured(push),false);
 assert.equal((await sendWebPush({}, {}, push,()=>{throw Error('Must not send')})).status,'not_configured');
});
test('explicit prospective client email rollout never releases historical messages, owner notifications or SMS',()=>{
 const cutoff=new Date(Date.now()-60000).toISOString(),queuedAt=new Date(Date.now()-1000).toISOString();
 const enabled={APP_ENV:'staging',STAGING_NOTIFICATIONS_ENABLED:'true',STAGING_CLIENT_EMAIL_AFTER:cutoff};
 assert.equal(stagingNotificationAllowed('email','client@example.test',enabled,{kind:'transactional-client',queuedAt}),true);
 for(const context of [{},{kind:'owner',queuedAt},{kind:'transactional-client',queuedAt:'1970-01-01T00:00:00Z'},{kind:'transactional-client',queuedAt:new Date(Date.now()+60000).toISOString()}])assert.equal(stagingNotificationAllowed('email','client@example.test',enabled,context),false);
 assert.equal(stagingNotificationAllowed('sms','+18135550100',enabled,{kind:'transactional-client',queuedAt}),false);
 assert.equal(stagingNotificationAllowed('email','client@example.test',{...enabled,STAGING_NOTIFICATIONS_ENABLED:'false'},{kind:'transactional-client',queuedAt}),false);
 assert.equal(stagingNotificationAllowed('email','client@example.test',{...enabled,STAGING_CLIENT_EMAIL_AFTER:'invalid'},{kind:'transactional-client',queuedAt}),false);
});
test('a correctly signed live Stripe event is rejected in staging, while a signed sandbox event passes',()=>{
 const now=1800000000,secret='whsec_synthetic_staging_test';
 for(const livemode of [true,false,undefined]){
  const raw=JSON.stringify({id:'evt_test',account:'acct_test',type:'invoice.paid',livemode,data:{object:{}}});
  const signature='t='+now+',v1='+createHmac('sha256',secret).update(now+'.'+raw).digest('hex');
  if(livemode===false)assert.equal(verifyStripeWebhook(raw,signature,secret,now,env).id,'evt_test');
  else assert.throws(()=>verifyStripeWebhook(raw,signature,secret,now,env),/only sandbox/);
 }
});
