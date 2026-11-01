import {randomUUID} from 'node:crypto';
import {getPool} from '../../../../server/database.mjs';
import {teamIdentity} from '../../../../server/team-portal.mjs';
import {validOrigin,trustedOrigin} from '../../../../server/security.mjs';
import {recordCashSale} from '../../../../server/record-cash-sale.mjs';
import {teamCashMemberships,confirmCashMembership} from '../../../../server/cash-membership-payment.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
const fail=(e:any)=>Response.json({error:e.message},{status:e.status||400,headers});
export async function GET(req:Request){try{const pool=getPool(),a=await teamIdentity(pool,req);return Response.json({memberships:await teamCashMemberships(pool,a)},{headers});}catch(e){return fail(e);}}
export async function POST(req:Request){if(!validOrigin(req))return Response.json({error:'Invalid origin.'},{status:403,headers});try{
 const pool=getPool(),a=await teamIdentity(pool,req),raw=await req.text();if(raw.length>2000)throw Error('Request too large.');const input=JSON.parse(raw);
 if(input.confirmed!==true||!/^[-a-f0-9]{36}$/i.test(input.id||''))throw Error('Choose a payment and confirm cash was received.');
 if(input.kind==='membership')return Response.json(await confirmCashMembership(pool,{owner:a.owner_id,teamAccountId:a.id,membershipId:input.id,confirmed:true,origin:trustedOrigin(req)}),{headers});
 if(input.kind!=='booking')throw Error('Choose a valid cash payment.');
 await recordCashSale(pool,{owner:a.owner_id,teamAccountId:a.id,eventId:randomUUID(),bookingId:input.id,onsiteConfirmed:true});return Response.json({paid:true,provider:'cash'},{headers});
 }catch(e){return fail(e);}}
