import {membershipAnchor,monthlyPeriod} from './membership-periods.mjs';
import {weeklyMonthCredits} from './membership-weekly.mjs';

export function clientCardBalance(member,now=new Date()){
 const recurring=member.billing_type!=='package';
 const expired=member.paid_through&&new Date(member.paid_through)<=now;
 let status=member.status==='active'&&expired?'expired':member.status;
 let used=Number(member.sessions_used),total=Number(member.sessions_included);
 let end=member.credit_period_end?new Date(member.credit_period_end):null;
 const allocation=at=>member.weekly_sessions?weeklyMonthCredits(member,member.weekly_sessions,at):Number(member.monthly_sessions??member.stripe_sessions_per_period??0);
 if(recurring&&status==='active'&&end&&end<=now&&member.initial_paid_at){
  end=monthlyPeriod(membershipAnchor(member),now).end;
  used=0;total=allocation(now);
 }
 const scheduled=member.credit_period_start&&new Date(member.credit_period_start)>now;
 if(status==='active'&&scheduled)status='scheduled';
 const left=status==='active'?Math.max(0,total-used):0;
 if(status==='active'&&left===0)status='exhausted';
 const renews=recurring&&end&&member.initial_paid_at&&['active','scheduled','exhausted'].includes(status);
 return {id:member.id,name:member.membership_name,status,used,left,total,recurring,
  nextDate:renews?end.toISOString().slice(0,10):null,nextTotal:renews?allocation(end):null};
}
