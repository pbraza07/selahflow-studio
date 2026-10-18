import {selectedSession,bookedSessionCount,overlaps,appointmentData as storedAppointmentData} from './session-scheduling.mjs';
import {loadOwnerMemberRoster,ownerAppointmentMember} from './owner-appointment-members.mjs';

/**
 * Charge one prepaid membership session per appointment, regardless of whether
 * it was checked in or marked no-show. Legacy completion never debits credits.
 *
 * Caller must hold an open transaction and the appointment's FOR UPDATE lock.
 * The member row lock and unique session_used ledger event make retries and
 * parallel requests idempotent.
 */
export const CREDIT_CONSUMING_STATUSES=new Set(['Checked in','No-show']);

export async function debitAppointmentMembershipSession(client,{owner,memberNumber,appointmentId,status,ledgerId,creditAllowed=true}){
 const number=String(memberNumber||'').trim().toUpperCase();
 if(!CREDIT_CONSUMING_STATUSES.has(status)||!number||creditAllowed===false){
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
 if(remaining<=0)return {deducted:false,alreadyDeducted:false,memberFound:true,active:false,exhausted:true,remaining:0};
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

/** Call within an open SQL transaction: status, audit, and membership debit commit together. */
export async function changeAppointmentStatus(client,{owner,appointmentId,status,eventId,ledgerId,createdAt}){
 await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[owner+':schedule']);
 if(!['Checked in','Completed','Cancelled','No-show'].includes(status))throw Error('Invalid appointment status.');
 const appointment=(await client.query(
  'SELECT * FROM appointments WHERE owner=$1 AND id=$2 FOR UPDATE',
  [owner,appointmentId]
 )).rows[0];
 if(!appointment)return {notFound:true};
 if(appointment.status===status)return {ok:true,alreadyProcessed:true,membershipDeducted:false};
 const attendanceCorrection=appointment.status==='No-show'&&status==='Checked in';
 if(['Completed','Cancelled','No-show'].includes(appointment.status)&&!attendanceCorrection)throw Error('This appointment is already closed.');
 let memberNumber='';
 let appointmentData={};
 try{
  appointmentData=typeof appointment.data==='string'?JSON.parse(appointment.data||'{}'):appointment.data||{};
  memberNumber=String(appointmentData.memberNumber||'').trim().toUpperCase();
 }catch{}
 // Older bookings did not always store an ID, although the client already had
 // one. Link only when full name and email identify exactly one player.
 if(!memberNumber&&String(appointmentData.name||appointmentData.customerName||'').trim()&&String(appointmentData.email||appointmentData.customerEmail||'').trim()){
  const roster=await loadOwnerMemberRoster(client,owner);
  memberNumber=ownerAppointmentMember(appointmentData,roster).memberNumber;
  if(memberNumber){
   await client.query('UPDATE appointments SET data=$1 WHERE owner=$2 AND id=$3',
    [JSON.stringify({...appointmentData,memberNumber}),owner,appointmentId]);
  }
 }
 // Reinstating a no-show must restore capacity safely before changing attendance.
 if(attendanceCorrection&&appointment.staff&&appointment.date){
  const settings=(await client.query('SELECT data FROM settings WHERE owner=$1',[owner])).rows[0]?.data;
  const config=typeof settings==='string'?JSON.parse(settings):settings||{};
  const services=(config.services||[]).filter(s=>(appointmentData.serviceIds||[]).includes(s.id));
  const session=selectedSession(config,appointment.date,appointment.staff,services,appointment.start);
  const others=(await client.query("SELECT * FROM appointments WHERE owner=$1 AND date=$2 AND id<>$3 AND status NOT IN ('Cancelled','No-show')",[owner,appointment.date,appointmentId])).rows;
  const buffer=Number(config.buffer)||0;
  if(others.some(a=>a.staff===appointment.staff&&overlaps(appointment.start,appointment.duration+buffer,a.start,a.duration+buffer)&&(!session||storedAppointmentData(a).sessionId!==session.id)))throw Error('This time has been rebooked. Resolve the conflicting appointment before correcting attendance.');
  if(session&&bookedSessionCount(others,session.id)>=session.capacity)throw Error('This session is now full. Resolve capacity before correcting attendance.');
  if(!session)for(let minute=appointment.start;minute<appointment.start+appointment.duration+buffer;minute+=15)await client.query('INSERT INTO slots(owner,date,staff,minute,appointment) VALUES($1,$2,$3,$4,$5)',[owner,appointment.date,appointment.staff,minute,appointmentId]);
 }
 const usage=await debitAppointmentMembershipSession(client,{
  owner,memberNumber,appointmentId,status,ledgerId,creditAllowed:appointmentData.membershipCreditAllowed!==false
 });
 await client.query('UPDATE appointments SET status=$1 WHERE owner=$2 AND id=$3',[status,owner,appointmentId]);
 if(status==='Cancelled'||status==='No-show')
  await client.query('DELETE FROM slots WHERE owner=$1 AND appointment=$2',[owner,appointmentId]);
 await client.query(
  "INSERT INTO events(id,owner,created,kind,data) VALUES($1,$2,$3,'status',$4) ON CONFLICT DO NOTHING",
  [eventId,owner,createdAt,JSON.stringify({
   appointment:appointmentId,previousStatus:appointment.status,attendanceCorrection:attendanceCorrection||(appointment.status==='Checked in'&&status==='No-show'),status,memberNumber:memberNumber||null,
   membershipDeducted:usage.deducted,alreadyDeducted:usage.alreadyDeducted,
   membershipSessionsRemaining:usage.remaining,membershipExhausted:usage.exhausted===true
  })]
 );
 return {ok:true,membershipDeducted:usage.deducted,alreadyDeducted:usage.alreadyDeducted,
  memberFound:usage.memberFound,membershipSessionsRemaining:usage.remaining,
  membershipExhausted:usage.exhausted===true,memberNumber:memberNumber||null};
}
