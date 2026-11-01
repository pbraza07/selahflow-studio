import {assertRequestReviewer} from '../../../../server/booking-review-access.mjs';
import {teamReviewContext} from '../../../../server/team-review-context.mjs';
import {customRegistrationFields} from '../../../../server/registration-questions.mjs';
import {getPool} from '../../../../server/database.mjs';
import {validOrigin,trustedOrigin} from '../../../../server/security.mjs';
import {reviewPendingRequest} from '../../../../lib/booking-review-actions';
import {editPendingRequest} from '../../../../server/booking-review-edits.mjs';
import {approvalFieldsForBusiness,sessionReviewSummary} from '../../../../server/booking-approval-display.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'};
const context=(req:Request)=>teamReviewContext(getPool(),req);
export async function GET(req:Request){try{const {pool,link,cfg,canReview,teamAccountId}=await context(req);
 if(!canReview)return Response.json({canReview:false,pending:[]},{headers});
 const pending=(await pool.query("SELECT id,date,staff_id,start_minute,duration,details,reviewer,status,created_at::text AS created_at FROM booking_requests WHERE business_id=$1 AND (($3::boolean AND staff_id=$2) OR (NOT $3::boolean AND reviewer=$2)) AND status='pending' ORDER BY created_at DESC LIMIT 100",[link.business_id,link.staff_id,!!teamAccountId])).rows.map((r:{details:string;[key:string]:unknown})=>{const {details,...rest}=r;return {...rest,details:JSON.parse(details)};});
 const confirmed=pending.length?(await pool.query("SELECT date,staff,start,duration,status,data FROM appointments WHERE owner=$1 AND date BETWEEN $2 AND $3 AND status NOT IN ('Cancelled','No-show') AND data LIKE '%sessionId%'",[link.owner_id,pending.reduce((d:string,r:{date:string})=>r.date<d?r.date:d,pending[0].date),pending.reduce((d:string,r:{date:string})=>r.date>d?r.date:d,pending[0].date)])).rows:[];
 return Response.json({canReview:true,businessName:link.business_name,teamMember:cfg.staff.find((s:{id:string})=>s.id===link.staff_id)?.name,
 pending:pending.map((r:any)=>({...r,sessionInfo:sessionReviewSummary(cfg,r,confirmed,pending)})),
 approvalFields:approvalFieldsForBusiness(cfg),customFields:customRegistrationFields(cfg,'booking').map((f:{id:string;label:string;type:string;options?:string[];required:boolean})=>({id:f.id,label:f.label,type:f.type,options:f.options||[],required:f.required})),
 team:cfg.staff.map((s:{id:string;name:string})=>({id:s.id,name:s.name}))},{headers});
 }catch{return Response.json({error:'This review link is invalid, expired, revoked, or no longer assigned.'},{status:403,headers});}}
export async function POST(req:Request){if(!validOrigin(req))return Response.json({error:'Invalid request origin.'},{status:403,headers});
 try{const {pool,link,canReview,teamAccountId}=await context(req);if(!canReview)throw Error('ACCESS_DENIED');
 const raw=await req.text();if(raw.length>25000)throw Error('Invalid request.');
 const b=JSON.parse(raw);
 const request=(await pool.query("SELECT id,business_id,owner_id,staff_id,reviewer,status FROM booking_requests WHERE id=$1 AND business_id=$2 AND owner_id=$3 AND status='pending'",[String(b.id||''),link.business_id,link.owner_id])).rows[0];if(!request)throw Error('This booking request has already been reviewed or is unavailable.');await assertRequestReviewer(pool,request,link.staff_id,teamAccountId);
 if(b.action==='editBooking')return Response.json(await editPendingRequest(link.owner_id,String(b.id||''),link.staff_id,b.details,teamAccountId),{headers});
 if(b.action!=='review'||typeof b.accept!=='boolean')throw Error('Invalid review action.');
 const result=await reviewPendingRequest(link.owner_id,String(b.id||''),link.staff_id,b.accept,trustedOrigin(req),teamAccountId);
 return Response.json(result,{headers});
 }catch(e){const m=(e as Error).message;return Response.json({error:m==='ACCESS_DENIED'?'Team review link expired or revoked.':m},{status:m==='ACCESS_DENIED'?403:409,headers});}}
