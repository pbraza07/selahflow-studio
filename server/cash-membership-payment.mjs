import {randomUUID} from 'node:crypto';
import {accountAppointments} from './team-portal.mjs';
import {accrueCashCommission} from './cash-commission-billing.mjs';
import {applyManualPeriod} from './manual-membership-period.mjs';
import {queueMembershipPaymentEmail} from './membership-payment-emails.mjs';
const data=row=>typeof row.data==='string'?JSON.parse(row.data):row.data||{};
export async function teamCashMemberships(db,team){
 const ids=[...new Set((await accountAppointments(db,team)).filter(a=>!['Cancelled','No-show'].includes(a.status)).map(a=>data(a).memberNumber).filter(Boolean))];
 if(!ids.length)return [];
 return (await db.query("SELECT m.id,m.customer_name,m.member_number,m.price_cents,p.name AS plan_name FROM customer_memberships m JOIN membership_plans p ON p.id=m.plan_id AND p.business_id=m.business_id WHERE m.business_id=$1 AND m.member_number=ANY($2::text[]) AND m.status='pending_payment' AND COALESCE(m.stripe_account_id,'') NOT LIKE 'acct_%' AND m.stripe_subscription_id IS NULL AND m.stripe_checkout_session_id IS NULL ORDER BY m.created_at DESC",[team.business_id,ids])).rows;
}
export async function confirmCashMembership(pool,{owner,membershipId,confirmed,teamAccountId=null,origin}){
 if(confirmed!==true)throw Error('Confirm cash was received before recording payment.');
 const db=await pool.connect();try{await db.query('BEGIN');
 const b=(await db.query("SELECT id FROM businesses WHERE owner_id=$1 AND status='active'",[owner])).rows[0];if(!b)throw Error('Business unavailable.');
 if(teamAccountId){const team=(await db.query("SELECT a.*,b.owner_id FROM team_accounts a JOIN businesses b ON b.id=a.business_id WHERE a.id=$1 AND b.id=$2 AND b.status='active' AND a.active=true AND a.must_change_password=false FOR SHARE OF a",[teamAccountId,b.id])).rows[0];if(!team||!(await teamCashMemberships(db,team)).some(m=>m.id===membershipId))throw Error('Choose an unpaid membership for a client assigned to you.');}
 const m=(await db.query('SELECT m.*,p.interval_unit,p.interval_count,p.sessions_included AS plan_sessions FROM customer_memberships m JOIN membership_plans p ON p.id=m.plan_id AND p.business_id=m.business_id WHERE m.business_id=$1 AND m.id=$2 FOR UPDATE OF m',[b.id,membershipId])).rows[0];
 if(!m)throw Error('Membership unavailable.');
 if(m.stripe_account_id?.startsWith('acct_')||m.stripe_subscription_id||m.stripe_checkout_session_id)throw Error('Stripe manages this membership. Resolve its card payment before recording cash.');
 if(m.status!=='pending_payment'||m.initial_paid_at||m.last_paid_at)throw Error('This initial membership payment is already recorded or unavailable.');
 if(!m.member_number||!Number.isInteger(m.price_cents)||m.price_cents<=0||!Number.isInteger(m.plan_sessions)||m.plan_sessions<1)throw Error('Review this membership client ID, price and credits before recording cash.');
 await accrueCashCommission(db,{businessId:b.id,kind:'membership',memberNumber:m.member_number,sourceId:m.id,grossCents:m.price_cents});
 const allocation=await applyManualPeriod(db,{member:m,credits:m.plan_sessions,plan:m}),paymentId=randomUUID(),requestId=randomUUID();
 await db.query("INSERT INTO membership_session_ledger(id,business_id,membership_id,appointment_id,event_type,session_delta,amount_cents) VALUES($1,$2,$3,$4,'payment_confirmed',$5,$6)",[paymentId,b.id,m.id,requestId,allocation.allocated,m.price_cents]);
 await db.query("INSERT INTO events(id,owner,created,kind,data) VALUES($1,$2,$3,'membership_payment',$4)",[randomUUID(),owner,new Date().toISOString(),JSON.stringify({membershipId:m.id,memberNumber:m.member_number,requestId,amountCents:m.price_cents,renewal:false,payment:'cash',confirmedBy:teamAccountId||owner,confirmedRole:teamAccountId?'team':'owner'})]);
 await queueMembershipPaymentEmail(db,{businessId:b.id,paymentId,origin,paymentMethod:'Cash received by the business'});
 await db.query('COMMIT');return {paid:true,provider:'cash',credited:allocation.allocated};
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
