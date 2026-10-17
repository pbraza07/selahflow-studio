import {stripeApi,createStripeMerchantAccount,paymentConfigured} from './membership-payments.mjs';
import {assertSandboxPayments,isStaging} from './staging-safety.mjs';

export async function businessStripeDirectory(pool){
 const rows=(await pool.query("SELECT b.id,b.slug,b.name,b.status,a.external_account_id AS account_id,COALESCE(a.charges_enabled,false) AS charges_enabled,COALESCE(a.onboarding_complete,false) AS onboarding_complete,a.updated_at FROM businesses b LEFT JOIN merchant_accounts a ON a.business_id=b.id ORDER BY b.name,b.id")).rows;
 return {configured:paymentConfigured(),sandbox:isStaging(),businesses:rows.map(b=>({...b,ready:paymentConfigured()&&b.status==='active'&&b.charges_enabled===true&&b.onboarding_complete===true}))};
}
export async function synchronizeBusinessStripe(pool,businessId,{createMissing=false,origin='',api=stripeApi,createAccount=createStripeMerchantAccount}={}){
 if(!paymentConfigured())throw Error('Stripe server configuration is incomplete.');
 assertSandboxPayments();
 const db=await pool.connect();
 try{
  await db.query('BEGIN');
  const b=(await db.query("SELECT id,slug,name,status FROM businesses WHERE id=$1 FOR UPDATE",[businessId])).rows[0];
  if(!b||b.status!=='active')throw Error('Only active businesses can set up payments.');
  let account=(await db.query('SELECT external_account_id FROM merchant_accounts WHERE business_id=$1',[b.id])).rows[0]?.external_account_id;
  if(!account&&createMissing){
   const created=await createAccount(b,isStaging()?`sandbox-${b.id}@example.com`:undefined);
   if(isStaging()&&created.livemode!==false)throw Error('Stripe must return a sandbox account.');
   account=created.id;
   if(!/^acct_[A-Za-z0-9]+$/.test(account||''))throw Error('Invalid Stripe account.');
   await db.query("INSERT INTO merchant_accounts(business_id,provider,external_account_id) VALUES($1,'stripe',$2) ON CONFLICT(business_id) DO UPDATE SET external_account_id=excluded.external_account_id,charges_enabled=false,onboarding_complete=false",[b.id,account]);
  }
  if(!account){await db.query('COMMIT');return {id:b.id,connected:false,ready:false,requirements:[]};}
  const info=await api('accounts/'+account,{method:'GET'});
  if(info.id!==account||info.livemode===true&&isStaging()||info.metadata?.selahflow_business_id&&info.metadata.selahflow_business_id!==b.id)throw Error('Stripe account does not match this business/environment.');
  const ready=info.charges_enabled===true&&info.details_submitted===true;
  await db.query('UPDATE merchant_accounts SET charges_enabled=$1,onboarding_complete=$2,updated_at=now() WHERE business_id=$3 AND external_account_id=$4',[info.charges_enabled===true,info.details_submitted===true,b.id,account]);
  await db.query('COMMIT');
  let url;
  if(origin&&!ready){
   const parsed=new URL(origin);if(parsed.protocol!=='https:'||isStaging()&&parsed.hostname!=='selahflow-staging.onrender.com')throw Error('Invalid payment setup origin.');
   const link=await api('account_links',{params:{account,refresh_url:origin+'/admin/platform?stripe=retry',return_url:origin+'/admin/platform?stripe=connected',type:'account_onboarding'}});
   if(new URL(link.url).origin!=='https://connect.stripe.com')throw Error('Invalid Stripe onboarding link.');
   url=link.url;
  }
  return {id:b.id,connected:true,accountId:account,ready,requirements:[...new Set([...(info.requirements?.currently_due||[]),...(info.requirements?.past_due||[])])],...(url?{url}:{})};
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
export async function prepareStagingStripeAccounts(pool,{api=stripeApi,createAccount=createStripeMerchantAccount}={}){
 if(process.env.APP_ENV!=='staging')throw Error('Bulk sandbox setup is restricted to staging.');
 assertSandboxPayments();
 if(!/^sk_test_|^rk_test_/.test(process.env.STRIPE_SECRET_KEY||''))throw Error('A sandbox Stripe key is required.');
 const businesses=(await pool.query("SELECT id,slug FROM businesses WHERE status='active' ORDER BY id")).rows,results=[];
 for(const business of businesses){
  try{results.push({...business,...await synchronizeBusinessStripe(pool,business.id,{createMissing:true,api,createAccount})});}
  catch(error){results.push({...business,ready:false,error:String(error.message).slice(0,300)});}
 }
 return results;
}
