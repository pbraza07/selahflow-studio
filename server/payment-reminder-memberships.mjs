import {randomBytes} from 'node:crypto';
import {tokenHash} from './security.mjs';
import {validEmail} from './notification-delivery.mjs';
import {paymentConfigured,stripeApi,invoiceSubscriptionId} from './membership-payments.mjs';
import {assertTestPayment} from './stripe-checkout.mjs';

const object=x=>{try{return typeof x==='string'?JSON.parse(x):x||{};}catch{return {};}};
const email=x=>String(x||'').trim().toLowerCase();
const id=x=>typeof x==='string'?x:x?.id;
const amount=x=>Number.isSafeInteger(Number(x))&&Number(x)>0&&Number(x)<=100000000;
const epoch=x=>Number.isSafeInteger(x)&&x>0?new Date(x*1000):null;
const memberSelect=`SELECT m.*,p.name AS plan_name,p.active AS plan_active,p.price_cents AS plan_price,
 b.name AS business_name,b.slug,b.owner_id,s.data AS settings,
 ma.external_account_id AS merchant_account,ma.charges_enabled,ma.onboarding_complete,
 EXISTS(SELECT 1 FROM membership_session_ledger l WHERE l.business_id=m.business_id AND l.membership_id=m.id AND l.event_type='payment_confirmed') AS has_payment,
 (SELECT MAX(i.created_at) FROM membership_payment_invitations i WHERE i.business_id=m.business_id AND i.membership_id=m.id) AS last_notice_at
 FROM customer_memberships m JOIN businesses b ON b.id=m.business_id AND b.status='active'
 JOIN membership_plans p ON p.id=m.plan_id AND p.business_id=m.business_id
 LEFT JOIN settings s ON s.owner=b.owner_id
 LEFT JOIN merchant_accounts ma ON ma.business_id=b.id AND ma.provider='stripe'`;

function eligible(m,now,destination){
 if(!m||object(m.settings).dailyPaymentReminders===false||!validEmail(email(m.customer_email))||destination&&email(destination)!==email(m.customer_email))return false;
 if(['canceled','cancelled'].includes(m.status))return false;
 if(m.stripe_subscription_id)return m.billing_type==='membership'&&(['pending_payment','past_due','payment_failed','expired'].includes(m.status)||m.status==='active'&&m.paid_through&&new Date(m.paid_through)<=now);
 return ['pending_payment','payment_failed'].includes(m.status)&&!m.initial_paid_at&&!m.last_paid_at&&!m.has_payment&&m.plan_active&&amount(m.price_cents)&&Number(m.price_cents)===Number(m.plan_price);
}
const base=m=>({kind:m.billing_type==='package'?'package':'membership',sourceId:m.id,businessId:m.business_id,
 destination:email(m.customer_email),businessName:m.business_name,clientName:m.customer_name,label:m.plan_name,
 amountCents:Number(m.price_cents),sourceAmountCents:Number(m.price_cents),eligibleSince:m.created_at,lastNoticeAt:m.stripe_subscription_id?null:m.last_notice_at||null});
async function readMember(pool,businessId,sourceId){return (await pool.query(memberSelect+' WHERE m.business_id=$1 AND m.id=$2',[businessId,sourceId])).rows[0];}

export async function listMembershipReminderCandidates(pool,{businessId,destination,now=new Date()}){
 const rows=(await pool.query(memberSelect+` WHERE m.business_id=$1 AND ($2::text IS NULL OR lower(trim(m.customer_email))=$2)
 AND m.status IN ('pending_payment','past_due','payment_failed','expired','active') ORDER BY m.created_at,m.id`,[businessId,destination?email(destination):null])).rows;
 return rows.filter(m=>eligible(m,new Date(now),destination)).map(m=>({...base(m),kind:m.stripe_subscription_id?'membership_invoice':base(m).kind}));
}

function safeOrigin(origin){const u=new URL(origin);if(u.username||u.password||(u.protocol!=='https:'&&!(u.protocol==='http:'&&u.hostname==='localhost')))throw Error('A secure application URL is required.');return u.origin;}
export function membershipCheckoutPaymentUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='checkout.stripe.com'&&!u.port&&!u.username&&!u.password?u.toString():null;}catch{return null;}}
export function membershipInvoicePaymentUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='invoice.stripe.com'&&!u.port&&!u.username&&!u.password?u.toString():null;}catch{return null;}}
function sameIdentity(before,after){return after&&before.business_id===after.business_id&&before.id===after.id&&email(before.customer_email)===email(after.customer_email)&&before.stripe_account_id===after.stripe_account_id&&before.merchant_account===after.merchant_account&&before.stripe_customer_id===after.stripe_customer_id&&before.stripe_subscription_id===after.stripe_subscription_id&&before.stripe_checkout_session_id===after.stripe_checkout_session_id&&before.plan_id===after.plan_id&&before.billing_type===after.billing_type&&before.first_invoice_cents===after.first_invoice_cents&&Number(before.price_cents)===Number(after.price_cents);}

