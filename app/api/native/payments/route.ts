import {getPool} from '../../../../server/database.mjs';
import {trustedOrigin,tokenHash} from '../../../../server/security.mjs';
import {exchangeNativePayment,requireNativePayment} from '../../../../server/native-payment-auth.mjs';
import {nativePaymentInfo,nativeConnectionToken,startTerminalPayment,checkTerminalPayment} from '../../../../server/terminal-payments.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
/** Native capabilities only: owner cookies and browser origins cannot authorize a charge here. */
export async function POST(req:Request){
 if(req.headers.has('origin'))return Response.json({error:'Use the SelahFlow Pay phone app.'},{status:403,headers});
 try{
  const raw=await req.text();if(raw.length>3000)throw Error('Invalid request.');const body=JSON.parse(raw),pool=getPool();
  const ip=(req.headers.get('x-forwarded-for')||'unknown').split(',').at(-1)!.trim();
  const limit=(await pool.query("INSERT INTO public_limits(key,count,window_start) VALUES($1,1,now()) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN public_limits.window_start<now()-interval '15 minutes' THEN 1 ELSE public_limits.count+1 END,window_start=CASE WHEN public_limits.window_start<now()-interval '15 minutes' THEN now() ELSE public_limits.window_start END RETURNING count",['native-payment:'+tokenHash(ip)])).rows[0];
  if(limit.count>120)return Response.json({error:'Too many requests. Try again later.'},{status:429,headers});
  if(body.action==='exchange')return Response.json(await exchangeNativePayment(pool,body),{headers});
  const scope=await requireNativePayment(pool,(req.headers.get('authorization')||'').replace(/^Bearer /,''));
  if(body.action==='disconnect'){await pool.query('UPDATE native_payment_authorizations SET grant_expires_at=now() WHERE grant_hash=$1',[tokenHash((req.headers.get('authorization')||'').replace(/^Bearer /,''))]);return Response.json({disconnected:true},{headers});}
  if(body.action==='info')return Response.json(await nativePaymentInfo(pool,scope),{headers});
  if(body.action==='connection-token')return Response.json(await nativeConnectionToken(pool,scope),{headers});
  if(body.action==='start')return Response.json(await startTerminalPayment(pool,scope,trustedOrigin(req)),{headers});
  if(body.action==='check'||body.action==='cancel')return Response.json(await checkTerminalPayment(pool,scope,{cancel:body.action==='cancel'}),{headers});
  throw Error('Choose a payment action.');
 }catch(e){return Response.json({error:(e as Error).message},{status:(e as Error).message==='AUTH_REQUIRED'?401:400,headers});}
}
