import {requireOwner} from '../../../../lib/auth';
import {getPool} from '../../../../server/database.mjs';
import {validOrigin} from '../../../../server/security.mjs';
import {easternClock} from '../../../../server/session-scheduling.mjs';
import {servicePercentageReport,saveServicePercentage} from '../../../../server/team-service-percentages.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
function failure(e:any){const auth=e.message==='AUTH_REQUIRED';return Response.json({error:auth?'Sign in as the business owner.':e.message||'Service percentages unavailable.'},{status:auth?401:400,headers});}
export async function GET(req:Request){try{const owner=await requireOwner(req),p=new URL(req.url).searchParams,today=easternClock().date;return Response.json(await servicePercentageReport(getPool(),{owner,from:p.get('from')||today.slice(0,7)+'-01',to:p.get('to')||today}),{headers});}catch(e){return failure(e);}}
export async function POST(req:Request){if(!validOrigin(req))return Response.json({error:'Invalid origin.'},{status:403,headers});try{const owner=await requireOwner(req),raw=await req.text();if(raw.length>2000)return Response.json({error:'Request too large.'},{status:413,headers});return Response.json(await saveServicePercentage(getPool(),{owner,input:JSON.parse(raw)}),{headers});}catch(e){return failure(e);}}
