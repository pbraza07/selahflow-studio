/** Read-only booking view. Scope and private access token are established by the API. */
export async function customerBookingDetails(pool,{ownerId,bookingId,businessName,businessSlug}){
 const request=(await pool.query('SELECT status,date,start_minute AS start,details,appointment_id FROM booking_requests WHERE owner_id=$1 AND id=$2',[ownerId,bookingId])).rows[0];
 const base={business:businessName,slug:businessSlug,bookingId};
 if(request&&!['accepted','approved'].includes(request.status)){
  const data=typeof request.details==='string'?JSON.parse(request.details||'{}'):request.details||{};
  return {...base,status:request.status==='declined'?'Declined':request.status==='cancelled'?'Cancelled':'Awaiting approval',date:request.date,start:request.start,services:data.services||[],paymentAvailable:false};
 }
 const appointment=(await pool.query('SELECT status,date,start,data FROM appointments WHERE owner=$1 AND id=$2',[ownerId,request?.appointment_id||bookingId])).rows[0];
 if(!appointment)throw Error('Booking record not found.');
 const data=typeof appointment.data==='string'?JSON.parse(appointment.data||'{}'):appointment.data||{};
 return {...base,status:appointment.status,date:appointment.date,start:appointment.start,services:data.services||[],paymentAvailable:!['cancelled','declined'].includes(String(appointment.status).toLowerCase())};
}
