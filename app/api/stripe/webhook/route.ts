import {completeInitialMembershipCheckout} from '../../../../server/membership-initial-payment.mjs';
import {refundCommission} from '../../../../server/first-customer-commissions.mjs';
import {monthlyPeriod,membershipAnchor,nextBillingAnchor} from '../../../../server/membership-periods.mjs';
import {getPool} from '../../../../server/database.mjs';
import {verifyStripeWebhook,stripeApi,invoiceSubscriptionId,shouldActivateInvoice} from '../../../../server/membership-payments.mjs';
import {applyBookingPayment,applyMembershipInvoice} from '../../../../server/stripe-checkout.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
export async function POST(req:Request){
 const raw=await req.text();
 if(raw.length>250000)return Response.json({error:'Payload too large.'},{status:413,headers});
 let event;
 try{event=verifyStripeWebhook(raw,req.headers.get('stripe-signature'),process.env.STRIPE_CONNECT_WEBHOOK_SECRET);}
 catch{return Response.json({error:'Invalid Stripe signature.'},{status:400,headers});}
 const account=event.account;
 if(!/^acct_[A-Za-z0-9]+$/.test(account))return Response.json({error:'Invalid connected account.'},{status:400,headers});
 const pool=getPool();
 try{
  const merchant=(await pool.query('SELECT business_id FROM merchant_accounts WHERE external_account_id=$1 AND provider=$2',[account,'stripe'])).rows[0];
  // Unknown Connect account: acknowledge but do not write local membership data.
  if(!merchant)return Response.json({received:true},{headers});
  let object=event.data.object||{};
  let subscriptionId=null,subscription:any=null;
  if(event.type==='invoice.paid'){
   // Retrieve the provider invoice with its current off-Stripe payment amount.
   // A dashboard manual mark-as-paid must never issue online membership credits.
   if(!/^in_[A-Za-z0-9]+$/.test(object.id||''))return Response.json({received:true},{headers});
   object=await stripeApi('invoices/'+object.id+'?expand[]=amount_paid_off_stripe',{method:'GET',account});
   if(!shouldActivateInvoice(object,true)||object.paid_out_of_band===true||object.currency!=='usd')
    return Response.json({received:true},{headers});
   subscriptionId=invoiceSubscriptionId(object);
   if(!subscriptionId)return Response.json({received:true},{headers});
   subscription=await stripeApi('subscriptions/'+subscriptionId,{method:'GET',account});
   if(object.billing_reason==='subscription_create'&&subscription.metadata?.selahflow_business_id===merchant.business_id){
    const m=(await pool.query('SELECT * FROM customer_memberships WHERE id=$1 AND business_id=$2 AND stripe_account_id=$3 AND (stripe_subscription_id IS NULL OR stripe_subscription_id=$4)',[subscription.metadata?.membership_id,merchant.business_id,account,subscriptionId])).rows[0];
    if(m&&!m.initial_paid_at&&m.stripe_interval_unit==='month'&&Number(object.amount_paid)>=Number(m.first_invoice_cents??m.price_cents)){const paidAt=object.status_transitions?.paid_at?new Date(object.status_transitions.paid_at*1000):new Date();const next=nextBillingAnchor(membershipAnchor({...m,initial_paid_at:paidAt}),paidAt,Number(m.stripe_interval_count)||1);await stripeApi('subscriptions/'+subscriptionId,{account,idempotencyKey:'member-anchor-'+event.id,params:{trial_end:Math.floor(next.getTime()/1000),proration_behavior:'none'}});}
   }
  }
  const db=await pool.connect();
  try{
   await db.query('BEGIN');
   const recorded=await db.query(
    'INSERT INTO membership_webhook_events(event_id,stripe_account_id,event_type) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING event_id',
    [event.id,account,event.type]);
   if(!recorded.rowCount){await db.query('COMMIT');return Response.json({received:true},{headers});}
   if(event.type==='account.updated'&&object.id===account){
    await db.query('UPDATE merchant_accounts SET charges_enabled=$1,onboarding_complete=$2,updated_at=now() WHERE business_id=$3 AND external_account_id=$4',
     [object.charges_enabled===true,object.details_submitted===true,merchant.business_id,account]);
   }else if(event.type==='checkout.session.completed'&&object.mode==='payment'){
    if(object.metadata?.membership_initial==='true'&&object.metadata?.selahflow_business_id===merchant.business_id){if(!await completeInitialMembershipCheckout(db,{businessId:merchant.business_id,account,session:object}))throw Error('Initial membership payment is awaiting local checkout reconciliation.');}
    else await applyBookingPayment(db,merchant.business_id,account,object);
   }else if(event.type==='checkout.session.completed'&&object.mode==='subscription'&&object.client_reference_id&&object.subscription){
    const id=object.client_reference_id;
    await db.query("UPDATE customer_memberships SET stripe_checkout_session_id=$1,stripe_customer_id=$2,stripe_subscription_id=$3,updated_at=now() WHERE id=$4 AND business_id=$5 AND stripe_account_id=$6 AND stripe_checkout_session_id=$1 AND (stripe_subscription_id IS NULL OR stripe_subscription_id=$3)",
     [object.id,typeof object.customer==='string'?object.customer:null,typeof object.subscription==='string'?object.subscription:null,id,merchant.business_id,account]);
    // Do NOT activate here: a completed Checkout Session by itself is not
    // proof that a recurring subscription's first invoice was paid.
   }else if(event.type==='invoice.paid'&&subscription){
    await applyMembershipInvoice(db,merchant.business_id,account,object,subscription);
   }else if(event.type==='checkout.session.expired'&&object.status==='expired'){
    await db.query("UPDATE first_customer_commissions SET status='expired',updated_at=now() WHERE business_id=$1 AND stripe_account_id=$2 AND stripe_checkout_session_id=$3 AND status='reserved'",[merchant.business_id,account,object.id]);
    await db.query("UPDATE booking_payments SET status='expired',updated_at=now() WHERE business_id=$1 AND stripe_account_id=$2 AND stripe_checkout_session_id=$3 AND status='pending'",[merchant.business_id,account,object.id]);
   }else if(event.type==='charge.refunded'){
    await refundCommission(db,{businessId:merchant.business_id,account,charge:object});
   }else if(event.type==='invoice.payment_failed'){
    const sub=invoiceSubscriptionId(object);
    if(sub)await db.query(
     "UPDATE customer_memberships SET status='past_due',updated_at=now() WHERE stripe_subscription_id=$1 AND stripe_account_id=$2 AND business_id=$3 AND (paid_through IS NULL OR paid_through<=now())",
     [sub,account,merchant.business_id]);
   }else if(event.type==='customer.subscription.updated'){
    await db.query("UPDATE customer_memberships SET status=CASE WHEN $1 IN ('past_due','unpaid') THEN 'past_due' WHEN $1='canceled' THEN 'canceled' ELSE status END,updated_at=now() WHERE stripe_subscription_id=$2 AND stripe_account_id=$3 AND business_id=$4",[object.status,object.id,account,merchant.business_id]);
   }else if(event.type==='customer.subscription.deleted'){
    await db.query("UPDATE customer_memberships SET status='canceled',updated_at=now() WHERE stripe_subscription_id=$1 AND stripe_account_id=$2 AND business_id=$3",
     [object.id,account,merchant.business_id]);
   }
   await db.query('COMMIT');
   return Response.json({received:true},{headers});
  }catch(err){await db.query('ROLLBACK');throw err;}finally{db.release();}
 }catch(err){
  console.error('Membership webhook processing failed', (err as Error)?.message);
  return Response.json({error:'Webhook temporarily unavailable.'},{status:503,headers});
 }
}
