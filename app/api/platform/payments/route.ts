import {getPool} from '../../../../server/database.mjs';
import {requireGmailAdmin} from '../../../../lib/platform-gmail-auth';
import {validOrigin,trustedOrigin} from '../../../../server/security.mjs';
import {businessStripeDirectory,synchronizeBusinessStripe} from '../../../../server/business-stripe-setup.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'};
function failure(e:unknown){const m=(e as Error).message;return Response.json({error:m==='AUTH_REQUIRED'?'Sign in to continue.':m==='FORBIDDEN'?'Only the primary platform administrator can manage business payment connections.':m},{status:m==='AUTH_REQUIRED'?401:m==='FORBIDDEN'?403:400,headers});}
export async function GET(req:Request){try{await requireGmailAdmin(req);return Response.json(await businessStripeDirectory(getPool()),{headers});}catch(e){return failure(e);}}
export async function POST(req:Request){
 if(!validOrigin(req))return Response.json({error:'Invalid origin.'},{status:403,headers});
 try{await requireGmailAdmin(req);const raw=await req.text();if(raw.length>1000)throw Error('Invalid payment setup request.');const b=JSON.parse(raw);
  if(!['connect','prepare','refresh'].includes(b.action)||typeof b.businessId!=='string'||!/^[-a-f0-9]{36}$/i.test(b.businessId))throw Error('Invalid payment setup request.');
  return Response.json(await synchronizeBusinessStripe(getPool(),b.businessId,{createMissing:b.action!=='refresh',origin:b.action==='connect'?trustedOrigin(req):''}),{headers});
 }catch(e){return failure(e);}
}
