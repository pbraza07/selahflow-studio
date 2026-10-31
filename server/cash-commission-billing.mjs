import {randomUUID} from 'node:crypto';
import {stripeApi} from './membership-payments.mjs';
import {assertTestPayment,checkoutUrl} from './stripe-checkout.mjs';
import {reserveCommission} from './first-customer-commissions.mjs';
import {getPool} from './database.mjs';
import {CASH_BILLING_TERMS_VERSION,CASH_BILLING_TERMS} from './cash-commission-terms.mjs';
export {CASH_BILLING_TERMS_VERSION,CASH_BILLING_TERMS} from './cash-commission-terms.mjs';
const ref=x=>typeof x==='string'?x:x?.id;
export const cashBillingReady=()=>!!process.env.STRIPE_SECRET_KEY&&!!process.env.STRIPE_PLATFORM_WEBHOOK_SECRET;
const apiDefault=(path,options={})=>stripeApi(path,{...options,apiVersion:'2026-09-30.endive'});
function safeStripeUrl(value,hosts){if(!value)return null;const u=new URL(value);if(u.protocol!=='https:'||!hosts.includes(u.hostname)||u.username||u.password)throw Error('Unsafe Stripe invoice URL.');return u.href;}
export function easternMonth(now=new Date()){const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit'}).formatToParts(now);return parts.find(p=>p.type==='year').value+'-'+parts.find(p=>p.type==='month').value;}
// Caller owns the payment transaction. Existing identity locks protect cash vs card races.
export async function accrueCashCommission(db,args,api){
 const period=(await db.query("SELECT to_char(clock_timestamp() AT TIME ZONE 'America/New_York','YYYY-MM') AS period")).rows[0].period;
 await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[args.businessId+':cash-statement:'+period]);
 const claim=await reserveCommission(db,{...args,account:'cash',collectionMethod:'cash'},api);if(!claim)return null;
 await db.query("UPDATE first_customer_commissions SET collection_method='cash',status='accrued',earned_at=clock_timestamp(),stripe_account_id='cash',updated_at=now() WHERE id=$1 AND business_id=$2 AND status='reserved'",[claim.id,args.businessId]);return claim;
}
export async function cashBillingInfo(db,businessId){
 const p=(await db.query('SELECT p.authorized_at,p.stripe_payment_method_id,c.signature_name,c.accepted_at,c.terms_version FROM commission_billing_profiles p LEFT JOIN commission_billing_consents c ON c.id=p.active_consent_id WHERE p.business_id=$1',[businessId])).rows[0];
 const pending=(await db.query("SELECT COALESCE(sum(fee_cents),0)::bigint AS cents FROM first_customer_commissions WHERE business_id=$1 AND collection_method='cash' AND status='accrued'",[businessId])).rows[0];
 const statements=(await db.query('SELECT id,period,amount_cents,status,paid_at,created_at FROM commission_monthly_statements WHERE business_id=$1 ORDER BY period DESC LIMIT 36',[businessId])).rows;
 return {configured:cashBillingReady(),authorized:!!p?.authorized_at&&!!p?.stripe_payment_method_id&&p?.terms_version===CASH_BILLING_TERMS_VERSION,authorizedAt:p?.authorized_at||null,signatureName:p?.signature_name||null,termsVersion:CASH_BILLING_TERMS_VERSION,terms:CASH_BILLING_TERMS,unbilledCents:Number(pending?.cents||0),statements};
}
export async function statementDetail(db,businessId,id){
 const s=(await db.query('SELECT id,period,amount_cents,status,paid_at,created_at FROM commission_monthly_statements WHERE id=$1 AND business_id=$2',[id,businessId])).rows[0];if(!s)throw Error('Statement not found.');
 const items=(await db.query('SELECT id,kind,source_id,gross_cents,eligible_cents,fee_cents,earned_at FROM first_customer_commissions WHERE business_id=$1 AND billing_statement_id=$2 ORDER BY earned_at,id',[businessId,id])).rows;return {...s,items};
}
export async function startCashBillingSetup(pool,{businessId,owner,input,origin},api=apiDefault){
 if(!cashBillingReady())throw Error('Platform Stripe billing setup is required before saving a billing card.');
 const name=String(input.signatureName||'').trim();if(typeof input.signatureName!=='string'||input.accepted!==true||input.version!==CASH_BILLING_TERMS_VERSION||name.length<2||name.length>120||/[<>\u0000-\u001f]/.test(name))throw Error('Read the authorization, enter your full name and check the agreement box.');
 const db=await pool.connect();try{await db.query('BEGIN');
 const b=(await db.query("SELECT b.name,b.slug,u.email FROM businesses b JOIN users u ON u.id=b.owner_id WHERE b.id=$1 AND b.owner_id=$2 AND b.status='active'",[businessId,owner])).rows[0];if(!b)throw Error('Business unavailable.');
 await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[businessId+':cash-billing-setup']);
 await db.query('INSERT INTO commission_billing_profiles(business_id) VALUES($1) ON CONFLICT DO NOTHING',[businessId]);
 const p=(await db.query('SELECT p.*,c.stripe_setup_session_id FROM commission_billing_profiles p LEFT JOIN commission_billing_consents c ON c.id=p.pending_consent_id WHERE p.business_id=$1 FOR UPDATE OF p',[businessId])).rows[0];
 if(p.stripe_setup_session_id){const old=await api('checkout/sessions/'+p.stripe_setup_session_id,{method:'GET'});assertTestPayment(old);if(old.status==='open'){await db.query('COMMIT');return {url:checkoutUrl(old)};}if(old.status==='complete')throw Error('Card setup is being verified. Refresh billing status before starting again.');}
 let customer=p.stripe_customer_id;if(!customer){const c=await api('customers',{idempotencyKey:'cash-commission-customer-'+businessId,params:{name:b.name,email:b.email,'metadata[selahflow_cash_business]':businessId}});assertTestPayment(c);if(!/^cus_[A-Za-z0-9]+$/.test(c.id||''))throw Error('Stripe billing customer unavailable.');customer=c.id;}
 const id=randomUUID();await db.query('INSERT INTO commission_billing_consents(id,business_id,owner_id,terms_version,signature_name,snapshot) VALUES($1,$2,$3,$4,$5,$6)',[id,businessId,owner,CASH_BILLING_TERMS_VERSION,name,CASH_BILLING_TERMS]);
 const s=await api('checkout/sessions',{idempotencyKey:'cash-commission-setup-'+id,params:{mode:'setup',customer,currency:'usd','managed_payments[enabled]':false,'payment_method_types[0]':'card',client_reference_id:businessId,'metadata[selahflow_cash_consent]':id,'setup_intent_data[metadata][selahflow_cash_consent]':id,'custom_text[submit][message]':'Save this business card for monthly SelahFlow cash commission invoices, including automatic collection and payment retries under your signed authorization.',success_url:origin+'/settings/commissions?setup=return',cancel_url:origin+'/settings/commissions?setup=cancelled'}});
 assertTestPayment(s);const url=checkoutUrl(s);
 await db.query('UPDATE commission_billing_consents SET stripe_setup_session_id=$1 WHERE id=$2',[s.id,id]);
 await db.query('UPDATE commission_billing_profiles SET stripe_customer_id=$1,pending_consent_id=$2,updated_at=now() WHERE business_id=$3',[customer,id,businessId]);
 await db.query('COMMIT');return {url};
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
export async function reconcileCashSetup(db,sessionId,api=apiDefault){
 const c=(await db.query('SELECT c.*,p.stripe_customer_id,p.pending_consent_id FROM commission_billing_consents c JOIN commission_billing_profiles p ON p.business_id=c.business_id WHERE c.stripe_setup_session_id=$1',[sessionId])).rows[0];if(!c||c.pending_consent_id!==c.id)return false;
 const s=await api('checkout/sessions/'+sessionId,{method:'GET'});assertTestPayment(s);
 if(s.mode!=='setup'||ref(s.customer)!==c.stripe_customer_id||s.client_reference_id!==c.business_id||s.metadata?.selahflow_cash_consent!==c.id)throw Error('Billing setup ownership mismatch.');
 if(s.status==='expired'){await db.query('UPDATE commission_billing_profiles SET pending_consent_id=NULL WHERE business_id=$1 AND pending_consent_id=$2',[c.business_id,c.id]);return false;}
 if(s.status!=='complete'||!ref(s.setup_intent))return false;
 const intent=await api('setup_intents/'+ref(s.setup_intent),{method:'GET'});assertTestPayment(intent);
 if(intent.status!=='succeeded'||ref(intent.customer)!==c.stripe_customer_id||intent.metadata?.selahflow_cash_consent!==c.id||!/^pm_[A-Za-z0-9]+$/.test(ref(intent.payment_method)||''))throw Error('Billing card setup needs verification.');
 const pm=await api('payment_methods/'+ref(intent.payment_method),{method:'GET'});assertTestPayment(pm);if(pm.type!=='card'||ref(pm.customer)!==c.stripe_customer_id)throw Error('Billing card ownership mismatch.');
 await api('customers/'+c.stripe_customer_id,{idempotencyKey:'cash-commission-default-'+c.id,params:{'invoice_settings[default_payment_method]':pm.id}});
 await db.query('UPDATE commission_billing_consents SET activated_at=COALESCE(activated_at,now()) WHERE id=$1',[c.id]);
 await db.query('UPDATE commission_billing_profiles SET active_consent_id=$1,pending_consent_id=NULL,stripe_payment_method_id=$2,authorized_at=COALESCE(authorized_at,now()),updated_at=now() WHERE business_id=$3 AND pending_consent_id=$1',[c.id,pm.id,c.business_id]);return true;
}
export async function reconcileCashInvoice(db,invoiceId,api=apiDefault){
 const s=(await db.query('SELECT * FROM commission_monthly_statements WHERE stripe_invoice_id=$1',[invoiceId])).rows[0];if(!s)return false;
 const inv=await api('invoices/'+invoiceId,{method:'GET'});assertTestPayment(inv);
 if(ref(inv.customer)!==s.stripe_customer_id||inv.metadata?.selahflow_cash_statement!==s.id||inv.currency!=='usd'||inv.total!==s.amount_cents||inv.collection_method!=='charge_automatically')throw Error('Commission invoice ownership or amount mismatch.');
 let status=inv.status;if(status==='open'&&inv.attempted&&inv.amount_remaining>0)status='failed';
 if(status==='paid'&&(inv.paid_out_of_band===true||Number(inv.amount_paid_off_stripe||0)>0||inv.amount_paid!==s.amount_cents||inv.amount_remaining!==0))throw Error('Commission invoice payment requires reconciliation.');
 if(!['draft','open','failed','paid','void','uncollectible'].includes(status))throw Error('Commission invoice state unavailable.');
 const hosted=safeStripeUrl(inv.hosted_invoice_url,['invoice.stripe.com']),pdf=safeStripeUrl(inv.invoice_pdf,['pay.stripe.com']);
 // Mark verified claim receipts first. If the statement write is interrupted, its old state remains eligible for worker reconciliation.
 if(status==='paid')await db.query("UPDATE first_customer_commissions SET status='paid',paid_at=COALESCE(paid_at,now()),updated_at=now() WHERE business_id=$1 AND billing_statement_id=$2 AND collection_method='cash' AND status='invoiced'",[s.business_id,s.id]);
 await db.query("UPDATE commission_monthly_statements SET status=$1,hosted_invoice_url=$2,invoice_pdf=$3,paid_at=CASE WHEN $1='paid' THEN COALESCE(paid_at,now()) ELSE paid_at END,checked_at=now(),updated_at=now() WHERE id=$4",[status,hosted,pdf,s.id]);return true;
}
export async function cashInvoicePaymentLink(db,businessId,id,api=apiDefault){
 const s=(await db.query('SELECT stripe_invoice_id FROM commission_monthly_statements WHERE id=$1 AND business_id=$2',[id,businessId])).rows[0];if(!s?.stripe_invoice_id)throw Error('This statement is still being prepared.');
 await reconcileCashInvoice(db,s.stripe_invoice_id,api);
 const current=(await db.query('SELECT status,hosted_invoice_url FROM commission_monthly_statements WHERE id=$1 AND business_id=$2',[id,businessId])).rows[0];
 if(!['open','failed'].includes(current.status)||!current.hosted_invoice_url)throw Error('This statement has no payable outstanding balance.');return {url:current.hosted_invoice_url};
}
// Persist the statement before external writes; provider retries reuse the same statement and keys.
export async function prepareCashStatement(pool,businessId,period){
 const db=await pool.connect();try{await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[businessId+':cash-statement:'+period]);
 let s=(await db.query('SELECT * FROM commission_monthly_statements WHERE business_id=$1 AND period=$2',[businessId,period])).rows[0];
 if(!s){const p=(await db.query('SELECT stripe_customer_id FROM commission_billing_profiles WHERE business_id=$1 AND authorized_at IS NOT NULL',[businessId])).rows[0];if(!p){await db.query('COMMIT');return null;}
 const rows=(await db.query("SELECT id,fee_cents FROM first_customer_commissions WHERE business_id=$1 AND collection_method='cash' AND status='accrued' AND billing_statement_id IS NULL AND to_char(earned_at AT TIME ZONE 'America/New_York','YYYY-MM')<=$2 FOR UPDATE",[businessId,period])).rows;
 const amount=rows.reduce((n,r)=>n+r.fee_cents,0);if(amount<50){await db.query('COMMIT');return null;}if(!Number.isSafeInteger(amount)||amount>99999999)throw Error('Commission statement total requires review.');
 s=(await db.query('INSERT INTO commission_monthly_statements(business_id,period,amount_cents,stripe_customer_id) VALUES($1,$2,$3,$4) RETURNING *',[businessId,period,amount,p.stripe_customer_id])).rows[0];
 await db.query("UPDATE first_customer_commissions SET billing_statement_id=$1,status='invoiced',updated_at=now() WHERE business_id=$2 AND id=ANY($3::uuid[])",[s.id,businessId,rows.map(r=>r.id)]);
 }await db.query('COMMIT');return s;
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
export async function issueCashStatement(db,s,origin,api=apiDefault){
 let inv;if(s.stripe_invoice_id){inv=await api('invoices/'+s.stripe_invoice_id,{method:'GET'});assertTestPayment(inv);}else{
 inv=await api('invoices',{idempotencyKey:'cash-statement-invoice-'+s.id,params:{customer:s.stripe_customer_id,currency:'usd',collection_method:'charge_automatically',auto_advance:false,pending_invoice_items_behavior:'exclude','payment_settings[payment_method_types][0]':'card','automatic_tax[enabled]':false,'metadata[selahflow_cash_statement]':s.id,description:'SelahFlow cash commission statement · '+s.period,footer:'Itemized transaction details: '+origin+'/settings/commissions'}});assertTestPayment(inv);
 if(!/^in_[A-Za-z0-9]+$/.test(inv.id||'')||ref(inv.customer)!==s.stripe_customer_id||inv.metadata?.selahflow_cash_statement!==s.id)throw Error('Commission invoice creation needs reconciliation.');
 await db.query('UPDATE commission_monthly_statements SET stripe_invoice_id=$1,updated_at=now() WHERE id=$2 AND stripe_invoice_id IS NULL',[inv.id,s.id]);
 }
 if(ref(inv.customer)!==s.stripe_customer_id||inv.metadata?.selahflow_cash_statement!==s.id||inv.currency!=='usd')throw Error('Commission invoice ownership mismatch.');
 if(inv.status==='draft'){
 const groups=(await db.query('SELECT kind,count(*)::int AS count,sum(fee_cents)::int AS cents FROM first_customer_commissions WHERE business_id=$1 AND billing_statement_id=$2 GROUP BY kind ORDER BY kind',[s.business_id,s.id])).rows;
 if(groups.reduce((n,g)=>n+g.cents,0)!==s.amount_cents)throw Error('Commission statement lines require reconciliation.');
 // Provider summary lines avoid the invoice-line cap. SelahFlow retains every transaction.
 for(const g of groups)await api('invoiceitems',{idempotencyKey:'cash-statement-items-'+s.id+'-'+g.kind,params:{customer:s.stripe_customer_id,invoice:inv.id,currency:'usd',amount:g.cents,description:g.count+' first '+g.kind+' cash commission'+(g.count===1?'':'s')+' · '+s.period+' · itemized in SelahFlow'}});
 inv=await api('invoices/'+inv.id,{method:'GET'});assertTestPayment(inv);if(inv.total!==s.amount_cents)throw Error('Commission invoice total requires reconciliation.');
 await api('invoices/'+inv.id+'/finalize',{idempotencyKey:'cash-statement-finalize-'+s.id,params:{auto_advance:true}});
 }return reconcileCashInvoice(db,inv.id,api);
}
export async function processCashBillingEvent(db,event,api=apiDefault){
 if(event.account)return false;
 if(['checkout.session.completed','checkout.session.expired'].includes(event.type))return reconcileCashSetup(db,event.data.object.id,api);
 if(['invoice.paid','invoice.payment_failed','invoice.updated','invoice.finalized','invoice.voided','invoice.marked_uncollectible'].includes(event.type))return reconcileCashInvoice(db,event.data.object.id,api);return false;
}
export async function sweepCashBilling(pool,{origin,now=new Date(),api=apiDefault}){
 if(!cashBillingReady())return;const db=await pool.connect();let locked=false;try{
 // Session lock spans provider calls without a long transaction. Connection release is guaranteed.
 locked=(await db.query('SELECT pg_try_advisory_lock(81371082) AS locked')).rows[0]?.locked;if(!locked)return;
 const pending=(await db.query('SELECT c.stripe_setup_session_id FROM commission_billing_profiles p JOIN commission_billing_consents c ON c.id=p.pending_consent_id WHERE c.stripe_setup_session_id IS NOT NULL ORDER BY c.accepted_at LIMIT 100')).rows;
 for(const c of pending)try{await reconcileCashSetup(db,c.stripe_setup_session_id,api);}catch{console.warn('Cash commission card verification pending.');}
 const months=(await db.query("SELECT DISTINCT c.business_id,to_char(c.earned_at AT TIME ZONE 'America/New_York','YYYY-MM') AS period FROM first_customer_commissions c WHERE c.collection_method='cash' AND c.status='accrued' AND to_char(c.earned_at AT TIME ZONE 'America/New_York','YYYY-MM')<$1 ORDER BY period,c.business_id LIMIT 100",[easternMonth(now)])).rows;
 for(const m of months)await prepareCashStatement(pool,m.business_id,m.period);
 const statements=(await db.query("SELECT * FROM commission_monthly_statements WHERE status IN ('draft','open','failed') AND (checked_at IS NULL OR checked_at<now()-interval '1 hour') ORDER BY checked_at NULLS FIRST,period LIMIT 100")).rows;
 for(const s of statements)try{await issueCashStatement(db,s,origin,api);}catch{console.warn('Cash commission statement needs reconciliation.');}
 }finally{if(locked)await db.query('SELECT pg_advisory_unlock(81371082)');db.release();}
}
export function startCashCommissionWorker(){const key=Symbol.for('selahflow.cash.commission.worker');if(globalThis[key])return;let busy=false;const run=async()=>{if(busy)return;busy=true;try{const origin=process.env.APP_URL||process.env.RENDER_EXTERNAL_URL;if(origin)await sweepCashBilling(getPool(),{origin});}catch{console.warn('Cash commission billing sweep unavailable.');}finally{busy=false;}};globalThis[key]=setInterval(run,300000);globalThis[key].unref?.();setTimeout(run,1000).unref?.();}
