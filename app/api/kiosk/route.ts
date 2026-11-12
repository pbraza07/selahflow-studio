import {getPool} from '../../../server/database.mjs';
import {validOrigin} from '../../../server/security.mjs';
import {kioskContext,kioskLimit,kioskLookup,kioskCheckIn,kioskMemberStatus,kioskWaiver,kioskSignWaiver,kioskCookie,kioskMarker} from '../../../server/kiosk.mjs';
const headers={'Cache-Control':'private, no-store'};
const fail=(e:unknown)=>{const message=(e as Error).message;return Response.json({error:message==='KIOSK_REQUIRED'?'Ask the business owner to enable this tablet.':message},{status:message==='KIOSK_REQUIRED'?401:400,headers});};
export const dynamic='force-dynamic';export const runtime='nodejs';
export async function GET(req:Request){try{const db=getPool(),ctx=await kioskContext(db,req,new URL(req.url).searchParams.get('business'));
 await db.query("UPDATE kiosk_devices SET expires_at=now()+interval '90 days' WHERE id=$1",[ctx.device_id]);
 const h=new Headers(headers);h.append('Set-Cookie',kioskCookie(ctx.slug,ctx.token));h.append('Set-Cookie',kioskMarker(ctx.slug));
 return Response.json({ready:true,autoNoShow:ctx.auto_no_show_enabled},{headers:h});}catch(e){return fail(e);}}
export async function POST(req:Request){if(!validOrigin(req))return Response.json({error:'Invalid origin.'},{status:403,headers});let db;try{
 const raw=await req.text();if(raw.length>8000)throw Error('Request too large.');const input=JSON.parse(raw),pool=getPool(),ctx=await kioskContext(pool,req,input.business);
 await kioskLimit(pool,ctx.device_id,'requests');
 db=await pool.connect();await db.query('BEGIN');let result;
 if(input.action==='lookup')result=await kioskLookup(db,ctx,input);
 else if(input.action==='checkin')result=await kioskCheckIn(db,ctx,input);
 else if(input.action==='membership')result=await kioskMemberStatus(db,ctx,input);
 else if(input.action==='waiver')result=await kioskWaiver(db,ctx,input);
 else if(input.action==='signWaiver')result=await kioskSignWaiver(db,ctx,input,req);
 else if(input.action==='reset'){await db.query('DELETE FROM kiosk_grants WHERE device_id=$1',[ctx.device_id]);result={ok:true};}
 else throw Error('Choose an action.');
 await db.query('COMMIT');return Response.json(result,{headers});
 }catch(e){if(db)await db.query('ROLLBACK');return fail(e);}finally{db?.release();}}
