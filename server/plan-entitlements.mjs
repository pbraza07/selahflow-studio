/**
 * SelahFlow subscription catalog and server-side entitlements.
 * The public prices are proposed launch rates; plan assignment never processes
 * payment. Actual access derives only from the database subscription record.
 * Add-on AI/phone/SMS services remain unavailable until separately configured.
 */
export const PLAN_CATALOG=Object.freeze({
 free:Object.freeze({
  name:'Free',monthlyCents:0,bookableStaff:1,
  summary:'A calm, organized starting point for solo service providers.',
  limits:Object.freeze({services:10,bookingFields:5,sessionSeries:15,membershipPlans:2}),
  included:Object.freeze([
   '1 bookable team member',
   'Up to 10 services in your catalog',
   'Up to 5 custom booking questions',
   'Up to 15 scheduled session templates or recurring series',
   'Up to 2 active customer membership offers',
   'Online appointments and daily, weekly, monthly calendars',
   'Client directory, attendance history and Excel exports',
   'Business branding, booking approvals and in-app / device push alerts'
  ])
 }),
 professional:Object.freeze({
  name:'Professional',monthlyCents:2499,bookableStaff:3,
  summary:'More team members and flexibility for a busy growing business.',
  limits:Object.freeze({services:50,bookingFields:15,sessionSeries:75,membershipPlans:10}),
  included:Object.freeze([
   'Up to 3 bookable team members',
   'Up to 50 services in your catalog',
   'Up to 15 custom booking questions',
   'Up to 75 session templates or recurring series',
   'Up to 10 active customer membership offers',
   'Online booking, calendars, staff schedules and group capacity tracking',
   'Client history, attendance reports and Excel exports',
   'Business branding, booking approvals and device push alerts'
  ])
 }),
 business:Object.freeze({
  name:'Business',monthlyCents:6999,bookableStaff:10,
  summary:'Room for multiple professionals, programs and a larger catalog.',
  limits:Object.freeze({services:150,bookingFields:25,sessionSeries:200,membershipPlans:25}),
  included:Object.freeze([
   'Up to 10 bookable team members',
   'Up to 150 services in your catalog',
   'Up to 25 custom booking questions',
   'Up to 200 session templates or recurring series',
   'Up to 25 active customer membership offers',
   'Staff calendars, recurring group sessions and remaining-seat tracking',
   'Client directory, full attendance history, reporting and Excel exports',
   'Custom branding, booking approval controls and device push alerts'
  ])
 })
});
export const PLAN_CODES=Object.freeze(Object.keys(PLAN_CATALOG));
export const PLAN_LIMIT_NAMES=Object.freeze({
 services:'service catalog items',
 bookingFields:'custom booking questions',
 sessionSeries:'session templates or recurring series',
 membershipPlans:'active customer membership offers'
});
export function normalizePlanCode(planCode,status='active'){
 if(status!=='active'||typeof planCode!=='string'||!Object.hasOwn(PLAN_CATALOG,planCode))return 'free';
 return planCode;
}
export function planEntitlements(planCode,status='active'){
 const effectiveCode=normalizePlanCode(planCode,status);
 const plan=PLAN_CATALOG[effectiveCode];
 return {code:effectiveCode,name:plan.name,monthlyCents:plan.monthlyCents,
  bookableStaff:plan.bookableStaff,limits:{...plan.limits},included:[...plan.included],
  subscriptionStatus:status||'inactive'};
}
const ids=xs=>new Set((Array.isArray(xs)?xs:[]).map(x=>x?.id).filter(x=>typeof x==='string'));
export function checkSubscriptionLimits(plan,oldConfig,newConfig){
 const ent=planEntitlements(plan?.plan_code,plan?.status);
 for(const [name,key] of [['services','services'],['bookingCustomFields','bookingFields'],['bookableSessions','sessionSeries']]){
  const before=ids(oldConfig?.[name]),after=ids(newConfig?.[name]);
  const added=[...after].filter(id=>!before.has(id));
  if(after.size>ent.limits[key]&&added.length)
   throw Error('The '+ent.name+' plan allows up to '+ent.limits[key]+' '+PLAN_LIMIT_NAMES[key]+
    '. Existing records remain available. Remove unused items or contact the platform administrator about a plan change.');
 }
 return ent;
}
export function activeMembershipLimit(planCode,status='active'){
 return planEntitlements(planCode,status).limits.membershipPlans;
}
