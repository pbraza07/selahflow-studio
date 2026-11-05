import {stripeApi} from './membership-payments.mjs';
import {assertTestPayment} from './stripe-checkout.mjs';

/** Only called after the owner explicitly confirms cancellation and deletion.
 * Verify all provider identities before cancellation. Retry after a local rollback
 * observes the already-canceled subscription and can finish the local deletion. */
export async function prepareOwnerMembershipDeletion(member,businessId,api=stripeApi){
 const prepared={...member},completedFreeCheckouts=new Set();
 const account=member.stripe_account_id;
 let subscriptionId=member.stripe_subscription_id,customer=member.stripe_customer_id;
 if(!subscriptionId&&!member.stripe_checkout_session_id)return {member:prepared,completedFreeCheckouts};
 if(!/^acct_[A-Za-z0-9]+$/.test(account||''))throw Error('The saved Stripe account needs review before deletion.');
 if(member.stripe_checkout_session_id){
  if(!/^cs_[A-Za-z0-9_]+$/.test(member.stripe_checkout_session_id))throw Error('The saved Stripe checkout needs review before deletion.');
  const session=await api('checkout/sessions/'+member.stripe_checkout_session_id,{method:'GET',account});assertTestPayment(session);
  if(session.id!==member.stripe_checkout_session_id||session.client_reference_id!==member.id||session.metadata?.membership_id!==member.id||session.metadata?.selahflow_business_id!==businessId||customer&&session.customer!==customer)throw Error('Stripe checkout identity does not match this membership.');
  const pending=member.status==='pending_payment'||!member.initial_paid_at&&!member.last_paid_at&&Number(member.sessions_included)===0;
  const free=session.status==='complete'&&session.payment_status==='no_payment_required'&&session.amount_total===0;
  if(pending&&!free&&(session.payment_status==='paid'||!['open','expired'].includes(session.status)))throw Error('Stripe reports a completed or processing payment. Use Check payment / activation before deleting this membership.');
  if(free){
   if(!['payment','subscription'].includes(session.mode))throw Error('Stripe checkout mode does not match this membership.');
   completedFreeCheckouts.add(account+'|'+session.id);
  }
  if(session.mode==='subscription'&&session.status==='complete'){
   if(typeof session.subscription!=='string'||!session.subscription||subscriptionId&&subscriptionId!==session.subscription)throw Error('Stripe subscription identity does not match this membership.');
   subscriptionId=session.subscription;
  }
  customer=customer||session.customer;
 }
 if(subscriptionId){
  if(!/^sub_[A-Za-z0-9]+$/.test(subscriptionId))throw Error('The saved Stripe subscription needs review before deletion.');
  const path='subscriptions/'+subscriptionId;
  const verify=sub=>{
   assertTestPayment(sub);
   if(sub.id!==subscriptionId||sub.metadata?.membership_id!==member.id||sub.metadata?.selahflow_business_id!==businessId||customer&&sub.customer!==customer)throw Error('Stripe subscription identity does not match this membership.');
  };
  let sub=await api(path,{method:'GET',account});verify(sub);
  if(!['canceled','incomplete_expired'].includes(sub.status)){
   sub=await api(path,{method:'DELETE',account,params:{invoice_now:false,prorate:false}});verify(sub);
   if(sub.status!=='canceled')throw Error('Stripe did not confirm cancellation. Retry deleting this membership.');
  }
  prepared.stripe_subscription_id=subscriptionId;
 }
 return {member:prepared,completedFreeCheckouts};
}
