import {hasUsableMembership} from './member-badge-state.mjs';
import {membershipAnchor,monthlyPeriod,businessDate} from './membership-periods.mjs';

export function validateWeeklySessions(value){
 if(value===undefined||value===null||value==='')return null;
 if(!Number.isInteger(value)||value<1||value>3)throw Error('Choose one, two or three sessions per week.');
 return value;
}
export function membershipUsageSummary(weekly,monthly){
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
 return member.status==='active'&&!!member.initial_paid_at&&!!member.paid_through&&date>=membershipAnchor(member).slice(0,10)&&date<businessDate(member.paid_through);
}
export function weeklyMonthCredits(member,weekly,at=new Date()){
 return weekly*weeklyMembershipWindow(member,businessDate(at)).weeks;
}
/** Caller holds the business schedule lock in an open transaction. Pending
 * requests reserve the allowance; cancellation/decline releases it. A no-show
 * continues to count. The appointment date, not check-in time, selects a week. */
/** @param {any} db @param {{owner:string,memberNumber:string,date:string,excludeIds?:string[]}} options */
export async function assertWeeklyMembershipBooking(db,{owner,memberNumber,date,excludeIds=[]}){
 const member=(await db.query('SELECT m.*,p.weekly_sessions FROM customer_memberships m JOIN businesses b ON b.id=m.business_id JOIN membership_plans p ON p.id=m.plan_id AND p.business_id=m.business_id WHERE b.owner_id=$1 AND m.member_number=$2 FOR UPDATE OF m',[owner,memberNumber])).rows[0];
 if(!member?.weekly_sessions)return member;
 const window=weeklyMembershipWindow(member,date);
 if(member.status!=='active'||!member.paid_through||date>=businessDate(member.paid_through))throw Error('This session is outside the paid membership period. Renew the membership or choose an earlier session.');
 const visits=(await db.query(`SELECT a.id,a.date,a.status,a.data FROM appointments a WHERE a.owner=$1 AND a.date>=$3 AND a.date<$4 AND a.status<>'Cancelled' AND a.data::jsonb->>'memberNumber'=$2 AND (a.data::jsonb->>'membershipCovered'='true' OR EXISTS(SELECT 1 FROM membership_session_ledger l WHERE l.business_id=$5 AND l.membership_id=$6 AND l.appointment_id=a.id AND l.event_type='session_used'))`,[owner,memberNumber,window.start,window.end,member.business_id,member.id])).rows;
 const pending=(await db.query("SELECT id FROM booking_requests WHERE owner_id=$1 AND date>=$3 AND date<$4 AND status='pending' AND details::jsonb->>'memberNumber'=$2 AND details::jsonb->>'membershipCovered'='true'",[owner,memberNumber,window.start,window.end])).rows;
 const count=new Set([...visits,...pending].filter(v=>!excludeIds.includes(v.id)).map(v=>v.id)).size;
 if(count>=member.weekly_sessions)throw Error(`Membership allows ${member.weekly_sessions} session(s) per week. The allowance for ${window.start} through ${window.end} (end date excluded) is already reserved or used.`);
 return {...member,weeklyWindow:window,weeklyRemaining:member.weekly_sessions-count};
}
