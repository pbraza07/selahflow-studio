import {getPool} from '../../../../server/database.mjs';
import {validOrigin} from '../../../../server/security.mjs';
import {teamLogin,teamCookie} from '../../../../server/team-portal.mjs';
export const runtime='nodejs';
export async function POST(req:Request){const headers={'Cache-Control':'private, no-store'};if(!validOrigin(req))return Response.json({error:'Invalid origin.'},{status:403,headers});try{const raw=await req.text();if(raw.length>4096)return Response.json({error:'Request too large.'},{status:413,headers});const r=await teamLogin(getPool(),JSON.parse(raw));if(r.choices)return Response.json({choices:r.choices},{headers});return Response.json({ok:true,mustChangePassword:r.mustChangePassword},{headers:{...headers,'Set-Cookie':teamCookie(r.token)}});}catch(e:any){return Response.json({error:e.status?e.message:'Unable to sign in. Try again.'},{status:e.status||503,headers});}}
