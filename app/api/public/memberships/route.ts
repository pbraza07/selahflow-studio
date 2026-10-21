import {quoteCoupon} from '../../../../server/business-coupons.mjs';
import {membershipEligibilitySummary} from '../../../../server/membership-eligibility.mjs';
import {startMembershipCheckout} from '../../../../server/membership-checkout.mjs';
import {membershipRequestDetails,registerMembershipWithoutApproval} from '../../../../server/membership-requests.mjs';
import {tokenHash} from '../../../../server/security.mjs';
import {publicRegistrationSettings} from '../../../../server/registration-questions.mjs';
import {getPool} from '../../../../server/database.mjs';
import {validOrigin,trustedOrigin} from '../../../../server/security.mjs';
import {paymentConfigured} from '../../../../server/membership-payments.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
const noStore={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const slugOk=(s:unknown):s is string=>typeof s==='string'&&/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(s);
export async function GET(req:Request){
 const slug=new URL(req.url).searchParams.get('slug');
 if(!slugOk(slug))return Response.json({error:'Business not found.'},{status:404,headers:noStore});
 try{
  const pool=getPool();
  const b=(await pool.query("SELECT b.id,b.name,b.slug,b.brand_primary,b.brand_background,s.data AS settings_data,a.charges_enabled,a.onboarding_complete FROM businesses b LEFT JOIN settings s ON s.owner=b.owner_id LEFT JOIN merchant_accounts a ON a.business_id=b.id WHERE b.slug=$1 AND b.status='active'",[slug])).rows[0];
  if(!b)return Response.json({error:'Business not found.'},{status:404,headers:noStore});
  const plans=(await pool.query("SELECT p.interval_count AS \"intervalCount\",p.credit_eligibility,p.id,p.name,p.description,p.interval_unit AS interval,p.price_cents AS \"priceCents\",p.group_id AS \"groupId\",COALESCE(p.badge,g.badge) AS badge FROM membership_plans p LEFT JOIN membership_groups g ON g.id=p.group_id AND g.business_id=p.business_id WHERE p.business_id=$1 AND p.active=TRUE ORDER BY p.display_order,p.created_at DESC,p.name",[b.id])).rows;
  const groups=(await pool.query('SELECT g.id,g.name,g.badge FROM membership_groups g WHERE g.business_id=$1 AND EXISTS(SELECT 1 FROM membership_plans p WHERE p.business_id=g.business_id AND p.group_id=g.id AND p.active=true) ORDER BY g.display_order,g.created_at,g.id',[b.id])).rows;
  let config:any={};try{config=JSON.parse(b.settings_data||'{}')}catch{}
  const theme=config.theme||null;
  return Response.json({slug:b.slug,name:b.name,plans:plans.map((p:any)=>{const {credit_eligibility,...plan}=p;return {...plan,creditSummary:membershipEligibilitySummary(credit_eligibility,config)};}),groups,brandPrimary:b.brand_primary,brandBackground:b.brand_background,theme,registrationConfig:publicRegistrationSettings(config),
   acceptsRequests:true,canPay:paymentConfigured()&&b.charges_enabled===true&&b.onboarding_complete===true},{headers:noStore});
 }catch{return Response.json({error:'Membership enrollment unavailable.'},{status:503,headers:noStore});}
}
export async function POST(req:Request){
 if(!validOrigin(req))return Response.json({error:'Invalid origin.'},{status:403,headers:noStore});
 try{
  const raw=await req.text();if(raw.length>20000)throw Error('Invalid enrollment details.');
  const body=JSON.parse(raw);
  if(!slugOk(body.slug)||!/^[a-f0-9-]{36}$/i.test(body.planId||''))throw Error('Choose a valid membership.');
  if(body.website)throw Error('Enrollment request not accepted.');
  if(body.action==='quoteCoupon'){const pool=getPool();const p=(await pool.query("SELECT p.business_id,p.price_cents FROM membership_plans p JOIN businesses b ON b.id=p.business_id WHERE b.slug=$1 AND b.status='active' AND p.id=$2 AND p.active=true",[body.slug,body.planId])).rows[0];if(!p)throw Error('Choose an available membership.');return Response.json(await quoteCoupon(pool,p.business_id,body.couponCode,Number(p.price_cents)),{headers:noStore});}
  if(body.action==='checkoutMembership'){
   const pool=getPool(),ip=(req.headers.get('x-forwarded-for')||'unknown').split(',').at(-1)!.trim();
   const limit=(await pool.query("INSERT INTO public_limits(key,count,window_start) VALUES($1,1,now()) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN public_limits.window_start<now()-interval '15 minutes' THEN 1 ELSE public_limits.count+1 END,window_start=CASE WHEN public_limits.window_start<now()-interval '15 minutes' THEN now() ELSE public_limits.window_start END RETURNING count",['membership-checkout:'+body.slug+':'+tokenHash(ip)])).rows[0];
   if(limit.count>12)return Response.json({error:'Too many requests. Please try again later.'},{status:429,headers:noStore});
   return Response.json(await startMembershipCheckout(pool,body,trustedOrigin(req)),{headers:noStore});
  }
  if(body.action==='requestMembership'){
   const pool=getPool();
   const business=(await pool.query("SELECT b.id,b.owner_id,s.data FROM businesses b LEFT JOIN settings s ON s.owner=b.owner_id WHERE b.slug=$1 AND b.status='active'",[body.slug])).rows[0];
   if(!business)throw Error('Business not found.');
   const ip=(req.headers.get('x-forwarded-for')||'unknown').split(',').at(-1)!.trim();
   const key='membership-request:'+business.id+':'+tokenHash(ip);
   const rate=(await pool.query("INSERT INTO public_limits(key,count,window_start) VALUES($1,1,now()) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN public_limits.window_start<now()-interval '15 minutes' THEN 1 ELSE public_limits.count+1 END,window_start=CASE WHEN public_limits.window_start<now()-interval '15 minutes' THEN now() ELSE public_limits.window_start END RETURNING count",[key])).rows[0];
   if(rate.count>12)return Response.json({error:'Too many requests. Please try again later.'},{status:429,headers:noStore});
   const plan=(await pool.query('SELECT id,price_cents,name FROM membership_plans WHERE business_id=$1 AND id=$2 AND active=true',[business.id,body.planId])).rows[0];
   if(!plan)throw Error('Choose an available membership package.');
   if(body.termsAccepted!==true)throw Error('Please accept the membership request terms.');
   const config=typeof business.data==='string'?JSON.parse(business.data):business.data||{};
   const details={...membershipRequestDetails(config,body),quotedPriceCents:Number(plan.price_cents),quotedPlanName:plan.name};
   if(!/^[a-f0-9-]{36}$/i.test(body.requestId||''))throw Error('Invalid request identifier. Refresh and try again.');
   const registered=await registerMembershipWithoutApproval(pool,{businessId:business.id,ownerId:business.owner_id,planId:plan.id,requestId:body.requestId,details});
   return Response.json(registered,{headers:noStore});
  }

  throw Error('Choose a valid enrollment action.');
 }catch(e){
  const msg=(e as Error).message||'Unable to start checkout.';
  return Response.json({error:msg},{status:/choose|enter|accept|valid|invalid/i.test(msg)?400:503,headers:noStore});
 }
}
