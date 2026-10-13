/**
 * Package colors are eligibility indicators, not permanent attributes of a
 * player. Exhausted packages retain their ledger and renewal eligibility,
 * while the player's stable membership ID falls back to a neutral badge.
 */
export function remainingMembershipSessions(included,used){
 const total=Number(included),consumed=Number(used);
 if(!Number.isFinite(total)||!Number.isFinite(consumed))return null;
 return Math.max(0,total-consumed);
}
export function hasUsableMembership({status,sessions_included,sessions_used,sessionsIncluded,sessionsUsed}={}){
 const remaining=remainingMembershipSessions(
  sessions_included??sessionsIncluded,sessions_used??sessionsUsed
 );
 return String(status||'').toLowerCase()==='active'&&remaining!==null&&remaining>0;
}
export function membershipDisplayStatus(member={}){
 if(hasUsableMembership(member))return 'active';
 if(String(member.status||'').toLowerCase()==='active'&&remainingMembershipSessions(
  member.sessions_included??member.sessionsIncluded,
  member.sessions_used??member.sessionsUsed
 )===0)return 'exhausted';
 return String(member.status||'').toLowerCase()||'none';
}
