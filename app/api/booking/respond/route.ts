import {getPool} from '../../../../server/database.mjs';
import {tokenHash,validOrigin,trustedOrigin} from '../../../../server/security.mjs';
import {reviewPendingRequest} from '../../../../lib/booking-review-actions';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'};
async function getContext(req:Request){
 const token=req.headers.get('authorization')?.replace(/^Bearer\s+/i,'')||'';
 if(!/^[a-f0-9]{64}$/.test(token))throw Error('INVALID_LINK');
 const pool=getPool();
 const result=await pool.query("SELECT t.id,t.reviewer,t.expires_at,r.id AS request_id,r.owner_id,r.reviewer AS assigned_reviewer,r.status,r.date,r.start_minute,r.duration,r.details,b.name AS business_name,s.data AS settings_data FROM booking_action_tokens t JOIN booking_requests r ON r.id=t.request_id JOIN businesses b ON b.id=r.business_id JOIN settings s ON s.owner=r.owner_id WHERE t.token_hash=$1 AND t.expires_at>now() AND b.status='active'",[tokenHash(token)]);
 const row=result.rows[0];if(!row)throw Error('INVALID_LINK');
 const config=JSON.parse(row.settings_data||'{}');
 if(row.reviewer!==row.assigned_reviewer||config.bookingApprovalReviewer!==row.assigned_reviewer||config.bookingApprovalEnabled!==true||row.reviewer!=='owner'&&!config.staff?.some((m:{id:string})=>m.id===row.reviewer))throw Error('INVALID_LINK');
 return row;
}
export async function GET(req:Request){try{const r=await getContext(req);const d=JSON.parse(r.details);return Response.json({id:r.request_id,status:r.status,business:r.business_name,date:r.date,start:r.start_minute,duration:r.duration,services:d.services,customer:d.customerName,price:d.quotedPrice},{headers});}catch{return Response.json({error:'This booking review link is invalid, expired, or no longer assigned.'},{status:403,headers});}}
export async function POST(req:Request){
 if(!validOrigin(req))return Response.json({error:'Invalid request origin.'},{status:403,headers});
 try{const r=await getContext(req);
  const text=await req.text();if(text.length>500)throw Error('Invalid request.');
  const input=JSON.parse(text);if(typeof input.accept!=='boolean')throw Error('Choose Accept or Decline.');
  if(r.status!=='pending')return Response.json({error:'This booking has already been reviewed.',status:r.status},{status:409,headers});
  const result=await reviewPendingRequest(r.owner_id,r.request_id,r.reviewer,input.accept,trustedOrigin(req));
  return Response.json(result,{headers});
 }catch(e){const msg=(e as Error).message;return Response.json({error:msg==='INVALID_LINK'?'Review link expired or invalid.':msg},{status:msg==='INVALID_LINK'?403:409,headers});}
}
