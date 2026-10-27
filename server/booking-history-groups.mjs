/** Consolidate only explicit booking links; never infer a match from a client or date. */
export function groupBookingHistory(rows){
 const groups=new Map(),other=[];
 for(const row of rows){if(!row.bookingKey){other.push(row);continue;}if(!groups.has(row.bookingKey))groups.set(row.bookingKey,[]);groups.get(row.bookingKey).push(row);}
 for(const [key,activities] of groups){
  const appointment=activities.find(r=>r.id.startsWith('booking:'));
  const request=activities.find(r=>r.id.startsWith('request:'));
  // A hidden booking must not be recreated from a message/payment alone.
  const primary=appointment||request;
  if(!primary){other.push(...activities);continue;}
  const paid=activities.filter(r=>r.paymentEvidence===true);
  const total=paid.reduce((n,r)=>n+(r.amountCents||0),0);
  const state=String(primary.status||'').toLowerCase();
  const bookingStatus=['confirmed','accepted','approved'].includes(state)?'Accepted':state==='pending'?'Submitted · Pending approval':String(primary.status||'Submitted');
  const paymentStatus=paid.length||primary.paymentConfirmed?'Paid':primary.membershipCovered?'Membership covered':primary.quoteCents===0?'No payment required':activities.some(r=>r.category==='payments'&&r.status==='processing')?'Payment processing':primary.paymentTracking==='completed'?'Payment marked complete':primary.quoteCents>0||activities.some(r=>r.category==='payments')?'Pending payment':'Payment not recorded';
  other.push({...primary,id:'booking-group:'+key,category:'bookings',title:appointment?.title||request?.title.replace(/^Booking request · /,'')||'Booking',status:bookingStatus+' · '+paymentStatus,bookingStatus,paymentStatus,...(paid.length?{amountCents:total}:{}),activities:[...activities].sort((a,b)=>a.order.localeCompare(b.order)||a.id.localeCompare(b.id))});
 }
 return other;
}
