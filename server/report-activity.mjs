/** One appointment occupies exactly one operational status bucket; money is counted separately. */
export const SCHEDULED_APPOINTMENT_STATUSES=new Set(['Confirmed','Scheduled']);
export const CHECKED_IN_APPOINTMENT_STATUSES=new Set(['Checked in','Checked-in']);
export const UNPAID_FORECAST_STATUSES=new Set(['Confirmed','Scheduled','Checked in','Checked-in','Completed']);
export function appointmentActivity(appointments){
 const rows=Array.isArray(appointments)?appointments:[];
 const is=(statuses)=>rows.filter(a=>statuses.has(a.status));
 return {
  all:rows,
  booked:is(SCHEDULED_APPOINTMENT_STATUSES),
  checkedIn:is(CHECKED_IN_APPOINTMENT_STATUSES),
  completed:rows.filter(a=>a.status==='Completed'),
  canceled:rows.filter(a=>a.status==='Cancelled'),
  noShows:rows.filter(a=>a.status==='No-show'),
  paid:rows.filter(a=>a.paymentStatus==='paid'),
 };
}
/** Quote totals are never interpreted as received money. Do not forecast a paid or membership-covered appointment again. */
export function unpaidAppointmentForecast(appointments,quoteOf){
 return (appointments||[]).filter(a=>UNPAID_FORECAST_STATUSES.has(a.status)&&
  a.paymentStatus!=='paid'&&a.membershipCovered!==true).map(a=>({...a,estimatedAmount:quoteOf(a)}));
}
