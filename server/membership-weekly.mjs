import {hasUsableMembership} from './member-badge-state.mjs';
import {membershipAnchor,monthlyPeriod,businessDate} from './membership-periods.mjs';

export function validateWeeklySessions(value){
 if(value===undefined||value===null||value==='')return null;
 if(!Number.isInteger(value)||value<1||value>3)throw Error('Choose one, two or three sessions per week.');
 return value;
}
export function membershipUsageSummary(weekly,monthly,billingType='membership'){
 if(billingType==='package')return `${monthly??0} total sessions. One-time payment; no automatic renewal or monthly reset. Credits remain until used.`;
 return weekly?`${weekly} session${weekly===1?'':'s'} per week. Seven-day weeks start on the membership initial date and restart at each monthly anniversary; a partial fifth week is included. Unused weekly sessions do not roll over.`:`${monthly??0} sessions each membership month. Unused sessions do not roll over.`;
}
// Work in business date labels, avoiding DST shifts and fixed 28/30-day months.
export function weeklyMembershipWindow(member,date){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))throw Error('Choose a valid session date.');
 const at=new Date(date+'T12:00:00Z'),anchor=membershipAnchor(member);
 if(!Number.isFinite(+at)||at.toISOString().slice(0,10)!==date)throw Error('Choose a valid session date.');
 if(!member.initial_paid_at||at<new Date(anchor))throw Error('The session is before the membership initial date.');
 const month=monthlyPeriod(anchor,at),days=Math.round((month.end-month.start)/86400000);
 const index=Math.floor((at-month.start)/604800000);
 const start=new Date(+month.start+index*604800000),end=new Date(Math.min(+start+604800000,+month.end));
 return {start:start.toISOString().slice(0,10),end:end.toISOString().slice(0,10),monthStart:month.start.toISOString().slice(0,10),monthEnd:month.end.toISOString().slice(0,10),weeks:Math.ceil(days/7)};
}
export function membershipBookingActive(member,date){
 if(!member?.weekly_sessions)return hasUsableMembership(member);
 const active=member.status==='active'&&!!member.initial_paid_at&&!!member.paid_through&&date>=membershipAnchor(member).slice(0,10)&&date<businessDate(member.paid_through);
 if(!active)return false;
 // Future prepaid months keep their own allowance even when this month is used.
 const current=member.credit_period_start&&member.credit_period_end&&date>=new Date(member.credit_period_start).toISOString().slice(0,10)&&date<new Date(member.credit_period_end).toISOString().slice(0,10);
 return member.weekly_limit_override!==true||!current||Number(member.sessions_included)>Number(member.sessions_used);
}
export function weeklyMonthCredits(member,weekly,at=new Date()){
 return weekly*weeklyMembershipWindow(member,businessDate(at)).weeks;
}
/** Caller holds the business schedule lock in an open transaction. Pending
 * requests reserve the allowance; cancellation/decline releases it. A no-show
 * continues to count. The appointment date, not check-in time, selects a week. */
/** @param {any} db @param {{owner:string,memberNumber:string,date:string,excludeIds?:string[],existingAppointmentId?:string}} options */
export async function assertWeeklyMembershipBooking(db,{owner,memberNumber,date,excludeIds=[],existingAppointmentId}){
 const member=(await db.query('SELECT m.*,p.weekly_sessions FROM customer_memberships m JOIN businesses b ON b.id=m.business_id JOIN membership_plans p ON p.id=m.plan_id AND p.business_id=m.business_id WHERE b.owner_id=$1 AND m.member_number=$2 FOR UPDATE OF m',[owner,memberNumber])).rows[0];
 if(!member?.weekly_sessions)return member;
 const window=weeklyMembershipWindow(member,date);
 if(member.status!=='active'||!member.paid_through||date>=businessDate(member.paid_through))throw Error('This session is outside the paid membership period. Renew the membership or choose an earlier session.');
 const proofs=(await db.query('SELECT appointment_id,authorized_date FROM membership_weekly_override_bookings WHERE business_id=$1 AND membership_id=$2 AND authorized_date>=$3 AND authorized_date<$4',[member.business_id,member.id,window.monthStart,window.monthEnd])).rows;
 const admitted=existingAppointmentId&&proofs.some(p=>p.appointment_id===existingAppointmentId&&p.authorized_date===date);
 // Once an override admitted a visit in a month, switching it off cannot grant
 // a second allowance on top of sessions already reserved in that month.
 const monthlyAllocation=member.weekly_limit_override===true||proofs.length?await assertMonthAllocation(db,{owner,memberNumber,member,window,excludeIds}):null;
 if(member.weekly_limit_override===true||admitted)return {...member,weeklyWindow:window,weeklyRemaining:null,monthlyAllocation};
 const visits=(await db.query(`SELECT a.id,a.date,a.status,a.data FROM appointments a WHERE a.owner=$1 AND a.date>=$3 AND a.date<$4 AND a.status<>'Cancelled' AND a.data::jsonb->>'memberNumber'=$2 AND (a.data::jsonb->>'membershipCovered'='true' OR EXISTS(SELECT 1 FROM membership_session_ledger l WHERE l.business_id=$5 AND l.membership_id=$6 AND l.appointment_id=a.id AND l.event_type='session_used'))`,[owner,memberNumber,window.start,window.end,member.business_id,member.id])).rows;
 const pending=(await db.query("SELECT id FROM booking_requests WHERE owner_id=$1 AND date>=$3 AND date<$4 AND status='pending' AND details::jsonb->>'memberNumber'=$2 AND details::jsonb->>'membershipCovered'='true'",[owner,memberNumber,window.start,window.end])).rows;
 const count=new Set([...visits,...pending].filter(v=>!excludeIds.includes(v.id)).map(v=>v.id)).size;
 if(count>=member.weekly_sessions)throw Error(`Membership allows ${member.weekly_sessions} session(s) per week. The allowance for ${window.start} through ${window.end} (end date excluded) is already reserved or used.`);
 return {...member,weeklyWindow:window,weeklyRemaining:member.weekly_sessions-count,monthlyAllocation};
}


