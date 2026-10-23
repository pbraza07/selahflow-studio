import {stripeApi,paymentConfigured} from './membership-payments.mjs';
import {isStaging} from './staging-safety.mjs';
export const COMMISSION_EVENTS=['checkout.session.completed','checkout.session.expired','invoice.paid','invoice.payment_failed','customer.subscription.updated','customer.subscription.deleted','account.updated','charge.refunded'];
async function endpointFor(api,origin){
 const url=new URL('/api/stripe/webhook',origin);if(url.protocol!=='https:')throw Error('Secure webhook origin required.');
 const result=await api('webhook_endpoints?limit=100',{method:'GET'});
 const matches=(result.data||[]).filter(e=>e.url===url.href&&e.status==='enabled'&&e.livemode===!isStaging());
 if(matches.length!==1)throw Error('Exactly one enabled Stripe Connect webhook must match '+url.href+'. Ask the platform administrator to review Stripe webhook setup.');
 return matches[0];
}
export async function commissionStripeStatus(origin,api=stripeApi){
 if(!paymentConfigured())return {ready:false,reason:'Stripe API key and Connect signing secret are required.'};
 try{
  const e=await endpointFor(api,origin),missing=COMMISSION_EVENTS.filter(type=>!e.enabled_events.includes('*')&&!e.enabled_events.includes(type));
  return {ready:missing.length===0,webhookId:e.id,missingEvents:missing,reason:missing.length?'Configure the missing commission webhook events.':'Commission payment and refund events are configured.'};
 }catch(e){return {ready:false,reason:/^(Exactly one|Secure webhook)/.test(String(e.message))?String(e.message):'Stripe commission setup could not be verified. Ask the platform administrator to check server credentials and webhook permissions.'};}
}
export async function assertCommissionStripeReady(origin,api=stripeApi){const result=await commissionStripeStatus(origin,api);if(!result.ready)throw Error(result.reason);return result;}
/** Add event types only to the existing matching endpoint. URL, signing secret, mode and other endpoints are unchanged. */
export async function configureCommissionStripe(origin,api=stripeApi){
 if(!paymentConfigured())throw Error('Stripe server configuration is incomplete.');
 const e=await endpointFor(api,origin);
 if(!e.enabled_events.includes('*')){
  const types=[...new Set([...e.enabled_events,...COMMISSION_EVENTS])];
  if(types.length!==e.enabled_events.length){const params=Object.fromEntries(types.map((type,i)=>['enabled_events['+i+']',type]));await api('webhook_endpoints/'+e.id,{params,idempotencyKey:'commission-events-v1-'+e.id});}
 }
 return assertCommissionStripeReady(origin,api);
}
