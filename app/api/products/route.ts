import {getPool} from '../../../server/database.mjs';
import {validOrigin,trustedOrigin,tokenHash} from '../../../server/security.mjs';
import {productCatalog} from '../../../server/product-catalog.mjs';
import {quoteProductOrder,submitProductOrder,publicProductOrder,productUuid} from '../../../server/product-orders.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
async function businessFor(slug:unknown){if(typeof slug!=='string'||!/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(slug))throw Error('Business unavailable.');const row=(await getPool().query("SELECT id,owner_id,name,slug FROM businesses WHERE slug=$1 AND status='active'",[slug])).rows[0];if(!row)throw Error('Business unavailable.');return row;}
export async function GET(req:Request){try{const business=await businessFor(new URL(req.url).searchParams.get('business')),pool=getPool(),shop=(await pool.query('SELECT address FROM product_shop_settings WHERE business_id=$1',[business.id])).rows[0];return Response.json({name:business.name,products:await productCatalog(pool,business.id),pickupAddress:shop?.address||null},{headers});}catch{return Response.json({error:'Products unavailable.'},{status:404,headers});}}
export async function POST(req:Request){if(!validOrigin(req))return Response.json({error:'Invalid origin.'},{status:403,headers});try{
 const raw=await req.text();if(raw.length>16000)throw Error('Request too large.');const input=JSON.parse(raw),business=await businessFor(input.business),pool=getPool();
 const ip=(req.headers.get('x-forwarded-for')||'unknown').split(',').at(-1)!.trim(),key='product-checkout:'+business.id+':'+tokenHash(ip);
 const limit=(await pool.query("INSERT INTO public_limits(key,count,window_start) VALUES($1,1,now()) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN public_limits.window_start<now()-interval '15 minutes' THEN 1 ELSE public_limits.count+1 END,window_start=CASE WHEN public_limits.window_start<now()-interval '15 minutes' THEN now() ELSE public_limits.window_start END RETURNING count",[key])).rows[0];if(limit.count>30)return Response.json({error:'Too many checkout requests. Please try again later.'},{status:429,headers});
 const db=await pool.connect();try{await db.query('BEGIN');let result;
 if(input.action==='quote')result=await quoteProductOrder(db,business,input);
 else if(input.action==='submit')result=await submitProductOrder(db,business,input,trustedOrigin(req));
 else if(input.action==='status'&&productUuid(input.key)){const order=(await db.query('SELECT * FROM product_orders WHERE business_id=$1 AND request_key=$2',[business.id,input.key])).rows[0];if(!order)throw Error('Checkout not found.');result=publicProductOrder(order);}
 else throw Error('Choose a checkout action.');
 await db.query('COMMIT');return Response.json(result,{headers});}catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
 }catch(e){return Response.json({error:(e as Error).message},{status:400,headers});}}
