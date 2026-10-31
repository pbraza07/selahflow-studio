import {googleOwnerCallback} from '../../../../../server/owner-federation-callback.mjs';
import {getPool} from '../../../../../server/database.mjs';
import {requireGmailAdmin} from '../../../../../lib/platform-gmail-auth';
import {completeGmailConnection} from '../../../../../server/gmail-delivery.mjs';
import {trustedOrigin,sessionToken} from '../../../../../server/security.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:Request){
 if(new URL(req.url).searchParams.get('state')?.startsWith('sf_auth_'))return googleOwnerCallback(getPool(),req);
 let result='error';
 try{
  const actor=await requireGmailAdmin(req),query=new URL(req.url).searchParams;
  if(query.has('error'))throw Error();
  await completeGmailConnection(getPool(),{actor,session:sessionToken(req),state:query.get('state'),code:query.get('code')});result='connected';
 }catch{}
 return new Response(null,{status:303,headers:{Location:trustedOrigin(req)+'/admin/platform?gmail='+result+'#platform-gmail','Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
}
