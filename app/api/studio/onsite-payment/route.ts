import {confirmCashMembership} from '../../../../server/cash-membership-payment.mjs';
import {randomUUID} from 'node:crypto';
import {recordCashSale} from '../../../../server/record-cash-sale.mjs';
import {startOwnerOnsiteCheckout} from '../../../../server/stripe-checkout.mjs';
import {requireOwner} from '../../../../lib/auth';
import {getPool} from '../../../../server/database.mjs';
import {validOrigin,trustedOrigin,sessionToken,tokenHash} from '../../../../server/security.mjs';
import {authorizeNativePayment} from '../../../../server/native-payment-auth.mjs';
import {terminalSettings,saveTerminalLocation,checkTerminalPayment} from '../../../../server/terminal-payments.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
export async function GET(req:Request){try{const owner=await requireOwner(req);return Response.json(await terminalSettings(getPool(),owner),{headers});}catch(e){return Response.json({error:(e as Error).message},{status:(e as Error).message==='AUTH_REQUIRED'?401:400,headers});}}
export async function POST(req:Request){
 if(!validOrigin(req))return Response.json({error:'Invalid origin.'},{status:403,headers});
 try{
  const owner=await requireOwner(req),raw=await req.text();if(raw.length>3000)throw Error('Invalid request.');const body=JSON.parse(raw),pool=getPool();
  if(body.action==='authorize')return Response.json(await authorizeNativePayment(pool,{...body,owner,sessionHash:tokenHash(sessionToken(req))}),{headers});
  if(body.action==='location')return Response.json(await saveTerminalLocation(pool,owner,body.locationId),{headers});
  if(body.action==='cashMembership'){if(!/^[-a-f0-9]{36}$/i.test(body.membershipId||''))throw Error('Invalid membership.');return Response.json(await confirmCashMembership(pool,{owner,membershipId:body.membershipId,confirmed:body.confirmed,origin:trustedOrigin(req)}),{headers});}
  if(!/^[-a-f0-9]{36}$/i.test(body.bookingId||''))throw Error('Invalid appointment.');
  const b=(await pool.query("SELECT id FROM businesses WHERE owner_id=$1 AND status='active'",[owner])).rows[0];if(!b)throw Error('Business unavailable.');
  if(body.action==='cash'){if(body.confirmed!==true)throw Error('Confirm cash was received before recording payment.');await recordCashSale(pool,{owner,eventId:randomUUID(),bookingId:body.bookingId,onsiteConfirmed:true});return Response.json({paid:true,provider:'cash'},{headers});}
  if(body.action==='checkout')return Response.json(await startOwnerOnsiteCheckout(pool,{owner,bookingId:body.bookingId,origin:trustedOrigin(req)}),{headers});
  if(!['check','cancel'].includes(body.action))throw Error('Choose an onsite payment action.');
  return Response.json(await checkTerminalPayment(pool,{business_id:b.id,booking_id:body.bookingId},{cancel:body.action==='cancel'}),{headers});
 }catch(e){return Response.json({error:(e as Error).message},{status:(e as Error).message==='AUTH_REQUIRED'?401:400,headers});}
}
