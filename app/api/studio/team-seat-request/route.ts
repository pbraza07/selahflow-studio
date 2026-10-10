import {randomUUID} from 'node:crypto';
import {getPool} from '../../../../server/database.mjs';
import {requireOwner} from '../../../../lib/auth';
import {validOrigin} from '../../../../server/security.mjs';
import {teamSeatRequestInput,MAX_AD_HOC_TEAM_SEATS,approvedTeamSeatCount} from '../../../../server/team-seat-policy.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const response=(body:unknown,status=200)=>Response.json(body,{status,headers});
const errorResponse=(e:unknown)=>{
 const msg=(e as Error).message;
 if(msg==='AUTH_REQUIRED')return response({error:'Please sign in.'},401);
 if(msg==='PASSWORD_CHANGE_REQUIRED')return response({error:'Change your temporary password first.'},403);
 if(/already|pending|limit|only|more than/i.test(msg))return response({error:msg},409);
 if(/invalid|enter|valid|name|reason/i.test(msg))return response({error:msg},400);
 console.error('Team seat owner request failed',e);
 return response({error:'Unable to process team member request.'},503);
};
export async function GET(req:Request){
 try{
  const owner=await requireOwner(req),pool=getPool();
  const business=(await pool.query(
   "SELECT id FROM businesses WHERE owner_id=$1 AND status='active'",[owner])).rows[0];
  if(!business)return response({error:'Active business required.'},403);
  const requests=(await pool.query(
   "SELECT id,team_member_name,reason,status,review_note,created_at,reviewed_at FROM business_team_seat_requests WHERE business_id=$1 ORDER BY created_at DESC LIMIT 60",
   [business.id])).rows;
  const extraSeats=await approvedTeamSeatCount(pool,business.id);
  return response({requests,extraSeats,pending:requests.some((x:any)=>x.status==='pending')});
 }catch(e){return errorResponse(e);}
}
export async function POST(req:Request){
 if(!validOrigin(req))return response({error:'Invalid request origin.'},403);
 let client:any;
 try{
  const owner=await requireOwner(req);
  const raw=await req.text();if(raw.length>1800)return response({error:'Request too large.'},413);
  const body=JSON.parse(raw),action=body.action;
  if(!['submit','withdraw'].includes(action))return response({error:'Unknown team member request action.'},400);
  const pool=getPool();client=await pool.connect();
  await client.query('BEGIN');
  const business=(await client.query(
   "SELECT id,owner_id FROM businesses WHERE owner_id=$1 AND status='active' FOR UPDATE",
   [owner])).rows[0];
  if(!business){await client.query('ROLLBACK');return response({error:'Active business required.'},403);}
  if(action==='withdraw'){
   if(typeof body.id!=='string'||!/^[a-f0-9-]{36}$/i.test(body.id))
    throw Error('Invalid request identifier.');
   const result=await client.query(
    "UPDATE business_team_seat_requests SET status='withdrawn',updated_at=now() WHERE id=$1 AND business_id=$2 AND status='pending' RETURNING id",
    [body.id,business.id]);
   if(!result.rowCount)throw Error('Only pending requests may be withdrawn.');
   await client.query('COMMIT');return response({ok:true,status:'withdrawn'});
  }
  const input=teamSeatRequestInput(body);
  if((await client.query(
   "SELECT 1 FROM business_team_seat_requests WHERE business_id=$1 AND status='pending'",
   [business.id])).rowCount)throw Error('A team member request is already pending. Wait for platform administrator review.');
  const active=await approvedTeamSeatCount(client,business.id);
  if(active>=MAX_AD_HOC_TEAM_SEATS)throw Error('Ad hoc team seat limit reached. Contact your platform administrator.');
  const id=randomUUID();
  await client.query(
   "INSERT INTO business_team_seat_requests(id,business_id,requested_by,team_member_name,reason) VALUES($1,$2,$3,$4,$5)",
   [id,business.id,owner,input.teamMemberName,input.reason]);
  await client.query('COMMIT');
  return response({ok:true,id,status:'pending',message:'Your request was sent to the platform administrator for review. No charge or subscription upgrade was created.'},201);
 }catch(e){
  if(client)try{await client.query('ROLLBACK');}catch{}
  if((e as {code?:string}).code==='23505')return response({error:'A request is already awaiting review.'},409);
  return errorResponse(e);
 }finally{client?.release();}
}