async function assertMonthAllocation(db,{owner,memberNumber,member,window,excludeIds}){
 const period=(await db.query('SELECT period_start,period_end,sessions_included,sessions_used FROM membership_credit_periods WHERE business_id=$1 AND membership_id=$2 AND period_start::date=$3::date AND period_end::date=$4::date ORDER BY sessions_used DESC,period_start DESC LIMIT 1',[member.business_id,member.id,window.monthStart,window.monthEnd])).rows[0];
 const current=member.credit_period_start&&member.credit_period_end&&new Date(member.credit_period_start).toISOString().slice(0,10)===window.monthStart&&new Date(member.credit_period_end).toISOString().slice(0,10)===window.monthEnd;
 const snapshot=current?member:period;
 const allocation=snapshot?Number(snapshot.sessions_included):member.weekly_sessions*window.weeks;
 const consumed=(await db.query("SELECT DISTINCT l.appointment_id FROM membership_session_ledger l JOIN appointments a ON a.id=l.appointment_id AND a.owner=$1 WHERE l.business_id=$2 AND l.membership_id=$3 AND l.event_type='session_used' AND a.date>=$4 AND a.date<$5",[owner,member.business_id,member.id,window.monthStart,window.monthEnd])).rows;
 const usedIds=new Set(consumed.map(x=>x.appointment_id));
 const used=Math.max(Number(snapshot?.sessions_used)||0,usedIds.size);
 const visits=(await db.query("SELECT a.id FROM appointments a WHERE a.owner=$1 AND a.date>=$3 AND a.date<$4 AND a.status<>'Cancelled' AND a.data::jsonb->>'memberNumber'=$2 AND a.data::jsonb->>'membershipCovered'='true' AND NOT EXISTS(SELECT 1 FROM membership_session_ledger l WHERE l.business_id=$5 AND l.membership_id=$6 AND l.appointment_id=a.id AND l.event_type='session_used')",[owner,memberNumber,window.monthStart,window.monthEnd,member.business_id,member.id])).rows;
 const pending=(await db.query("SELECT id FROM booking_requests WHERE owner_id=$1 AND date>=$3 AND date<$4 AND status='pending' AND details::jsonb->>'memberNumber'=$2 AND details::jsonb->>'membershipCovered'='true'",[owner,memberNumber,window.monthStart,window.monthEnd])).rows;
 const reserved=new Set([...visits,...pending].filter(x=>!excludeIds.includes(x.id)&&!usedIds.has(x.id)).map(x=>x.id)).size;
 if(!Number.isSafeInteger(allocation)||allocation<=0||used+reserved>=allocation)throw Error('No membership sessions remaining for this membership month. Existing bookings and used sessions count toward the allowance.');
 return {included:allocation,used,periodStart:period?.period_start?new Date(period.period_start).toISOString():window.monthStart+'T12:00:00Z',periodEnd:period?.period_end?new Date(period.period_end).toISOString():window.monthEnd+'T12:00:00Z'};
}

/** Only call after a successful scoped admission and appointment write in the
 * same schedule-locked transaction. Public booking input cannot issue proof. */
export async function recordWeeklyOverrideBooking(db,{member,appointmentId,date}){
 if(member?.weekly_limit_override!==true||!member.weekly_sessions)return;
 const window=weeklyMembershipWindow(member,date);
 // Existing accepted visits must not become unusable when this admission takes
 // their week over the ordinary cap and the owner later turns the override off.
 // This runs only after the whole month's used/reserved total passed validation.
 await db.query("INSERT INTO membership_weekly_override_bookings(business_id,membership_id,appointment_id,authorized_date) SELECT $1,$2,a.id,a.date FROM appointments a JOIN businesses b ON b.owner_id=a.owner JOIN appointments admitted ON admitted.owner=b.owner_id AND admitted.id=$3 AND admitted.date=$4 WHERE b.id=$1 AND admitted.data::jsonb->>'memberNumber'=$5 AND admitted.data::jsonb->>'membershipCovered'='true' AND a.date>=$6 AND a.date<$7 AND a.data::jsonb->>'memberNumber'=$5 AND a.data::jsonb->>'membershipCovered'='true' AND a.status IN ('Confirmed','Scheduled','Checked in','Checked-in','Completed','No-show','Attended') ON CONFLICT(business_id,membership_id,appointment_id) DO UPDATE SET authorized_date=excluded.authorized_date,authorized_at=now()",[member.business_id,member.id,appointmentId,date,member.member_number,window.monthStart,window.monthEnd]);
}


/** Persist a late debit in its original month without spending this month's
 * credits. The admission check already holds the membership/schedule locks. */
export async function recordHistoricalOverrideUsage(db,{member,date,allocation}){
 if(!allocation)return false;
 const current=member.credit_period_start&&member.credit_period_end&&date>=new Date(member.credit_period_start).toISOString().slice(0,10)&&date<new Date(member.credit_period_end).toISOString().slice(0,10);
 if(current)return false;
 await db.query('INSERT INTO membership_credit_periods(business_id,membership_id,period_start,period_end,sessions_included,sessions_used) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(membership_id,period_start) DO UPDATE SET sessions_used=GREATEST(membership_credit_periods.sessions_used,excluded.sessions_used) WHERE membership_credit_periods.business_id=excluded.business_id',[member.business_id,member.id,allocation.periodStart,allocation.periodEnd,allocation.included,allocation.used+1]);
 return true;
}
