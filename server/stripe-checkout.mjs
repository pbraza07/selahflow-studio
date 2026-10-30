import {bookingServicePaymentOptions} from './service-payment-options.mjs';
import {weeklyMonthCredits} from './membership-weekly.mjs';
import {reserveCommission,attachCommissionSession,settleCommission} from './first-customer-commissions.mjs';
import {monthlyPeriod,refreshMemberPeriod,membershipAnchor,nextBillingAnchor} from './membership-periods.mjs';
import {assertBookingWaiver} from './participation-waivers.mjs';
import {randomUUID} from 'node:crypto';
import {stripeApi,paymentConfigured,invoiceSubscriptionId,invoicePaidThrough,shouldActivateInvoice} from './membership-payments.mjs';
import {isStaging} from './staging-safety.mjs';
import {tokenHash} from './security.mjs';
import {queueApprovedBooking,queueBookingPaid} from './booking-client-notifications.mjs';
import {confirmDirectBookingForPayment,pendingDirectBooking} from './direct-booking-approval.mjs';
import {sessionIsFull,SESSION_FULL_MESSAGE} from './session-capacity.mjs';
import {queueMembershipPaymentEmail} from './membership-payment-emails.mjs';

export function assertTestPayment(object){
 if(isStaging()&&object?.livemode!==false)throw Error('Staging accepts only Stripe sandbox payments.');
}
export function checkoutUrl(session){
 if(!/^https:\/\/checkout\.stripe\.com\//.test(session?.url||''))throw Error('Stripe did not return a secure checkout link.');
 return session.url;
}
export async function readyMerchant(db,businessId,api=stripeApi){
 if(!paymentConfigured())throw Error('Online payments are not configured yet. Contact the business.');
 const merchant=(await db.query("SELECT external_account_id FROM merchant_accounts WHERE business_id=$1 AND provider='stripe'",[businessId])).rows[0];
 if(!merchant?.external_account_id)throw Error('This business must connect Stripe before accepting online payments.');
 const account=await api('accounts/'+merchant.external_account_id,{method:'GET'});
 const ready=account.charges_enabled===true&&account.details_submitted===true;
 await db.query('UPDATE merchant_accounts SET charges_enabled=$1,onboarding_complete=$2,updated_at=now() WHERE business_id=$3 AND external_account_id=$4',[account.charges_enabled===true,account.details_submitted===true,businessId,merchant.external_account_id]);
 if(!ready)throw Error('The business must complete Stripe onboarding before online payment is available.');
 return merchant.external_account_id;
}

// Server prices come from the saved booking, never the payment button's payload.
export async function startBookingCheckout(pool,{slug,bookingId,token,origin},api=stripeApi){
 if(!/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(slug||'')||!/^[-a-f0-9]{36}$/i.test(bookingId||'')||!/^[a-f0-9]{64}$/i.test(token||''))throw Error('Invalid booking payment reference.');
 const pending=await pendingDirectBooking(pool,{slug,bookingId,token},{allowApproval:true});
 if(pending&&await sessionIsFull(pool,{owner:pending.row.owner_id,config:pending.config,date:pending.row.date,staff:pending.row.staff_id,services:pending.services,start:pending.row.start_minute}))throw Error(SESSION_FULL_MESSAGE);
 await confirmDirectBookingForPayment(pool,{slug,bookingId,token,origin});
 const db=await pool.connect();
 try{
  await db.query('BEGIN');
  const business=(await db.query("SELECT id,owner_id,name FROM businesses WHERE slug=$1 AND status='active'",[slug])).rows[0];
  if(!business)throw Error('Business unavailable.');
  const access=(await db.query('SELECT 1 FROM customer_booking_access WHERE owner_id=$1 AND booking_id=$2 AND token_hash=$3 AND expires_at>now()',[business.owner_id,bookingId,tokenHash(token)])).rowCount;
  if(!access)throw Error('Invalid or expired booking payment link.');
  await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[business.id+':payment:'+bookingId]);
  const request=(await db.query('SELECT status,appointment_id FROM booking_requests WHERE id=$1 AND business_id=$2',[bookingId,business.id])).rows[0];
  if(request&&request.status!=='accepted')throw Error('The business must approve this booking before you can pay.');
  const actualId=request?.appointment_id||bookingId;
  const appointment=(await db.query('SELECT id,data,status FROM appointments WHERE owner=$1 AND id=$2 FOR UPDATE',[business.owner_id,actualId])).rows[0];
  if(!appointment||!['Confirmed','Checked in','Checked-in','Completed','No-show'].includes(appointment.status))throw Error('This booking is not available for payment.');
  const data=typeof appointment.data==='string'?JSON.parse(appointment.data):appointment.data;
  const settings=(await db.query('SELECT data FROM settings WHERE owner=$1',[business.owner_id])).rows[0];
  const config=typeof settings?.data==='string'?JSON.parse(settings.data):settings?.data||{};
  await assertBookingWaiver(db,{owner:business.owner_id,config,serviceIds:data.serviceIds||[],memberNumber:data.memberNumber});
  if(data.paymentStatus==='paid'){await db.query('COMMIT');return {paid:true};}
  const cents=Math.round(Number(data.price)*100);
  if(data.membershipCovered===true||cents===0)throw Error('No payment is due for this booking.');
  if(!Number.isSafeInteger(cents)||cents<50||cents>100000000)throw Error('This booking has an invalid online payment amount.');
  await queueApprovedBooking(db,{bookingId:actualId,requestId:request?bookingId:null,origin});
  let record=(await db.query('SELECT * FROM booking_payments WHERE booking_id=$1 AND business_id=$2 FOR UPDATE',[actualId,business.id])).rows[0];
  if(record?.status==='paid'){await queueBookingPaid(db,business.id,actualId);await db.query('COMMIT');return {paid:true};}
  if(record&&record.amount_cents!==cents)throw Error('The booking price changed. Contact the business before paying.');
  if(!bookingServicePaymentOptions(config,data).online)throw Error('Pay onsite at the business for this service. Online payment is not enabled.');
  const account=await readyMerchant(db,business.id,api);
  if(record&&record.stripe_account_id!==account)throw Error('The payment account changed. Contact the business before paying.');
  if(record?.stripe_checkout_session_id){
   const existing=await api('checkout/sessions/'+record.stripe_checkout_session_id,{method:'GET',account});
   assertTestPayment(existing);
   if(existing.payment_status==='paid'){
    if(!await applyBookingPayment(db,business.id,account,existing,api))throw Error('The payment details need review by the business. Do not pay again.');await db.query('COMMIT');return {paid:true};
   }
   if(existing.status==='open'){await db.query('COMMIT');return {checkoutUrl:checkoutUrl(existing)};}
   if(existing.status!=='expired')throw Error('The previous payment is still processing. Please wait before retrying.');
  }
  if(!record){
   const lines=Array.isArray(data.paymentLines)&&data.paymentLines.length?data.paymentLines:[{id:data.serviceIds?.[0]||'',name:(data.services||['Appointment']).join(' + '),type:'service',price:cents/100,qty:1}];
   if(lines.reduce((sum,line)=>sum+Math.round(Number(line.price)*100)*line.qty,0)!==cents)throw Error('Booking payment details need review by the business.');
   record=(await db.query('INSERT INTO booking_payments(booking_id,business_id,stripe_account_id,amount_cents,lines) VALUES($1,$2,$3,$4,$5::jsonb) RETURNING *',[actualId,business.id,account,cents,JSON.stringify(lines)])).rows[0];
  }else if(record.amount_cents!==cents)throw Error('The booking price changed. Contact the business before paying.');
  const eligible=Math.min(record.amount_cents,record.lines.filter(line=>line.type==='service').reduce((n,line)=>n+Math.round(Number(line.price)*100)*line.qty,0));
  const commission=await reserveCommission(db,{businessId:business.id,kind:'booking',memberNumber:data.memberNumber,sourceId:actualId,account,grossCents:cents,eligibleCents:eligible},api);
  const session=await api('checkout/sessions',{account,idempotencyKey:'booking-'+actualId+'-'+(record.stripe_checkout_session_id||'initial'),params:{
   mode:'payment',...(commission?{'payment_intent_data[application_fee_amount]':commission.fee_cents,'metadata[commission_claim_id]':commission.id}:{}),'allowed_payment_method_types[0]':'card',client_reference_id:actualId,customer_email:data.email||undefined,
   'line_items[0][quantity]':'1','line_items[0][price_data][currency]':'usd',
   'line_items[0][price_data][unit_amount]':String(record.amount_cents),
   'line_items[0][price_data][product_data][description]':data.coupon?'Includes coupon '+data.coupon.code+' · discount $'+(data.coupon.discountCents/100).toFixed(2):undefined,
   'line_items[0][price_data][product_data][name]':business.name+' · '+(data.services||['Appointment']).join(' + ').slice(0,150),
   'metadata[booking_id]':actualId,'metadata[selahflow_business_id]':business.id,
   'payment_intent_data[metadata][booking_id]':actualId,
   success_url:origin+'/payment/'+slug+'?session_id={CHECKOUT_SESSION_ID}',
   cancel_url:origin+'/payment/'+slug+'?booking_id='+encodeURIComponent(bookingId)+'&cancelled=1'
  }});
  assertTestPayment(session);const url=checkoutUrl(session);
  await attachCommissionSession(db,commission,session);
  await db.query("UPDATE booking_payments SET stripe_checkout_session_id=$1,status='pending',updated_at=now() WHERE booking_id=$2 AND business_id=$3",[session.id,actualId,business.id]);
  await db.query('COMMIT');return {checkoutUrl:url};
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}

// Caller owns a transaction. The receipt and financial writes commit together.
export async function applyBookingPayment(db,businessId,account,session,api=stripeApi){
 assertTestPayment(session);
 if(session.mode!=='payment'||session.payment_status!=='paid'||session.currency!=='usd'||typeof session.payment_intent!=='string')return false;
 const row=(await db.query('SELECT * FROM booking_payments WHERE business_id=$1 AND stripe_account_id=$2 AND stripe_checkout_session_id=$3 FOR UPDATE',[businessId,account,session.id])).rows[0];
 if(!row||session.client_reference_id!==row.booking_id||session.metadata?.booking_id!==row.booking_id||session.metadata?.selahflow_business_id!==businessId||session.amount_total!==row.amount_cents)return false;
 if(row.status==='paid')return true;
 await settleCommission(db,{businessId,account,session},api);
 const receipt=await db.query('INSERT INTO stripe_payment_receipts(stripe_account_id,provider_reference,business_id,booking_id,amount_cents) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING provider_reference',[account,session.payment_intent,businessId,row.booking_id,row.amount_cents]);
 if(!receipt.rowCount)return true;
 await db.query("UPDATE booking_payments SET status='paid',stripe_payment_intent_id=$1,paid_at=now(),updated_at=now() WHERE booking_id=$2 AND business_id=$3",[session.payment_intent,row.booking_id,businessId]);
 const payment={bookingId:row.booking_id,lines:row.lines,total:row.amount_cents/100,tax:0,payment:isStaging()?'Stripe sandbox':'Stripe',providerReference:session.payment_intent};
 await db.query("INSERT INTO events(id,owner,created,kind,data) SELECT $1,owner_id,$2,'cash_sale',$3 FROM businesses WHERE id=$4",['stripe-booking-'+account+'-'+session.payment_intent,new Date().toISOString(),JSON.stringify(payment),businessId]);
 await db.query("UPDATE appointments SET data=(data::jsonb||$1::jsonb)::text WHERE id=$2 AND owner=(SELECT owner_id FROM businesses WHERE id=$3)",[JSON.stringify({paymentStatus:'paid',paymentProvider:'stripe',paymentReference:session.payment_intent}),row.booking_id,businessId]);
 await queueBookingPaid(db,businessId,row.booking_id);
 return true;
}

export async function applyMembershipInvoice(db,businessId,account,invoice,subscription){
 assertTestPayment(invoice);assertTestPayment(subscription);
 if(!shouldActivateInvoice(invoice,true)||invoice.paid_out_of_band===true||Number(invoice.amount_paid_off_stripe||0)>0||invoice.currency!=='usd'||!['subscription_create','subscription_cycle'].includes(invoice.billing_reason))return false;
 const subscriptionId=invoiceSubscriptionId(invoice),paidThrough=invoicePaidThrough(invoice),memberId=subscription.metadata?.membership_id;
 if(!subscriptionId||subscription.id!==subscriptionId||!paidThrough||subscription.metadata?.selahflow_business_id!==businessId)return false;
 const member=(await db.query('SELECT * FROM customer_memberships WHERE id=$1 AND business_id=$2 AND stripe_account_id=$3 FOR UPDATE',[memberId,businessId,account])).rows[0];
 if(!member||Number(invoice.billing_reason==='subscription_create'?(member.first_invoice_cents??member.price_cents):(member.renewal_invoice_cents??member.price_cents))>invoice.amount_paid||(member.stripe_subscription_id&&member.stripe_subscription_id!==subscriptionId))return false;
 const starts=(invoice.lines?.data||[]).map(l=>l.period?.start).filter(Number.isSafeInteger);
 const paidAt=invoice.billing_reason==='subscription_create'&&invoice.status_transitions?.paid_at?new Date(invoice.status_transitions.paid_at*1000):starts.length?new Date(Math.min(...starts)*1000):new Date();
 return recordMembershipPaidPeriod(db,{businessId,account,member,reference:invoice.id,amountCents:invoice.amount_paid,paidAt,paidThrough,subscription,customerId:typeof invoice.customer==='string'?invoice.customer:null,renewal:invoice.billing_reason==='subscription_cycle'});
}
export async function recordMembershipPaidPeriod(db,{businessId,account,member,reference,amountCents,paidAt,paidThrough,subscription,customerId,renewal=false}){
 let credits=Number(member.stripe_sessions_per_period);
 const weekly=(await db.query('SELECT weekly_sessions FROM membership_plans WHERE id=$1 AND business_id=$2',[member.plan_id,businessId])).rows[0]?.weekly_sessions;
 if(weekly)credits=weeklyMonthCredits({...member,initial_paid_at:member.initial_paid_at||paidAt},weekly,paidAt);
 if(!Number.isSafeInteger(credits)||credits<0)return false;
 const receipt=await db.query('INSERT INTO stripe_payment_receipts(stripe_account_id,provider_reference,business_id,membership_id,amount_cents) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING provider_reference',[account,reference,businessId,member.id,amountCents]);
 if(!receipt.rowCount)return true;
 const paymentId=randomUUID();
 const initial=member.initial_paid_at||paidAt;const anchor=membershipAnchor({...member,initial_paid_at:initial});const period=monthlyPeriod(anchor,paidAt);
 const effectivePaidThrough=!renewal&&member.stripe_interval_unit==='month'?nextBillingAnchor(anchor,paidAt,Number(member.stripe_interval_count)||1).toISOString():paidThrough;
 const reset=!member.initial_paid_at||!member.credit_period_end||new Date(member.credit_period_end)<=paidAt;
 if(reset&&member.credit_period_start&&member.credit_period_end)await db.query('INSERT INTO membership_credit_periods(business_id,membership_id,period_start,period_end,sessions_included,sessions_used) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING',[businessId,member.id,member.credit_period_start,member.credit_period_end,member.sessions_included,member.sessions_used]);
 await db.query("INSERT INTO membership_session_ledger(id,business_id,membership_id,appointment_id,event_type,session_delta,amount_cents) VALUES($1,$2,$3,$4,'payment_confirmed',$5,$6)",[paymentId,businessId,member.id,'stripe:'+reference,reset?credits:0,amountCents]);
 await db.query("UPDATE customer_memberships SET sessions_included=CASE WHEN $8 THEN $1 ELSE sessions_included END,sessions_used=CASE WHEN $8 THEN 0 ELSE sessions_used END,initial_paid_at=COALESCE(initial_paid_at,$9),monthly_sessions=$1,credit_period_start=CASE WHEN $8 THEN $10 ELSE credit_period_start END,credit_period_end=CASE WHEN $8 THEN $11 ELSE credit_period_end END,status=CASE WHEN $7='canceled' THEN 'canceled' WHEN GREATEST(paid_through,$2::timestamptz)>now() THEN 'active' ELSE 'expired' END,paid_through=GREATEST(paid_through,$2::timestamptz),last_paid_at=now(),stripe_subscription_id=$3,stripe_customer_id=$4,updated_at=now() WHERE id=$5 AND business_id=$6",[credits,effectivePaidThrough,subscription.id,customerId,member.id,businessId,subscription.status,reset,new Date(initial).toISOString(),period.start.toISOString(),period.end.toISOString()]);
 // Reports already reconcile the session payment ledger, so no duplicate audit sale.
 await queueMembershipPaymentEmail(db,{businessId,paymentId,paymentMethod:isStaging()?'Stripe sandbox':'Stripe',renewal:renewal});
 return true;
}
