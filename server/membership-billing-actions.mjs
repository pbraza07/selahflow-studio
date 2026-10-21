import {randomUUID} from 'node:crypto';
import {stripeApi} from './membership-payments.mjs';
import {assertTestPayment} from './stripe-checkout.mjs';
import {monthlyPeriod,anniversary,nextBillingAnchor} from './membership-periods.mjs';
import {queueMembershipInvitation} from './membership-invitations.mjs';
export async function membershipBillingAction(db,{business,owner,input,origin,api=stripeApi}){
 if(input.action==='sendPayment')return queueMembershipInvitation(db,{businessId:business.id,membershipId:String(input.id||''),origin});
 if(input.action==='saveCoupon'){
  const code=String(input.code||'').trim().toUpperCase(),description=String(input.description||'').trim(),value=Number(input.value);
  if(!/^[A-Z0-9_-]{3,40}$/.test(code)||description.length>500||!['percent','fixed'].includes(input.kind)||!Number.isInteger(value)||value<1||input.kind==='percent'&&value>100||value>100000000||!['once','forever'].includes(input.duration))throw Error('Enter a valid coupon code, discount and duration.');
  const expiry=input.expiresAt?new Date(input.expiresAt):null;if(expiry&&!Number.isFinite(expiry.getTime()))throw Error('Enter a valid coupon expiry.');
  await db.query('INSERT INTO business_coupons(business_id,code,description,kind,value,duration,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7)',[business.id,code,description,input.kind,value,input.duration,expiry?.toISOString()||null]);return {ok:true};
 }
 if(input.action==='toggleCoupon'){await db.query('UPDATE business_coupons SET active=$1 WHERE business_id=$2 AND id=$3',[input.active===true,business.id,input.id]);return {ok:true};}
 const member=(await db.query('SELECT m.*,p.interval_unit,p.interval_count,p.name AS plan_name FROM customer_memberships m JOIN membership_plans p ON p.id=m.plan_id AND p.business_id=m.business_id WHERE m.id=$1 AND m.business_id=$2 FOR UPDATE OF m',[input.id,business.id])).rows[0];
 if(!member)throw Error('Choose a member in this business.');
 const requestId=String(input.requestId||'');if(!/^[a-f0-9-]{36}$/i.test(requestId))throw Error('Invalid update request.');
 if(input.action==='setInitialDate'){
  const value=String(input.initialDate||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||new Date(value+'T12:00:00Z').toISOString().slice(0,10)!==value||value>new Date().toISOString().slice(0,10))throw Error('Enter a valid initial date no later than today.');
  const period=monthlyPeriod(value+'T12:00:00Z');const nextPayment=nextBillingAnchor(value+'T12:00:00Z',new Date(),member.stripe_interval_unit==='month'?Number(member.stripe_interval_count)||1:1);
  if((member.stripe_interval_unit||member.interval_unit)!=='month')throw Error('Choose monthly recurring billing before overriding its monthly initial date.');
  if(member.stripe_subscription_id){const subscription=await api('subscriptions/'+member.stripe_subscription_id,{method:'GET',account:member.stripe_account_id});assertTestPayment(subscription);if(subscription.metadata?.membership_id!==member.id||subscription.metadata?.selahflow_business_id!==business.id)throw Error('Stripe membership identity does not match.');await api('subscriptions/'+member.stripe_subscription_id,{account:member.stripe_account_id,idempotencyKey:'member-date-'+requestId,params:{trial_end:Math.floor(nextPayment.getTime()/1000),proration_behavior:'none','metadata[selahflow_initial_date]':value}});}
  await db.query('UPDATE customer_memberships SET billing_start_override=$1,credit_period_start=CASE WHEN initial_paid_at IS NULL THEN credit_period_start ELSE $2 END,credit_period_end=CASE WHEN initial_paid_at IS NULL THEN credit_period_end ELSE $3 END,paid_through=CASE WHEN initial_paid_at IS NULL THEN paid_through ELSE $6 END,updated_at=now() WHERE id=$4 AND business_id=$5',[value,period.start.toISOString(),period.end.toISOString(),member.id,business.id,nextPayment.toISOString()]);
  await db.query("INSERT INTO events(id,owner,created,kind,data) VALUES($1,$2,$3,'membership_billing_date',$4)",[randomUUID(),owner,new Date().toISOString(),JSON.stringify({membershipId:member.id,initialDate:value,nextPayment:nextPayment.toISOString(),stripeSynchronized:!!member.stripe_subscription_id})]);return {ok:true,nextPayment:nextPayment.toISOString()};
 }
 if(input.action==='syncRecurrence'){
  if(!member.stripe_subscription_id)throw Error('The member must authorize recurring Stripe enrollment first. Send a payment invitation.');
  const unit=input.interval,count=Number(input.intervalCount);if(!['week','month','year'].includes(unit)||!Number.isInteger(count)||count<1||count>12)throw Error('Choose a valid recurrence.');
  const sub=await api('subscriptions/'+member.stripe_subscription_id,{method:'GET',account:member.stripe_account_id});assertTestPayment(sub);if(sub.metadata?.membership_id!==member.id||sub.metadata?.selahflow_business_id!==business.id||sub.items?.data?.length!==1)throw Error('Stripe subscription does not match this membership.');
  const item=sub.items.data[0],product=typeof item.price.product==='string'?item.price.product:item.price.product?.id;
  const price=await api('prices',{account:member.stripe_account_id,idempotencyKey:'member-price-'+requestId,params:{currency:'usd',unit_amount:member.price_cents,product,'recurring[interval]':unit,'recurring[interval_count]':count}});
  // Explicit owner action schedules this change at the already-paid renewal boundary.
  const existingSchedule=typeof sub.schedule==='string'?sub.schedule:null;
  if(existingSchedule)throw Error('This subscription already has a schedule. Review it in Stripe before changing recurrence.');
  const schedule=await api('subscription_schedules',{account:member.stripe_account_id,idempotencyKey:'member-schedule-'+requestId,params:{from_subscription:sub.id}});
  const phase=schedule.phases?.[0];if(!phase?.end_date)throw Error('Stripe did not return the current billing boundary.');
  await api('subscription_schedules/'+schedule.id,{account:member.stripe_account_id,idempotencyKey:'member-schedule-update-'+requestId,params:{end_behavior:'release','phases[0][start_date]':phase.start_date,'phases[0][end_date]':phase.end_date,'phases[0][items][0][price]':item.price.id,'phases[0][items][0][quantity]':1,'phases[1][items][0][price]':price.id,'phases[1][items][0][quantity]':1,'phases[1][proration_behavior]':'none','phases[1][duration][interval]':unit,'phases[1][duration][interval_count]':count}});
  await db.query('UPDATE customer_memberships SET stripe_interval_unit=$1,stripe_interval_count=$2,updated_at=now() WHERE id=$3 AND business_id=$4',[unit,count,member.id,business.id]);return {ok:true,effectiveAt:new Date(phase.end_date*1000).toISOString()};
 }
 throw Error('Choose a valid membership billing action.');
}
