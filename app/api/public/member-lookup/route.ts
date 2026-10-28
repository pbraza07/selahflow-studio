import {getPool} from '../../../../server/database.mjs';
import {tokenHash,validOrigin} from '../../../../server/security.mjs';
import {restoreCurrentProfileAnswers,restoredContact} from '../../../../server/returning-member-prefill.mjs';
import {hasUsableMembership,remainingMembershipSessions} from '../../../../server/member-badge-state.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};

export async function POST(req:Request){
 if(!validOrigin(req))return Response.json({error:'Invalid origin.'},{status:403,headers});
 try{
  const raw=await req.text();
  if(raw.length>1500)return Response.json({error:'Invalid lookup request.'},{status:400,headers});
  const body=JSON.parse(raw);
  if(!body||typeof body!=='object'||Array.isArray(body))return Response.json({error:'Invalid lookup request.'},{status:400,headers});
  const slug=String(body.slug||'').trim();
  const memberNumber=String(body.memberNumber||'').trim().toUpperCase();
  const dob=String(body.dateOfBirth||'');
  if(!/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(slug)
   ||!/^[A-Z]{2}([0-9]{4}|[0-9]{6})$/.test(memberNumber)
   ||dob&&(!/^\d{4}-\d{2}-\d{2}$/.test(dob)||Number.isNaN(Date.parse(dob))||new Date(dob).toISOString().slice(0,10)!==dob))
   return Response.json({error:'Enter a valid Membership ID.'},{status:400,headers});

  const db=getPool();
  const business=(await db.query("SELECT id,owner_id FROM businesses WHERE slug=$1 AND status='active' LIMIT 1",[slug])).rows[0];
  if(!business)return Response.json({error:'Business not found.'},{status:404,headers});
  // ID-only form recovery is explicitly supported. Responses remain scoped to
  // one active business and allowlisted form fields, with IP/member throttles.
  const ip=(req.headers.get('x-forwarded-for')||'unknown').split(',').at(-1)!.trim().slice(0,128);
  for(const [key,maximum] of [
   ['member-prefill-ip:'+business.id+':'+tokenHash(ip),15],
   ['member-prefill-id:'+business.id+':'+tokenHash(memberNumber),10]
  ] as const){
   const limits=await db.query(
    "INSERT INTO public_limits(key,count,window_start) VALUES($1,1,now()) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN public_limits.window_start<now()-interval '15 minutes' THEN 1 ELSE public_limits.count+1 END,window_start=CASE WHEN public_limits.window_start<now()-interval '15 minutes' THEN now() ELSE public_limits.window_start END RETURNING count",
    [key]
   );
   if(Number(limits.rows[0]?.count)>maximum)
    return Response.json({error:'Too many lookup attempts. Please try again later.'},{status:429,headers});
  }

  const [member,booking,membership,profileIdentity]=await Promise.all([
   db.query("SELECT customer_name,customer_email,customer_phone,registration_answers,member_number,date_of_birth::text AS dob,status,sessions_included,sessions_used FROM customer_memberships WHERE business_id=$1 AND member_number=$2 AND ($3::date IS NULL OR date_of_birth=$3::date) LIMIT 1",[business.id,memberNumber,dob||null]),
   db.query("SELECT first_name||' '||last_name AS customer_name,email AS customer_email,phone AS customer_phone,member_number,date_of_birth::text AS dob FROM customer_booking_ids WHERE business_id=$1 AND member_number=$2 AND ($3::date IS NULL OR date_of_birth=$3::date) LIMIT 1",[business.id,memberNumber,dob||null])
   ,db.query("SELECT p.credit_eligibility,p.name AS membership_name,m.status,m.sessions_included,m.sessions_used FROM customer_memberships m JOIN membership_plans p ON p.id=m.plan_id WHERE m.business_id=$1 AND m.member_number=$2 AND ($3::date IS NULL OR m.date_of_birth=$3::date) ORDER BY CASE WHEN m.status='active' THEN 0 ELSE 1 END,m.updated_at DESC LIMIT 1",[business.id,memberNumber,dob||null]),
   db.query("SELECT name AS customer_name,email AS customer_email,phone AS customer_phone,member_number,date_of_birth::text AS dob,registration_answers FROM business_client_profiles WHERE owner=$1 AND member_number=$2 AND deleted_at IS NULL AND archived=false AND ($3::date IS NULL OR date_of_birth=$3::date) LIMIT 1",[business.owner_id,memberNumber,dob||null])
  ]);
  const identity=member.rows[0]||booking.rows[0]||profileIdentity.rows[0];
  if(!identity)return Response.json({error:'No registration found for this Membership ID at this business. Check the ID or contact the business.'},{status:404,headers});
  const profile=(await db.query(
   "SELECT name,first_name,last_name,email,phone,import_columns,registration_answers FROM business_client_profiles WHERE owner=$1 AND deleted_at IS NULL AND (member_number=$2 OR (member_number IS NULL AND lower(trim(name))=lower(trim($3)) AND lower(trim(email))=lower(trim($4)))) ORDER BY CASE WHEN member_number=$2 THEN 0 ELSE 1 END,created_at DESC LIMIT 1",
   [business.owner_id,memberNumber,identity.customer_name,identity.customer_email]
  )).rows[0]||{};
  const [appointment,request,settings]=await Promise.all([
   db.query("SELECT data FROM appointments WHERE owner=$1 AND data::jsonb->>'memberNumber'=$2 ORDER BY COALESCE(data::jsonb->>'created','') DESC,date DESC,start DESC LIMIT 1",[business.owner_id,memberNumber]),
   db.query("SELECT details,created_at FROM booking_requests WHERE business_id=$1 AND details::jsonb->>'memberNumber'=$2 ORDER BY created_at DESC LIMIT 1",[business.id,memberNumber]),
   db.query("SELECT data FROM settings WHERE owner=$1 LIMIT 1",[business.owner_id])
  ]);
  let config:any={};
  try{config=JSON.parse(settings.rows[0]?.data||'{}');}catch{}
  let latestAppointment:any={};
  try{const value=appointment.rows[0]?.data;latestAppointment=typeof value==='string'?JSON.parse(value):value||{};}catch{}
  let latestRequest:any={};
  try{const value=request.rows[0]?.details;latestRequest=typeof value==='string'?JSON.parse(value):value||{};}catch{}
  const appointedAt=Date.parse(String(latestAppointment.created||''));
  const requestedAt=Date.parse(String(request.rows[0]?.created_at||''));
  const latest=Number.isFinite(requestedAt)&&(!Number.isFinite(appointedAt)||requestedAt>appointedAt)?latestRequest:latestAppointment;
  const backup=latest===latestRequest?latestAppointment:latestRequest;
  const fields=Array.isArray(config.bookingCustomFields)?config.bookingCustomFields:[];
  const customAnswers=restoreCurrentProfileAnswers(
   fields,profile.registration_answers,latest.customAnswers,backup.customAnswers,member.rows[0]?.registration_answers,
   profile.import_columns
  );
  const contact=restoredContact(
   identity,profile,
   Object.keys(latest).length?latest:backup
  );
  const membershipRow=membership.rows[0]||null;
  const sessionsIncluded=membershipRow?Number(membershipRow.sessions_included):0;
  const sessionsUsed=membershipRow?Number(membershipRow.sessions_used):0;
  const sessionsLeft=membershipRow?remainingMembershipSessions(sessionsIncluded,sessionsUsed):0;
  const membershipCovered=!!membershipRow&&hasUsableMembership({status:membershipRow.status,sessions_included:sessionsIncluded,sessions_used:sessionsUsed});
  return Response.json({...contact,dateOfBirth:String(identity.dob||''),memberNumber,customAnswers,membership:membershipRow?{creditEligibility:membershipRow.credit_eligibility,name:membershipRow.membership_name,status:membershipRow.status,sessionsIncluded,sessionsUsed,sessionsLeft,membershipCovered}:null,membershipCovered},{headers});
 }catch(error){
  console.error('Member prefill lookup failed:',error);
  return Response.json({error:'Saved client details are temporarily unavailable. Please retry.'},{status:503,headers});
 }
}
