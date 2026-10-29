import {getPool} from '../../../../server/database.mjs';
import {publicTeam} from '../../../../server/team-portal.mjs';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{return Response.json(await publicTeam(getPool(),new URL(req.url).searchParams.get('id')||''),{headers:{'Cache-Control':'no-store'}});}catch(e:any){return Response.json({error:'Team page unavailable.'},{status:e.status||503,headers:{'Cache-Control':'no-store'}});}}
