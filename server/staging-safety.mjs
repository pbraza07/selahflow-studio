/** Staging boundaries are checked before a pool (and startup migrations) can run. */
export function isStaging(env=process.env){
 return env.APP_ENV==='staging'||env.RENDER_SERVICE_NAME==='selahflow-staging'||env.RENDER_GIT_BRANCH==='staging';
}
export function assertSandboxPayments(env=process.env){
 if(!isStaging(env))return;
 for(const [key,value] of Object.entries(env)){
  if(!value||!key.includes('STRIPE'))continue;
  if(/(?:sk|rk|pk)_live_/.test(value))throw Error('Live Stripe credentials are forbidden in staging.');
 }
 if(env.STRIPE_SECRET_KEY&&!/^(sk|rk)_test_/.test(env.STRIPE_SECRET_KEY))throw Error('Staging requires a Stripe sandbox/test secret key.');
 for(const key of ['STRIPE_PUBLISHABLE_KEY','NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'])
  if(env[key]&&!env[key].startsWith('pk_test_'))throw Error('Staging requires a Stripe sandbox/test publishable key.');
}
export function assertStagingDatabase(env=process.env){
 if(!isStaging(env))return;
 if(env.APP_ENV!=='staging')throw Error('The staging deployment must explicitly set APP_ENV=staging.');
 const url=new URL(env.DATABASE_URL||'postgresql://invalid/invalid');
 if(!['postgres:','postgresql:'].includes(url.protocol)||decodeURIComponent(url.pathname)!=='/selahflow_staging'||decodeURIComponent(url.username)!=='selahflow_staging_user')
  throw Error('Staging must use only selahflow_staging and its dedicated user.');
 if(!env.STAGING_DATABASE_HOST||url.hostname!==env.STAGING_DATABASE_HOST)throw Error('Staging database host does not match the approved instance.');
 if(env.RENDER==='true'&&(env.RENDER_GIT_BRANCH!=='staging'||env.RENDER_SERVICE_NAME!=='selahflow-staging'))throw Error('Staging must deploy the staging branch to selahflow-staging.');
 const origin=new URL(env.APP_URL||env.RENDER_EXTERNAL_URL||'http://localhost:3000');
 if(origin.hostname==='salonflow-hf3w.onrender.com'||(env.RENDER==='true'&&(!origin.hostname.startsWith('selahflow-staging')||!origin.hostname.endsWith('.onrender.com')||origin.protocol!=='https:')))
  throw Error('Staging must use its own HTTPS origin.');
 assertSandboxPayments(env);
}
export function stagingNotificationAllowed(channel,destination,env=process.env,context={}){
 if(!isStaging(env))return true;
 if(env.STAGING_NOTIFICATIONS_ENABLED!=='true')return false;
 const cutoff=Date.parse(env.STAGING_CLIENT_EMAIL_AFTER||''),queued=new Date(context.queuedAt||'').getTime();
 if(channel==='email'&&context.kind==='transactional-client'&&Number.isFinite(cutoff)&&Number.isFinite(queued)&&queued>=cutoff&&queued<=Date.now())return true;
 // This authorization is persisted only by an authenticated owner confirming the exact campaign.
 const approved=Date.parse(context.communicationAuthorizedAt||'');
 if(channel==='email'&&context.kind==='business-communication'&&context.businessId&&Number.isFinite(approved)&&approved<=Date.now())return true;
 if(channel==='email'&&context.kind==='business-communication'&&String(env.STAGING_COMMUNICATION_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean).includes(String(destination||'').trim().toLowerCase()))return true;
 const value=channel==='email'?env.STAGING_NOTIFICATION_EMAILS:env.STAGING_NOTIFICATION_PHONES;
 return String(value||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean).includes(String(destination||'').trim().toLowerCase());
}
