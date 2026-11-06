import {easternClock,appointmentData} from './session-scheduling.mjs';
import {refreshMemberPeriod} from './membership-periods.mjs';
import {hasUsableMembership} from './member-badge-state.mjs';
import {membershipAllows} from './membership-eligibility.mjs';
import {loadOwnerMemberRoster,ownerAppointmentMember} from './owner-appointment-members.mjs';
import {assertBookingWaiver} from './participation-waivers.mjs';
import {randomUUID} from 'node:crypto';

export function sessionHasEnded(visit,clock=easternClock()){
 return /^\d{4}-\d{2}-\d{2}$/.test(visit.date||'')&&(visit.date<clock.date||visit.date===clock.date&&Number(visit.start)+Number(visit.duration)<=clock.minutes);
}
export function pastSessionOverride(input,{isPublic=false,isTeam=false,clock=easternClock()}={}){
 if(input.pastSessionOverride!==true)return null;
 if(isPublic||isTeam)throw Error('Only the business owner can override a past session.');
 if(input.action==='availability'){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(input.date||'')||input.date>clock.date)throw Error('Choose today or an earlier date for a past booking.');
  return {reason:'',ownerOverride:true};
 }
 const reason=String(input.overrideReason||'').trim();
 if(reason.length<5||reason.length>500)throw Error('Enter an override reason of 5–500 characters.');
 if(!sessionHasEnded(input,clock))throw Error('Choose a session that has already ended.');
 return {reason,ownerOverride:true};
}
const eligibleStatuses=new Set(['Confirmed','Scheduled','Checked in','Checked-in','Completed','Attended','No-show']);
async function selectedMember(db,owner,businessId,id){
 const member=(await db.query("SELECT m.*,p.credit_eligibility FROM customer_memberships m JOIN businesses b ON b.id=m.business_id JOIN membership_plans p ON p.id=m.plan_id AND p.business_id=m.business_id WHERE b.owner_id=$1 AND b.id=$2 AND b.status='active' AND m.id=$3 FOR UPDATE OF m",[owner,businessId,id])).rows[0];
 if(!member?.member_number)throw Error('Choose a member in this business.');
 return member;
}
export async function pastMemberVisits(db,{owner,businessId,id}){
 const member=await selectedMember(db,owner,businessId,id),roster=await loadOwnerMemberRoster(db,owner);
 const visits=(await db.query('SELECT id,date,start,duration,status,data FROM appointments WHERE owner=$1 AND date<=$2 ORDER BY date DESC,start DESC',[owner,easternClock().date])).rows;
 const used=new Set((await db.query("SELECT appointment_id FROM membership_session_ledger WHERE business_id=$1 AND event_type='session_used'",[businessId])).rows.map(r=>r.appointment_id));
 return visits.filter(v=>eligibleStatuses.has(v.status)&&sessionHasEnded(v)&&!used.has(v.id)&&ownerAppointmentMember(appointmentData(v),roster).memberNumber===member.member_number).slice(0,200).map(v=>({id:v.id,date:v.date,start:v.start,status:v.status,services:appointmentData(v).services||[]}));
}
/** Owner-only caller holds an open transaction. Override spends today's balance,
 * never rewrites activation dates or old monthly credit snapshots. */
