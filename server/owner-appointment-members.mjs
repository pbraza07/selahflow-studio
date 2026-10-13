import {hasUsableMembership,remainingMembershipSessions} from './member-badge-state.mjs';

export const ownerMemberRosterSQL=`
 SELECT 'membership' AS source,m.member_number,m.customer_name AS name,m.customer_email AS email,
  p.name AS membership_name,m.status AS membership_status,m.sessions_included,m.sessions_used,
  m.date_of_birth::text AS date_of_birth
 FROM customer_memberships m
 JOIN businesses b ON b.id=m.business_id
 JOIN membership_plans p ON p.id=m.plan_id
 WHERE b.owner_id=$1 AND m.member_number IS NOT NULL
 UNION ALL
 SELECT 'booking' AS source,c.member_number,concat(c.first_name,' ',c.last_name) AS name,
  c.email,NULL::text,NULL::text,NULL::integer,NULL::integer,c.date_of_birth::text
 FROM customer_booking_ids c JOIN businesses b ON b.id=c.business_id
 WHERE b.owner_id=$1
 UNION ALL
 SELECT 'profile' AS source,p.member_number,p.name,p.email,
  NULL::text,NULL::text,NULL::integer,NULL::integer,p.date_of_birth::text
 FROM business_client_profiles p
 WHERE p.owner=$1 AND p.deleted_at IS NULL AND p.member_number IS NOT NULL
`;

export async function loadOwnerMemberRoster(client,owner){
 const found=await client.query(ownerMemberRosterSQL,[owner]);
 return found.rows;
}
const normalName=value=>String(value||'').trim().toLowerCase().replace(/\s+/g,' ');
const normalEmail=value=>String(value||'').trim().toLowerCase();
const normalId=value=>String(value||'').trim().toUpperCase();

/**
 * Prefer a stored immutable member ID; only resolve legacy bookings from a
 * uniquely matching full name + email (and DOB when present). Email alone is
 * not sufficient, because siblings may share a parent's address.
 */
export function ownerAppointmentMember(appointment,roster=[]){
 const data=appointment||{};
 const explicit=normalId(data.memberNumber);
 const validRecords=roster.filter(row=>normalId(row.member_number));
 let number=explicit;
 if(!number){
  const name=normalName(data.name||data.customerName);
  const email=normalEmail(data.email||data.customerEmail);
  const birth=String(data.dateOfBirth||'').slice(0,10);
  if(!name||!email)return {memberNumber:'',membership:null};
  const candidates=validRecords.filter(row=>
   normalName(row.name)===name&&normalEmail(row.email)===email&&
   (!birth||!row.date_of_birth||String(row.date_of_birth).slice(0,10)===birth)
  );
  const ids=[...new Set(candidates.map(row=>normalId(row.member_number)))];
  if(ids.length===1)number=ids[0];
 }
 const membership=validRecords.find(row=>row.source==='membership'&&normalId(row.member_number)===number)||null;
 return {memberNumber:number,membership};
}

export function decorateOwnerAppointments(appointments,roster=[]){
 return (appointments||[]).map(appt=>{
  const {memberNumber,membership}=ownerAppointmentMember(appt,roster);
  const included=membership?Number(membership.sessions_included):null;
  const used=membership?Number(membership.sessions_used):null;
  return {...appt,memberNumber:memberNumber||null,
   membershipName:membership?.membership_name||null,
   membershipStatus:membership?.membership_status||null,
   membershipSessionsIncluded:included,membershipSessionsUsed:used,
   membershipSessionsRemaining:membership?remainingMembershipSessions(included,used):null,
   membershipHasCredits:!!membership&&hasUsableMembership(membership)
  };
 });
}
