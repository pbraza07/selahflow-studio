import {requireOwner} from '../../../../../lib/auth';
import {validOrigin} from '../../../../../server/security.mjs';
import {rescheduleSessionForOwner} from '../../../../../server/safe-session-reschedule.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
export async function POST(req:Request){
 if(!validOrigin(req))return Response.json({error:'Invalid origin.'},{status:403,headers});
 try{
  const owner=await requireOwner(req);
  const raw=await req.text();
  if(raw.length>2500)return Response.json({error:'Session change too large.'},{status:413,headers});
  const body=JSON.parse(raw);
  const result=await rescheduleSessionForOwner({owner,input:body});
  return Response.json(result,{headers});
 }catch(e){
  const message=(e as Error).message||'Unable to change this session.';
  const code=(e as {status?:number}).status;
  const status=message==='AUTH_REQUIRED'?401:
   message==='PASSWORD_CHANGE_REQUIRED'?403:code===409?409:
   /not active|unavailable|not authorized/i.test(message)?403:
   /conflict|full|capacity|booked|changed|overlap|reserved|checked in|completed/i.test(message)?409:
   /valid|choose|session|past|time|future|existing|eligible|staff|hours/i.test(message)?400:503;
  if(status===503)console.error('Session reschedule failed',e);
  return Response.json({error:status===503?'Unable to reschedule session right now.':message},{status,headers});
 }
}
