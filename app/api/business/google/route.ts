import {getPool} from '../../../../server/database.mjs';
import {requireOwner} from '../../../../lib/auth';
import {validOrigin,trustedOrigin,sessionToken} from '../../../../server/security.mjs';
import {googleBusinessStatus,beginGoogleBusiness,googleBusinessLocations,selectGoogleLocation,saveGoogleDisplay,disconnectGoogleBusiness} from '../../../../server/google-business-connection.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'};
function failure(e:unknown){const m=(e as Error).message;return Response.json({error:m==='AUTH_REQUIRED'?'Sign in to continue.':m==='FORBIDDEN'?'An active business owner account is required.':m==='GOOGLE_RECONNECT'?'Reconnect your Google business account.':'Google setup or access is unavailable. Check the connection settings and Google API approval.'},{status:m==='AUTH_REQUIRED'?401:m==='FORBIDDEN'?403:503,headers});}
export async function GET(req:Request){try{const owner=await requireOwner(req);return Response.json({...await googleBusinessStatus(getPool(),owner),redirectUri:trustedOrigin(req)+'/api/business/google/callback'},{headers});}catch(e){return failure(e);}}
export async function POST(req:Request){
 if(!validOrigin(req))return Response.json({error:'Invalid origin.'},{status:403,headers});
 try{const owner=await requireOwner(req),raw=await req.text();if(raw.length>1500)return Response.json({error:'Request too large.'},{status:413,headers});
 const b=JSON.parse(raw),db=getPool();let result;
 switch(b.action){
 case 'connect':result=await beginGoogleBusiness(db,{owner,session:sessionToken(req),origin:trustedOrigin(req)});break;
 case 'locations':result=await googleBusinessLocations(db,owner);break;
 case 'select':result=await selectGoogleLocation(db,owner,b.location);break;
 case 'display':result=await saveGoogleDisplay(db,owner,b);break;
 case 'disconnect':result=await disconnectGoogleBusiness(db,owner);break;
 default:return Response.json({error:'Invalid action.'},{status:400,headers});
 }return Response.json(result,{headers});}catch(e){return failure(e);}
}
