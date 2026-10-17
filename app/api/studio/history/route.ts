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
