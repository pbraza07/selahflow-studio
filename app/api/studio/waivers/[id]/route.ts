import {validOrigin} from '../../../../../server/security.mjs';
import {getPool} from '../../../../../server/database.mjs';
import {requireOwner} from '../../../../../lib/auth';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){
 try{const owner=await requireOwner(req),{id}=await params;
 if(!/^[a-f0-9-]{36}$/i.test(id))return Response.json({error:'Waiver not found.'},{status:404,headers});
 const row=(await getPool().query('SELECT w.* FROM participation_waivers w JOIN businesses b ON b.id=w.business_id WHERE w.id=$1 AND b.owner_id=$2 AND b.status=\'active\'',[id,owner])).rows[0];
 return row?Response.json({waiver:row},{headers}):Response.json({error:'Waiver not found.'},{status:404,headers});
 }catch(e){const auth=(e as Error).message==='AUTH_REQUIRED';return Response.json({error:auth?'Please sign in to view this waiver.':'Waiver unavailable.'},{status:auth?401:503,headers});}
}

export async function DELETE(req:Request,{params}:{params:Promise<{id:string}>}){
 if(!validOrigin(req))return Response.json({error:'Invalid request origin.'},{status:403,headers});
 try{
  const owner=await requireOwner(req),{id}=await params;
  if(!/^[a-f0-9-]{36}$/i.test(id))return Response.json({error:'Waiver not found.'},{status:404,headers});
  const body=await req.json().catch(()=>({}));
  if(body.confirmPhrase!=='DELETE WAIVER')return Response.json({error:'Confirm waiver deletion.'},{status:400,headers});
  const db=await getPool().connect();
  try{
   await db.query('BEGIN');
   await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[owner+':schedule']);
   const row=(await db.query("UPDATE participation_waivers w SET deleted_at=COALESCE(w.deleted_at,now()),deleted_by=COALESCE(w.deleted_by,$2) FROM businesses b WHERE w.id=$1 AND b.id=w.business_id AND b.owner_id=$2 AND b.status='active' RETURNING w.id",[id,owner])).rows[0];
   await db.query('COMMIT');
   return row?Response.json({ok:true,retained:true},{headers}):Response.json({error:'Waiver not found.'},{status:404,headers});
  }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
 }catch(e){const auth=(e as Error).message==='AUTH_REQUIRED';return Response.json({error:auth?'Please sign in to manage waivers.':'Unable to delete waiver. Please try again.'},{status:auth?401:503,headers});}
}