async function reminderLink(pool,m,origin,now){
 const current=(await pool.query('SELECT * FROM membership_payment_reminder_links WHERE membership_id=$1 AND business_id=$2',[m.id,m.business_id])).rows[0];
 if(current&&current.destination===email(m.customer_email)&&new Date(current.expires_at)>new Date(now.getTime()+86400000)){
  try{const u=new URL(current.payment_url),token=u.pathname.split('/').at(-1);if(u.origin===origin&&/^\/membership-pay\/[a-f0-9]{64}$/.test(u.pathname)&&!u.search&&!u.hash&&tokenHash(token)===current.token_hash)return u.toString();}catch{}
 }
 const token=randomBytes(32).toString('hex'),url=origin+'/membership-pay/'+token;
 const r=await pool.query(`INSERT INTO membership_payment_reminder_links(membership_id,business_id,token_hash,payment_url,expires_at,destination)
 VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(membership_id) DO UPDATE SET token_hash=excluded.token_hash,destination=excluded.destination,payment_url=excluded.payment_url,expires_at=excluded.expires_at,updated_at=now()
 WHERE membership_payment_reminder_links.business_id=excluded.business_id RETURNING membership_id`,[m.id,m.business_id,tokenHash(token),url,new Date(now.getTime()+30*86400000).toISOString(),email(m.customer_email)]);
 if(!r.rows.length)throw Error('Membership payment link scope changed.');return url;
}

async function inFlightInvoicePayment(invoice,account,api){
 const payments=invoice.payments?.data||[],references=[invoice.payment_intent,...payments.filter(p=>p.status==='open').map(p=>p.payment?.payment_intent)].filter(Boolean);
 if(invoice.payments?.has_more)throw Error('Invoice payment details require review.');
 for(const value of references){const reference=id(value);if(!/^pi_[A-Za-z0-9]+$/.test(reference||''))throw Error('Invoice payment reference is unavailable.');const intent=typeof value==='object'?value:await api('payment_intents/'+reference,{method:'GET',account});assertTestPayment(intent);if(intent.id!==reference||id(intent.customer)&&id(intent.customer)!==id(invoice.customer))throw Error('Invoice payment scope changed.');if(['processing','succeeded','requires_capture'].includes(intent.status))return true;}
 return false;
}

async function recurringItems(pool,m,{now,api,destination}){
 if(!/^acct_[A-Za-z0-9]+$/.test(m.stripe_account_id||'')||m.merchant_account!==m.stripe_account_id||!/^sub_[A-Za-z0-9]+$/.test(m.stripe_subscription_id||'')||!/^cus_[A-Za-z0-9]+$/.test(m.stripe_customer_id||''))return [];
 const account=m.stripe_account_id,subscription=await api('subscriptions/'+m.stripe_subscription_id,{method:'GET',account});assertTestPayment(subscription);
 if(subscription.id!==m.stripe_subscription_id||subscription.metadata?.membership_id!==m.id||subscription.metadata?.selahflow_business_id!==m.business_id||id(subscription.customer)!==m.stripe_customer_id||['canceled','incomplete_expired','paused'].includes(subscription.status)||subscription.pause_collection)return [];
 let cursor='',pages=0;const items=[],seen=new Set();
 do{
  const page=await api('invoices?subscription='+encodeURIComponent(subscription.id)+'&status=open&limit=100'+(cursor?'&starting_after='+encodeURIComponent(cursor):''),{method:'GET',account});
  if(!Array.isArray(page.data))throw Error('Invoice list unavailable.');
  for(const candidate of page.data){
   if(!/^in_[A-Za-z0-9]+$/.test(candidate.id||'')||seen.has(candidate.id))continue;seen.add(candidate.id);
   // Refresh the invoice and its payment intents, not just a potentially stale local past_due status.
   const invoice=await api('invoices/'+candidate.id+'?expand[]=payments.data.payment.payment_intent',{method:'GET',account});assertTestPayment(invoice);
   if(invoice.id!==candidate.id||invoiceSubscriptionId(invoice)!==subscription.id||id(invoice.customer)!==m.stripe_customer_id||invoice.status!=='open'||invoice.paid===true||invoice.currency!=='usd'||!Number.isSafeInteger(invoice.amount_remaining)||!amount(invoice.amount_remaining)||!['subscription_create','subscription_cycle','subscription_update'].includes(invoice.billing_reason))continue;
   const created=epoch(invoice.created),due=epoch(invoice.due_date);if(!created||created>now||due&&due>now||!due&&invoice.attempted!==true&&!(Number(invoice.attempt_count)>0))continue;
   const url=membershipInvoicePaymentUrl(invoice.hosted_invoice_url);if(!url||await inFlightInvoicePayment(invoice,account,api))continue;
   items.push({...base(m),kind:'membership_invoice',invoiceId:invoice.id,date:(due||created).toISOString().slice(0,10),label:m.plan_name+' · outstanding invoice',amountCents:Number(invoice.amount_remaining),eligibleSince:due&&due>created?due:created,url,actionLabel:'Pay membership balance'});
  }
  if(!page.has_more)break;
  const last=page.data.at(-1)?.id;if(!last||last===cursor||++pages>=20)throw Error('Invoice list requires additional review.');cursor=last;
 }while(true);
 const fresh=await readMember(pool,m.business_id,m.id);
 return sameIdentity(m,fresh)&&eligible(fresh,now,destination)?items.map(x=>({...x,clientName:fresh.customer_name,lastNoticeAt:null})):[];
}

