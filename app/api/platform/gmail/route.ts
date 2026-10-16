import {getPool} from '../../../../server/database.mjs';
import {requireGmailAdmin} from '../../../../lib/platform-gmail-auth';
import {gmailStatus,beginGmailConnection,disconnectGmail,selectedEmailProvider} from '../../../../server/gmail-delivery.mjs';
import {validOrigin,trustedOrigin,sessionToken} from '../../../../server/security.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'};
const failure=(e:unknown)=>{const m=(e as Error).message;return Response.json({error:m==='AUTH_REQUIRED'?'Sign in to continue.':m==='FORBIDDEN'?'Only the primary platform administrator can manage the shared Gmail account.':'Gmail setup is incomplete or temporarily unavailable.'},{status:m==='AUTH_REQUIRED'?401:m==='FORBIDDEN'?403:503,headers});};
export async function GET(req:Request){try{await requireGmailAdmin(req);return Response.json({...await gmailStatus(),provider:selectedEmailProvider()==='gmail'?'Gmail':'Resend',redirectUri:trustedOrigin(req)+'/api/platform/gmail/callback'},{headers});}catch(e){return failure(e);}}
export async function POST(req:Request){
 if(!validOrigin(req))return Response.json({error:'Invalid origin.'},{status:403,headers});
 try{
  const actor=await requireGmailAdmin(req),raw=await req.text();if(raw.length>500)throw Error();
  const b=JSON.parse(raw),db=getPool();
  if(b.action==='connect')return Response.json(await beginGmailConnection(db,{actor,session:sessionToken(req),origin:trustedOrigin(req)}),{headers});
  if(b.action==='disconnect')return Response.json(await disconnectGmail(db,actor),{headers});
  return Response.json({error:'Invalid action.'},{status:400,headers});
 }catch(e){return failure(e);}
}
