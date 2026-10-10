import {getPool} from '../../../../server/database.mjs';
import {requireOwner} from '../../../../lib/auth';
import {validOrigin} from '../../../../server/security.mjs';
import {getPlatformRole} from '../../../../server/platform-roles.mjs';
import {teamSeatReviewInput,MAX_AD_HOC_TEAM_SEATS,approvedTeamSeatCount,bookableTeamLimit} from '../../../../server/team-seat-policy.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const response=(data:unknown,status=200)=>Response.json(data,{status,headers});
const fail=(e:unknown)=>{
 const msg=(e as Error).message;
 if(msg==='AUTH_REQUIRED')return response({error:'Please sign in.'},401);
 if(msg==='FORBIDDEN'||msg==='PASSWORD_CHANGE_REQUIRED')return response({error:'Platform administrator access required.'},403);
 if(/already|no longer|limit|only|not pending|must be approved/i.test(msg))return response({error:msg},409);
 if(/choose|invalid|note/i.test(msg))return response({error:msg},400);
 console.error('Platform team seat review failed',e);
 return response({error:'Unable to review team member request.'},503);
};
async function platformAdmin(req:Request){
 const user=await requireOwner(req),pool=getPool(),role=await getPlatformRole(pool,user);
 if(!role)throw Error('FORBIDDEN');
 return {user,role,pool};
}
export async function GET(req:Request){
 try{
  const {pool}=await platformAdmin(req);
  const rows=(await pool.query(
   "SELECT r.id,r.business_id,r.team_member_name,r.reason,r.status,r.review_note,r.created_at,r.reviewed_at,b.name AS business_name,b.slug AS business_slug,b.status AS business_status,u.email AS owner_email,s.plan_code,s.status AS subscription_status,st.data AS studio_data FROM business_team_seat_requests r JOIN businesses b ON b.id=r.business_id JOIN users u ON u.id=b.owner_id LEFT JOIN business_subscriptions s ON s.business_id=b.id LEFT JOIN settings st ON st.owner=b.owner_id ORDER BY CASE r.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,r.created_at DESC LIMIT 200"
  )).rows;
  const seats=(await pool.query(
   "SELECT business_id,COUNT(*)::int AS count FROM business_team_seat_requests WHERE status='approved' GROUP BY business_id"
  )).rows;
  const seatMap=new Map(seats.map((s:any)=>[s.business_id,s.count]));
  const requests=rows.map((r:any)=>{
   let staff=0;try{staff=JSON.parse(r.studio_data||'{}')?.staff?.length||0;}catch{}
   return {id:r.id,businessId:r.business_id,businessName:r.business_name,slug:r.business_slug,
    businessStatus:r.business_status,ownerEmail:r.owner_email,teamMemberName:r.team_member_name,
    reason:r.reason,status:r.status,reviewNote:r.review_note,createdAt:r.created_at,reviewedAt:r.reviewed_at,
    planCode:r.plan_code||'free',currentTeam:staff,extraSeats:seatMap.get(r.business_id)||0,
    teamLimit:bookableTeamLimit(r.plan_code,r.subscription_status,seatMap.get(r.business_id)||0)};
  });
  return response({requests,pendingCount:requests.filter((r:any)=>r.status==='pending').length});
 }catch(e){return fail(e);}
}
export async function POST(req:Request){
 if(!validOrigin(req))return response({error:'Invalid request origin.'},403);
 let client:any;
 try{
  const {pool,user}=await platformAdmin(req),raw=await req.text();
  if(raw.length>1600)return response({error:'Request too large.'},413);
  const action=teamSeatReviewInput(JSON.parse(raw));
  client=await pool.connect();
  await client.query('BEGIN');
  const source=(await client.query(
   'SELECT r.id,r.business_id,r.status,b.owner_id,b.status AS business_status FROM business_team_seat_requests r JOIN businesses b ON b.id=r.business_id WHERE r.id=$1',
   [action.id])).rows[0];
  if(!source)throw Error('Invalid team member request.');
  // Synchronize changes with the owner settings writer. Never let a revoked
  // grant race with an in-progress team roster update.
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[source.owner_id+':schedule']);
  const request=(await client.query(
   'SELECT id,business_id,status FROM business_team_seat_requests WHERE id=$1 FOR UPDATE',
   [action.id])).rows[0];
  if(!request)throw Error('Invalid team member request.');
  const expected=action.action==='revoke'?'approved':'pending';
  if(request.status!==expected)throw Error(action.action==='revoke'?'Only an approved extra team seat can be revoked.':'This team seat request is no longer pending.');
  if(action.action==='approve'){
   if(source.business_status!=='active')throw Error('Only active businesses may receive an extra team seat.');
   if(await approvedTeamSeatCount(client,source.business_id)>=MAX_AD_HOC_TEAM_SEATS)
    throw Error('Ad hoc team seat limit reached.');
  }
  const status=action.action==='approve'?'approved':action.action==='decline'?'declined':'revoked';
  await client.query(
   'UPDATE business_team_seat_requests SET status=$1,review_note=$2,reviewed_by=$3,reviewed_at=now(),updated_at=now() WHERE id=$4',
   [status,action.note,user,action.id]);
  await client.query('COMMIT');
  return response({ok:true,status,message:status==='approved'?
   'One additional business-only team slot was granted without changing the subscription or charging the business.':
   status==='revoked'?'Extra seat grant revoked; existing team and booking records remain unchanged.':
   'Request declined. No additional team seat was granted.'});
 }catch(e){if(client)try{await client.query('ROLLBACK');}catch{}return fail(e);}
 finally{client?.release();}
}
