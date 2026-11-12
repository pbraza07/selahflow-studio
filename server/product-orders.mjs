import {randomUUID} from 'node:crypto';
import {commissionEmail,commissionPhone} from './commission-contact-evidence.mjs';
import {issueMemberId} from './member-id-policy.mjs';
import {ensureMemberBookingIdentity} from './shared-member-identity.mjs';
import {reserveCommission,attachCommissionSession,settleCommission} from './first-customer-commissions.mjs';
import {accrueCashCommission,cashBillingInfo} from './cash-commission-billing.mjs';
import {assertTestPayment,checkoutUrl,readyMerchant} from './stripe-checkout.mjs';
import {productTaxQuote,productStripeApi,productAddress} from './product-tax.mjs';
export const productUuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
export function productCart(input){
 if(!Array.isArray(input)||!input.length||input.length>20||input.some(l=>!productUuid(l?.id)||!Number.isInteger(l.qty)||l.qty<1||l.qty>50)||new Set(input.map(l=>l.id)).size!==input.length)throw Error('Choose between 1 and 20 products, with quantities from 1 to 50.');
 return input.map(({id,qty})=>({id,qty}));
}
export async function productClient(db,business,input){
 const name=typeof input.name==='string'?input.name.trim().replace(/\s+/g,' '):'',email=commissionEmail(input.email),phone=commissionPhone(input.phone),number=typeof input.memberNumber==='string'?input.memberNumber.trim().toUpperCase():'';
 if(name.length>100||name.split(' ').length<2||!name)throw Error('Enter your first and last name.');
 if(!email&&!phone&&!number||input.email&&!email||input.phone&&!phone||number&&!/^[A-Z]{2}([0-9]{4}|[0-9]{6})$/.test(number))throw Error('Enter a valid phone number, email, or Member / Client ID before checkout.');
 await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[business.id+':member-id-allocation']);
 const profiles=(await db.query(`WITH contacts AS (
  SELECT member_number,name,email,phone FROM business_client_profiles WHERE owner=$2 AND deleted_at IS NULL
  UNION ALL SELECT member_number,first_name||' '||last_name,email,phone FROM customer_booking_ids WHERE business_id=$1
  UNION ALL SELECT member_number,customer_name,customer_email,customer_phone FROM customer_memberships WHERE business_id=$1
 ) SELECT p.member_number,p.name,p.email,p.phone FROM contacts p JOIN business_member_ids r ON r.business_id=$1 AND r.member_number=p.member_number AND r.retired_at IS NULL WHERE lower(regexp_replace(btrim(p.name),'\\s+',' ','g'))=lower($3)`,[business.id,business.owner_id,name])).rows;
 const matches=[...new Map(profiles.filter(p=>number?p.member_number===number:email&&commissionEmail(p.email)===email||phone&&commissionPhone(p.phone)===phone).map(p=>[p.member_number,p])).values()];
 if(matches.length>1||number&&matches.length!==1)throw Error('We could not uniquely match those details. Check your name and Client ID or contact the business.');
 if(matches.length===1)return {memberNumber:matches[0].member_number,name,email};
 const registrationIdentity=randomUUID(),memberNumber=await issueMemberId(db,{businessId:business.id,name,dateOfBirth:'',registrationIdentity});
 const words=name.split(' ');
 await ensureMemberBookingIdentity(db,{businessId:business.id,ownerId:business.owner_id,firstName:words[0],lastName:words.slice(1).join(' '),email,phone,dateOfBirth:'',memberNumber,registrationIdentity,source:'Product checkout'});
 return {memberNumber,name,email};
}
export function publicProductOrder(order){return {id:order.id,status:order.status,submitted:!!order.submitted_at,lines:order.lines,subtotalCents:order.subtotal_cents,taxCents:order.tax_cents,totalCents:order.total_cents,paymentMethod:order.payment_method,checkoutUrl:order.status==='pending'?order.checkout_url:null};}
export async function quoteProductOrder(db,business,input,api=productStripeApi){
 if(!productUuid(input.key)||!['stripe','cash','zelle'].includes(input.paymentMethod))throw Error('Choose a payment method and retry checkout.');
 await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[business.id+':product-request:'+input.key]);
 const prior=(await db.query('SELECT * FROM product_orders WHERE business_id=$1 AND request_key=$2',[business.id,input.key])).rows[0];
 if(prior)return publicProductOrder(prior);
 const cart=productCart(input.cart),products=(await db.query('SELECT id,name,price_cents,tax_code FROM business_products WHERE business_id=$1 AND archived=false AND id=ANY($2::uuid[])',[business.id,cart.map(l=>l.id)])).rows;
 if(products.length!==cart.length)throw Error('A product is no longer available. Review your cart.');
 const lines=cart.map(l=>{const p=products.find(p=>p.id===l.id);return {...l,name:p.name,priceCents:p.price_cents,taxCode:p.tax_code};});
 if(lines.reduce((n,l)=>n+l.qty*l.priceCents,0)>10000000)throw Error('The maximum product order is $100,000.');
 const customer=await productClient(db,business,input),address=productAddress(input.address);
 const {calculation,account,shop,subtotal}=await productTaxQuote(db,business,lines,address,api);
 const order=(await db.query('INSERT INTO product_orders(business_id,request_key,member_number,customer_name,customer_email,customer_address,pickup_location_id,lines,subtotal_cents,tax_cents,total_cents,payment_method,stripe_account_id,tax_calculation_id,tax_expires_at) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8::jsonb,$9,$10,$11,$12,$13,$14,to_timestamp($15)) RETURNING *',[business.id,input.key,customer.memberNumber,customer.name,customer.email,JSON.stringify(address),shop.stripe_location_id,JSON.stringify(lines),subtotal,calculation.tax_amount_exclusive,calculation.amount_total,input.paymentMethod,account,calculation.id,calculation.expires_at])).rows[0];
 return publicProductOrder(order);
}
export async function submitProductOrder(db,business,input,origin,api=productStripeApi){
 if(!productUuid(input.key))throw Error('Invalid checkout reference.');
 await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[business.id+':product-request:'+input.key]);
 const order=(await db.query('SELECT * FROM product_orders WHERE business_id=$1 AND request_key=$2 FOR UPDATE',[business.id,input.key])).rows[0];
 if(!order||order.status!=='pending')throw Error('This checkout is no longer pending.');
 if(input.expectedTotal!==order.total_cents)throw Error('Review the total including tax before continuing.');
 if(order.checkout_url)return publicProductOrder(order);
 if(Date.now()-new Date(order.created_at).getTime()>30*60*1000)throw Error('This checkout quote expired. Start a new checkout to review the current products and tax.');
 const currentAccount=await readyMerchant(db,business.id,api);
 const shop=(await db.query('SELECT stripe_account_id,stripe_location_id FROM product_shop_settings WHERE business_id=$1',[business.id])).rows[0];
 if(currentAccount!==order.stripe_account_id||shop?.stripe_account_id!==order.stripe_account_id||shop?.stripe_location_id!==order.pickup_location_id)throw Error('The business payment or pickup setup changed. Start a new checkout.');
 const available=(await db.query('SELECT id FROM business_products WHERE business_id=$1 AND archived=false AND id=ANY($2::uuid[])',[business.id,order.lines.map(l=>l.id)])).rows;
 if(available.length!==order.lines.length)throw Error('A product is no longer available. Start a new checkout.');
 if(!order.tax_expires_at||new Date(order.tax_expires_at)<=new Date())throw Error('This tax quote expired. Start a new checkout to review current tax.');
 if(order.payment_method!=='stripe'){
  const billing=await cashBillingInfo(db,business.id);
  if(!billing.configured||!billing.authorized)throw Error('On-site product checkout is not available yet. The business must complete monthly product commission billing setup.');
  await db.query('UPDATE product_orders SET submitted_at=COALESCE(submitted_at,now()) WHERE id=$1',[order.id]);
  await db.query("INSERT INTO events(id,owner,created,kind,data) VALUES($1,$2,$3,'product_order',$4) ON CONFLICT(id) DO NOTHING",[order.id,business.owner_id,new Date().toISOString(),JSON.stringify({name:order.customer_name,email:order.customer_email,memberNumber:order.member_number,orderId:order.id,total:order.total_cents/100,payment:order.payment_method,lines:order.lines})]);
  return {...publicProductOrder(order),submitted:true};
 }
 const claim=await reserveCommission(db,{businessId:business.id,kind:'product',memberNumber:order.member_number,sourceId:order.id,account:order.stripe_account_id,grossCents:order.total_cents,eligibleCents:order.subtotal_cents},api);
 const params={mode:'payment',client_reference_id:order.id,customer_email:order.customer_email||undefined,'automatic_tax[enabled]':true,'automatic_tax[liability][type]':'self','metadata[selahflow_product_order]':order.id,'metadata[selahflow_business_id]':business.id,'metadata[commission_claim_id]':claim?.id,'payment_intent_data[application_fee_amount]':claim?.fee_cents,'payment_intent_data[metadata][selahflow_product_order]':order.id,success_url:origin+'/shop/'+business.slug+'?payment=returned',cancel_url:origin+'/shop/'+business.slug+'?payment=canceled',expires_at:Math.floor(Date.now()/1000)+1800};
 // Persist tax location on Stripe Products; Checkout uses its native Tax integration.
 params.expires_at=Math.floor(new Date(order.created_at).getTime()/1000)+3600;
 params.integration_identifier='selahflow_products_'+order.id.replaceAll('-','').slice(0,8).replace(/[0-9a-f]/g,c=>String.fromCharCode(97+parseInt(c,16)));
 for(let i=0;i<order.lines.length;i++){
  const l=order.lines[i],product=await api('products',{account:order.stripe_account_id,idempotencyKey:'product-order-'+order.id+'-'+i,params:{name:l.name,'tax_details[tax_code]':l.taxCode,'tax_details[performance_location]':order.pickup_location_id}});
  const prefix='line_items['+i+']';Object.assign(params,{[prefix+'[price_data][currency]']:'usd',[prefix+'[price_data][unit_amount]']:l.priceCents,[prefix+'[price_data][tax_behavior]']:'exclusive',[prefix+'[price_data][product]']:product.id,[prefix+'[quantity]']:l.qty});
 }
 const session=await api('checkout/sessions',{account:order.stripe_account_id,idempotencyKey:'product-checkout-'+order.id,params});assertTestPayment(session);
 const url=checkoutUrl(session);
 await attachCommissionSession(db,claim,session);
 await db.query('UPDATE product_orders SET stripe_checkout_session_id=$1,checkout_url=$2,commission_id=$3,submitted_at=COALESCE(submitted_at,now()),updated_at=now() WHERE id=$4 AND business_id=$5',[session.id,url,claim?.id||null,order.id,business.id]);
 return {...publicProductOrder(order),checkoutUrl:url};
}
async function recordProductPayment(db,business,order){
 await db.query("UPDATE product_orders SET status='paid',paid_at=COALESCE(paid_at,now()),updated_at=now() WHERE id=$1 AND business_id=$2",[order.id,business.id]);
 const event={productOrderId:order.id,name:order.customer_name,email:order.customer_email,memberNumber:order.member_number,lines:order.lines.map(l=>({id:l.id,name:l.name,type:'product',qty:l.qty,price:l.priceCents/100})),total:order.total_cents/100,tax:order.tax_cents/100,payment:order.payment_method==='stripe'?'Stripe':order.payment_method==='zelle'?'Zelle':'Cash',providerReference:order.stripe_payment_intent_id||undefined};
 await db.query("INSERT INTO events(id,owner,created,kind,data) VALUES($1,$2,$3,'cash_sale',$4) ON CONFLICT(id) DO NOTHING",[order.id+'-payment',business.owner_id,new Date().toISOString(),JSON.stringify(event)]);
}
export async function confirmProductCash(db,business,input,api=productStripeApi){
 if(!productUuid(input.id)||input.received!==true)throw Error('Confirm that you received the full payment.');
 const order=(await db.query('SELECT * FROM product_orders WHERE id=$1 AND business_id=$2 FOR UPDATE',[input.id,business.id])).rows[0];
 if(!order||!order.submitted_at||!['cash','zelle'].includes(order.payment_method))throw Error('Choose an unpaid cash or Zelle product order.');
 if(order.paid_at)return {ok:true};
 if(order.status!=='pending')throw Error('This order is no longer awaiting payment.');
 if(await readyMerchant(db,business.id,api)!==order.stripe_account_id)throw Error('The business payment account changed. Review this order before recording receipt.');
 if(!order.tax_expires_at||new Date(order.tax_expires_at)<=new Date())throw Error('Tax quote expired. Cancel this unpaid order and ask the client to review a new checkout.');
 const account=order.stripe_account_id,calculation={id:order.tax_calculation_id};
 const claim=await accrueCashCommission(db,{businessId:business.id,kind:'product',memberNumber:order.member_number,sourceId:order.id,grossCents:order.total_cents,eligibleCents:order.subtotal_cents},api);
 const transaction=await api('tax/transactions/create_from_calculation',{account,idempotencyKey:'product-tax-paid-'+order.id,params:{calculation:calculation.id,reference:order.id}});
 if(!/^tax_[a-zA-Z0-9]+$/.test(transaction.id||''))throw Error('Tax transaction could not be verified.');
 await db.query('UPDATE product_orders SET tax_calculation_id=$1,tax_transaction_id=$2,commission_id=$3 WHERE id=$4 AND business_id=$5',[calculation.id,transaction.id,claim?.id||null,order.id,business.id]);
 await recordProductPayment(db,business,order);return {ok:true};
}
export async function applyProductPayment(db,businessId,account,session,api=productStripeApi){
 if(session.payment_status!=='paid')return false;
 const order=(await db.query('SELECT * FROM product_orders WHERE id=$1 AND business_id=$2 AND stripe_account_id=$3 AND stripe_checkout_session_id=$4 FOR UPDATE',[session.metadata?.selahflow_product_order,businessId,account,session.id])).rows[0];
 if(!order)throw Error('Product checkout awaits reconciliation.');
 if(order.paid_at)return true;
 assertTestPayment(session);
 const tax=session.total_details?.amount_tax,total=session.amount_total;
 if(session.currency!=='usd'||session.amount_subtotal!==order.subtotal_cents||!Number.isSafeInteger(tax)||tax<0||!Number.isSafeInteger(total)||total!==order.subtotal_cents+tax||session.automatic_tax?.status!=='complete'||typeof session.payment_intent!=='string')throw Error('Product payment total or tax requires reconciliation.');
 const intent=await api('payment_intents/'+session.payment_intent+'?expand[]=latest_charge',{method:'GET',account});assertTestPayment(intent);
 if(intent.status!=='succeeded'||intent.currency!=='usd'||intent.amount_received!==total)throw Error('Product payment is awaiting Stripe verification.');
 // Native Checkout displays and collects its final tax. Preserve the original quote
 // while accepting a provider-verified tax change; merchandise and fee cannot change.
 await db.query('UPDATE product_orders SET quoted_tax_cents=COALESCE(quoted_tax_cents,tax_cents),quoted_total_cents=COALESCE(quoted_total_cents,total_cents),tax_cents=$1,total_cents=$2 WHERE id=$3 AND business_id=$4',[tax,total,order.id,businessId]);
 await db.query("UPDATE first_customer_commissions SET gross_cents=$1 WHERE id=$2 AND business_id=$3 AND source_id=$4 AND status='reserved'",[total,order.commission_id,businessId,order.id]);
 await settleCommission(db,{businessId,account,session},api);
 await db.query('UPDATE product_orders SET stripe_payment_intent_id=$1 WHERE id=$2',[session.payment_intent,order.id]);
 const business=(await db.query('SELECT id,owner_id FROM businesses WHERE id=$1',[businessId])).rows[0];
 await recordProductPayment(db,business,{...order,tax_cents:tax,total_cents:total,stripe_payment_intent_id:session.payment_intent});
 const refunded=Number(intent.latest_charge?.amount_refunded||0);
 if(Number.isSafeInteger(refunded)&&refunded>0&&refunded<=total)await db.query("UPDATE product_orders SET refunded_cents=$1,status=CASE WHEN $1=total_cents THEN 'refunded' ELSE 'partially_refunded' END WHERE id=$2 AND business_id=$3",[refunded,order.id,businessId]);
 return true;
}
