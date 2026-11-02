import {getPool} from '../../../../server/database.mjs';
import {requireGmailAdmin} from '../../../../lib/platform-gmail-auth';
import {easternClock} from '../../../../server/session-scheduling.mjs';
import {serviceCommissionReport} from '../../../../server/service-commission-report.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
export async function GET(req:Request){try{await requireGmailAdmin(req);const p=new URL(req.url).searchParams,today=easternClock().date;return Response.json(await serviceCommissionReport(getPool(),{businessId:p.get('businessId')||null,from:p.get('from')||today.slice(0,7)+'-01',to:p.get('to')||today,staffId:p.has('staffId')?p.get('staffId'):null,page:Number(p.get('page')||0)}),{headers});}catch(e:any){return Response.json({error:e.message==='AUTH_REQUIRED'?'Sign in to continue.':e.message==='FORBIDDEN'?'Primary platform administrator required.':e.message},{status:e.message==='AUTH_REQUIRED'?401:e.message==='FORBIDDEN'?403:400,headers});}}
