import {getPool} from '../../../../server/database.mjs';
import {validOrigin} from '../../../../server/security.mjs';
import {supportActor,startSupport,endSupport} from '../../../../server/platform-support.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
export async function POST(req:Request){
 if(!validOrigin(req))return Response.json({error:'Invalid origin.'},{status:403,headers});
 let db;
 try{
  const pool=getPool(),actor=await supportActor(pool,req),raw=await req.text();
  if(raw.length>1000)return Response.json({error:'Request too large.'},{status:413,headers});
  const body=JSON.parse(raw);
  db=await pool.connect();await db.query('BEGIN');
  // Serialize switches and exits for the same login.
  const locked=await db.query('SELECT token_hash FROM sessions WHERE token_hash=$1 AND expires_at>now() FOR UPDATE',[actor.hash]);if(!locked.rows[0])throw Error('AUTH_REQUIRED');await supportActor(db,req);
  let destination='/admin/platform';
  if(body.action==='end')await endSupport(db,actor);
  else if(body.action==='start'&&typeof body.businessId==='string'&&/^[a-f0-9-]{36}$/i.test(body.businessId)){
   const b=await startSupport(db,actor,body.businessId);destination='/studio/'+encodeURIComponent(b.slug);
  }else throw Error('Invalid support request.');
  await db.query('COMMIT');return Response.json({dashboardUrl:destination},{headers});
 }catch(e){if(db)await db.query('ROLLBACK');const m=(e as Error).message;
  return Response.json({error:m==='AUTH_REQUIRED'?'Please sign in again.':m==='FORBIDDEN'?'Platform administrator access required.':m==='PASSWORD_CHANGE_REQUIRED'?'Update your administrator password first.':'Support access unavailable. Select an active business and retry.'},{status:m==='AUTH_REQUIRED'?401:m==='FORBIDDEN'||m==='PASSWORD_CHANGE_REQUIRED'?403:400,headers});
 }finally{db?.release();}
}
