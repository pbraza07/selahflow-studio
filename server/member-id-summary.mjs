import {remainingMembershipSessions,hasUsableMembership,membershipDisplayStatus} from './member-badge-state.mjs';
export async function memberIdMembershipSummary(client,owner,memberNumber){
 const row=(await client.query(`SELECT p.name,g.name AS type_name,m.status,m.sessions_included,m.sessions_used
  FROM customer_memberships m JOIN businesses b ON b.id=m.business_id
  JOIN membership_plans p ON p.id=m.plan_id AND p.business_id=m.business_id
  LEFT JOIN membership_groups g ON g.id=p.group_id AND g.business_id=m.business_id
  WHERE b.owner_id=$1 AND b.status='active' AND m.member_number=$2
  ORDER BY m.updated_at DESC LIMIT 1`,[owner,memberNumber])).rows[0];
 if(!row)return null;
 return {name:row.name,type:row.type_name||row.name,status:membershipDisplayStatus(row),
  sessionsLeft:hasUsableMembership(row)?remainingMembershipSessions(row.sessions_included,row.sessions_used):0,
  sessionsIncluded:Number(row.sessions_included),sessionsUsed:Number(row.sessions_used)};
}
