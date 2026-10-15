import {customRegistrationFields} from '../../../../server/registration-questions.mjs';
import {getPool} from '../../../../server/database.mjs';
import {tokenHash,validOrigin,trustedOrigin} from '../../../../server/security.mjs';
import {reviewPendingRequest} from '../../../../lib/booking-review-actions';
import {editPendingRequest} from '../../../../server/booking-review-edits.mjs';
import {approvalFieldsForBusiness,sessionReviewSummary} from '../../../../server/booking-approval-display.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'};
async function context(req:Request){
 const token=req.headers.get('authorization')?.replace(/^Bearer\s+/i,'')||'';
 if(!/^[a-f0-9]{64}$/.test(token))throw Error('ACCESS_DENIED');
 const pool=getPool();
 const link=(await pool.query("SELECT l.business_id,l.staff_id,b.owner_id,s.data AS settings_data,b.name AS business_name FROM booking_review_links l JOIN businesses b ON b.id=l.business_id JOIN settings s ON s.owner=b.owner_id WHERE l.token_hash=$1 AND l.expires_at>now() AND b.status='active'",[tokenHash(token)])).rows[0];
 if(!link)throw Error('ACCESS_DENIED');
 const cfg=JSON.parse(link.settings_data||'{}');
 if(cfg.bookingApprovalEnabled!==true||cfg.bookingApprovalReviewer!==link.staff_id||!cfg.staff?.some((s:{id:string})=>s.id===link.staff_id))throw Error('ACCESS_DENIED');
 return {pool,link,cfg};
}
export async function GET(req:Request){try{const {pool,link,cfg}=await context(req);
 const pending=(await pool.query("SELECT id,date,staff_id,start_minute,duration,details,reviewer,status,created_at::text AS created_at FROM booking_requests WHERE business_id=$1 AND reviewer=$2 AND status='pending' ORDER BY created_at DESC LIMIT 100",[link.business_id,link.staff_id])).rows.map((r:{details:string;[key:string]:unknown})=>{const {details,...rest}=r;return {...rest,details:JSON.parse(details)};});
 const confirmed=pending.length?(await pool.query("SELECT date,staff,start,duration,status,data FROM appointments WHERE owner=$1 AND date BETWEEN $2 AND $3 AND status NOT IN ('Cancelled','No-show') AND data LIKE '%sessionId%'",[link.owner_id,pending.reduce((d:string,r:{date:string})=>r.date<d?r.date:d,pending[0].date),pending.reduce((d:string,r:{date:string})=>r.date>d?r.date:d,pending[0].date)])).rows:[];
 return Response.json({businessName:link.business_name,teamMember:cfg.staff.find((s:{id:string})=>s.id===link.staff_id)?.name,
 pending:pending.map((r:any)=>({...r,sessionInfo:sessionReviewSummary(cfg,r,confirmed,pending)})),
 approvalFields:approvalFieldsForBusiness(cfg),customFields:customRegistrationFields(cfg,'booking').map((f:{id:string;label:string;type:string;options?:string[];required:boolean})=>({id:f.id,label:f.label,type:f.type,options:f.options||[],required:f.required})),
 team:cfg.staff.map((s:{id:string;name:string})=>({id:s.id,name:s.name}))},{headers});
 }catch{return Response.json({error:'This review link is invalid, expired, revoked, or no longer assigned.'},{status:403,headers});}}
export async function POST(req:Request){if(!validOrigin(req))return Response.json({error:'Invalid request origin.'},{status:403,headers});
 try{const {link}=await context(req);
 const raw=await req.text();if(raw.length>25000)throw Error('Invalid request.');
 const b=JSON.parse(raw);if(b.action==='editBooking')return Response.json(await editPendingRequest(link.owner_id,String(b.id||''),link.staff_id,b.details),{headers});
 if(b.action!=='review'||typeof b.accept!=='boolean')throw Error('Invalid review action.');
 const result=await reviewPendingRequest(link.owner_id,String(b.id||''),link.staff_id,b.accept,trustedOrigin(req));
 return Response.json(result,{headers});
 }catch(e){const m=(e as Error).message;return Response.json({error:m==='ACCESS_DENIED'?'Team review link expired or revoked.':m},{status:m==='ACCESS_DENIED'?403:409,headers});}}
