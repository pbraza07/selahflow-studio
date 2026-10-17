import {getPool} from '../../../../../server/database.mjs';
import {validOrigin,trustedOrigin,tokenHash} from '../../../../../server/security.mjs';
import {stripeApi} from '../../../../../server/membership-payments.mjs';
import {startBookingCheckout,applyBookingPayment,assertTestPayment} from '../../../../../server/stripe-checkout.mjs';
import {bookingPaymentPreview} from '../../../../../server/booking-payment-preview.mjs';
import {startRegistrationPayment} from '../../../../../server/registration-payment.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
export async function POST(req:Request){
 if(!validOrigin(req))return Response.json({error:'Invalid origin.'},{status:403,headers});
 try{
  const raw=await req.text();if(raw.length>2000)throw Error('Invalid payment request.');
  const body=JSON.parse(raw);
  const pool=getPool(),ip=(req.headers.get('x-forwarded-for')||'unknown').split(',').at(-1)!.trim();
  const limit=(await pool.query("INSERT INTO public_limits(key,count,window_start) VALUES($1,1,now()) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN public_limits.window_start<now()-interval '15 minutes' THEN 1 ELSE public_limits.count+1 END,window_start=CASE WHEN public_limits.window_start<now()-interval '15 minutes' THEN now() ELSE public_limits.window_start END RETURNING count",['booking-checkout:'+tokenHash(ip)])).rows[0];
  if(limit.count>30)return Response.json({error:'Too many payment requests. Try again later.'},{status:429,headers});
  if(body.action==='preview')return Response.json(await bookingPaymentPreview(pool,body),{headers});
  if(body.action==='registration'){
   const key='registration-checkout:'+tokenHash(ip+':'+String(body.slug)+':'+String(body.memberNumber));
   const tries=(await pool.query("INSERT INTO public_limits(key,count,window_start) VALUES($1,1,now()) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN public_limits.window_start<now()-interval '15 minutes' THEN 1 ELSE public_limits.count+1 END,window_start=CASE WHEN public_limits.window_start<now()-interval '15 minutes' THEN now() ELSE public_limits.window_start END RETURNING count",[key])).rows[0];
   if(tries.count>6)return Response.json({error:'Too many verification attempts. Try again later.'},{status:429,headers});
   return Response.json(await startRegistrationPayment(pool,{...body,origin:trustedOrigin(req)}),{headers});
  }
  return Response.json(await startBookingCheckout(getPool(),{...body,origin:trustedOrigin(req)}),{headers});
 }catch(e){return Response.json({error:(e as Error).message||'Unable to start payment.'},{status:400,headers});}
}
export async function GET(req:Request){
 const url=new URL(req.url),slug=url.searchParams.get('slug')||'',session=url.searchParams.get('session_id')||'';
 if(!/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(slug)||!/^cs_(test_|live_)[A-Za-z0-9_]{10,200}$/.test(session))return Response.json({error:'Invalid payment reference.'},{status:400,headers});
 const db=await getPool().connect();
 try{
  await db.query('BEGIN');
  const record=(await db.query("SELECT p.* FROM booking_payments p JOIN businesses b ON b.id=p.business_id WHERE b.slug=$1 AND b.status='active' AND p.stripe_checkout_session_id=$2",[slug,session])).rows[0];
  if(!record)throw Error('Payment not found.');
  const checkout=await stripeApi('checkout/sessions/'+session,{method:'GET',account:record.stripe_account_id});assertTestPayment(checkout);
  const paid=await applyBookingPayment(db,record.business_id,record.stripe_account_id,checkout);
  await db.query('COMMIT');
  return Response.json({status:paid?'paid':checkout.status==='expired'?'expired':'pending',amountCents:record.amount_cents},{headers});
 }catch(e){await db.query('ROLLBACK');return Response.json({error:'Payment verification is temporarily unavailable. Please retry.'},{status:503,headers});}finally{db.release();}
}
