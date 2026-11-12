import {getPool} from '../../../../server/database.mjs';
import {requireOwner} from '../../../../lib/auth';
import {validOrigin} from '../../../../server/security.mjs';
import {compressProductImage} from '../../../../server/product-catalog.mjs';
import {productUuid} from '../../../../server/product-orders.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:Request){const id=new URL(req.url).searchParams.get('id');if(!productUuid(id))return new Response(null,{status:404});const row=(await getPool().query("SELECT p.image FROM business_products p JOIN businesses b ON b.id=p.business_id WHERE p.id=$1 AND p.archived=false AND b.status='active'",[id])).rows[0];return row?.image?new Response(new Uint8Array(row.image),{headers:{'Content-Type':'image/webp','X-Content-Type-Options':'nosniff','Cache-Control':'public, max-age=300'}}):new Response(null,{status:404});}
export async function POST(req:Request){if(!validOrigin(req))return Response.json({error:'Invalid origin.'},{status:403});try{const owner=await requireOwner(req);
 if(Number(req.headers.get('content-length'))>6*1024*1024)throw Error('Choose an image smaller than 5 MB.');const form=await req.formData(),id=String(form.get('id')),file=form.get('image');
 if(!productUuid(id)||!(file instanceof File)||file.size>5*1024*1024)throw Error('Choose a product and image smaller than 5 MB.');
 const pool=getPool(),row=(await pool.query("SELECT p.id FROM business_products p JOIN businesses b ON b.id=p.business_id WHERE p.id=$1 AND b.owner_id=$2 AND b.status='active' AND p.archived=false",[id,owner])).rows[0];if(!row)throw Error('Choose a product from this business.');
 const bytes=await compressProductImage(Buffer.from(await file.arrayBuffer()));
 await pool.query('UPDATE business_products SET image=$1,updated_at=now() WHERE id=$2 AND business_id=(SELECT id FROM businesses WHERE owner_id=$3)',[bytes,id,owner]);return Response.json({ok:true,bytes:bytes.length},{headers:{'Cache-Control':'no-store'}});
 }catch(e){const msg=(e as Error).message;return Response.json({error:msg==='AUTH_REQUIRED'?'Sign in to upload product pictures.':msg},{status:msg==='AUTH_REQUIRED'?401:400});}}
