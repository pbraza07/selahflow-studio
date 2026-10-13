import {getPool} from '../../../../server/database.mjs';
import {requireOwner} from '../../../../lib/auth';
import {validOrigin} from '../../../../server/security.mjs';
import {reviewMembershipRequest} from '../../../../server/membership-requests.mjs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
export async function GET(req:Request){try{const owner=await requireOwner(req);const rows=await getPool().query("SELECT r.id,r.details,r.created_at,p.name AS plan_name FROM membership_requests r JOIN businesses b ON b.id=r.business_id JOIN membership_plans p ON p.id=r.plan_id WHERE b.owner_id=$1 AND r.status='pending' ORDER BY r.created_at DESC",[owner]);return Response.json({requests:rows.rows},{headers});}catch(e){return Response.json({error:'Please sign in to review membership requests.'},{status:401,headers});}}
export async function POST(req:Request){if(!validOrigin(req))return Response.json({error:'Invalid origin.'},{status:403});let client;try{const owner=await requireOwner(req),body=await req.json();if(typeof body.id!=='string'||!['approve','decline'].includes(body.action))throw Error('Invalid request.');client=await getPool().connect();await client.query('BEGIN');const result=await reviewMembershipRequest(client,{owner,id:body.id,approve:body.action==='approve'});await client.query('COMMIT');return Response.json(result,{headers});}catch(e){if(client)await client.query('ROLLBACK');return Response.json({error:(e as Error).message},{status:(e as Error).message==='AUTH_REQUIRED'?401:400,headers});}finally{client?.release();}}
