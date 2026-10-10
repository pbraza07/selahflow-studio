import {getPool} from '../../../../server/database.mjs';
import {requireOwner} from '../../../../lib/auth';
import {validOrigin} from '../../../../server/security.mjs';
import {getPlatformRole} from '../../../../server/platform-roles.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
async function platformOwner(req:Request){
 const owner=await requireOwner(req);
 const role=await getPlatformRole(getPool(),owner);
 if(!role)throw Error('FORBIDDEN');
 return owner;
}
const err=(e:unknown)=>Response.json({error:(e as Error).message==='AUTH_REQUIRED'?'Please sign in.':(e as Error).message==='FORBIDDEN'?'Platform administrators only.':'Operation unavailable.'},{status:(e as Error).message==='AUTH_REQUIRED'?401:(e as Error).message==='FORBIDDEN'?403:503});
export async function GET(req:Request){
 try{
  const userId=await platformOwner(req);
  const pool=getPool();const role=await getPlatformRole(pool,userId);
  const [businesses,subscriptions,bookings,pending,ai,pendingRegistrations,terms,directory,teamSeatRequests]=await Promise.all([
   pool.query("SELECT COUNT(*)::int AS count, COUNT(*) FILTER(WHERE status='active' AND is_listed=TRUE)::int AS listed FROM businesses"),
   pool.query("SELECT plan_code,COUNT(*)::int AS count FROM business_subscriptions GROUP BY plan_code ORDER BY plan_code"),
   pool.query('SELECT COUNT(*)::int AS count FROM appointments'),
   pool.query("SELECT id,slug,name,industry,city,region FROM businesses WHERE listing_requested=TRUE AND is_listed=FALSE AND status='active' ORDER BY created_at LIMIT 50"),
   pool.query('SELECT COALESCE(SUM(estimated_cost_cents),0)::bigint::text AS estimated_cost_cents FROM ai_usage'),
   pool.query("SELECT b.id,b.slug,b.name,b.industry,b.city,b.region,b.created_at,u.email FROM businesses b JOIN users u ON u.id=b.owner_id WHERE b.status='pending' ORDER BY b.created_at ASC LIMIT 200"),
   pool.query("SELECT b.name AS business_name,b.slug,e.duration_unit,COUNT(*)::int AS count,COUNT(*) FILTER (WHERE e.status='active' AND e.ends_on>=CURRENT_DATE)::int AS active_count FROM service_enrollments e JOIN businesses b ON b.id=e.business_id GROUP BY b.name,b.slug,e.duration_unit ORDER BY b.name,e.duration_unit"),
   pool.query("SELECT b.id,b.slug,b.name,b.industry,b.description,b.city,b.region,b.status,b.is_listed,b.created_at::text AS created_at,u.email AS owner_email,COALESCE(sub.plan_code,'free') AS plan_code,COALESCE(ap.booking_count,0)::int AS appointment_count FROM businesses b JOIN users u ON u.id=b.owner_id LEFT JOIN business_subscriptions sub ON sub.business_id=b.id LEFT JOIN (SELECT owner,COUNT(*)::int AS booking_count FROM appointments GROUP BY owner) ap ON ap.owner=b.owner_id ORDER BY CASE b.status WHEN 'active' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,b.created_at DESC,b.name"),
   pool.query("SELECT COUNT(*)::int AS count FROM business_team_seat_requests WHERE status='pending'")
  ]);
  return Response.json({businesses:businesses.rows[0],subscriptions:subscriptions.rows,bookings:bookings.rows[0].count,pendingListings:pending.rows,pendingRegistrations:pendingRegistrations.rows,canApproveRegistrations:role==='primary',termEnrollmentMetrics:terms.rows,estimatedAiCostCents:ai.rows[0].estimated_cost_cents,directory:directory.rows,pendingTeamSeatRequests:teamSeatRequests.rows[0]?.count||0,financialStatus:'Not configured: Stripe and marketplace charges are not live in v1.3.'},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return err(e);}
}
export async function POST(req:Request){
 if(!validOrigin(req))return Response.json({error:'Invalid origin.'},{status:403});
 try{
  const actor=await platformOwner(req);
  const raw=await req.text();if(raw.length>1500)return Response.json({error:'Request too large.'},{status:413});
  const b=JSON.parse(raw);
  if(typeof b.businessId!=='string'||!/^[-a-f0-9]{36}$/.test(b.businessId)||typeof b.approve!=='boolean')
   return Response.json({error:'Invalid listing request.'},{status:400});
  const pool=getPool();
  if(b.action==='registration'){
   if(await getPlatformRole(pool,actor)!=='primary')return Response.json({error:'Only the primary platform administrator may approve business applications.'},{status:403});
   const result=await pool.query("UPDATE businesses SET status=CASE WHEN $1 THEN 'active' ELSE 'rejected' END,is_listed=$1,listing_requested=FALSE,updated_at=now() WHERE id=$2 AND status='pending' RETURNING slug",[b.approve,b.businessId]);
   if(!result.rowCount)return Response.json({error:'Pending business application not found.'},{status:404});
   return Response.json({ok:true,slug:result.rows[0].slug,status:b.approve?'active':'rejected',listed:b.approve},{headers:{'Cache-Control':'no-store'}});
  }
  return Response.json({error:'Approved businesses are published automatically. Listing cannot be disabled for active businesses.'},{status:400,headers:{'Cache-Control':'no-store'}});
 }catch(e){return err(e);}
}
