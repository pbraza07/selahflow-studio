import {getPool} from '../../../../../server/database.mjs';
import {stripeApi} from '../../../../../server/membership-payments.mjs';
import {assertTestPayment,applyMembershipInvoice} from '../../../../../server/stripe-checkout.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:Request){
 const url=new URL(req.url),slug=url.searchParams.get('slug')||'',session=url.searchParams.get('session_id')||'';
 if(!/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(slug)||!/^cs_(test_|live_)[A-Za-z0-9_]+$/.test(session))
  return Response.json({status:'unavailable'},{status:400,headers:{'Cache-Control':'no-store'}});
 try{
  const pool=getPool();
  const member=(await pool.query("SELECT m.business_id,m.stripe_account_id FROM customer_memberships m JOIN businesses b ON b.id=m.business_id WHERE b.slug=$1 AND b.status='active' AND m.stripe_checkout_session_id=$2",[slug,session])).rows[0];
  if(member){
   const checkout=await stripeApi('checkout/sessions/'+session,{method:'GET',account:member.stripe_account_id});assertTestPayment(checkout);
   if(typeof checkout.subscription==='string'){
    const subscription=await stripeApi('subscriptions/'+checkout.subscription,{method:'GET',account:member.stripe_account_id});
    if(typeof subscription.latest_invoice==='string'){
     const invoice=await stripeApi('invoices/'+subscription.latest_invoice,{method:'GET',account:member.stripe_account_id});
     const db=await pool.connect();try{await db.query('BEGIN');await applyMembershipInvoice(db,member.business_id,member.stripe_account_id,invoice,subscription);await db.query('COMMIT');}catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
    }
   }
  }
  const result=await pool.query("SELECT m.status,m.paid_through,m.member_number,m.sessions_included,m.sessions_used,p.name AS plan_name FROM customer_memberships m JOIN businesses b ON b.id=m.business_id JOIN membership_plans p ON p.id=m.plan_id WHERE b.slug=$1 AND b.status='active' AND m.stripe_checkout_session_id=$2 LIMIT 1",[slug,session]);
  if(!result.rows.length)return Response.json({status:'pending_payment'},{headers:{'Cache-Control':'no-store'}});
  const row=result.rows[0];
  return Response.json({status:row.status,plan:row.plan_name,paidThrough:row.paid_through,...(row.status==='active'?{memberNumber:row.member_number,sessionsLeft:Math.max(0,row.sessions_included-row.sessions_used)}:{})},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({status:'unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
