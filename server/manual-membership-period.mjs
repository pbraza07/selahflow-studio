import {anniversary,monthlyPeriod,membershipAnchor,nextBillingAnchor} from './membership-periods.mjs';
export async function applyManualPeriod(db,{member,credits,plan,now=new Date()}){
 const initial=member.initial_paid_at||now,anchor=membershipAnchor({...member,initial_paid_at:initial}),period=monthlyPeriod(anchor,now);
 const reset=!member.initial_paid_at||member.status!=='active'||!member.credit_period_end||new Date(member.credit_period_end)<=now;
 const base=member.paid_through&&new Date(member.paid_through)>now?new Date(member.paid_through):now;
 const unit=plan.interval_unit||'month',count=Number(plan.interval_count)||1;
 let through;if(unit==='week')through=new Date(base.getTime()+count*7*86400000);else through=nextBillingAnchor(anchor,base,unit==='year'?12*count:count);
 if(reset&&member.credit_period_start)await db.query('INSERT INTO membership_credit_periods(business_id,membership_id,period_start,period_end,sessions_included,sessions_used) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING',[member.business_id,member.id,member.credit_period_start,member.credit_period_end,member.sessions_included,member.sessions_used]);
 await db.query("UPDATE customer_memberships SET sessions_included=CASE WHEN $1 THEN $2 ELSE sessions_included END,sessions_used=CASE WHEN $1 THEN 0 ELSE sessions_used END,status='active',initial_paid_at=COALESCE(initial_paid_at,$3),monthly_sessions=$2,credit_period_start=CASE WHEN $1 THEN $4 ELSE credit_period_start END,credit_period_end=CASE WHEN $1 THEN $5 ELSE credit_period_end END,paid_through=$6,last_paid_at=$3,updated_at=now() WHERE id=$7 AND business_id=$8",[reset,credits,new Date(now).toISOString(),period.start.toISOString(),period.end.toISOString(),through.toISOString(),member.id,member.business_id]);
 return {allocated:reset?credits:0,paidThrough:through.toISOString()};
}
