import test from 'node:test';
import assert from 'node:assert/strict';

test('independent server module graphs share one staging pool with rollout headroom',async()=>{
 const keys=['APP_ENV','DATABASE_URL','STAGING_DATABASE_HOST','RENDER','RENDER_GIT_BRANCH','RENDER_SERVICE_NAME','APP_URL','STRIPE_SECRET_KEY','STRIPE_PUBLISHABLE_KEY','NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'];
 const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 const poolKey=Symbol.for('selahflow.postgres.pool');
 assert.equal(globalThis[poolKey],undefined);
 try{
  Object.assign(process.env,{APP_ENV:'staging',DATABASE_URL:'postgresql://selahflow_staging_user:fixture@localhost/selahflow_staging',STAGING_DATABASE_HOST:'localhost',RENDER:'true',RENDER_GIT_BRANCH:'staging',RENDER_SERVICE_NAME:'selahflow-staging',APP_URL:'https://selahflow-staging.onrender.com'});
  for(const k of ['STRIPE_SECRET_KEY','STRIPE_PUBLISHABLE_KEY','NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'])delete process.env[k];
  const a=await import('../server/database.mjs?instrumentation');
  const b=await import('../server/database.mjs?route');
  assert.equal(a.getPool(),b.getPool());
  assert.equal(a.getPool().options.max,2);
  assert.ok(a.getPool().options.max*2<5,'old and new instances fit the five-connection role limit');
  process.env.DATABASE_URL='postgresql://other:fixture@localhost/wrong';
  assert.throws(()=>b.getPool(),/dedicated user/,'cached pools must not bypass staging guards');
 }finally{
  await globalThis[poolKey]?.end();delete globalThis[poolKey];
  for(const k of keys)if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];
 }
});
