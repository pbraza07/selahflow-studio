import {receiptLinks} from './booking-receipts.mjs';
import {sendNotificationChannel,validEmail,maskDestination} from './notification-delivery.mjs';
const object=x=>typeof x==='string'?JSON.parse(x):x||{};
const clean=x=>String(x??'').replace(/[<>\r\n]/g,' ').slice(0,300);
/** The payment ledger and this snapshot commit together. No email is queued for unpaid signup. */
export async function queueMembershipPaymentEmail(db,{businessId,paymentId,paymentMethod='Recorded by the business',renewal=false,origin=process.env.APP_URL||process.env.RENDER_EXTERNAL_URL}){
 const row=(await db.query("SELECT l.id,l.amount_cents,l.session_delta,l.created_at,m.id AS membership_id,m.customer_name,m.customer_email,m.member_number,m.sessions_included,m.sessions_used,m.paid_through,p.name AS plan_name,p.description,p.interval_unit,b.name AS business,b.slug FROM membership_session_ledger l JOIN customer_memberships m ON m.id=l.membership_id AND m.business_id=l.business_id JOIN membership_plans p ON p.id=m.plan_id AND p.business_id=m.business_id JOIN businesses b ON b.id=l.business_id WHERE l.business_id=$1 AND l.id=$2 AND l.event_type='payment_confirmed' AND b.status='active'",[businessId,paymentId])).rows[0];
 if(!row)return;
 let links=null;try{if(origin)links=receiptLinks(origin,row.slug);}catch{/* Receipt still records payment if the app URL needs configuration. */}
 const snapshot={planName:clean(row.plan_name),description:clean(row.description),memberNumber:clean(row.member_number),sessionsAdded:Number(row.session_delta),sessionsLeft:Math.max(0,Number(row.sessions_included)-Number(row.sessions_used)),sessionsUsed:Number(row.sessions_used),amountCents:Number(row.amount_cents),interval:clean(row.interval_unit),paidThrough:row.paid_through?new Date(row.paid_through).toISOString():null,paymentMethod,renewal};
 const amount=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(snapshot.amountCents/100);
 const actions=links?[{label:'Check membership status',url:links.status},{label:'Book a session',url:links.booking},{label:'Explore membership options',url:links.membership}]:[];
 const message={subject:`Membership payment confirmed — ${clean(row.business)}`,actions,text:`Hello ${clean(row.customer_name)},\n\nThank you! Your ${snapshot.planName} membership payment at ${clean(row.business)} is recorded.\n\nMembership: ${snapshot.planName}${snapshot.description?'\n'+snapshot.description:''}\nMembership ID: ${snapshot.memberNumber}\nAmount paid: ${amount}\nPayment method: ${clean(paymentMethod)}\nPlan period: ${snapshot.interval}\nSessions added: ${snapshot.sessionsAdded}\nSessions left: ${snapshot.sessionsLeft}\nSessions taken / used: ${snapshot.sessionsUsed}${snapshot.paidThrough?'\nPaid through: '+new Intl.DateTimeFormat('en-US',{dateStyle:'medium',timeZone:'America/New_York'}).format(new Date(snapshot.paidThrough)):''}\nBalance at the time of this email.\n\n${links?'Check membership status: '+links.status+'\nBook a session: '+links.booking+'\nExplore plans: '+links.membership:'Contact the business for membership details.'}\n\nWe look forward to seeing you!`};
 await db.query('INSERT INTO membership_payment_emails(payment_id,business_id,membership_id,destination,destination_masked,snapshot,message) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb) ON CONFLICT DO NOTHING',[paymentId,businessId,row.membership_id,String(row.customer_email||'').trim(),maskDestination(row.customer_email,'email'),JSON.stringify(snapshot),JSON.stringify(message)]);
}
export async function processMembershipPaymentEmails(pool,{send=sendNotificationChannel,limit=10}={}){
 await pool.query("UPDATE membership_payment_emails SET status='unknown',detail='Delivery outcome unknown; check provider before resending',updated_at=now() WHERE status='processing' AND updated_at<now()-interval '2 minutes'");
 let processed=0;
 for(let i=0;i<limit;i++){
  const item=(await pool.query("UPDATE membership_payment_emails SET status='processing',updated_at=now() WHERE payment_id=(SELECT e.payment_id FROM membership_payment_emails e JOIN businesses b ON b.id=e.business_id WHERE b.status='active' AND ((e.status IN ('queued','failed') AND e.attempts<3) OR e.status='not_configured') AND e.next_attempt_at<=now() ORDER BY e.next_attempt_at FOR UPDATE OF e SKIP LOCKED LIMIT 1) RETURNING *")).rows[0];
  if(!item)break;processed++;
  try{
   const valid=(await pool.query("SELECT 1 FROM membership_session_ledger l JOIN customer_memberships m ON m.id=l.membership_id AND m.business_id=l.business_id JOIN businesses b ON b.id=l.business_id WHERE l.id=$1 AND l.business_id=$2 AND l.membership_id=$3 AND l.event_type='payment_confirmed' AND b.status='active'",[item.payment_id,item.business_id,item.membership_id])).rows.length>0;
   const result=!valid?{status:'superseded',detail:'Payment no longer available'}:!validEmail(item.destination)?{status:'invalid_destination',detail:'Membership email missing or invalid'}:await send('email',item.destination,{...object(item.message),idempotencyKey:'membership-payment-'+item.payment_id,trackAmbiguous:true},undefined,undefined,{kind:'transactional-client',queuedAt:item.created_at});
   await pool.query("UPDATE membership_payment_emails SET status=$1,detail=$2,attempts=attempts+CASE WHEN $1='failed' THEN 1 ELSE 0 END,next_attempt_at=now()+interval '5 minutes',updated_at=now() WHERE payment_id=$3 AND status='processing'",[result.status,result.detail,item.payment_id]);
   console.log('Membership payment email:',JSON.stringify({status:result.status}));
  }catch{await pool.query("UPDATE membership_payment_emails SET status='unknown',detail='Delivery outcome unknown; check provider before resending',updated_at=now() WHERE payment_id=$1 AND status='processing'",[item.payment_id]);}
 }
 return {processed};
}
