/** Credit eligibility is independent of the visible membership classification.
 * Unpaid, expired and exhausted memberships cannot use prepaid sessions even
 * though their badge continues to show the assigned plan/type and status. */
export function remainingMembershipSessions(included,used){
 const total=Number(included),consumed=Number(used);
 if(!Number.isFinite(total)||!Number.isFinite(consumed))return null;
 return Math.max(0,total-consumed);
}
export function hasUsableMembership({status,membership_status,sessions_included,sessions_used,sessionsIncluded,sessionsUsed,paid_through,paidThrough}={}){
 const remaining=remainingMembershipSessions(
  sessions_included??sessionsIncluded,sessions_used??sessionsUsed
 );
 if((paid_through||paidThrough)&&new Date(paid_through||paidThrough)<=new Date())return false;
 return String(status??membership_status??'').toLowerCase()==='active'&&remaining!==null&&remaining>0;
}
export function membershipDisplayStatus(member={}){
 if(hasUsableMembership(member))return 'active';
 if(String(member.status||'').toLowerCase()==='active'&&remainingMembershipSessions(
  member.sessions_included??member.sessionsIncluded,
  member.sessions_used??member.sessionsUsed
 )===0)return 'exhausted';
 return String(member.status||'').toLowerCase()||'none';
}
