import {stripeApi,paymentConfigured} from './membership-payments.mjs';
import {isStaging} from './staging-safety.mjs';
import {assertTestPayment,applyBookingPayment,recordVerifiedBookingPayment} from './stripe-checkout.mjs';
import {reserveCommission,attachCommissionIntent,settleTerminalCommission} from './first-customer-commissions.mjs';
import {bookingServicePaymentOptions} from './service-payment-options.mjs';
import {assertBookingWaiver} from './participation-waivers.mjs';
import {queueApprovedBooking} from './booking-client-notifications.mjs';
const obj=x=>typeof x==='string'?JSON.parse(x):x||{};
/** New Terminal collection uses Accounts v2's current capability, not a cached/v1 readiness flag. */
export async function readyTerminalMerchant(db,businessId,api=stripeApi){
 if(!paymentConfigured())throw Error('Stripe payments are not configured for SelahFlow.');
 const merchant=(await db.query("SELECT external_account_id FROM merchant_accounts WHERE business_id=$1 AND provider='stripe'",[businessId])).rows[0];
 if(!merchant?.external_account_id)throw Error('Connect this business Stripe account before using Tap to Pay.');
 const account=await api('core/accounts/'+merchant.external_account_id+'?include%5B0%5D=configuration.merchant',{method:'GET',namespace:'v2'});
 if(account.id!==merchant.external_account_id||account.configuration?.merchant?.capabilities?.card_payments?.status!=='active')throw Error('Complete Stripe verification: card payments must be active before onsite collection.');
 return merchant.external_account_id;
}
export async function terminalSettings(db,owner,api=stripeApi){
 const b=(await db.query("SELECT id FROM businesses WHERE owner_id=$1 AND status='active'",[owner])).rows[0];if(!b)throw Error('Business unavailable.');
 const account=await readyTerminalMerchant(db,b.id,api);
 const locations=await api('terminal/locations?limit=100',{method:'GET',account});
 const saved=(await db.query('SELECT location_id FROM business_terminal_settings WHERE business_id=$1 AND stripe_account_id=$2',[b.id,account])).rows[0];
 return {locationId:saved?.location_id||'',locations:(locations.data||[]).map(l=>({id:l.id,name:l.display_name||l.id})),sandbox:isStaging()};
}
export async function saveTerminalLocation(db,owner,locationId,api=stripeApi){
 if(!/^tml_[A-Za-z0-9]+$/.test(locationId||''))throw Error('Choose a Stripe Terminal location.');
 const b=(await db.query("SELECT id FROM businesses WHERE owner_id=$1 AND status='active'",[owner])).rows[0];if(!b)throw Error('Business unavailable.');
 const account=await readyTerminalMerchant(db,b.id,api),location=await api('terminal/locations/'+locationId,{method:'GET',account});
 if(location.id!==locationId||location.deleted)throw Error('Stripe Terminal location unavailable.');
 await db.query('INSERT INTO business_terminal_settings(business_id,stripe_account_id,location_id) VALUES($1,$2,$3) ON CONFLICT(business_id) DO UPDATE SET stripe_account_id=$2,location_id=$3,updated_at=now()',[b.id,account,locationId]);return {saved:true};
}
async function scopedBooking(db,scope){
 const r=(await db.query("SELECT a.*,b.name,b.slug,s.data AS settings FROM appointments a JOIN businesses b ON b.owner_id=a.owner LEFT JOIN settings s ON s.owner=a.owner WHERE a.id=$1 AND b.id=$2 AND b.status='active' FOR UPDATE OF a",[scope.booking_id,scope.business_id])).rows[0];
 if(!r||!['Confirmed','Scheduled','Checked in','Checked-in','Completed','No-show'].includes(r.status))throw Error('This approved appointment is unavailable for collection.');
 return {...r,data:obj(r.data),config:obj(r.settings)};
}
export async function nativePaymentInfo(db,scope){
 const r=(await db.query("SELECT a.data,a.status,a.date,a.start,b.name,p.status AS payment_status,p.terminal_payment_intent_id,t.location_id FROM businesses b JOIN appointments a ON a.owner=b.owner_id AND a.id=$2 LEFT JOIN booking_payments p ON p.business_id=b.id AND p.booking_id=a.id LEFT JOIN business_terminal_settings t ON t.business_id=b.id JOIN merchant_accounts m ON m.business_id=b.id AND m.provider='stripe' AND t.stripe_account_id=m.external_account_id WHERE b.id=$1 AND b.status='active'",[scope.business_id,scope.booking_id])).rows[0];
 if(!r)throw Error('Set a Stripe Terminal location in Payment setup first.');const d=obj(r.data);
 return {business:r.name,client:d.name||'Client',date:r.date,start:r.start,amountCents:Math.round(Number(d.price)*100),paid:r.payment_status==='paid'||d.paymentStatus==='paid',locationId:r.location_id,sandbox:isStaging(),intentStarted:!!r.terminal_payment_intent_id};
}
export async function nativeConnectionToken(db,scope,api=stripeApi){
 const info=await nativePaymentInfo(db,scope);if(info.paid)throw Error('This appointment is already paid.');
 const account=await readyTerminalMerchant(db,scope.business_id,api);
 const token=await api('terminal/connection_tokens',{account,params:{location:info.locationId}});
 if(typeof token.secret!=='string')throw Error('Stripe connection unavailable.');return {secret:token.secret};
}
/** Shared appointment lock and explicit online expiry prevent concurrent online/Terminal collection. */
export async function startTerminalPayment(pool,scope,origin,api=stripeApi){
 const db=await pool.connect();try{
  await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[scope.business_id+':payment:'+scope.booking_id]);
  const a=await scopedBooking(db,scope),d=a.data,cents=Math.round(Number(d.price)*100);
  let p=(await db.query('SELECT * FROM booking_payments WHERE booking_id=$1 AND business_id=$2 FOR UPDATE',[scope.booking_id,scope.business_id])).rows[0];
  if(d.paymentStatus==='paid'||p?.status==='paid'){await db.query('COMMIT');return {paid:true};}
  if(d.membershipCovered||cents===0)throw Error('No payment is due for this booking.');
  if(!Number.isSafeInteger(cents)||cents<50||cents>100000000)throw Error('Invalid saved appointment price.');
  if(!bookingServicePaymentOptions(a.config,d).onsite)throw Error('Pay on Site is not enabled for this service.');
  await assertBookingWaiver(db,{owner:a.owner,config:a.config,serviceIds:d.serviceIds||[],memberNumber:d.memberNumber});
  const account=await readyTerminalMerchant(db,scope.business_id,api);
  const setting=(await db.query('SELECT location_id FROM business_terminal_settings WHERE business_id=$1 AND stripe_account_id=$2',[scope.business_id,account])).rows[0];
  if(!setting)throw Error('Choose a Stripe Terminal location in Payment setup.');
  if(p&&(p.stripe_account_id!==account||p.amount_cents!==cents))throw Error('Saved payment amount or account changed. Reconcile before collecting.');
  if(p?.terminal_payment_intent_id){
   const pi=await api('payment_intents/'+p.terminal_payment_intent_id+'?expand[]=latest_charge',{method:'GET',account});assertTestPayment(pi);
   if(pi.status==='succeeded'){if(!await applyTerminalPayment(db,scope.business_id,account,pi,api))throw Error('Payment needs reconciliation. Do not charge again.');await db.query('COMMIT');return {paid:true};}
   if(pi.status!=='canceled'){if(!['requires_payment_method','requires_confirmation'].includes(pi.status))throw Error('Payment is processing. Check status before retrying.');await db.query('COMMIT');return {clientSecret:pi.client_secret,locationId:setting.location_id};}
  }
  if(p?.stripe_checkout_session_id){
   const path='checkout/sessions/'+p.stripe_checkout_session_id,session=await api(path,{method:'GET',account});assertTestPayment(session);
   if(session.payment_status==='paid'){if(!await applyBookingPayment(db,scope.business_id,account,session,api))throw Error('Payment needs reconciliation. Do not charge again.');await db.query('COMMIT');return {paid:true};}
   if(!['open','expired'].includes(session.status))throw Error('Online payment is processing. Do not collect again.');
   if(session.status==='open'){const expired=await api(path+'/expire',{account,idempotencyKey:'terminal-expire-'+p.stripe_checkout_session_id});assertTestPayment(expired);if(expired.status!=='expired')throw Error('Online checkout could not be closed. Do not collect again.');}
  }
  const lines=Array.isArray(d.paymentLines)&&d.paymentLines.length?d.paymentLines:[{id:d.serviceIds?.[0]||'',name:(d.services||['Appointment']).join(' + '),type:'service',price:cents/100,qty:1}];
  if(lines.reduce((n,l)=>n+Math.round(Number(l.price)*100)*l.qty,0)!==cents)throw Error('Saved payment lines need review.');
  if(!p)p=(await db.query('INSERT INTO booking_payments(booking_id,business_id,stripe_account_id,amount_cents,lines) VALUES($1,$2,$3,$4,$5::jsonb) RETURNING *',[scope.booking_id,scope.business_id,account,cents,JSON.stringify(lines)])).rows[0];
  const eligible=Math.min(cents,p.lines.filter(l=>l.type==='service').reduce((n,l)=>n+Math.round(Number(l.price)*100)*l.qty,0));
  const commission=await reserveCommission(db,{businessId:scope.business_id,kind:'booking',memberNumber:d.memberNumber,sourceId:scope.booking_id,account,grossCents:cents,eligibleCents:eligible},api);
  const pi=await api('payment_intents',{account,idempotencyKey:'terminal-'+scope.booking_id+'-'+(p.terminal_payment_intent_id||p.stripe_checkout_session_id||'initial'),params:{amount:cents,currency:'usd','payment_method_types[0]':'card_present',capture_method:'automatic',...(commission?{application_fee_amount:commission.fee_cents,'metadata[commission_claim_id]':commission.id}:{}),'metadata[booking_id]':scope.booking_id,'metadata[selahflow_business_id]':scope.business_id,'metadata[selahflow_channel]':'terminal',description:a.name+' · Appointment '+scope.booking_id}});
  assertTestPayment(pi);if(!/^pi_[A-Za-z0-9]+$/.test(pi.id||'')||typeof pi.client_secret!=='string')throw Error('Invalid Stripe collection response.');
  await db.query('INSERT INTO booking_terminal_attempts(payment_intent_id,business_id,booking_id,stripe_account_id,location_id,amount_cents) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING',[pi.id,scope.business_id,scope.booking_id,account,setting.location_id,cents]);
  await attachCommissionIntent(db,commission,pi);
  await db.query("UPDATE booking_payments SET terminal_payment_intent_id=$1,stripe_checkout_session_id=NULL,status='pending',updated_at=now() WHERE booking_id=$2 AND business_id=$3",[pi.id,scope.booking_id,scope.business_id]);
  await db.query("UPDATE appointments SET data=(data::jsonb||'{\"paymentChoice\":\"onsite\"}'::jsonb)::text WHERE id=$1 AND owner=$2",[scope.booking_id,a.owner]);
  await queueApprovedBooking(db,{bookingId:scope.booking_id,requestId:d.bookingRequestId||null,origin});
  await db.query('COMMIT');return {clientSecret:pi.client_secret,locationId:setting.location_id};
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
/** A signed webhook or an authenticated Stripe retrieval invokes this; never trust SDK success alone. */
export async function applyTerminalPayment(db,businessId,account,intent,api=stripeApi){
 assertTestPayment(intent);
 if(intent.status!=='succeeded'||intent.currency!=='usd'||intent.metadata?.selahflow_business_id!==businessId||intent.metadata?.selahflow_channel!=='terminal'||!intent.payment_method_types?.includes('card_present'))return false;
 const attempt=(await db.query('SELECT * FROM booking_terminal_attempts WHERE payment_intent_id=$1 AND business_id=$2 AND stripe_account_id=$3',[intent.id,businessId,account])).rows[0];if(!attempt)return false;
 const p=(await db.query('SELECT * FROM booking_payments WHERE booking_id=$1 AND business_id=$2 AND stripe_account_id=$3 FOR UPDATE',[attempt.booking_id,businessId,account])).rows[0];
 if(!p){
  const retained=(await db.query('SELECT 1 FROM stripe_payment_receipts WHERE stripe_account_id=$1 AND provider_reference=$2 AND business_id=$3 AND booking_id IS NULL AND amount_cents=$4',[account,intent.id,businessId,attempt.amount_cents])).rows.length;
  return !!retained&&intent.metadata?.booking_id===attempt.booking_id&&intent.amount===attempt.amount_cents&&intent.amount_received===attempt.amount_cents;
 }
 if(intent.metadata?.booking_id!==p.booking_id||intent.amount!==p.amount_cents||intent.amount_received!==p.amount_cents||attempt.amount_cents!==p.amount_cents)return false;
 if(p.status==='paid'){if(p.stripe_payment_intent_id!==intent.id)throw Error('A second payment needs reconciliation. Do not charge again.');return true;}
 if(p.terminal_payment_intent_id!==intent.id)throw Error('Unexpected onsite payment needs reconciliation.');
 // Re-fetch with the connected account and expanded charge even for signed events.
 const actual=await api('payment_intents/'+intent.id+'?expand[]=latest_charge',{method:'GET',account});assertTestPayment(actual);
 if(actual.id!==intent.id||actual.status!=='succeeded'||actual.amount_received!==p.amount_cents||actual.amount!==p.amount_cents||actual.currency!=='usd'||actual.metadata?.booking_id!==p.booking_id||actual.metadata?.selahflow_business_id!==businessId||actual.metadata?.selahflow_channel!=='terminal'||actual.latest_charge?.payment_method_details?.type!=='card_present'||actual.latest_charge?.paid!==true)throw Error('Stripe card-present payment needs reconciliation.');
 await settleTerminalCommission(db,{businessId,account,intent:actual},api);
 return recordVerifiedBookingPayment(db,{businessId,account,row:p,intentId:actual.id,onsite:true});
}
export async function checkTerminalPayment(pool,scope,{cancel=false}={},api=stripeApi){
 const db=await pool.connect();try{
  await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[scope.business_id+':payment:'+scope.booking_id]);
  const p=(await db.query('SELECT * FROM booking_payments WHERE booking_id=$1 AND business_id=$2 FOR UPDATE',[scope.booking_id,scope.business_id])).rows[0];
  if(p?.status==='paid'){await db.query('COMMIT');return {paid:true};}
  if(!p?.terminal_payment_intent_id){await db.query('COMMIT');return {paid:false,status:'not_started'};}
  const path='payment_intents/'+p.terminal_payment_intent_id;let pi=await api(path+'?expand[]=latest_charge',{method:'GET',account:p.stripe_account_id});assertTestPayment(pi);
  if(cancel&&['requires_payment_method','requires_confirmation','requires_capture'].includes(pi.status)){pi=await api(path+'/cancel',{account:p.stripe_account_id,idempotencyKey:'terminal-cancel-'+pi.id});assertTestPayment(pi);}
  if(cancel&&!['canceled','succeeded'].includes(pi.status))throw Error('Payment is processing. Check status before cancellation or another charge.');
  const paid=await applyTerminalPayment(db,scope.business_id,p.stripe_account_id,pi,api);
  if(pi.status==='canceled'){await db.query("UPDATE booking_payments SET status='expired',updated_at=now() WHERE booking_id=$1 AND business_id=$2 AND status='pending'",[scope.booking_id,scope.business_id]);await db.query("UPDATE first_customer_commissions SET status='expired',updated_at=now() WHERE business_id=$1 AND stripe_payment_intent_id=$2 AND status='reserved'",[scope.business_id,pi.id]);}
  await db.query('COMMIT');return {paid,status:pi.status};
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