export async function applyPastMemberCredit(db,{owner,businessId,id,appointmentId,reason,attendance='Checked in'}){
 reason=String(reason||'').trim();
 if(reason.length<5||reason.length>500)throw Error('Enter an override reason of 5–500 characters.');
 if(!['Checked in','No-show'].includes(attendance))throw Error('Choose attendance for this past visit.');
 await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[owner+':schedule']);
 await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[businessId+':payment:'+appointmentId]);
 let member=await selectedMember(db,owner,businessId,id);
 const visit=(await db.query('SELECT * FROM appointments WHERE owner=$1 AND id=$2 FOR UPDATE',[owner,appointmentId])).rows[0];
 if(!visit||!eligibleStatuses.has(visit.status)||!sessionHasEnded(visit))throw Error('Choose an existing past visit that has not been canceled.');
 const data=appointmentData(visit),roster=await loadOwnerMemberRoster(db,owner);
 if(ownerAppointmentMember(data,roster).memberNumber!==member.member_number)throw Error('This visit does not belong to the selected member.');
 const prior=(await db.query("SELECT membership_id FROM membership_session_ledger WHERE business_id=$1 AND appointment_id=$2 AND event_type='session_used'",[businessId,appointmentId])).rows[0];
 if(prior){if(prior.membership_id!==id)throw Error('A different membership already paid for this visit.');return {ok:true,alreadyDeducted:true};}
 member=await refreshMemberPeriod(db,member);
 if(!member.initial_paid_at||!hasUsableMembership(member))throw Error('An active, paid membership with remaining sessions is required.');
 if(data.membershipCreditAllowed===false||!membershipAllows(member.credit_eligibility,{serviceIds:data.serviceIds||[],sessionId:data.sessionId}))throw Error('This membership does not cover the selected service or session.');
 const payment=(await db.query("SELECT 1 FROM booking_payments WHERE business_id=$1 AND booking_id=$2 AND status IN ('pending','paid')",[businessId,appointmentId])).rows.length;
 const cash=(await db.query("SELECT 1 FROM events WHERE owner=$1 AND kind='cash_sale' AND data::jsonb->>'bookingId'=$2",[owner,appointmentId])).rows.length;
 if(payment||cash||data.paymentStatus==='paid'||data.paymentIntentId)throw Error('Resolve this booking’s existing payment or open checkout before applying membership credits.');
 const settings=(await db.query('SELECT data FROM settings WHERE owner=$1',[owner])).rows[0]?.data;
 const config=typeof settings==='string'?JSON.parse(settings):settings||{};
 await assertBookingWaiver(db,{owner,config,serviceIds:data.serviceIds||[],memberNumber:member.member_number});
 const reserved=(await db.query(`SELECT id FROM appointments a WHERE owner=$1 AND status NOT IN ('Cancelled','No-show') AND id<>$2 AND data::jsonb->>'memberNumber'=$3 AND data::jsonb->>'membershipCovered'='true' AND ($4::boolean OR date>=$5 AND date<$6) AND NOT EXISTS(SELECT 1 FROM membership_session_ledger l WHERE l.business_id=$7 AND l.appointment_id=a.id AND l.event_type='session_used') UNION SELECT id FROM booking_requests WHERE owner_id=$1 AND status='pending' AND details::jsonb->>'memberNumber'=$3 AND details::jsonb->>'membershipCovered'='true' AND ($4::boolean OR date>=$5 AND date<$6)`,[owner,appointmentId,member.member_number,member.billing_type==='package'||!member.credit_period_start||!member.credit_period_end,String(member.credit_period_start instanceof Date?member.credit_period_start.toISOString():member.credit_period_start||'').slice(0,10),String(member.credit_period_end instanceof Date?member.credit_period_end.toISOString():member.credit_period_end||'').slice(0,10),businessId])).rows.length;
 if(Number(member.sessions_used)+reserved>=Number(member.sessions_included))throw Error('No unreserved membership sessions remain. Existing bookings retain their credits.');
 const previousStatus=visit.status,newStatus=['Confirmed','Scheduled'].includes(visit.status)?attendance:visit.status;
 await db.query("INSERT INTO membership_session_ledger(id,business_id,membership_id,appointment_id,event_type,session_delta) VALUES($1,$2,$3,$4,'session_used',-1)",[randomUUID(),businessId,id,appointmentId]);
 await db.query('UPDATE customer_memberships SET sessions_used=sessions_used+1,updated_at=now() WHERE business_id=$1 AND id=$2',[businessId,id]);
 const override={remaining:Number(member.sessions_included)-Number(member.sessions_used)-1,owner,reason,recordedAt:new Date().toISOString(),visitDate:visit.date,creditPeriodStart:member.credit_period_start,creditPeriodEnd:member.credit_period_end,previousStatus};
 await db.query('UPDATE appointments SET status=$1,data=$2 WHERE owner=$3 AND id=$4',[newStatus,JSON.stringify({...data,memberNumber:member.member_number,membershipCovered:true,price:0,originalPrice:data.originalPrice??data.price,pastMembershipOverride:override}),owner,appointmentId]);
 if(newStatus==='No-show')await db.query('DELETE FROM slots WHERE owner=$1 AND appointment=$2',[owner,appointmentId]);
 await db.query("INSERT INTO events(id,owner,created,kind,data) VALUES($1,$2,$3,'past_membership_override',$4)",[randomUUID(),owner,override.recordedAt,JSON.stringify({...override,appointment:appointmentId,membershipId:id,sessionDelta:-1})]);
 return {ok:true,remaining:Number(member.sessions_included)-Number(member.sessions_used)-1};
}
