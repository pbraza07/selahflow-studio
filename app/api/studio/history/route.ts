import {validOrigin} from '../../../../server/security.mjs';
import {requireOwner} from '../../../../lib/auth';
import {getPool} from '../../../../server/database.mjs';
import {loadOwnerHistory} from '../../../../server/owner-history.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
export async function GET(req:Request){try{
 const owner=await requireOwner(req),p=new URL(req.url).searchParams;
 const from=p.get('from')||'',to=p.get('to')||'';
 if([from,to].some(d=>d&&!/^\d{4}-\d{2}-\d{2}$/.test(d))||from&&to&&from>to)return Response.json({error:'Choose a valid date range.'},{status:400,headers});
 return Response.json(await loadOwnerHistory(getPool(),owner,{q:p.get('q'),category:p.get('category'),from,to,page:Number(p.get('page')||1),member:p.get('member')||'',clientEmail:p.get('clientEmail')||'',clientName:p.get('clientName')||''}),{headers});
 }catch(e){const message=(e as Error).message;return Response.json({error:message==='AUTH_REQUIRED'?'Sign in to view history.':message==='FORBIDDEN'?'Business workspace unavailable.':'History could not be loaded. Try again.'},{status:message==='AUTH_REQUIRED'?401:message==='FORBIDDEN'?403:503,headers});}}

export async function POST(req:Request){
 if(!validOrigin(req))return Response.json({error:'Invalid request origin.'},{status:403,headers});
 try{
  const owner=await requireOwner(req),body=await req.json();
  if(body.action!=='clear'||body.confirmPhrase!=='DELETE HISTORY')return Response.json({error:'Confirm deleting all history from this tab.'},{status:400,headers});
  const db=await getPool().connect();
  try{await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[owner+':history']);const result=await loadOwnerHistory(db,owner,{clear:true});await db.query('COMMIT');return Response.json({ok:true,...result},{headers});}
  catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
 }catch(e){return Response.json({error:(e as Error).message==='AUTH_REQUIRED'?'Sign in to manage history.':'Could not clear history.'},{status:(e as Error).message==='AUTH_REQUIRED'?401:503,headers});}
}
