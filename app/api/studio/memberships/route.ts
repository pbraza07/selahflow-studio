import {randomUUID} from 'node:crypto';
import {getPool} from '../../../../server/database.mjs';
import {requireOwner} from '../../../../lib/auth';
import {validOrigin,trustedOrigin} from '../../../../server/security.mjs';
import {paymentConfigured,validateMembershipPlan,stripeApi} from '../../../../server/membership-payments.mjs';
import {planEntitlements,activeMembershipLimit} from '../../../../server/plan-entitlements.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
async function ctx(req:Request){
 const owner=await requireOwner(req),pool=getPool();
 const row=(await pool.query("SELECT b.id,b.slug,b.name,s.plan_code,s.status AS subscription_status FROM businesses b JOIN business_subscriptions s ON s.business_id=b.id WHERE b.owner_id=$1 AND b.status='active'",[owner])).rows[0];
 if(!row)throw Error('Business unavailable.');
 return {owner,pool,business:row};
}
function error(err:unknown){
 const msg=(err as Error).message||'Memberships unavailable.';
 return Response.json({error:msg==='AUTH_REQUIRED'?'Please sign in to manage memberships.':msg},
  {status:msg==='AUTH_REQUIRED'?401:/limit|allows up to|only |exceed/i.test(msg)?409:/invalid|enter |choose |required/i.test(msg)?400:503,headers});
}
export async function GET(req:Request){
 try{
  const {pool,business}=await ctx(req);
  const [plans,members,merchant]=await Promise.all([
   pool.query('SELECT id,name,description,interval_unit AS interval,price_cents AS "priceCents",active FROM membership_plans WHERE business_id=$1 ORDER BY created_at DESC',[business.id]),
   pool.query("SELECT m.id,m.customer_name,m.customer_email,m.status,m.last_paid_at,m.paid_through,p.name AS plan_name,p.interval_unit FROM customer_memberships m JOIN membership_plans p ON p.id=m.plan_id WHERE m.business_id=$1 ORDER BY m.created_at DESC LIMIT 200",[business.id]),
   pool.query("SELECT external_account_id,charges_enabled,onboarding_complete FROM merchant_accounts WHERE business_id=$1",[business.id])
  ]);
  const account=merchant.rows[0]||{};
  return Response.json({businessName:business.name,plans:plans.rows,members:members.rows,planBenefits:planEntitlements(business.plan_code,business.subscription_status),
   payments:{configured:paymentConfigured(),connected:!!account.external_account_id,
    ready:paymentConfigured()&&account.charges_enabled===true&&account.onboarding_complete===true}}, {headers});
 }catch(e){return error(e);}
}
export async function POST(req:Request){
 if(!validOrigin(req))return Response.json({error:'Invalid origin.'},{status:403,headers});
 try{
  const {pool,business}=await ctx(req);
  const raw=await req.text();if(raw.length>8000)throw Error('Request too large.');
  const input=JSON.parse(raw);
  if(input.action==='save'||input.action==='toggle'){
   // Serialize membership offer modifications for this business. Quotas are
   // enforced by the server against the persisted plan and existing offers.
   const client=await pool.connect();
   try{
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[business.id+':membership-offers']);
    const record=(await client.query(
     'SELECT s.plan_code,s.status FROM business_subscriptions s WHERE s.business_id=$1',
     [business.id])).rows[0];
    const limit=activeMembershipLimit(record?.plan_code,record?.status);
    const count=Number((await client.query(
     'SELECT COUNT(*)::int AS count FROM membership_plans WHERE business_id=$1 AND active=TRUE',
     [business.id])).rows[0]?.count||0);
    if(input.action==='save'){
     const plan=validateMembershipPlan(input);
     const active=input.active!==false;
     if(input.id){
      if(!/^[a-f0-9-]{36}$/i.test(input.id))throw Error('Invalid membership offer.');
      const old=(await client.query(
       'SELECT active FROM membership_plans WHERE id=$1 AND business_id=$2 FOR UPDATE',
       [input.id,business.id])).rows[0];
      if(!old)throw Error('Membership offer not found for this business.');
      if(active&&!old.active&&count>=limit)
       throw Error('Your '+planEntitlements(record?.plan_code,record?.status).name+' plan allows up to '+limit+' active customer membership offers. Existing offers are preserved.');
      await client.query(
       'UPDATE membership_plans SET name=$1,description=$2,interval_unit=$3,price_cents=$4,active=$5,updated_at=now() WHERE id=$6 AND business_id=$7',
       [plan.name,plan.description,plan.interval,plan.price,active,input.id,business.id]);
     }else{
      if(active&&count>=limit)
       throw Error('Your '+planEntitlements(record?.plan_code,record?.status).name+' plan allows up to '+limit+' active customer membership offers. Existing offers are preserved.');
      await client.query(
       'INSERT INTO membership_plans(id,business_id,name,description,interval_unit,price_cents,active) VALUES($1,$2,$3,$4,$5,$6,$7)',
       [randomUUID(),business.id,plan.name,plan.description,plan.interval,plan.price,active]);
     }
    }else{
     if(!/^[a-f0-9-]{36}$/i.test(input.id||''))throw Error('Invalid membership offer.');
     const old=(await client.query(
      'SELECT active FROM membership_plans WHERE id=$1 AND business_id=$2 FOR UPDATE',
      [input.id,business.id])).rows[0];
     if(!old)throw Error('Membership offer not found for this business.');
     if(input.active===true&&!old.active&&count>=limit)
      throw Error('Your '+planEntitlements(record?.plan_code,record?.status).name+' plan allows up to '+limit+' active customer membership offers. Existing offers are preserved.');
     await client.query(
      'UPDATE membership_plans SET active=$1,updated_at=now() WHERE id=$2 AND business_id=$3',
      [input.active===true,input.id,business.id]);
    }
    await client.query('COMMIT');
    return Response.json({ok:true,planLimit:limit},{headers});
   }catch(e){await client.query('ROLLBACK');throw e;}
   finally{client.release();}
  }
  if(input.action==='connect'){
   if(!paymentConfigured())throw Error('Stripe payments require STRIPE_SECRET_KEY and STRIPE_CONNECT_WEBHOOK_SECRET in the SelahFlow Render environment before enrollment can accept money.');
   const current=(await pool.query('SELECT external_account_id FROM merchant_accounts WHERE business_id=$1',[business.id])).rows[0];
   let accountId=current?.external_account_id;
   if(!accountId){
    const created=await stripeApi('accounts',{params:{
     type:'express',country:'US',email:input.email||undefined,
     'business_profile[name]':business.name,
     'capabilities[card_payments][requested]':'true',
     'capabilities[transfers][requested]':'true',
     'metadata[selahflow_business_id]':business.id
    },idempotencyKey:'selahflow-connect-'+business.id});
    accountId=created.id;
    await pool.query("INSERT INTO merchant_accounts(business_id,provider,external_account_id) VALUES($1,'stripe',$2) ON CONFLICT(business_id) DO UPDATE SET external_account_id=excluded.external_account_id",
     [business.id,accountId]);
   }
   const origin=trustedOrigin(req);
   const link=await stripeApi('account_links',{params:{
    account:accountId,refresh_url:origin+'/studio/'+business.slug+'?stripe=retry',
    return_url:origin+'/studio/'+business.slug+'?stripe=connected',type:'account_onboarding'
   }});
   return Response.json({url:link.url},{headers});
  }
  if(input.action==='verify'){
   if(!paymentConfigured())throw Error('Stripe payments are not yet configured.');
   const account=(await pool.query('SELECT external_account_id FROM merchant_accounts WHERE business_id=$1',[business.id])).rows[0];
   if(!account?.external_account_id)throw Error('Connect Stripe before verifying payments.');
   const info=await stripeApi('accounts/'+account.external_account_id,{method:'GET'});
   const ready=info.charges_enabled===true&&info.details_submitted===true;
   await pool.query('UPDATE merchant_accounts SET charges_enabled=$1,onboarding_complete=$2,updated_at=now() WHERE business_id=$3',
    [info.charges_enabled===true,info.details_submitted===true,business.id]);
   return Response.json({ok:true,ready},{headers});
  }
  throw Error('Invalid membership action.');
 }catch(e){return error(e);}
}
