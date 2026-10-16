import {customRegistrationFields} from '../../../../server/registration-questions.mjs';
import {randomBytes} from 'node:crypto';
import {getPool} from '../../../../server/database.mjs';
import {requireOwner} from '../../../../lib/auth';
import {validOrigin,tokenHash,trustedOrigin} from '../../../../server/security.mjs';
import {deliveryProviderStatusWithConnection,notifyBookingRequest} from '../../../../server/notification-delivery.mjs';
import {reviewPendingRequest} from '../../../../lib/booking-review-actions';
import {editPendingRequest} from '../../../../server/booking-review-edits.mjs';
import {approvalFieldsForBusiness,sessionReviewSummary} from '../../../../server/booking-approval-display.mjs';
import {listClientMessages,retryClientMessages} from '../../../../server/booking-client-notifications.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
async function context(req:Request){
 const owner=await requireOwner(req),pool=getPool();
 const business=(await pool.query("SELECT b.id,s.data FROM businesses b JOIN settings s ON s.owner=b.owner_id WHERE b.owner_id=$1 AND b.status='active'",[owner])).rows[0];
 if(!business)throw Error('FORBIDDEN');
 return {owner,pool,business,settings:JSON.parse(business.data||'{}')};
}
function err(e:unknown){const m=(e as Error).message;return Response.json({error:m==='AUTH_REQUIRED'?'Sign in to view booking requests.':m==='FORBIDDEN'?'Business not active.':m},{status:m==='AUTH_REQUIRED'?401:m==='FORBIDDEN'?403:/already|no longer|capacity|available|past|changed/i.test(m)?409:400,headers});}
export async function GET(req:Request){try{const {pool,owner,settings,business}=await context(req);
 const [items,attempts,account]=await Promise.all([
  pool.query("SELECT id,date,staff_id,start_minute,duration,details,reviewer,status,created_at::text AS created_at FROM booking_requests WHERE owner_id=$1 AND status='pending' ORDER BY created_at DESC LIMIT 100",[owner]),
  pool.query("SELECT DISTINCT ON (a.request_id,a.channel) a.request_id,a.channel,a.status,a.destination_masked,a.attempted_at::text AS attempted_at FROM booking_notification_attempts a JOIN booking_requests r ON r.id=a.request_id WHERE r.owner_id=$1 AND r.status='pending' ORDER BY a.request_id,a.channel,a.attempted_at DESC",[owner]),
  pool.query('SELECT email FROM users WHERE id=$1',[owner])
 ]);
 const rows=items.rows.map((r:{details:string;[key:string]:unknown})=>{const {details,...rest}=r;return {...rest,details:JSON.parse(details)};});
 const confirmed=rows.length?(await pool.query("SELECT date,staff,start,duration,status,data FROM appointments WHERE owner=$1 AND date BETWEEN $2 AND $3 AND status NOT IN ('Cancelled','No-show') AND data LIKE '%sessionId%'",[owner,rows.reduce((d:string,r:{date:string})=>r.date<d?r.date:d,rows[0].date),rows.reduce((d:string,r:{date:string})=>r.date>d?r.date:d,rows[0].date)])).rows:[];
 const delivery:Record<string,Record<string,{status:string;destination:string;at:string}>>={};for(const a of attempts.rows){delivery[a.request_id]??={};delivery[a.request_id][a.channel]={status:a.status,destination:a.destination_masked,at:a.attempted_at};}
 return Response.json({enabled:settings.bookingApprovalEnabled===true,reviewer:settings.bookingApprovalReviewer||'owner',
 pending:rows.map((r:any)=>({...r,sessionInfo:sessionReviewSummary(settings,r,confirmed,rows)})),clientMessages:await listClientMessages(pool,owner),
 approvalFields:approvalFieldsForBusiness(settings),
 customFields:customRegistrationFields(settings,'booking').map((f:{id:string;label:string;type:string;options?:string[];required:boolean})=>({id:f.id,label:f.label,type:f.type,options:f.options||[],required:f.required})),pendingCount:rows.length,businessId:business.id,providerStatus:await deliveryProviderStatusWithConnection(pool),accountEmail:account.rows[0]?.email||'',deliveryStatus:delivery},{headers});
 }catch(e){return err(e);}}
export async function POST(req:Request){if(!validOrigin(req))return Response.json({error:'Invalid origin'},{status:403,headers});
 try{
  const {owner,pool,business,settings}=await context(req),raw=await req.text();
  if(raw.length>25000)throw Error('Request too large.');
  const body=JSON.parse(raw);
  if(body.action==='editBooking')return Response.json(await editPendingRequest(owner,String(body.id),'owner',body.details),{headers});
  if(body.action==='review'&&typeof body.accept==='boolean'){
   return Response.json(await reviewPendingRequest(owner,String(body.id), 'owner',body.accept,trustedOrigin(req)),{headers});
  }
  if(body.action==='retryClientMessages')return Response.json(await retryClientMessages(pool,owner,String(body.id||'')),{headers});
  if(body.action==='resendNotification'){
   const id=String(body.id||'');
   if(!/^[a-f0-9-]{36}$/i.test(id))throw Error('Invalid booking request.');
   const pending=(await pool.query("SELECT id FROM booking_requests WHERE id=$1 AND owner_id=$2 AND status='pending'",[id,owner])).rows[0];
   if(!pending)throw Error('Booking request unavailable or already reviewed.');
   const summary=await notifyBookingRequest({requestId:id,origin:trustedOrigin(req)});
   return Response.json({ok:true,delivery:summary},{headers});
  }
  if(body.action==='createStaffLink'){
   const staffId=String(body.staffId||'');
   if(settings.bookingApprovalEnabled!==true||settings.bookingApprovalReviewer!==staffId||!settings.staff?.some((s:{id:string})=>s.id===staffId))throw Error('Enable review and choose this team member in Settings before creating an invite.');
   const token=randomBytes(32).toString('hex');
   await pool.query("INSERT INTO booking_review_links(business_id,staff_id,token_hash,expires_at) VALUES($1,$2,$3,now()+interval '30 days') ON CONFLICT(business_id,staff_id) DO UPDATE SET token_hash=excluded.token_hash,expires_at=excluded.expires_at,created_at=now()",[business.id,staffId,tokenHash(token)]);
   return Response.json({ok:true,url:new URL('/team/review/'+token,req.url).toString(),expiresInDays:30},{headers});
  }
  if(body.action==='revokeStaffLink'){
   const staffId=String(body.staffId||'');
   if(!settings.staff?.some((s:{id:string})=>s.id===staffId))throw Error('Invalid team member.');
   await pool.query('DELETE FROM booking_review_links WHERE business_id=$1 AND staff_id=$2',[business.id,staffId]);
   return Response.json({ok:true},{headers});
  }
  return Response.json({error:'Invalid action.'},{status:400,headers});
 }catch(e){return err(e);}
}
