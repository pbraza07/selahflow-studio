import test from 'node:test';
import assert from 'node:assert/strict';
import {assertStagingDatabase,assertSandboxPayments,stagingNotificationAllowed} from '../server/staging-safety.mjs';
import {sendNotificationChannel} from '../server/notification-delivery.mjs';
import {configured,sendWebPush} from '../server/push-crypto.mjs';
const env={APP_ENV:'staging',DATABASE_URL:'postgresql://selahflow_staging_user:test@approved-host/selahflow_staging',STAGING_DATABASE_HOST:'approved-host',RENDER:'true',RENDER_SERVICE_NAME:'selahflow-staging',RENDER_GIT_BRANCH:'staging',RENDER_EXTERNAL_URL:'https://selahflow-staging.onrender.com'};
test('staging rejects production database, privileged user, wrong host, branch and origin before opening a pool',()=>{
 assert.doesNotThrow(()=>assertStagingDatabase(env));
 for(const change of [{DATABASE_URL:env.DATABASE_URL.replace('/selahflow_staging','/amanda_realtor_db')},{DATABASE_URL:env.DATABASE_URL.replace('selahflow_staging_user','amanda_realtor_db_user')},{STAGING_DATABASE_HOST:'other-host'},{RENDER_GIT_BRANCH:'main'},{APP_URL:'https://salonflow-hf3w.onrender.com'},{APP_ENV:''}])
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
