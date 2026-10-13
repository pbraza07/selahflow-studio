/**
 * Charge one prepaid membership session per appointment, regardless of whether
 * it was checked in, marked no-show, or completed later.
 *
 * Caller must hold an open transaction and the appointment's FOR UPDATE lock.
 * The member row lock and unique session_used ledger event make retries and
 * parallel requests idempotent.
 */
export const CREDIT_CONSUMING_STATUSES=new Set(['Checked in','No-show','Completed']);

export async function debitAppointmentMembershipSession(client,{owner,memberNumber,appointmentId,status,ledgerId}){
 const number=String(memberNumber||'').trim().toUpperCase();
 if(!CREDIT_CONSUMING_STATUSES.has(status)||!number){
  return {deducted:false,alreadyDeducted:false,memberFound:false,remaining:null};
 }
 const result=await client.query(
  "SELECT m.id,m.status,m.sessions_included,m.sessions_used,b.id AS business_id FROM customer_memberships m JOIN businesses b ON b.id=m.business_id WHERE b.owner_id=$1 AND m.member_number=$2 FOR UPDATE OF m",
  [owner,number]
 );
 const member=result.rows[0];
 if(!member)return {deducted:false,alreadyDeducted:false,memberFound:false,remaining:null};
 if(member.status!=='active')return {deducted:false,alreadyDeducted:false,memberFound:true,active:false,remaining:null};
 const remaining=Number(member.sessions_included)-Number(member.sessions_used);
 const prior=await client.query(
  "SELECT 1 FROM membership_session_ledger WHERE business_id=$1 AND membership_id=$2 AND appointment_id=$3 AND event_type='session_used' LIMIT 1",
  [member.business_id,member.id,appointmentId]
 );
 if(prior.rowCount)return {deducted:false,alreadyDeducted:true,memberFound:true,active:true,remaining:Math.max(0,remaining)};
 if(remaining<=0)throw Error('No membership sessions remaining. Renew or adjust this player\'s membership before checking in or marking no-show.');
 const inserted=await client.query(
  "INSERT INTO membership_session_ledger(id,business_id,membership_id,appointment_id,event_type,session_delta) VALUES($1,$2,$3,$4,'session_used',-1) ON CONFLICT DO NOTHING RETURNING id",
  [ledgerId,member.business_id,member.id,appointmentId]
 );
 if(!inserted.rowCount)return {deducted:false,alreadyDeducted:true,memberFound:true,active:true,remaining};
 const updated=await client.query(
  "UPDATE customer_memberships SET sessions_used=sessions_used+1,updated_at=now() WHERE business_id=$1 AND id=$2 AND sessions_used<sessions_included RETURNING sessions_used,sessions_included",
  [member.business_id,member.id]
 );
 if(!updated.rowCount)throw Error('Unable to deduct the membership session. Please retry.');
 return {deducted:true,alreadyDeducted:false,memberFound:true,active:true,
  remaining:Math.max(0,Number(updated.rows[0].sessions_included)-Number(updated.rows[0].sessions_used))};
}
