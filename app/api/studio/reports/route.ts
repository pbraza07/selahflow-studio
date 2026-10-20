import {getPool} from '../../../../server/database.mjs';
import {requireOwner} from '../../../../lib/auth';
import {validOrigin} from '../../../../server/security.mjs';
import {loadFinancialPipeline} from '../../../../server/financial-pipeline.mjs';
import {resetPaidRevenue} from '../../../../server/report-reset.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
export async function GET(req:Request){
 try{const owner=await requireOwner(req);return Response.json({rows:await loadFinancialPipeline(getPool(),owner)},{headers});}
 catch(e){const auth=(e as Error).message==='AUTH_REQUIRED';return Response.json({error:auth?'Please sign in.':'Financial status report is unavailable. Retry to load current totals.'},{status:auth?401:503,headers});}
}
export async function POST(req:Request){
 if(!validOrigin(req))return Response.json({error:'Invalid origin.'},{status:403,headers});
 let db;
 try{
  const owner=await requireOwner(req),raw=await req.text();if(raw.length>2000)throw Error('Invalid reset request.');
  const body=JSON.parse(raw);if(body.action!=='resetPaidRevenue')throw Error('Invalid report action.');
  db=await getPool().connect();await db.query('BEGIN');const result=await resetPaidRevenue(db,owner,body);await db.query('COMMIT');
  return Response.json({ok:true,...result},{headers});
 }catch(e){if(db)await db.query('ROLLBACK');return Response.json({error:(e as Error).message},{status:(e as Error).message==='AUTH_REQUIRED'?401:400,headers});}finally{db?.release();}
}
