import {getPool} from '../../../../server/database.mjs';
import {teamIdentity} from '../../../../server/team-portal.mjs';
import {workspaceSummary} from '../../../../server/team-workspace-state.mjs';
import {workspaceBillingAction} from '../../../../server/team-workspace-billing.mjs';
import {trustedOrigin,validOrigin} from '../../../../server/security.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
function fail(e:any){return Response.json({error:e.status?e.message:e.message||'Workspace billing unavailable.'},{status:e.status||400,headers});}
export async function GET(req:Request){try{const a=await teamIdentity(getPool(),req,false,true);return Response.json({business:a.business_name,billing:workspaceSummary(a)},{headers});}catch(e){return fail(e);}}
export async function POST(req:Request){if(!validOrigin(req))return Response.json({error:'Invalid origin.'},{status:403,headers});try{const pool=getPool(),a=await teamIdentity(pool,req,false,true),raw=await req.text();if(raw.length>2000)return Response.json({error:'Request too large.'},{status:413,headers});const b=JSON.parse(raw);if(!['checkout','check','manage','cancel'].includes(b.action))throw Error('Choose a billing action.');return Response.json(await workspaceBillingAction(pool,{accountId:a.id,businessId:a.business_id,action:b.action,origin:trustedOrigin(req),consent:b.consent,version:b.version}),{headers});}catch(e){return fail(e);}}
