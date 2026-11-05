import {stripeApi} from './membership-payments.mjs';
import {assertTestPayment,applyMembershipInvoice} from './stripe-checkout.mjs';
import {completeInitialMembershipCheckout} from './membership-initial-payment.mjs';

/** Verify an existing enrollment; never create a charge or substitute a manual receipt. */
export async function reconcileMembershipPayment(pool,{businessId,membershipId},api=stripeApi){
 const db=await pool.connect();
 try{
  await db.query('BEGIN');
  const member=(await db.query('SELECT * FROM customer_memberships WHERE business_id=$1 AND id=$2 FOR UPDATE',[businessId,membershipId])).rows[0];
  if(!member)throw Error('Member not found.');
  if(!member.stripe_account_id?.startsWith('acct_')||!member.stripe_checkout_session_id)throw Error('This membership has no Stripe checkout to verify.');
  const account=member.stripe_account_id;
  const checkout=await api('checkout/sessions/'+encodeURIComponent(member.stripe_checkout_session_id),{method:'GET',account});assertTestPayment(checkout);
  if(checkout.id!==member.stripe_checkout_session_id||checkout.client_reference_id!==member.id||checkout.metadata?.membership_id!==member.id||checkout.metadata?.selahflow_business_id!==businessId)throw Error('Stripe checkout does not match this membership.');
  if(checkout.status!=='complete')throw Error('Checkout is not complete. Ask the client to finish their existing checkout, then check again.');
  let confirmed=false;
  if(checkout.mode==='payment')confirmed=await completeInitialMembershipCheckout(db,{businessId,account,session:checkout},api);
  else if(checkout.mode==='subscription'&&typeof checkout.subscription==='string'){
   if(member.stripe_subscription_id&&member.stripe_subscription_id!==checkout.subscription)throw Error('Stripe subscription does not match this membership.');
   const sub=await api('subscriptions/'+encodeURIComponent(checkout.subscription),{method:'GET',account});assertTestPayment(sub);
   if(sub.id!==checkout.subscription||sub.customer!==checkout.customer||sub.metadata?.membership_id!==member.id||sub.metadata?.selahflow_business_id!==businessId)throw Error('Stripe subscription does not match this membership.');
   if(typeof sub.latest_invoice==='string'){
    const invoice=await api('invoices/'+encodeURIComponent(sub.latest_invoice)+'?expand[]=amount_paid_off_stripe',{method:'GET',account});assertTestPayment(invoice);
    if(invoice.id!==sub.latest_invoice||invoice.customer!==sub.customer)throw Error('Stripe invoice does not match this membership.');
    confirmed=await applyMembershipInvoice(db,businessId,account,invoice,sub);
   }
  }
  if(!confirmed)throw Error('Stripe has not confirmed an eligible payment or free activation. No payment was recorded.');
  const current=(await db.query('SELECT status,sessions_included,sessions_used FROM customer_memberships WHERE business_id=$1 AND id=$2',[businessId,membershipId])).rows[0];
  await db.query('COMMIT');
  return {ok:true,verified:true,status:current.status,credited:Math.max(0,current.sessions_included-member.sessions_included),sessionsLeft:Math.max(0,current.sessions_included-current.sessions_used)};
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
