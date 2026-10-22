/** Flatten owner-scoped history, independently of directory/profile filters.
 * Accepted requests already appear through their canonical appointment only.
 */
export function allBookingStatusRows(clients=[]){
 const rows=new Map();
 for(const client of clients)for(const visit of client.history||[]){
  if(rows.has(visit.id))continue;
  rows.set(visit.id,{...visit,submittedAt:visit.bookingTimeline?.find(entry=>entry.status==='Submitted')?.at||visit.submittedAt||null,clientName:visit.customerName||client.name||'',clientEmail:visit.customerEmail||client.email||'',clientPhone:visit.customerPhone||client.phone||'',clientMemberNumber:visit.customerMemberNumber||client.memberNumber||''});
 }
 return [...rows.values()].sort((a,b)=>String(b.submittedAt||'').localeCompare(String(a.submittedAt||''))||b.date.localeCompare(a.date)||b.time-a.time||a.id.localeCompare(b.id));
}
export function filterBookingStatusRows(rows,{search='',status='',payment='',from='',to='',attendedOnly=false}={}){
 const query=search.trim().toLocaleLowerCase();
 return rows.filter(row=>(!status||row.status===status)&&(!payment||row.paymentTracking===payment)&&(!from||row.date>=from)&&(!to||row.date<=to)&&(!attendedOnly||row.attended)&&(!query||[row.clientName,row.clientEmail,row.clientPhone,row.clientMemberNumber,...row.serviceNames,...row.serviceTypes,row.staff,row.sessionType].join(' ').toLocaleLowerCase().includes(query)));
}
