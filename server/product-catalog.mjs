import sharp from 'sharp';
import {planEntitlements} from './plan-entitlements.mjs';

export const PRODUCT_TERMS='product-first-client-10-percent-v1';
export const PRODUCT_TERMS_TEXT='I am authorized to act for this business. I accept a SelahFlow commission of 10% of the product subtotal, excluding tax, on each client’s first paid product order at this business, with no minimum fee and no commission on later product orders. This is separate from session and membership commissions. Stripe deducts the commission from the first online product payment. For cash and Zelle, I additionally authorize collection through the business’s verified monthly cash-commission billing card and statement, under its existing schedule and retry terms. This product authorization supplements the earlier exclusion of retail products; it does not change session or membership fees. No product commission applies before this acceptance. I confirm this business is responsible for collecting and remitting tax on these sales and that the saved pickup address and selected product tax categories are correct. Orders are for pickup at this business, not shipping.';
export function validateProduct(input){
 const name=typeof input.name==='string'?input.name.trim():'',description=typeof input.description==='string'?input.description.trim():'';
 if(!name||name.length>100||description.length>600)throw Error('Enter a product name (up to 100 characters) and description (up to 600).');
 if(!Number.isSafeInteger(input.priceCents)||input.priceCents<50||input.priceCents>10000000)throw Error('Enter a product price between $0.50 and $100,000.');
 if(!/^txcd_[0-9]{8}$/.test(input.taxCode||''))throw Error('Select the Stripe tax category that applies to this product.');
 return {name,description,priceCents:input.priceCents,taxCode:input.taxCode};
}
export async function compressProductImage(source){
 if(!Buffer.isBuffer(source)||source.length<32||source.length>5*1024*1024)throw Error('Choose a JPG, PNG or WebP image smaller than 5 MB.');
 const meta=await sharp(source,{limitInputPixels:25000000,animated:false}).metadata();
 if(!['jpeg','png','webp'].includes(meta.format)||meta.pages>1)throw Error('Choose a still JPG, PNG or WebP image.');
 for(const width of [1000,800,600]){
  const bytes=await sharp(source,{limitInputPixels:25000000,animated:false}).rotate().resize({width,height:width,fit:'inside',withoutEnlargement:true}).webp({quality:78,effort:4}).toBuffer();
  if(bytes.length<=250000)return bytes;
 }
 throw Error('This picture is too detailed. Choose a smaller image.');
}
export async function catalogAllowance(db,business){
 const row=(await db.query('SELECT s.plan_code,s.status,o.limits FROM business_subscriptions s LEFT JOIN business_entitlement_overrides o ON o.business_id=s.business_id WHERE s.business_id=$1',[business.id])).rows[0];
 const limit=Number.isInteger(row?.limits?.services)?row.limits.services:planEntitlements(row?.plan_code,row?.status).limits.services;
 const settings=(await db.query('SELECT data FROM settings WHERE owner=$1',[business.owner_id])).rows[0];
 const services=(settings?JSON.parse(settings.data).services:[])||[];
 const products=Number((await db.query('SELECT count(*)::int AS count FROM business_products WHERE business_id=$1 AND archived=false',[business.id])).rows[0].count);
 return {limit,services:services.length,products,used:services.length+products};
}
export async function productCatalog(db,businessId,{includeArchived=false}={}){
 return (await db.query('SELECT id,name,description,price_cents,tax_code,archived,image IS NOT NULL AS has_image,updated_at FROM business_products WHERE business_id=$1 AND ($2 OR archived=false) ORDER BY created_at,id',[businessId,includeArchived])).rows;
}
export async function saveProduct(db,business,input){
 // Same lock as service settings: concurrent service/product additions cannot exceed the package.
 await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[business.owner_id+':schedule']);
 const old=input.id?(await db.query('SELECT id,archived FROM business_products WHERE id=$1 AND business_id=$2 FOR UPDATE',[input.id,business.id])).rows[0]:null;
 if(input.id&&!old)throw Error('Choose a product from this business.');
 if(input.action==='archive'){
  if(!old)throw Error('Choose a product.');
  await db.query('UPDATE business_products SET archived=true,updated_at=now() WHERE id=$1 AND business_id=$2',[old.id,business.id]);return {id:old.id};
 }
 const p=validateProduct(input),allowance=await catalogAllowance(db,business);
 if((!old||old.archived)&&allowance.used>=allowance.limit)throw Error('Your package allows '+allowance.limit+' services and products combined. Archive an unused product or change your package.');
 if(old){await db.query('UPDATE business_products SET name=$1,description=$2,price_cents=$3,tax_code=$4,archived=false,updated_at=now() WHERE id=$5 AND business_id=$6',[p.name,p.description,p.priceCents,p.taxCode,old.id,business.id]);return {id:old.id};}
 return (await db.query('INSERT INTO business_products(business_id,name,description,price_cents,tax_code) VALUES($1,$2,$3,$4,$5) RETURNING id',[business.id,p.name,p.description,p.priceCents,p.taxCode])).rows[0];
}
