import {getPool} from '../../../../server/database.mjs';
import {validOrigin,tokenHash} from '../../../../server/security.mjs';
import {teamCookie,teamToken} from '../../../../server/team-portal.mjs';
export async function POST(req:Request){if(!validOrigin(req))return new Response(null,{status:403});await getPool().query('DELETE FROM team_sessions WHERE token_hash=$1',[tokenHash(teamToken(req))]);return Response.json({ok:true},{headers:{'Set-Cookie':teamCookie('',0),'Cache-Control':'private, no-store'}});}
