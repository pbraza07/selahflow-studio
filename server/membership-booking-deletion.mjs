import {expireClientCheckouts} from './client-checkout-expiry.mjs';
import {retainDeletedClientFinancials} from './client-financial-retention.mjs';

export async function removeMembershipBookings(db,{owner,businessId,member,api}){
 const numbers=member.member_number?[member.member_number]:[];
 if(numbers.length){
  const aliases=await db.query('SELECT previous_number FROM member_id_history_aliases WHERE business_id=$1 AND current_number=$2',[businessId,member.member_number]);
  numbers.push(...aliases.rows.map(r=>r.previous_number));
 }
 const shared=(await db.query('SELECT 1 FROM customer_memberships WHERE business_id=$1 AND id<>$2 AND member_number=ANY($3::text[]) LIMIT 1',[businessId,member.id,numbers])).rows.length>0;
 const linked=(await db.query("SELECT appointment_id FROM membership_session_ledger WHERE business_id=$1 AND membership_id=$2 AND event_type IN ('session_used','session_credit')",[businessId,member.id])).rows.map(r=>r.appointment_id);
 const match=(column)=>`(id=ANY($2::text[]) OR ${column}::jsonb->>'membershipId'=$3 OR (NULLIF(${column}::jsonb->>'membershipId','') IS NULL AND ${column}::jsonb->>'memberNumber'=ANY($4::text[])))`;
 const params=[linked,member.id,shared?[]:numbers];
 const initial=(await db.query('SELECT id FROM appointments WHERE owner=$1 AND '+match('data'),[owner,...params])).rows.map(r=>r.id);
 const requests=(await db.query('SELECT * FROM booking_requests WHERE business_id=$1 AND ('+match('details')+' OR appointment_id=ANY($5::text[]))',[businessId,...params,initial])).rows;
 const requestIds=requests.map(r=>r.id);
 const appointments=(await db.query('SELECT * FROM appointments WHERE owner=$1 AND id=ANY($2::text[])',[owner,[...initial,...requests.map(r=>r.appointment_id).filter(Boolean)]])).rows;
 const appointmentIds=appointments.map(r=>r.id),bookingKeys=[...new Set([...appointmentIds,...requestIds])];
 if(!bookingKeys.length)return 0;
 const specs=[];
 const add=(table,where,args,rows)=>specs.push({table,where,args,rows});
  add('booking_client_messages','booking_id=ANY($1::text[])',[appointmentIds]);
  add('booking_receipt_emails','business_id=$1 AND booking_key=ANY($2::text[])',[businessId,bookingKeys]);
  add('booking_client_flows','business_id=$1 AND (booking_id=ANY($2::text[]) OR request_id=ANY($3::text[]))',[businessId,appointmentIds,requestIds]);
  for(const table of ['booking_action_tokens','booking_notification_attempts'])add(table,'request_id=ANY($1::text[])',[requestIds]);
  for(const table of ['booking_request_edits','business_notification_reads'])add(table,'business_id=$1 AND request_id=ANY($2::text[])',[businessId,requestIds]);
  for(const table of ['customer_booking_access','customer_booking_push'])add(table,'owner_id=$1 AND booking_id=ANY($2::text[])',[owner,bookingKeys]);
  add('team_cancellation_requests','business_id=$1 AND appointment_id=ANY($2::text[])',[businessId,appointmentIds]);
  add('slots','owner=$1 AND appointment=ANY($2::text[])',[owner,appointmentIds]);
  add('booking_payments','business_id=$1 AND booking_id=ANY($2::text[])',[businessId,bookingKeys]);
  add('booking_requests','business_id=$1 AND id=ANY($2::text[])',[businessId,requestIds],requests);
  add('marketplace_referrals','business_id=$1 AND appointment_id=ANY($2::text[])',[businessId,appointmentIds]);
  add('appointments','owner=$1 AND id=ANY($2::text[])',[owner,appointmentIds],appointments);
 const eventKeys=['appointment','appointmentId','bookingId','booking_id','requestId'];
 const eventLinks=eventKeys.map(key=>`data::jsonb->>'${key}'=ANY($2::text[])`).join(' OR ');
 add('events','owner=$1 AND ('+eventLinks+')',[owner,bookingKeys]);
 add('owner_form_notifications','business_id=$1 AND source_id=ANY($2::text[])',[businessId,bookingKeys]);
 add('stripe_payment_receipts','business_id=$1 AND booking_id=ANY($2::text[])',[businessId,bookingKeys]);
 for(const s of specs)s.rows??=(await db.query(`SELECT * FROM ${s.table} WHERE ${s.where} FOR UPDATE`,s.args)).rows;
 if(specs.some(s=>s.rows.some(r=>r.status==='processing')))throw Error('A booking update is processing. Retry deletion after it finishes.');
 const bookingPayments=specs.find(s=>s.table==='booking_payments').rows;
 if(bookingPayments.some(p=>p.status==='pending'&&p.terminal_payment_intent_id))throw Error('Finish or cancel the onsite card collection before deleting this membership.');
 await expireClientCheckouts(db,{businessId,bookingKeys,bookingPayments},api);
 const retained=await retainDeletedClientFinancials(db,{businessId,specs});
 await db.query("UPDATE first_customer_commissions SET source_id=NULL WHERE business_id=$1 AND kind='booking' AND source_id=ANY($2::text[])",[businessId,bookingKeys]);
 await db.query('UPDATE stripe_payment_receipts SET booking_id=NULL WHERE business_id=$1 AND booking_id=ANY($2::text[])',[businessId,bookingKeys]);
 for(const s of specs){
  if(['appointments','booking_requests','events'].includes(s.table))for(const row of s.rows)await db.query('INSERT INTO deleted_client_records(business_id,source_table,record_digest) VALUES($1,$2,md5($3)) ON CONFLICT DO NOTHING',[businessId,s.table,row.id]);
  if(s.table!=='stripe_payment_receipts')await db.query(`DELETE FROM ${s.table} WHERE ${s.where}`,s.args);
 }
 return retained;
}
