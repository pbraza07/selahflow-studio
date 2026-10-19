import {createHash} from 'node:crypto';
import {issueMemberId} from './member-id-policy.mjs';
import {membershipRequestDetails} from './membership-requests.mjs';
import {stripeApi} from './membership-payments.mjs';
import {readyMerchant,assertTestPayment,checkoutUrl} from './stripe-checkout.mjs';

export async function startMembershipCheckout(pool,body,origin,api=stripeApi){
 if(!/^[a-f0-9-]{36}$/i.test(body.requestId||''))throw Error('Invalid request identifier. Refresh and try again.');
 const db=await pool.connect();
 try{
  await db.query('BEGIN');
  const business=(await db.query("SELECT b.id,b.name,b.slug,s.data FROM businesses b LEFT JOIN settings s ON s.owner=b.owner_id WHERE b.slug=$1 AND b.status='active'",[body.slug])).rows[0];
  if(!business)throw Error('Business unavailable.');
  const plan=(await db.query('SELECT * FROM membership_plans WHERE id=$1 AND business_id=$2 AND active=true',[body.planId,business.id])).rows[0];
  if(!plan)throw Error('Choose an available membership.');
  if(body.termsAccepted!==true||body.recurringAccepted!==true)throw Error('Please accept recurring billing and membership terms.');
  const config=typeof business.data==='string'?JSON.parse(business.data):business.data||{};
  const details=membershipRequestDetails(config,body);
  const name=details.name,email=details.email.toLowerCase(),dob=details.dateOfBirth;
  const fingerprint=createHash('sha256').update(JSON.stringify({plan:plan.id,name:name.toLowerCase().replace(/\s+/g,' '),email,dob})).digest('hex');
  // Serialize enrollment for the same identity, including retries with a fresh browser request ID.
  const number=await issueMemberId(db,{businessId:business.id,name,dateOfBirth:dob,requested:body.memberNumber});
  let member=(await db.query('SELECT * FROM customer_memberships WHERE business_id=$1 AND member_number=$2 FOR UPDATE',[business.id,number])).rows[0];
  // A pending offline registration may transition into Stripe without approval.
  // Only the matching member identity, selected plan and unchanged price qualify.
  const unpaidRegistration=!!(member&&member.status==='pending_payment'&&!member.stripe_signup_fingerprint&&!member.stripe_checkout_session_id&&!member.stripe_account_id);
  if(member&&(member.status!=='pending_payment'||!unpaidRegistration&&member.stripe_signup_fingerprint!==fingerprint))
   throw Error('This client already has a membership or another enrollment. Contact the business to manage it.');
  if(member&&(Number(member.price_cents)!==Number(plan.price_cents)||!unpaidRegistration&&(member.stripe_interval_unit!==plan.interval_unit||Number(member.stripe_sessions_per_period)!==Number(plan.sessions_included))))
   throw Error('This package changed after registration. Contact the business before paying.');
  if(unpaidRegistration&&(member.plan_id!==plan.id||String(member.customer_name).trim().toLowerCase()!==name.trim().toLowerCase()||
    String(member.customer_email).trim().toLowerCase()!==email||String(member.date_of_birth).slice(0,10)!==dob))
   throw Error('Registration identity or package does not match. Contact the business.');
  const account=await readyMerchant(db,business.id,api);
  if(member&&!unpaidRegistration&&member.stripe_account_id!==account)throw Error('The payment account changed. Contact the business.');
  if(unpaidRegistration){
   await db.query("UPDATE customer_memberships SET stripe_account_id=$1,stripe_signup_fingerprint=$2,stripe_interval_unit=$3,stripe_sessions_per_period=$4,updated_at=now() WHERE id=$5 AND business_id=$6 AND status='pending_payment' AND stripe_account_id=''",[account,fingerprint,plan.interval_unit,plan.sessions_included,member.id,business.id]);
   member={...member,stripe_account_id:account,stripe_signup_fingerprint:fingerprint,stripe_interval_unit:plan.interval_unit,stripe_sessions_per_period:plan.sessions_included};
  }
  if(member?.stripe_checkout_session_id){
   const previous=await api('checkout/sessions/'+member.stripe_checkout_session_id,{method:'GET',account});assertTestPayment(previous);
   if(previous.status==='open'){await db.query('COMMIT');return {checkoutUrl:checkoutUrl(previous)};}
   if(previous.status!=='expired'){await db.query('COMMIT');return {returnUrl:origin+'/membership/'+business.slug+'?checkout=success&session_id='+encodeURIComponent(previous.id)};}
  }
  if(!member){
   const labels=details.fieldLabels||{};
   member=(await db.query("INSERT INTO customer_memberships(id,business_id,plan_id,customer_name,customer_email,status,stripe_account_id,price_cents,date_of_birth,customer_phone,registration_answers,registration_field_labels,member_number,stripe_sessions_per_period,stripe_signup_fingerprint,stripe_interval_unit) VALUES($1,$2,$3,$4,$5,'pending_payment',$6,$7,$8::date,$9,$10::jsonb,$11::jsonb,$12,$13,$14,$15) RETURNING *",[body.requestId,business.id,plan.id,name,email,account,plan.price_cents,dob,details.phone,JSON.stringify(details.customAnswers||{}),JSON.stringify(labels),number,plan.sessions_included,fingerprint,plan.interval_unit])).rows[0];
  }
  const session=await api('checkout/sessions',{account,idempotencyKey:'membership-'+member.id+'-'+(member.stripe_checkout_session_id||'initial'),params:{
   mode:'subscription','allowed_payment_method_types[0]':'card','line_items[0][quantity]':'1',
   'line_items[0][price_data][currency]':'usd','line_items[0][price_data][unit_amount]':String(member.price_cents),
   'line_items[0][price_data][recurring][interval]':member.stripe_interval_unit,
   'line_items[0][price_data][product_data][name]':business.name+' · '+plan.name,
   customer_email:email,client_reference_id:member.id,
   'metadata[membership_id]':member.id,'metadata[selahflow_business_id]':business.id,
   'subscription_data[metadata][membership_id]':member.id,'subscription_data[metadata][selahflow_business_id]':business.id,
   'payment_method_collection':'always',success_url:origin+'/membership/'+business.slug+'?checkout=success&session_id={CHECKOUT_SESSION_ID}',
   cancel_url:origin+'/membership/'+business.slug+'?checkout=cancelled'
  }});
  assertTestPayment(session);const url=checkoutUrl(session);
  await db.query('UPDATE customer_memberships SET stripe_checkout_session_id=$1,updated_at=now() WHERE id=$2 AND business_id=$3',[session.id,member.id,business.id]);
  await db.query('COMMIT');return {checkoutUrl:url};
 }catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
}
