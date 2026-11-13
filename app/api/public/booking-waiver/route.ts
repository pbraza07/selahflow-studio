import {getPool} from '../../../../server/database.mjs';
import {validOrigin,tokenHash} from '../../../../server/security.mjs';
import {previewBookingWaiver,signBookingWaiver} from '../../../../server/booking-waiver-invitations.mjs';
export const dynamic='force-dynamic';export const runtime='nodejs';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
export async function POST(req:Request){
 if(!validOrigin(req))return Response.json({error:'Invalid origin.'},{status:403,headers});
 let db;
 try{
  const raw=await req.text();if(raw.length>8000)throw Error('Request too large.');const body=JSON.parse(raw);
  if(!body||!['preview','sign'].includes(body.action)||typeof body.slug!=='string'||typeof body.token!=='string')throw Error('Invalid waiver request.');
  const pool=getPool(),ip=(req.headers.get('x-forwarded-for')||'unknown').split(',').at(-1)!.trim();
  const limit=await pool.query("INSERT INTO public_limits(key,count,window_start) VALUES($1,1,now()) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN public_limits.window_start<now()-interval '15 minutes' THEN 1 ELSE public_limits.count+1 END,window_start=CASE WHEN public_limits.window_start<now()-interval '15 minutes' THEN now() ELSE public_limits.window_start END RETURNING count",['booking-waiver:'+tokenHash(ip)]);
  if(Number(limit.rows[0]?.count)>60)return Response.json({error:'Too many requests. Please try again later.'},{status:429,headers});
  db=await pool.connect();await db.query('BEGIN');
  const result=body.action==='preview'?await previewBookingWaiver(db,body):await signBookingWaiver(db,body,{ip,userAgent:req.headers.get('user-agent')});
  await db.query('COMMIT');return Response.json(result,{headers});
 }catch(error){if(db)await db.query('ROLLBACK');return Response.json({error:(error as Error).message},{status:400,headers});}finally{db?.release();}
}
