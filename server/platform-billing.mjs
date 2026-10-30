import {createHash} from 'node:crypto';
import {stripeApi,createStripeMerchantAccount,invoiceSubscriptionId,invoicePaidThrough} from './membership-payments.mjs';
import {PLAN_CATALOG} from './plan-entitlements.mjs';
import {recordServiceAcceptance} from './business-service-agreement.mjs';
import {SERVICE_AGREEMENT_VERSION} from './business-service-terms.mjs';
import {assertTestPayment,checkoutUrl} from './stripe-checkout.mjs';
export const platformPriceId=code=>process.env['STRIPE_PLATFORM_PRICE_'+code.toUpperCase()]||'';
export const platformBillingReady=()=>!!process.env.STRIPE_SECRET_KEY&&!!process.env.STRIPE_PLATFORM_WEBHOOK_SECRET&&['professional','business'].every(p=>/^price_[A-Za-z0-9]+$/.test(platformPriceId(p)));
export const platformApi=(path,options={})=>stripeApi(path,{...options,apiVersion:'2026-09-30.endive'});
const reference=x=>typeof x==='string'?x:x?.id;
async function ownerBusiness(db,owner){const b=(await db.query('SELECT b.*,u.email FROM businesses b JOIN users u ON u.id=b.owner_id WHERE b.owner_id=$1',[owner])).rows[0];if(!b)throw Error('Business unavailable.');return b;}
export async function platformBillingInfo(db,owner){
 const b=await ownerBusiness(db,owner),s=(await db.query('SELECT * FROM business_subscriptions WHERE business_id=$1',[b.id])).rows[0];
 const agreement=(await db.query('SELECT plan_code FROM business_service_agreements WHERE business_id=$1 AND owner_id=$2 AND version=$3 ORDER BY accepted_at DESC LIMIT 1',[b.id,owner,SERVICE_AGREEMENT_VERSION])).rows[0];
 return {business:b.name,slug:b.slug,businessStatus:b.status,planCode:s?.plan_code||'free',requestedPlan:s?.requested_plan_code||'free',billingStatus:s?.billing_status||'none',periodEnd:s?.billing_period_end,riskHold:s?.billing_risk_hold===true,hasSubscription:!!s?.stripe_subscription_id,agreementPlan:agreement?.plan_code||null,configured:platformBillingReady()};
}
async function billingCustomer(db,b,api){
 let id=(await db.query("SELECT external_account_id FROM merchant_accounts WHERE business_id=$1 AND provider='stripe'",[b.id])).rows[0]?.external_account_id;
 if(!id){const a=await createStripeMerchantAccount(b,b.email,api);id=a.id;await db.query("INSERT INTO merchant_accounts(business_id,provider,external_account_id) VALUES($1,'stripe',$2) ON CONFLICT DO NOTHING",[b.id,id]);id=(await db.query('SELECT external_account_id FROM merchant_accounts WHERE business_id=$1',[b.id])).rows[0].external_account_id;}
 const a=await api('core/accounts/'+id,{namespace:'v2',params:{configuration:{customer:{}},include:['configuration.customer']},idempotencyKey:'platform-customer-config-'+b.id});
 if(a.id!==id||!a.configuration?.customer)throw Error('Stripe customer configuration is unavailable.');return id;
}
export async function startPlatformSubscription(pool,{owner,planCode,agreement,origin,ipHash=''},api=platformApi){
 if(!['professional','business'].includes(planCode))throw Error('Choose a paid SelahFlow package.');
 if(!platformBillingReady())throw Error('SelahFlow package billing is not configured yet.');
 const db=await pool.connect();try{
  await db.query('BEGIN');const b=await ownerBusiness(db,owner);if(!['pending','active'].includes(b.status))throw Error('This business cannot start package payment.');
  await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[b.id+':platform-billing']);
  const row=(await db.query('SELECT * FROM business_subscriptions WHERE business_id=$1 FOR UPDATE',[b.id])).rows[0];if(!row)throw Error('Business package record unavailable.');
  if(row.billing_risk_hold)throw Error('Contact SelahFlow support about the billing review. You can still manage or cancel the subscription.');
  if(agreement)await recordServiceAcceptance(db,{businessId:b.id,owner,input:agreement,planCode,ipHash});
  else if(!(await db.query('SELECT 1 FROM business_service_agreements WHERE business_id=$1 AND owner_id=$2 AND version=$3 AND plan_code=$4 LIMIT 1',[b.id,owner,SERVICE_AGREEMENT_VERSION,planCode])).rows.length)
   throw Error('Read and sign the current SelahFlow services agreement before payment.');
  let previousEnded=false;if(row.stripe_subscription_id){const sub=await api('subscriptions/'+row.stripe_subscription_id,{method:'GET'});assertTestPayment(sub);if(!['canceled','incomplete_expired'].includes(sub.status))throw Error('Manage or cancel the existing subscription before starting another.');previousEnded=true;}
  if(row.billing_checkout_session_id){const path='checkout/sessions/'+row.billing_checkout_session_id,s=await api(path,{method:'GET'});assertTestPayment(s);if(s.status==='open'&&row.billing_checkout_plan===planCode){await db.query('COMMIT');return {checkoutUrl:checkoutUrl(s)};}if(!['open','expired'].includes(s.status)&&!previousEnded)throw Error('Previous payment is processing. Check billing status before paying again.');if(s.status==='open'){const expired=await api(path+'/expire',{idempotencyKey:'platform-expire-'+s.id});assertTestPayment(expired);if(expired.status!=='expired')throw Error('The previous checkout could not be closed.');}}
  const priceId=platformPriceId(planCode),price=await api('prices/'+priceId,{method:'GET'});assertTestPayment(price);
  if(!price.active||price.currency!=='usd'||price.unit_amount!==PLAN_CATALOG[planCode].monthlyCents||price.recurring?.interval!=='month'||price.recurring?.interval_count!==1)throw Error('Configured Stripe package price does not match the published monthly price.');
  await portalConfiguration(origin,api);
  const customer=await billingCustomer(db,b,api),suffix=Array.from(createHash('sha256').update(b.id+'|'+planCode+'|'+(row.billing_checkout_session_id||'initial')).digest().subarray(0,8),v=>String.fromCharCode(97+v%26)).join('');
  const session=await api('checkout/sessions',{idempotencyKey:'platform-'+b.id+'-'+planCode+'-'+(row.billing_checkout_session_id||'initial'),params:{mode:'subscription',customer_account:customer,integration_identifier:'selahflow_packages_'+suffix,'line_items[0][price]':priceId,'line_items[0][quantity]':1,client_reference_id:b.id,'metadata[selahflow_platform_business]':b.id,'subscription_data[metadata][selahflow_platform_business]':b.id,success_url:origin+'/settings/package?session_id={CHECKOUT_SESSION_ID}',cancel_url:origin+'/settings/package?cancelled=1'}});
  assertTestPayment(session);const url=checkoutUrl(session);
  await db.query("UPDATE business_subscriptions SET requested_plan_code=$1,billing_checkout_plan=$1,billing_price_id=$2,stripe_customer_id=$3,billing_checkout_session_id=$4,stripe_subscription_id=NULL,billing_status='checkout_pending',updated_at=now() WHERE business_id=$5",[planCode,priceId,customer,session.id,b.id]);
  await db.query('COMMIT');return {checkoutUrl:url};
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
async function portalConfiguration(origin,api){
 const configurations=await api('billing_portal/configurations?active=true&limit=100',{method:'GET'});
 const saved=configurations.data?.find(c=>c.metadata?.selahflow_packages==='v1');if(saved)return saved.id;
 const c=await api('billing_portal/configurations',{idempotencyKey:'selahflow-package-portal-v1',params:{'features[subscription_cancel][enabled]':true,'features[subscription_cancel][mode]':'at_period_end','features[payment_method_update][enabled]':true,'features[invoice_history][enabled]':true,'business_profile[privacy_policy_url]':origin+'/privacy','business_profile[terms_of_service_url]':origin+'/terms/business-services','metadata[selahflow_packages]':'v1'}});
 if(!/^bpc_[A-Za-z0-9]+$/.test(c.id||''))throw Error('Stripe cancellation portal configuration unavailable.');return c.id;
}
export async function platformBillingPortal(db,{owner,origin},api=platformApi){
 const b=await ownerBusiness(db,owner),row=(await db.query('SELECT stripe_customer_id FROM business_subscriptions WHERE business_id=$1',[b.id])).rows[0];
 if(!row?.stripe_customer_id)throw Error('No Stripe subscription customer exists for this business.');
 const session=await api('billing_portal/sessions',{params:{customer_account:row.stripe_customer_id,configuration:await portalConfiguration(origin,api),return_url:origin+'/settings/package'}});const url=new URL(session.url);
 if(url.protocol!=='https:'||url.hostname!=='billing.stripe.com')throw Error('Stripe did not return a safe billing portal.');return {url:url.href};
}
async function bindCheckout(db,session,api){
 const row=(await db.query('SELECT * FROM business_subscriptions WHERE billing_checkout_session_id=$1 FOR UPDATE',[session.id])).rows[0];if(!row)return;
 const actual=await api('checkout/sessions/'+session.id,{method:'GET'});assertTestPayment(actual);
 if(actual.mode!=='subscription'||actual.client_reference_id!==row.business_id||actual.customer_account!==row.stripe_customer_id||!reference(actual.subscription))throw Error('Package checkout ownership needs reconciliation.');
 const sub=await api('subscriptions/'+reference(actual.subscription),{method:'GET'});assertTestPayment(sub);
 if(sub.customer_account!==row.stripe_customer_id||!sub.items?.data?.some(i=>reference(i.price)===row.billing_price_id))throw Error('Package subscription does not match checkout.');
 await db.query('UPDATE business_subscriptions SET stripe_subscription_id=$1,billing_status=$2,updated_at=now() WHERE business_id=$3',[sub.id,sub.status,row.business_id]);
 if(sub.latest_invoice)await applyPlatformInvoice(db,reference(sub.latest_invoice),api);
}
export async function applyPlatformInvoice(db,invoiceId,api=platformApi){
 const invoice=await api('invoices/'+invoiceId+'?expand[]=payments',{method:'GET'});assertTestPayment(invoice);const sid=invoiceSubscriptionId(invoice);if(!sid)return false;
 let row=(await db.query('SELECT * FROM business_subscriptions WHERE stripe_subscription_id=$1 FOR UPDATE',[sid])).rows[0];
 // invoice.paid can precede checkout.session.completed: resolve through its customer account + saved checkout, then verify provider ownership.
 if(!row&&invoice.customer_account){row=(await db.query('SELECT * FROM business_subscriptions WHERE stripe_customer_id=$1 AND billing_checkout_session_id IS NOT NULL FOR UPDATE',[invoice.customer_account])).rows[0];if(row){const checkout=await api('checkout/sessions/'+row.billing_checkout_session_id,{method:'GET'});assertTestPayment(checkout);if(reference(checkout.subscription)!==sid||checkout.customer_account!==row.stripe_customer_id||checkout.client_reference_id!==row.business_id)return false;await db.query('UPDATE business_subscriptions SET stripe_subscription_id=$1 WHERE business_id=$2',[sid,row.business_id]);row.stripe_subscription_id=sid;}}
 if(!row)return false;
 const sub=await api('subscriptions/'+sid,{method:'GET'});assertTestPayment(sub);const price=sub.items?.data?.[0]?.price,code=row.billing_checkout_plan||row.requested_plan_code;
 if(!PLAN_CATALOG[code]||sub.customer_account!==row.stripe_customer_id||invoice.customer_account!==row.stripe_customer_id||reference(price)!==row.billing_price_id||sub.items?.data?.length!==1||sub.items.data[0].quantity!==1)throw Error('Package invoice ownership or price mismatch.');
 const end=invoicePaidThrough(invoice),amount=PLAN_CATALOG[code].monthlyCents;
 if(invoice.status!=='paid'||invoice.paid_out_of_band===true||Number(invoice.amount_paid_off_stripe||0)>0||!['subscription_create','subscription_cycle'].includes(invoice.billing_reason)||!['active','trialing'].includes(sub.status)||invoice.currency!=='usd'||invoice.amount_paid<amount||invoice.amount_remaining!==0||!end||new Date(end)<=new Date())return false;
 await db.query('INSERT INTO platform_billing_receipts(invoice_id,business_id,subscription_id,amount_cents,currency,period_end) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING',[invoice.id,row.business_id,sid,invoice.amount_paid,'usd',end]);
 const payments=invoice.payments?.data||(await api('invoice_payments?invoice='+encodeURIComponent(invoice.id)+'&limit=100',{method:'GET'})).data||[];
 for(const p of payments){const pi=reference(p.payment?.payment_intent);if(pi)await db.query('INSERT INTO platform_payment_refs(payment_intent_id,invoice_id,business_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[pi,invoice.id,row.business_id]);}
 await db.query("UPDATE business_subscriptions SET plan_code=CASE WHEN billing_risk_hold THEN 'free' ELSE $1 END,status='active',billing_status=CASE WHEN billing_risk_hold THEN 'review' ELSE 'active' END,billing_managed=true,billing_period_end=GREATEST(billing_period_end,$2::timestamptz),updated_at=now() WHERE business_id=$3",[code,end,row.business_id]);return true;
}
async function holdForRisk(db,object,type,api){
 const chargeId=type==='charge.refunded'?object.id:reference(object.charge);if(!chargeId)return;
 const charge=await api('charges/'+chargeId,{method:'GET'});assertTestPayment(charge);const pi=reference(charge.payment_intent);if(!pi)return;
 let row=(await db.query('SELECT business_id FROM platform_payment_refs WHERE payment_intent_id=$1',[pi])).rows[0];
 if(!row){const payments=await api('invoice_payments?payment[type]=payment_intent&payment[payment_intent]='+encodeURIComponent(pi)+'&limit=100',{method:'GET'});for(const p of payments.data||[]){const inv=await api('invoices/'+reference(p.invoice),{method:'GET'}),sid=invoiceSubscriptionId(inv);if(sid){row=(await db.query('SELECT business_id FROM business_subscriptions WHERE stripe_subscription_id=$1',[sid])).rows[0];if(row)break;}}}
 if(row)await db.query("UPDATE business_subscriptions SET billing_risk_hold=true,billing_status='review',plan_code=CASE WHEN billing_managed THEN 'free' ELSE plan_code END,updated_at=now() WHERE business_id=$1",[row.business_id]);
}
export async function processPlatformBillingEvent(pool,event,api=platformApi){
 assertTestPayment(event);if(event.account)throw Error('Connected-account event cannot update platform billing.');
 const db=await pool.connect();try{await db.query('BEGIN');const r=await db.query('INSERT INTO platform_billing_events(event_id,event_type) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING event_id',[event.id,event.type]);if(!r.rows.length){await db.query('COMMIT');return;}
 const o=event.data.object;
 if(['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type))await bindCheckout(db,o,api);
 else if(event.type==='checkout.session.expired'){
  const session=await api('checkout/sessions/'+o.id,{method:'GET'});assertTestPayment(session);
  if(session.mode==='subscription'&&session.status==='expired'&&session.payment_status!=='paid'&&!reference(session.subscription))await db.query("UPDATE business_subscriptions SET billing_status='checkout_expired',updated_at=now() WHERE billing_checkout_session_id=$1 AND stripe_customer_id=$2 AND business_id=$3 AND stripe_subscription_id IS NULL",[session.id,session.customer_account,session.client_reference_id]);
 }else if(event.type==='invoice.paid')await applyPlatformInvoice(db,o.id,api);
 else if(['customer.subscription.updated','customer.subscription.deleted'].includes(event.type)){
  const sub=await api('subscriptions/'+o.id,{method:'GET'});assertTestPayment(sub);const row=(await db.query('SELECT * FROM business_subscriptions WHERE stripe_subscription_id=$1 FOR UPDATE',[sub.id])).rows[0];
  if(row&&sub.customer_account===row.stripe_customer_id){if(['canceled','unpaid','incomplete_expired','paused'].includes(sub.status))await db.query("UPDATE business_subscriptions SET billing_status=$1,plan_code=CASE WHEN billing_managed THEN 'free' ELSE plan_code END,updated_at=now() WHERE business_id=$2",[sub.status,row.business_id]);else if(sub.latest_invoice)await applyPlatformInvoice(db,reference(sub.latest_invoice),api);}
 }else if(event.type==='invoice.payment_failed'){
  const invoice=await api('invoices/'+o.id,{method:'GET'});assertTestPayment(invoice);const sid=invoiceSubscriptionId(invoice),sub=sid?await api('subscriptions/'+sid,{method:'GET'}):null;if(sub)assertTestPayment(sub);if(sid&&invoice.status==='open'&&invoice.amount_remaining>0&&reference(sub?.latest_invoice)===invoice.id)await db.query("UPDATE business_subscriptions SET billing_status='past_due',plan_code=CASE WHEN billing_managed AND billing_period_end<=now() THEN 'free' ELSE plan_code END,updated_at=now() WHERE stripe_subscription_id=$1 AND stripe_customer_id=$2",[sid,invoice.customer_account]);
 }else if(['charge.refunded','charge.dispute.created','radar.early_fraud_warning.created'].includes(event.type))await holdForRisk(db,o,event.type,api);
 await db.query('COMMIT');}catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
