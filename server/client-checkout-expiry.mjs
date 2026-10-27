import {stripeApi} from './membership-payments.mjs';
import {isStaging} from './staging-safety.mjs';

/** Called within the owner's deletion transaction, after resolving the exact
 * business/client and locking its records. Provider expiry is retry-safe even
 * if a subsequent local operation rolls back. Never cancel paid subscriptions. */
export async function expireClientCheckouts(db,{businessId,bookingKeys=[],members=[],bookingPayments=[]},api=stripeApi){
 for(const member of members)if(member.stripe_subscription_id){
  const subscription=await api('subscriptions/'+member.stripe_subscription_id,{method:'GET',account:member.stripe_account_id});
  if(isStaging()&&subscription?.livemode!==false)throw Error('Staging accepts only Stripe sandbox payments.');
  if(subscription.id!==member.stripe_subscription_id||subscription.metadata?.selahflow_business_id!==businessId||subscription.metadata?.membership_id!==member.id)throw Error('Stripe subscription identity does not match this membership.');
  if(!['canceled','incomplete_expired'].includes(subscription.status))throw Error('Cancel the active Stripe subscription before deleting this membership.');
 }
 const memberIds=members.map(m=>m.id);
 const claims=(await db.query("SELECT * FROM first_customer_commissions WHERE business_id=$1 AND status='reserved' AND ((kind='booking' AND source_id=ANY($2::text[])) OR (kind='membership' AND source_id=ANY($3::text[]))) FOR UPDATE",[businessId,bookingKeys,memberIds])).rows;
 const refs=new Map();
 const add=(session,account,kind,source)=>{
  if(!session)return;
  if(!/^cs_[A-Za-z0-9_]+$/.test(session)||!/^acct_[A-Za-z0-9]+$/.test(account||'')||!source)throw Error('The saved Stripe checkout needs review before deletion.');
  const key=account+'|'+session,previous=refs.get(key);
  if(previous&&(previous.kind!==kind||previous.source!==source))throw Error('Stripe checkout references do not match this registration.');
  refs.set(key,{session,account,kind,source});
 };
 for(const p of bookingPayments)if(p.status==='pending')add(p.stripe_checkout_session_id,p.stripe_account_id,'booking',p.booking_id);
 for(const m of members)if(m.status==='pending_payment'||!m.initial_paid_at&&!m.last_paid_at&&Number(m.sessions_included)===0)add(m.stripe_checkout_session_id,m.stripe_account_id,'membership',m.id);
 for(const c of claims)add(c.stripe_checkout_session_id,c.stripe_account_id,c.kind,c.source_id);
 for(const r of refs.values()){
  const path='checkout/sessions/'+r.session;
  const verify=session=>{
   if(isStaging()&&session?.livemode!==false)throw Error('Staging accepts only Stripe sandbox payments.');
   if(session?.id!==r.session||session.metadata?.selahflow_business_id!==businessId||session.metadata?.[r.kind==='booking'?'booking_id':'membership_id']!==r.source||session.client_reference_id!==r.source)throw Error('Stripe checkout identity does not match this registration. Deletion stopped.');
   if(session.payment_status==='paid'||!['open','expired'].includes(session.status))throw Error('Stripe reports a completed or processing payment. Verify its payment status before deleting this registration.');
  };
  let session=await api(path,{method:'GET',account:r.account});verify(session);
  if(session.status==='open'){
   session=await api(path+'/expire',{account:r.account,idempotencyKey:'client-delete-expire-'+r.account+'-'+r.session});verify(session);
   if(session.status!=='expired')throw Error('Stripe did not confirm checkout expiry. Retry deletion.');
  }
  await db.query("UPDATE booking_payments SET status='expired',updated_at=now() WHERE business_id=$1 AND stripe_account_id=$2 AND stripe_checkout_session_id=$3 AND status='pending'",[businessId,r.account,r.session]);
  await db.query("UPDATE first_customer_commissions SET status='expired',updated_at=now() WHERE business_id=$1 AND stripe_account_id=$2 AND stripe_checkout_session_id=$3 AND status='reserved'",[businessId,r.account,r.session]);
 }
 return refs.size;
}
