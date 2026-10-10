/** No-charge, platform-approved one-off team seat grants.
 * Approved requests count as exactly one extra seat for a single business.
 * Subscriptions, amounts and entitlements of other businesses are unaffected.
 */
export const MAX_AD_HOC_TEAM_SEATS=20;
export const TEAM_SEAT_STATUSES=['pending','approved','declined','withdrawn','revoked'];
export function teamSeatRequestInput(input){
 if(!input||typeof input!=='object'||Array.isArray(input))
  throw Error('Please enter a valid team member request.');
 const name=String(input.teamMemberName||'').trim();
 const reason=String(input.reason||'').trim();
 if(name.length<2||name.length>100||/[<>\u0000-\u001f]/.test(name))
  throw Error('Team member name must be 2–100 valid characters.');
 if(reason.length<5||reason.length>1000||/[<>\u0000-\u001f]/.test(reason))
  throw Error('Enter a reason of 5–1000 characters.');
 return {teamMemberName:name,reason};
}
export function teamSeatReviewInput(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||
 !['approve','decline','revoke'].includes(input.action)||
 typeof input.id!=='string'||!/^[a-f0-9-]{36}$/i.test(input.id))
  throw Error('Choose a valid team seat request and review action.');
 const note=String(input.note||'').trim();
 if(note.length>1000||/[<>\u0000-\u001f]/.test(note))
  throw Error('Review note must not exceed 1000 characters.');
 return {action:input.action,id:input.id,note};
}
export function bookableTeamLimit(planCode,subscriptionStatus,approvedSeats=0){
 const regular=subscriptionStatus==='active'?
  ({free:1,professional:3,business:10})[planCode]||1:1;
 if(!Number.isInteger(approvedSeats)||approvedSeats<0||approvedSeats>MAX_AD_HOC_TEAM_SEATS)
  throw Error('Invalid extra seat count.');
 return Math.min(100,regular+approvedSeats);
}
export async function approvedTeamSeatCount(pool,businessId){
 const result=await pool.query(
  "SELECT COUNT(*)::int AS count FROM business_team_seat_requests WHERE business_id=$1 AND status='approved'",
  [businessId]);
 return result.rows[0]?.count||0;
}
