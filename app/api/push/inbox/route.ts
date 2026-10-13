import {pushContext} from '../../../../server/push-context.mjs';
import {validOrigin} from '../../../../server/security.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
function fail(){return Response.json({error:'You are not authorized for this notification inbox.'},{status:403,headers});}
export async function GET(req:Request){try{
 const {pool,businessId,reviewer}=await pushContext(req);
 const {rows}=await pool.query("SELECT r.id,r.date,r.start_minute,r.created_at::text AS created_at,r.details,(reads.request_id IS NULL) AS unread FROM booking_requests r LEFT JOIN business_notification_reads reads ON reads.business_id=r.business_id AND reads.reviewer=$2 AND reads.request_id=r.id WHERE r.business_id=$1 AND r.status='pending' AND ($2='owner' OR r.reviewer=$2) ORDER BY r.created_at DESC LIMIT 100",[businessId,reviewer]);
 const items:any[]=rows.map((r:{details:string;[key:string]:unknown})=>{let d:any={};try{d=JSON.parse(r.details)}catch{}
  const {details,...rest}=r;return {...rest,customerName:String(d.customerName||'').slice(0,100),services:Array.isArray(d.services)?d.services.slice(0,5):[]};});
 if(reviewer==='owner'){
  const membership=await pool.query("SELECT r.id,r.created_at::text AS created_at,r.details,p.name AS plan_name,(r.owner_read_at IS NULL) AS unread FROM membership_requests r JOIN membership_plans p ON p.id=r.plan_id AND p.business_id=r.business_id WHERE r.business_id=$1 AND r.status='pending' ORDER BY r.created_at DESC LIMIT 100",[businessId]);
  for(const r of membership.rows)items.push({id:r.id,created_at:r.created_at,customerName:r.details.name,services:[r.plan_name],kind:'membership',unread:r.unread});
  items.sort((a,b)=>b.created_at.localeCompare(a.created_at));
 }
 return Response.json({items,unread:items.filter((x:{unread:boolean})=>x.unread).length,pending:items.length},{headers});
 }catch{return fail();}}
export async function POST(req:Request){
 if(!validOrigin(req))return Response.json({error:'Invalid request origin.'},{status:403,headers});
 try{
  const {pool,businessId,reviewer}=await pushContext(req);
  const raw=await req.text();if(raw.length>10000)return Response.json({error:'Request too large.'},{status:413,headers});
  const data=JSON.parse(raw);
  if(data.action!=='markRead'||!Array.isArray(data.ids)||data.ids.length>200||!data.ids.every((x:unknown)=>typeof x==='string'&&/^[a-f0-9-]{36}$/i.test(x)))return Response.json({error:'Invalid notification selection.'},{status:400,headers});
  if(data.ids.length){
   await pool.query("INSERT INTO business_notification_reads(business_id,reviewer,request_id) SELECT r.business_id,$2,r.id FROM booking_requests r WHERE r.business_id=$1 AND r.status='pending' AND ($2='owner' OR r.reviewer=$2) AND r.id=ANY($3::text[]) ON CONFLICT(business_id,reviewer,request_id) DO NOTHING",[businessId,reviewer,data.ids]);
   if(reviewer==='owner')await pool.query("UPDATE membership_requests SET owner_read_at=COALESCE(owner_read_at,now()) WHERE business_id=$1 AND status='pending' AND id=ANY($2::text[])",[businessId,data.ids]);
  }
  return Response.json({ok:true},{headers});
 }catch{return fail();}
}
