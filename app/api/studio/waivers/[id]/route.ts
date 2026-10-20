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
