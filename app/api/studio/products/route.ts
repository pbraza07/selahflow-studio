import {requireOwner} from '../../../../lib/auth';
import {supportActor} from '../../../../server/platform-support.mjs';
import {getPool} from '../../../../server/database.mjs';
import {validOrigin} from '../../../../server/security.mjs';
import {catalogAllowance,productCatalog,saveProduct,validateProduct,PRODUCT_TERMS_TEXT} from '../../../../server/product-catalog.mjs';
import {saveProductShop,productStripeApi} from '../../../../server/product-tax.mjs';
import {confirmProductCash,productUuid} from '../../../../server/product-orders.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
async function context(req:Request){const owner=await requireOwner(req),pool=getPool();const business=(await pool.query("SELECT id,owner_id,name,slug FROM businesses WHERE owner_id=$1 AND status='active'",[owner])).rows[0];if(!business)throw Error('Business unavailable.');return {pool,business};}
const fail=(e:unknown)=>{const message=(e as Error).message;return Response.json({error:message==='AUTH_REQUIRED'?'Sign in to manage products.':message},{status:message==='AUTH_REQUIRED'?401:400,headers});};
export async function GET(req:Request){try{const {pool,business}=await context(req);
 const [products,allowance,shop,orders]=await Promise.all([productCatalog(pool,business.id,{includeArchived:true}),catalogAllowance(pool,business),pool.query('SELECT address,accepted_at FROM product_shop_settings WHERE business_id=$1',[business.id]),pool.query('SELECT id,member_number,customer_name,lines,total_cents,tax_cents,payment_method,status,created_at,paid_at,refunded_cents FROM product_orders WHERE business_id=$1 AND submitted_at IS NOT NULL ORDER BY created_at DESC LIMIT 200',[business.id])]);
 return Response.json({products,allowance,shop:shop.rows[0]||null,orders:orders.rows,slug:business.slug,terms:PRODUCT_TERMS_TEXT},{headers});
 }catch(e){return fail(e);}}
export async function POST(req:Request){if(!validOrigin(req))return Response.json({error:'Invalid origin.'},{status:403,headers});try{
 const {pool,business}=await context(req),raw=await req.text();if(raw.length>16000)throw Error('Request too large.');const input=JSON.parse(raw),db=await pool.connect();
 try{await db.query('BEGIN');let result;
 if(input.action==='saveShop'){const actor=await supportActor(pool,req);if(actor.id!==business.owner_id)throw Error('Only the signed-in business owner can accept product payment and tax authorization.');result=await saveProductShop(db,business,input);}
 else if(input.action==='confirmPayment')result=await confirmProductCash(db,business,input);
 else if(input.action==='cancelOrder'){
  if(!productUuid(input.id))throw Error('Choose an order.');
  const order=(await db.query('SELECT * FROM product_orders WHERE business_id=$1 AND id=$2 FOR UPDATE',[business.id,input.id])).rows[0];
  if(!order||order.status!=='pending')throw Error('Choose an unpaid order.');
  if(order.stripe_checkout_session_id){const session=await productStripeApi('checkout/sessions/'+order.stripe_checkout_session_id,{method:'GET',account:order.stripe_account_id});if(session.status!=='expired'){if(session.status!=='open'||session.payment_status==='paid')throw Error('This payment is processing or paid. Wait for Stripe to confirm it.');const expired=await productStripeApi('checkout/sessions/'+session.id+'/expire',{account:order.stripe_account_id,idempotencyKey:'product-expire-'+order.id});if(expired.status!=='expired')throw Error('Stripe did not confirm expiration.');}}
  await db.query("UPDATE product_orders SET status='canceled',updated_at=now() WHERE id=$1 AND business_id=$2",[order.id,business.id]);
  await db.query("UPDATE first_customer_commissions SET status='expired',updated_at=now() WHERE id=$1 AND business_id=$2 AND status='reserved'",[order.commission_id,business.id]);result={ok:true};
 }else if(['save','archive'].includes(input.action)){
  if(input.id&&!productUuid(input.id))throw Error('Choose a valid product.');
  if(input.action==='save')validateProduct(input);
  result=await saveProduct(db,business,input);
 }else throw Error('Choose a product action.');
 await db.query('COMMIT');return Response.json(result,{headers});
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
 }catch(e){return fail(e);}}
