import {requireOwner} from '../../../../lib/auth';
import {getPool} from '../../../../server/database.mjs';
import {validOrigin} from '../../../../server/security.mjs';
import {listOwnerCancellations,reviewTeamCancellation} from '../../../../server/team-cancellations.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
function fail(e:any){return Response.json({error:e.message==='AUTH_REQUIRED'?'Sign in to review cancellation requests.':e.status?e.message:'Cancellation requests are unavailable.'},{status:e.message==='AUTH_REQUIRED'?401:e.status||503,headers});}
export async function GET(req:Request){try{return Response.json({requests:await listOwnerCancellations(getPool(),await requireOwner(req))},{headers});}catch(e){return fail(e);}}
export async function POST(req:Request){if(!validOrigin(req))return Response.json({error:'Invalid origin.'},{status:403,headers});try{const owner=await requireOwner(req),raw=await req.text();if(raw.length>2000)return Response.json({error:'Request too large.'},{status:413,headers});return Response.json(await reviewTeamCancellation(getPool(),owner,JSON.parse(raw)),{headers});}catch(e){return fail(e);}}
