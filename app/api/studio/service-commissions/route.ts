import {getPool} from '../../../../server/database.mjs';
import {requireOwner} from '../../../../lib/auth';
import {easternClock} from '../../../../server/session-scheduling.mjs';
import {serviceCommissionReport} from '../../../../server/service-commission-report.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
export async function GET(req:Request){try{const owner=await requireOwner(req),pool=getPool(),b=(await pool.query("SELECT id FROM businesses WHERE owner_id=$1 AND status='active'",[owner])).rows[0];if(!b)throw Error('Business unavailable.');const p=new URL(req.url).searchParams,today=easternClock().date;return Response.json(await serviceCommissionReport(pool,{businessId:b.id,from:p.get('from')||today.slice(0,7)+'-01',to:p.get('to')||today,staffId:p.has('staffId')?p.get('staffId'):null,page:Number(p.get('page')||0)}),{headers});}catch(e:any){return Response.json({error:e.message==='AUTH_REQUIRED'?'Sign in as the business owner.':e.message},{status:e.message==='AUTH_REQUIRED'?401:400,headers});}}
