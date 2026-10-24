import {getPool} from '../../../../server/database.mjs';
import {requireGmailAdmin} from '../../../../lib/platform-gmail-auth';
import {commissionStripeStatus,configureCommissionStripe,assertCommissionStripeReady} from '../../../../server/commission-stripe-setup.mjs';
import {validOrigin,trustedOrigin} from '../../../../server/security.mjs';
import {commissionSettings,saveCommissionSettings,setPlatformCommissionEnabled} from '../../../../server/first-customer-commissions.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
function failure(e:unknown){const message=(e as Error).message;return Response.json({error:message==='AUTH_REQUIRED'?'Sign in to continue.':message==='FORBIDDEN'?'Primary platform administrator required.':message},{status:message==='AUTH_REQUIRED'?401:message==='FORBIDDEN'?403:400,headers});}
export async function GET(req:Request){
 try{
  await requireGmailAdmin(req);const pool=getPool();
  const businesses=(await pool.query(`SELECT b.id,b.name,b.slug,b.status,EXISTS(SELECT 1 FROM merchant_accounts m WHERE m.business_id=b.id AND m.provider='stripe' AND m.charges_enabled=true AND m.onboarding_complete=true) AS "paymentReady" FROM businesses b ORDER BY b.name,b.id`)).rows;
  return Response.json({stripe:await commissionStripeStatus(trustedOrigin(req)),businesses:await Promise.all(businesses.map(async (b:{id:string;name:string;slug:string;status:string;paymentReady:boolean})=>({...b,commissions:await commissionSettings(pool,b.id)})))},{headers});
 }catch(e){return failure(e);}
}
export async function POST(req:Request){
 if(!validOrigin(req))return Response.json({error:'Invalid origin.'},{status:403,headers});
 try{
  const actor=await requireGmailAdmin(req),pool=getPool(),raw=await req.text();if(raw.length>500)throw Error('Request too large.');const body=JSON.parse(raw);
  if(body.action==='configureWebhooks')return Response.json(await configureCommissionStripe(trustedOrigin(req)),{headers});
  if(!['pause','setEnabled'].includes(body.action)||!/^[-a-f0-9]{36}$/i.test(body.businessId||''))throw Error('Choose a business and commission action.');
  if(body.action==='setEnabled'){
   if(!['booking','membership'].includes(body.kind)||typeof body.enabled!=='boolean')throw Error('Choose a commission type and an enabled or disabled state.');
   if(body.enabled)await assertCommissionStripeReady(trustedOrigin(req));
  }
  const db=await pool.connect();
  try{
   await db.query('BEGIN');
   const data=body.action==='setEnabled'
    ?await setPlatformCommissionEnabled(db,{businessId:body.businessId,actor,kind:body.kind,enabled:body.enabled})
    :await saveCommissionSettings(db,{businessId:body.businessId,actor,bookingEnabled:false,membershipEnabled:false,acceptTerms:false});
   await db.query('COMMIT');return Response.json(data,{headers});
  }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
 }catch(e){return failure(e);}
}
