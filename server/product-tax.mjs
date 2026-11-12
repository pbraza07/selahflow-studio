import {createHash} from 'node:crypto';
import {stripeApi} from './membership-payments.mjs';
import {readyMerchant,assertTestPayment} from './stripe-checkout.mjs';
import {PRODUCT_TERMS,PRODUCT_TERMS_TEXT} from './product-catalog.mjs';
export const productStripeApi=(path,options={})=>stripeApi(path,{...options,apiVersion:'2026-09-30.endive'});
export function productAddress(input){
 const address={};for(const key of ['line1','line2','city','state','postal_code','country'])address[key]=typeof input?.[key]==='string'?input[key].trim():'';
 address.country=address.country.toUpperCase();address.state=address.state.toUpperCase();
 if(!address.line1||!address.city||!address.state||!address.postal_code||!/^[A-Z]{2}$/.test(address.country)||Object.values(address).some(x=>x.length>150))throw Error('Enter the complete business pickup address, including country and postal code.');
 return address;
}
export async function verifyProductTax(account,address,api=productStripeApi){
 const settings=await api('tax/settings',{method:'GET',account});
 if(settings.status!=='active')throw Error('Complete Stripe Tax settings on this business’s Stripe account before accepting product orders.');
 const registrations=await api('tax/registrations?status=active&limit=100',{method:'GET',account});
 const registered=registrations.data?.some(r=>r.status==='active'&&r.country===address.country&&(address.country!=='US'||r.country_options?.us?.state===address.state));
 if(!registered)throw Error('No active Stripe Tax registration was found for the business pickup location. Review the business’s tax setup before opening checkout.');
 return settings;
}
export async function saveProductShop(db,business,input,api=productStripeApi){
 if(input.accepted!==true||input.businessTaxLiability!==true)throw Error('Confirm the business’s tax responsibility and product commission terms before opening checkout.');
 const address=productAddress(input.address),account=await readyMerchant(db,business.id,api);
 await verifyProductTax(account,address,api);
 const params={type:'performance',description:business.name+' · Product pickup'};
 for(const [key,value] of Object.entries(address))if(value)params['address['+key+']']=value;
 const location=await api('tax/locations',{account,params,idempotencyKey:'product-location-'+business.id+'-'+createHash('sha256').update(JSON.stringify([account,address])).digest('hex').slice(0,24)});
 if(!/^taxloc_[a-zA-Z0-9]+$/.test(location.id||''))throw Error('Stripe could not verify the pickup location.');
 await db.query('INSERT INTO product_shop_settings(business_id,address,stripe_account_id,stripe_location_id,terms_version,terms_snapshot,accepted_by) VALUES($1,$2::jsonb,$3,$4,$5,$6,$7) ON CONFLICT(business_id) DO UPDATE SET address=excluded.address,stripe_account_id=excluded.stripe_account_id,stripe_location_id=excluded.stripe_location_id,terms_version=excluded.terms_version,terms_snapshot=excluded.terms_snapshot,accepted_by=excluded.accepted_by,accepted_at=now()',[business.id,JSON.stringify(address),account,location.id,PRODUCT_TERMS,PRODUCT_TERMS_TEXT,business.owner_id]);
 await db.query("INSERT INTO events(id,owner,created,kind,data) VALUES(gen_random_uuid()::text,$1,$2,'product_shop_authorization',$3)",[business.owner_id,new Date().toISOString(),JSON.stringify({termsVersion:PRODUCT_TERMS,terms:PRODUCT_TERMS_TEXT,address,account,actor:business.owner_id})]);
 return {ok:true};
}
export async function productTaxQuote(db,business,lines,customerAddress,api=productStripeApi){
 const shop=(await db.query('SELECT * FROM product_shop_settings WHERE business_id=$1',[business.id])).rows[0];
 if(shop?.terms_version!==PRODUCT_TERMS)throw Error('This business has not opened product checkout yet.');
 const account=await readyMerchant(db,business.id,api);
 if(account!==shop.stripe_account_id)throw Error('The business must verify product tax setup for its current Stripe account.');
 await verifyProductTax(account,shop.address,api);
 const params={currency:'usd','customer_details[address_source]':'billing','expand[0]':'line_items'};
 for(const [key,value] of Object.entries(productAddress(customerAddress)))if(value)params['customer_details[address]['+key+']']=value;
 lines.forEach((line,i)=>{const prefix='line_items['+i+']';Object.assign(params,{[prefix+'[amount]']:line.priceCents*line.qty,[prefix+'[reference]']:line.id,[prefix+'[quantity]']:line.qty,[prefix+'[tax_behavior]']:'exclusive',[prefix+'[tax_code]']:line.taxCode,[prefix+'[performance_location]']:shop.stripe_location_id});});
 const calculation=await api('tax/calculations',{account,params});assertTestPayment(calculation);
 const subtotal=lines.reduce((n,l)=>n+l.priceCents*l.qty,0);
 if(!/^taxcalc_[a-zA-Z0-9]+$/.test(calculation.id||'')||!Number.isSafeInteger(calculation.amount_total)||!Number.isSafeInteger(calculation.tax_amount_exclusive)||calculation.amount_total!==subtotal+calculation.tax_amount_exclusive)throw Error('Tax calculation could not be verified. Please try again.');
 if(calculation.tax_breakdown?.some(t=>t.taxability_reason==='not_collecting'))throw Error('Stripe is not collecting tax for this purchase. The business must review its registrations and product tax category.');
 return {shop,account,calculation,subtotal};
}