/** Builds only reminders for existing obligations; never creates a charge or subscription. */
export async function prepareMembershipReminder(pool,{businessId,sourceId,origin,now=new Date(),destination,api=stripeApi,configured=paymentConfigured()}){
 now=new Date(now);const m=await readMember(pool,businessId,sourceId);if(!eligible(m,now,destination))return null;
 if(m.stripe_subscription_id)return configured?recurringItems(pool,m,{now,api,destination}):[];
 const item=base(m);if(!amount(item.amountCents)||m.first_invoice_cents===0)return null;
 if(m.stripe_checkout_session_id){
  if(!configured||!/^cs_[A-Za-z0-9_]+$/.test(m.stripe_checkout_session_id)||!/^acct_[A-Za-z0-9]+$/.test(m.stripe_account_id||'')||m.merchant_account!==m.stripe_account_id)return null;
  const session=await api('checkout/sessions/'+m.stripe_checkout_session_id,{method:'GET',account:m.stripe_account_id});assertTestPayment(session);
  if(session.id!==m.stripe_checkout_session_id||session.client_reference_id!==m.id||session.metadata?.membership_id!==m.id||session.metadata?.selahflow_business_id!==m.business_id||session.currency!=='usd'||session.payment_status!=='unpaid'||!['open','expired'].includes(session.status))return null;
  if(session.status==='open'){
   const recipient=email(session.customer_details?.email||session.customer_email);
   if(recipient!==email(m.customer_email)||m.stripe_customer_id&&id(session.customer)!==m.stripe_customer_id||!Number.isSafeInteger(session.amount_total)||session.amount_total!==Number(m.first_invoice_cents??m.price_cents)||!membershipCheckoutPaymentUrl(session.url)||session.expires_at&&(!epoch(session.expires_at)||epoch(session.expires_at)<=now))return null;
   item.amountCents=session.amount_total;item.url=membershipCheckoutPaymentUrl(session.url);item.actionLabel=m.billing_type==='package'?'Pay for package':'Pay for membership';
  }else item.amountCents=Number(m.first_invoice_cents??m.price_cents);
  if(!amount(item.amountCents))return null;
  if(session.payment_intent){const reference=id(session.payment_intent);if(!/^pi_[A-Za-z0-9]+$/.test(reference||''))return null;const intent=typeof session.payment_intent==='object'?session.payment_intent:await api('payment_intents/'+reference,{method:'GET',account:m.stripe_account_id});assertTestPayment(intent);if(intent.id!==reference||id(intent.customer)&&id(session.customer)&&id(intent.customer)!==id(session.customer)||m.stripe_customer_id&&id(intent.customer)!==m.stripe_customer_id||['processing','succeeded','requires_capture'].includes(intent.status))return null;}
 }
 const fresh=await readMember(pool,businessId,sourceId);if(!sameIdentity(m,fresh)||!eligible(fresh,now,destination))return null;
 // Pending manual registrations remain payable onsite when card setup is unavailable.
 if(!fresh.stripe_checkout_session_id&&fresh.status==='pending_payment'&&configured&&fresh.charges_enabled&&fresh.onboarding_complete&&/^acct_[A-Za-z0-9]+$/.test(fresh.merchant_account||'')&&(!fresh.stripe_account_id||fresh.stripe_account_id===fresh.merchant_account)){
  item.url=await reminderLink(pool,fresh,safeOrigin(origin),now);item.actionLabel=fresh.billing_type==='package'?'Pay for package':'Pay for membership';
 }
 return {...item,clientName:fresh.customer_name,lastNoticeAt:fresh.last_notice_at||null};
}
