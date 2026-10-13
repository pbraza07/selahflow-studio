import {getPool} from '../../../../server/database.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(req:Request){
 try{
  const body=await req.json();
  const slug=String(body.slug||'').trim(),memberNumber=String(body.memberNumber||'').trim().toUpperCase(),dob=String(body.dateOfBirth||'');
  if(!slug||!/^[A-Z]{2}[0-9]{4}$/.test(memberNumber)||!/^\d{4}-\d{2}-\d{2}$/.test(dob))return Response.json({error:'Enter your membership ID and date of birth.'},{status:400,headers:{'Cache-Control':'no-store'}});
  const db=getPool();
  const q=await db.query("SELECT m.customer_name,m.customer_email,m.member_number,b.owner_id FROM customer_memberships m JOIN businesses b ON b.id=m.business_id WHERE b.slug=$1 AND b.status='active' AND m.member_number=$2 AND m.date_of_birth=$3::date LIMIT 1",[slug,memberNumber,dob]);
  const booking=await db.query("SELECT c.first_name||' '||c.last_name AS customer_name,c.email AS customer_email,c.phone,c.member_number,b.owner_id FROM customer_booking_ids c JOIN businesses b ON b.id=c.business_id WHERE b.slug=$1 AND b.status='active' AND c.member_number=$2 AND c.date_of_birth=$3::date LIMIT 1",[slug,memberNumber,dob]);
  const m=q.rows[0]||booking.rows[0];
  if(!m)return Response.json({error:'Member ID and birth date did not match.'},{status:404,headers:{'Cache-Control':'no-store'}});
  const profile=await db.query("SELECT phone,import_columns FROM business_client_profiles WHERE owner=$1 AND deleted_at IS NULL AND (member_number=$2 OR (lower(email)=lower($3) AND lower(trim(name))=lower(trim($4)))) ORDER BY CASE WHEN member_number=$2 THEN 0 ELSE 1 END,created_at DESC LIMIT 1",[m.owner_id,memberNumber,m.customer_email,m.customer_name]);
  const full=String(m.customer_name||'').trim().split(/\s+/);
  return Response.json({firstName:full[0]||'',lastName:full.slice(1).join(' '),email:m.customer_email,phone:profile.rows[0]?.phone||m.phone||'',memberNumber:m.member_number,customAnswers:profile.rows[0]?.import_columns||{}},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Member lookup is temporarily unavailable.'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
