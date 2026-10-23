import {stripeApi} from './membership-payments.mjs';
import {assertTestPayment,recordMembershipPaidPeriod} from './stripe-checkout.mjs';
import {settleCommission} from './first-customer-commissions.mjs';
import {anniversary,membershipAnchor,nextBillingAnchor} from './membership-periods.mjs';
/** A paid initial period uses a one-off Connect fee. The subsequent subscription has a permanent 0% application fee. */
export async function completeInitialMembershipCheckout(db,{businessId,account,session},api=stripeApi){
 assertTestPayment(session);
 if(session.mode!=='payment'||session.payment_status!=='paid'||session.currency!=='usd'||session.metadata?.membership_initial!=='true'||session.metadata?.selahflow_business_id!==businessId||typeof session.payment_intent!=='string'||typeof session.customer!=='string')return false;
 const member=(await db.query('SELECT * FROM customer_memberships WHERE business_id=$1 AND stripe_account_id=$2 AND stripe_checkout_session_id=$3 FOR UPDATE',[businessId,account,session.id])).rows[0];
 if(!member||member.stripe_initial_checkout_mode!=='payment'||!member.stripe_recurring_authorized_at||session.client_reference_id!==member.id||session.metadata?.membership_id!==member.id||session.amount_total!==Number(member.first_invoice_cents)||!member.stripe_renewal_product_id)return false;
 if((await db.query('SELECT 1 FROM stripe_payment_receipts WHERE stripe_account_id=$1 AND provider_reference=$2 AND business_id=$3 AND membership_id=$4',[account,session.payment_intent,businessId,member.id])).rows.length)return true;
 const pi=await api('payment_intents/'+session.payment_intent+'?expand[]=latest_charge',{method:'GET',account});assertTestPayment(pi);
 if(pi.status!=='succeeded'||pi.amount_received!==session.amount_total||pi.currency!=='usd'||pi.customer!==session.customer||typeof pi.payment_method!=='string'||pi.metadata?.membership_id!==member.id||pi.metadata?.selahflow_business_id!==businessId||!Number.isSafeInteger(pi.latest_charge?.created))throw Error('Initial membership payment needs provider reconciliation.');
 const paidAt=new Date(pi.latest_charge.created*1000),count=Number(member.stripe_interval_count)||1,unit=member.stripe_interval_unit;
 const boundary=unit==='month'?nextBillingAnchor(membershipAnchor({...member,initial_paid_at:paidAt}),paidAt,count):unit==='year'?anniversary(paidAt,12*count):new Date(paidAt.getTime()+7*86400000*count);
 // Search this Checkout-created customer before provisioning, including retries beyond Stripe's idempotency window.
 const existing=await api('subscriptions?customer='+encodeURIComponent(session.customer)+'&status=all&limit=100',{method:'GET',account});
 let subscription=(existing.data||[]).find(s=>s.metadata?.membership_id===member.id&&s.metadata?.selahflow_initial_checkout===session.id);
 if(!subscription){
  if(existing.has_more||existing.data?.length)throw Error('Existing Stripe subscriptions need review before enrollment can continue.');
  if(boundary<=new Date())throw Error('Initial payment was received, but recurring setup was delayed beyond its paid period. Contact the business to reconcile the billing date.');
  subscription=await api('subscriptions',{account,idempotencyKey:'membership-renewals-'+session.id,params:{
   customer:session.customer,default_payment_method:pi.payment_method,
   application_fee_percent:0,billing_cycle_anchor:Math.floor(boundary.getTime()/1000),proration_behavior:'none',
   'items[0][price_data][currency]':'usd','items[0][price_data][product]':member.stripe_renewal_product_id,
   'items[0][price_data][unit_amount]':String(member.price_cents),'items[0][price_data][recurring][interval]':unit,'items[0][price_data][recurring][interval_count]':count,
   ...(member.stripe_renewal_coupon_id?{'discounts[0][coupon]':member.stripe_renewal_coupon_id}:{}),
   'metadata[membership_id]':member.id,'metadata[selahflow_business_id]':businessId,'metadata[selahflow_initial_checkout]':session.id
  }});
 }
 assertTestPayment(subscription);
 if(!/^sub_[A-Za-z0-9]+$/.test(subscription.id||'')||subscription.customer!==session.customer||Number(subscription.application_fee_percent||0)!==0||subscription.metadata?.membership_id!==member.id||subscription.metadata?.selahflow_business_id!==businessId||subscription.metadata?.selahflow_initial_checkout!==session.id)throw Error('Recurring membership setup needs review.');
 await settleCommission(db,{businessId,account,session},api);
 await db.query('UPDATE customer_memberships SET stripe_initial_paid_at=$1 WHERE id=$2 AND business_id=$3',[paidAt.toISOString(),member.id,businessId]);
 return recordMembershipPaidPeriod(db,{businessId,account,member,reference:pi.id,amountCents:session.amount_total,paidAt,paidThrough:boundary.toISOString(),subscription,customerId:session.customer});
}
