import {expireClientCheckouts} from './client-checkout-expiry.mjs';
import {retainDeletedClientFinancials} from './client-financial-retention.mjs';
const object=x=>{try{return typeof x==='string'?JSON.parse(x):x||{};}catch{return {};}};
const day=x=>x instanceof Date?x.toISOString().slice(0,10):String(x||'').slice(0,10);
const identity=(name,dob)=>String(name||'').trim().replace(/\s+/g,' ').toLowerCase()+'|'+day(dob);
/** Caller owns transaction. Match the member identity, never a shared family email alone. */
export async function deleteClientPermanently(db,{owner,businessId,client,closeOpenCheckouts=false,api=undefined}){
 const business=(await db.query("SELECT id,owner_id FROM businesses WHERE id=$1 AND owner_id=$2 AND status='active'",[businessId,owner])).rows[0];
 if(!business||!client?.id)throw Error('Client not found in this business.');
 await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[business.id+':member-id-allocation']);
 await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[owner+':schedule']);
 await db.query('LOCK TABLE appointments,booking_requests,business_client_profiles,business_member_ids,customer_booking_ids,customer_memberships,booking_client_messages,booking_receipt_emails,membership_payment_emails,membership_payment_invitations,owner_form_notifications,business_communication_recipients IN SHARE ROW EXCLUSIVE MODE');
 const profile={id:client.id};
 const reservation=(await db.query('SELECT identity_key FROM business_member_ids WHERE business_id=$1 AND member_number=$2',[business.id,client.memberNumber||''])).rows[0];
 const original={identity_key:reservation?.identity_key&&!reservation.identity_key.startsWith('deleted:')?reservation.identity_key:identity(client.name,client.dateOfBirth)};
 if(!reservation&&!client.name)throw Error('Client identity unavailable.');
 const aliases=(await db.query('SELECT * FROM business_member_ids WHERE business_id=$1 AND identity_key=$2',[business.id,original.identity_key])).rows;
 const historicalAliases=(await db.query('SELECT previous_number FROM member_id_history_aliases WHERE business_id=$1 AND current_number=$2',[business.id,client.memberNumber||''])).rows;
 const numbers=[...new Set([...historicalAliases.map(r=>r.previous_number),...aliases.map(r=>r.member_number),...(client.memberNumber?[client.memberNumber]:[])])],numberSet=new Set(numbers);
 const historyIds=new Set((client.history||[]).map(r=>r.id));
 const sameContact=d=>{
  const email=String(d.email||d.customerEmail||d.customer_email||'').trim().toLowerCase(),phone=String(d.phone||d.customerPhone||d.customer_phone||'').replace(/[^+0-9]/g,'');
  return Boolean(email&&email===String(client.email||'').trim().toLowerCase()||phone&&phone===String(client.phone||'').replace(/[^+0-9]/g,''));
 };
 const matches=d=>numberSet.has(d.memberNumber||d.member_number)||(identity(d.name||d.client||d.customerName||d.customer_name||[d.first_name,d.last_name].filter(Boolean).join(' '),d.dateOfBirth||d.date_of_birth)===original.identity_key&&(!original.identity_key.endsWith('|')||sameContact(d)));

 const read=async(table,where,args)=>(await db.query(`SELECT * FROM ${table} WHERE ${where}`,args)).rows;
  const members=(await read('customer_memberships','business_id=$1',[business.id])).filter(matches);
  if(members.some(m=>m.stripe_subscription_id&&!['canceled','expired'].includes(m.status)))throw Error('Cancel this registration active Stripe subscription before reset.');
  const memberIds=members.map(m=>m.id);
  let appointments=(await read('appointments','owner=$1',[business.owner_id])).filter(a=>historyIds.has(a.id)||matches(object(a.data)));
  let appointmentIds=appointments.map(a=>a.id);
  const requests=(await read('booking_requests','business_id=$1',[business.id])).filter(r=>historyIds.has(r.id)||matches(object(r.details))||appointmentIds.includes(r.appointment_id));
  const requestIds=requests.map(r=>r.id),linkedAppointments=requests.map(r=>r.appointment_id).filter(Boolean);
  appointments=(await read('appointments','owner=$1',[business.owner_id])).filter(a=>appointmentIds.includes(a.id)||linkedAppointments.includes(a.id));appointmentIds=appointments.map(a=>a.id);
  const bookingKeys=[...new Set([...appointmentIds,...requestIds])];
  const membershipRequests=(await read('membership_requests','business_id=$1',[business.id])).filter(r=>matches(object(r.details))||memberIds.includes(r.membership_id));
  const ids=new Set([...bookingKeys,...memberIds,...membershipRequests.map(r=>r.id)]);
  const events=(await read('events','owner=$1',[business.owner_id])).filter(e=>{
   const d=object(e.data);return matches(d)||Object.entries(d).some(([key,value])=>['appointment','appointmentId','bookingId','booking_id','requestId','membershipId','membership_id'].includes(key)&&ids.has(value)||['memberNumber','oldMemberNumber'].includes(key)&&numberSet.has(value));
  });
  const specs=[];
  const add=(table,where,args,rows)=>specs.push({table,where,args,rows});
  add('business_communication_recipients','business_id=$1 AND source_ids ? $2',[business.id,client.id]);
  add('owner_form_notifications','business_id=$1 AND source_id=ANY($2::text[])',[business.id,[...bookingKeys,...membershipRequests.map(r=>r.id)]]);
  add('booking_client_messages','booking_id=ANY($1::text[])',[appointmentIds]);
  add('booking_receipt_emails','business_id=$1 AND booking_key=ANY($2::text[])',[business.id,bookingKeys]);
  add('membership_payment_invitations','business_id=$1 AND membership_id=ANY($2::text[])',[business.id,memberIds]);
  add('membership_payment_emails','business_id=$1 AND membership_id=ANY($2::text[])',[business.id,memberIds]);
  add('booking_client_flows','business_id=$1 AND (booking_id=ANY($2::text[]) OR request_id=ANY($3::text[]))',[business.id,appointmentIds,requestIds]);
  for(const table of ['booking_action_tokens','booking_notification_attempts'])add(table,'request_id=ANY($1::text[])',[requestIds]);
  for(const table of ['booking_request_edits','business_notification_reads'])add(table,'business_id=$1 AND request_id=ANY($2::text[])',[business.id,requestIds]);
  for(const table of ['customer_booking_access','customer_booking_push'])add(table,'owner_id=$1 AND booking_id=ANY($2::text[])',[business.owner_id,bookingKeys]);
  add('slots','owner=$1 AND appointment=ANY($2::text[])',[business.owner_id,appointmentIds]);
  add('booking_payments','business_id=$1 AND booking_id=ANY($2::text[])',[business.id,bookingKeys]);
  add('stripe_payment_receipts','business_id=$1 AND (booking_id=ANY($2::text[]) OR membership_id=ANY($3::text[]))',[business.id,bookingKeys,memberIds]);
  add('membership_session_ledger','business_id=$1 AND membership_id=ANY($2::text[])',[business.id,memberIds]);
  add('membership_requests','business_id=$1 AND id=ANY($2::text[])',[business.id,membershipRequests.map(r=>r.id)],membershipRequests);
  add('booking_requests','business_id=$1 AND id=ANY($2::text[])',[business.id,requestIds],requests);
  add('marketplace_referrals','business_id=$1 AND appointment_id=ANY($2::text[])',[business.id,appointmentIds]);
  add('appointments','owner=$1 AND id=ANY($2::text[])',[business.owner_id,appointmentIds],appointments);
  add('customer_memberships','business_id=$1 AND id=ANY($2::text[])',[business.id,memberIds],members);
  add('customer_booking_ids','business_id=$1 AND member_number=ANY($2::text[])',[business.id,numbers]);
  const profileIds=(await read('business_client_profiles','owner=$1',[business.owner_id])).filter(p=>p.id===profile.id||matches(p)).map(p=>p.id);
  add('business_client_profiles','owner=$1 AND id=ANY($2::text[])',[business.owner_id,profileIds]);
  const enrollments=(await read('service_enrollments','business_id=$1',[business.id])).filter(r=>r.client_name?.trim().toLowerCase()===String(client.name||'').trim().toLowerCase()&&r.client_email?.trim().toLowerCase()===String(client.email||'').trim().toLowerCase());
  add('service_enrollments','business_id=$1 AND id=ANY($2::text[])',[business.id,enrollments.map(r=>r.id)]);
  add('events','owner=$1 AND id=ANY($2::text[])',[business.owner_id,events.map(e=>e.id)],events);
  for(const s of specs)s.rows??=await read(s.table,s.where,s.args);
  const rowsFor=table=>specs.find(s=>s.table===table).rows;
  if(['business_communication_recipients','booking_client_messages','booking_receipt_emails','membership_payment_emails','membership_payment_invitations','owner_form_notifications'].some(table=>rowsFor(table).some(m=>m.status==='processing')))throw Error('A related email is currently being sent. Retry reset after delivery finishes.');
  if(closeOpenCheckouts)await expireClientCheckouts(db,{businessId:business.id,bookingKeys,members,bookingPayments:rowsFor('booking_payments')},api);
  if(!closeOpenCheckouts&&rowsFor('booking_payments').some(p=>p.status==='pending'&&p.stripe_checkout_session_id))throw Error('Expire this registration open Stripe Checkout before reset.');
  if((await db.query("SELECT 1 FROM first_customer_commissions WHERE business_id=$1 AND source_id=ANY($2::text[]) AND kind='membership' AND status='reserved' AND stripe_checkout_session_id IS NOT NULL",[business.id,memberIds])).rows.length)throw Error('Expire this membership open Stripe Checkout before reset.');
  await db.query("UPDATE first_customer_commissions SET source_id=NULL WHERE business_id=$1 AND ((kind='booking' AND source_id=ANY($2::text[])) OR (kind='membership' AND source_id=ANY($3::text[])))",[business.id,bookingKeys,memberIds]);
  const retainedFinancialRecords=await retainDeletedClientFinancials(db,{businessId:business.id,specs});
  const result={removed:Object.fromEntries(specs.map(s=>[s.table,s.rows.length])),releasedIds:numbers.length,retainedFinancialRecords,freshRegistrationVerified:false};
  // Tombstones track only source record hashes, so stale imports/webhook IDs
  // cannot recreate deleted rows while a genuinely new registration is allowed.
  for(const spec of specs)if(['appointments','events','business_client_profiles','customer_booking_ids','customer_memberships','booking_requests','membership_requests'].includes(spec.table))for(const row of spec.rows)if(row.id)await db.query('INSERT INTO deleted_client_records(business_id,source_table,record_digest) VALUES($1,$2,md5($3)) ON CONFLICT DO NOTHING',[business.id,spec.table,String(row.id)]);
  if(original.identity_key.startsWith('registration:'))await db.query('INSERT INTO deleted_client_records(business_id,source_table,record_digest) VALUES($1,$2,md5($3)) ON CONFLICT DO NOTHING',[business.id,'registration_identity',original.identity_key.slice('registration:'.length)]);
  for(const s of specs){
   if(s.table==='stripe_payment_receipts'){await db.query(`UPDATE stripe_payment_receipts SET booking_id=NULL,membership_id=NULL WHERE ${s.where}`,s.args);continue;}
   await db.query(`DELETE FROM ${s.table} WHERE ${s.where}`,s.args);
  }
  await db.query('DELETE FROM business_member_ids WHERE business_id=$1 AND (identity_key=$2 OR member_number=ANY($3::text[]))',[business.id,original.identity_key,numbers]);
  for(const s of specs)if((await read(s.table,s.where,s.args)).length)throw Error('Registration reset verification failed.');
  await db.query('DELETE FROM member_id_history_aliases WHERE business_id=$1 AND current_number=ANY($2::text[])',[business.id,numbers]);
  await db.query('DELETE FROM legacy_business_member_numbers WHERE business_id=$1 AND member_number=ANY($2::text[])',[business.id,numbers]);
  await db.query('INSERT INTO client_deletion_audit(business_id,target_digest,result) VALUES($1,md5($2),$3::jsonb)',[business.id,String(client.id),JSON.stringify(result)]);
  return result;
}
