import {requireOwner} from '../../../../lib/auth';
import {getPool} from '../../../../server/database.mjs';
import {trustedOrigin} from '../../../../server/security.mjs';
import {bookingQr} from '../../../../server/booking-qr.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:Request){
 const headers={'Cache-Control':'private, no-store'};
 try{
  const owner=await requireOwner(req),business=(await getPool().query("SELECT slug FROM businesses WHERE owner_id=$1 AND status='active'",[owner])).rows[0];
  if(!business)return Response.json({error:'Active business not found.'},{status:404,headers});
  const query=new URL(req.url).searchParams,format=query.get('format')||'svg';
  if(!['svg','png'].includes(format))return Response.json({error:'Choose SVG or PNG.'},{status:400,headers});
  const qr=await bookingQr({slug:business.slug,origin:trustedOrigin(req),format});
  return new Response(typeof qr.body==='string'?qr.body:new Uint8Array(qr.body),{headers:{...headers,'Content-Type':qr.type,'Content-Disposition':(query.get('download')==='1'?'attachment':'inline')+'; filename="'+business.slug+'-booking-qr.'+format+'"','Content-Security-Policy':"default-src 'none'; sandbox",'X-Content-Type-Options':'nosniff'}});
 }catch(e){return Response.json({error:(e as Error).message==='AUTH_REQUIRED'?'Please sign in.':'Unable to generate booking QR code.'},{status:(e as Error).message==='AUTH_REQUIRED'?401:503,headers});}
}
