import {getPool} from '../../../../server/database.mjs';
import {teamIdentity} from '../../../../server/team-portal.mjs';
import {teamBookingNotifications,markTeamBookingNotificationsRead} from '../../../../server/team-booking-push.mjs';
import {validOrigin} from '../../../../server/security.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
const fail=(status=403)=>Response.json({error:'Team appointment notifications are unavailable.'},{status,headers});
export async function GET(req:Request){try{const account=await teamIdentity(getPool(),req);const items=await teamBookingNotifications(getPool(),account);return Response.json({items,unread:items.filter((x:{unread:boolean})=>x.unread).length},{headers});}catch{return fail();}}
export async function POST(req:Request){
 if(!validOrigin(req))return fail(403);
 try{const account=await teamIdentity(getPool(),req),raw=await req.text();if(raw.length>10000)return fail(413);const body=JSON.parse(raw),ids=body.ids;if(body.action!=='markRead'||!Array.isArray(ids)||ids.length>100||!ids.every((x:unknown)=>typeof x==='string'&&x.length>0&&x.length<=150))return fail(400);await markTeamBookingNotificationsRead(getPool(),account,[...new Set(ids)]);return Response.json({ok:true},{headers});}catch{return fail();}
}
