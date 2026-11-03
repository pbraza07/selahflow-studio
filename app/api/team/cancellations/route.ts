import {getPool} from '../../../../server/database.mjs';
import {teamIdentity} from '../../../../server/team-portal.mjs';
import {validOrigin} from '../../../../server/security.mjs';
import {listTeamCancellations,requestTeamCancellation} from '../../../../server/team-cancellations.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
const fail=(e:any)=>Response.json({error:e.status?e.message:'Cancellation requests are unavailable.'},{status:e.status||503,headers});
export async function GET(req:Request){try{const pool=getPool(),account=await teamIdentity(pool,req);return Response.json({requests:await listTeamCancellations(pool,account)},{headers});}catch(e){return fail(e);}}
export async function POST(req:Request){if(!validOrigin(req))return Response.json({error:'Invalid origin.'},{status:403,headers});try{const raw=await req.text();if(raw.length>2000)return Response.json({error:'Request too large.'},{status:413,headers});return Response.json(await requestTeamCancellation(getPool(),req,JSON.parse(raw)),{headers});}catch(e){return fail(e);}}
