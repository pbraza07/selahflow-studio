import {issueMemberId} from '../../../../server/member-id-policy.mjs';
import {notifyMembershipRequest} from '../../../../server/notification-delivery.mjs';
import {membershipRequestDetails} from '../../../../server/membership-requests.mjs';
import {pushMembershipRequest} from '../../../../server/push-delivery.mjs';
import {tokenHash} from '../../../../server/security.mjs';
import {customRegistrationFields,publicRegistrationSettings,validateStandardRegistration} from '../../../../server/registration-questions.mjs';
import {sanitizeBookingAnswers} from '../../../../server/booking-custom-fields.mjs';
import {randomUUID} from 'node:crypto';
import {getPool} from '../../../../server/database.mjs';
import {validOrigin,trustedOrigin} from '../../../../server/security.mjs';
import {paymentConfigured,stripeApi} from '../../../../server/membership-payments.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
const noStore={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const slugOk=(s:unknown):s is string=>typeof s==='string'&&/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(s);
const text=(s:unknown,max=250)=>typeof s==='string'?s.trim().slice(0,max):'';
export async function GET(req:Request){
 const slug=new URL(req.url).searchParams.get('slug');
 if(!slugOk(slug))return Response.json({error:'Business not found.'},{status:404,headers:noStore});
 try{
  const pool=getPool();
  const b=(await pool.query("SELECT b.id,b.name,b.slug,b.brand_primary,b.brand_background,s.data AS settings_data,a.charges_enabled,a.onboarding_complete FROM businesses b LEFT JOIN settings s ON s.owner=b.owner_id LEFT JOIN merchant_accounts a ON a.business_id=b.id WHERE b.slug=$1 AND b.status='active'",[slug])).rows[0];
  if(!b)return Response.json({error:'Business not found.'},{status:404,headers:noStore});
  const plans=(await pool.query("SELECT p.id,p.name,p.description,p.interval_unit AS interval,p.price_cents AS \"priceCents\",p.group_id AS \"groupId\",COALESCE(p.badge,g.badge) AS badge FROM membership_plans p LEFT JOIN membership_groups g ON g.id=p.group_id AND g.business_id=p.business_id WHERE p.business_id=$1 AND p.active=TRUE ORDER BY p.display_order,p.created_at DESC,p.name",[b.id])).rows;
  const groups=(await pool.query('SELECT g.id,g.name,g.badge FROM membership_groups g WHERE g.business_id=$1 AND EXISTS(SELECT 1 FROM membership_plans p WHERE p.business_id=g.business_id AND p.group_id=g.id AND p.active=true) ORDER BY g.display_order,g.created_at,g.id',[b.id])).rows;
  let config:any={};try{config=JSON.parse(b.settings_data||'{}')}catch{}
  const theme=config.theme||null;
  return Response.json({slug:b.slug,name:b.name,plans,groups,brandPrimary:b.brand_primary,brandBackground:b.brand_background,theme,registrationConfig:publicRegistrationSettings(config),
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
  if(body.action==='requestMembership'){
   const pool=getPool();
   const business=(await pool.query("SELECT b.id,b.owner_id,s.data FROM businesses b LEFT JOIN settings s ON s.owner=b.owner_id WHERE b.slug=$1 AND b.status='active'",[body.slug])).rows[0];
   if(!business)throw Error('Business not found.');
   const ip=(req.headers.get('x-forwarded-for')||'unknown').split(',').at(-1)!.trim();
   const key='membership-request:'+business.id+':'+tokenHash(ip);
   const rate=(await pool.query("INSERT INTO public_limits(key,count,window_start) VALUES($1,1,now()) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN public_limits.window_start<now()-interval '15 minutes' THEN 1 ELSE public_limits.count+1 END,window_start=CASE WHEN public_limits.window_start<now()-interval '15 minutes' THEN now() ELSE public_limits.window_start END RETURNING count",[key])).rows[0];
   if(rate.count>12)return Response.json({error:'Too many requests. Please try again later.'},{status:429,headers:noStore});
   const plan=(await pool.query('SELECT id FROM membership_plans WHERE business_id=$1 AND id=$2 AND active=true',[business.id,body.planId])).rows[0];
   if(!plan)throw Error('Choose an available membership package.');
   if(body.termsAccepted!==true)throw Error('Please accept the membership request terms.');
   const config=typeof business.data==='string'?JSON.parse(business.data):business.data||{};
   const details=membershipRequestDetails(config,body);
   if(!/^[a-f0-9-]{36}$/i.test(body.requestId||''))throw Error('Invalid request identifier. Refresh and try again.');
   const inserted=await pool.query("INSERT INTO membership_requests(id,business_id,plan_id,details) VALUES($1,$2,$3,$4::jsonb) ON CONFLICT(id) DO NOTHING RETURNING id",[body.requestId,business.id,plan.id,JSON.stringify(details)]);
   if(inserted.rowCount){await Promise.allSettled([pushMembershipRequest(body.requestId),notifyMembershipRequest({requestId:body.requestId,origin:trustedOrigin(req)})]);}
   return Response.json({ok:true,requested:true,message:'Membership request submitted. The team will review your information.'},{headers:noStore});
  }

  const name=text(body.name,101),email=text(body.email,255).toLowerCase();
  if(name.length<2||name.length>100||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)
   throw Error('Enter your full name and a valid email.');
  if(body.termsAccepted!==true)throw Error('Please accept recurring billing and membership terms.');
  if(!paymentConfigured())throw Error('Secure online membership payments are not available yet. Contact the business.');
  const pool=getPool();
  const item=(await pool.query(
   "SELECT p.id,p.name,p.interval_unit,p.price_cents,b.id AS business_id,b.owner_id,b.slug,b.name AS business_name,a.external_account_id,a.charges_enabled,a.onboarding_complete FROM membership_plans p JOIN businesses b ON b.id=p.business_id JOIN merchant_accounts a ON a.business_id=b.id WHERE b.slug=$1 AND p.id=$2 AND p.active=TRUE AND b.status='active'",
   [body.slug,body.planId])).rows[0];
  if(!item)throw Error('Membership is no longer available.');
  if(item.charges_enabled!==true||item.onboarding_complete!==true)throw Error('Business payments are not yet ready.');
  const settings=(await pool.query('SELECT data FROM settings WHERE owner=$1',[item.owner_id])).rows[0]?.data;
  const config=typeof settings==='string'?JSON.parse(settings):settings||{};
  validateStandardRegistration(config,'membership',body);
  const dob=String(body.dateOfBirth||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(dob)||!Number.isFinite(Date.parse(dob))||new Date(dob).toISOString().slice(0,10)!==dob||dob>new Date().toISOString().slice(0,10))throw Error('Enter a valid date of birth.');
  const fields=customRegistrationFields(config,'membership');
  const answers=sanitizeBookingAnswers(fields,body.customAnswers);
  const labels=Object.fromEntries(fields.map((f:any)=>[f.id,f.label]));
  // Recheck Stripe before redirecting a customer, not merely locally cached flags.
  const account=await stripeApi('accounts/'+item.external_account_id,{method:'GET'});
  if(account.charges_enabled!==true||account.details_submitted!==true)
   throw Error('Payments are temporarily unavailable for this business.');
  const id=randomUUID(),origin=trustedOrigin(req);
  const registration=await pool.connect();
  try{
   await registration.query('BEGIN');
   const number=await issueMemberId(registration,{businessId:item.business_id,name,dateOfBirth:dob,requested:body.memberNumber});
  await registration.query(
   "INSERT INTO customer_memberships(id,business_id,plan_id,customer_name,customer_email,status,stripe_account_id,price_cents,date_of_birth,customer_phone,registration_answers,registration_field_labels,member_number) VALUES($1,$2,$3,$4,$5,'pending_payment',$6,$7,$8::date,$9,$10::jsonb,$11::jsonb,$12)",
   [id,item.business_id,item.id,name,email,item.external_account_id,item.price_cents,dob,text(body.phone,40),JSON.stringify(answers),JSON.stringify(labels),number]);
   await registration.query('COMMIT');
  }catch(error){await registration.query('ROLLBACK');throw error;}finally{registration.release();}
  const session=await stripeApi('checkout/sessions',{account:item.external_account_id,
   idempotencyKey:'membership-checkout-'+id,
   params:{
    mode:'subscription',
    'payment_method_types[0]':'card',
    'line_items[0][quantity]':'1',
    'line_items[0][price_data][currency]':'usd',
    'line_items[0][price_data][unit_amount]':String(item.price_cents),
    'line_items[0][price_data][recurring][interval]':item.interval_unit,
    'line_items[0][price_data][product_data][name]':item.business_name+' · '+item.name,
    'line_items[0][price_data][product_data][description]':item.interval_unit+'ly recurring membership',
    customer_email:email,
    client_reference_id:id,
    'metadata[membership_id]':id,
    'metadata[selahflow_business_id]':item.business_id,
    'subscription_data[metadata][membership_id]':id,
    'subscription_data[metadata][selahflow_business_id]':item.business_id,
    'subscription_data[description]':item.business_name+' · '+item.name,
    'payment_method_collection':'always',
    success_url:origin+'/membership/'+encodeURIComponent(item.slug)+'?checkout=success&session_id={CHECKOUT_SESSION_ID}',
    cancel_url:origin+'/membership/'+encodeURIComponent(item.slug)+'?checkout=cancelled'
   }});
  if(!/^https:\/\/checkout\.stripe\.com\//.test(session.url||''))throw Error('Stripe could not create a secure checkout link.');
  await pool.query('UPDATE customer_memberships SET stripe_checkout_session_id=$1,updated_at=now() WHERE id=$2 AND business_id=$3',
    [session.id,id,item.business_id]);
  return Response.json({checkoutUrl:session.url},{headers:noStore});
 }catch(e){
  const msg=(e as Error).message||'Unable to start checkout.';
  return Response.json({error:msg},{status:/choose|enter|accept|valid|invalid/i.test(msg)?400:503,headers:noStore});
 }
}
