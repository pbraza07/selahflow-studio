import {randomUUID} from 'node:crypto';
import {issueMemberId,birthdateMemberId,memberRegistrationIdentity} from './member-id-policy.mjs';
import {validateClientInput,sameClientContact} from './client-profile-logic.mjs';
import {editableClientProfileFields,clientProfileAnswers} from './client-profile-fields.mjs';
import {sanitizeBookingAnswers} from './booking-custom-fields.mjs';
import {tokenHash} from './security.mjs';
const object=x=>typeof x==='string'?JSON.parse(x):x||{};
const normalize=x=>String(x||'').trim().replace(/\s+/g,' ').toLowerCase();
export function clientProfileEditToken(c){return tokenHash(JSON.stringify([c.id,c.name,c.firstName||'',c.lastName||'',c.email,c.phone,c.notes||'',c.memberNumber||'',c.dateOfBirth||'',c.profileUpdatedAt||'',clientProfileAnswers(c),c.importColumns||{}]));}
/** Caller owns transaction, authenticated business selection and clients lock. */
export async function updateClientProfile(db,{owner,businessId,selected,profile,clients,config,input}){
 if(!(await db.query("SELECT id FROM businesses WHERE id=$1 AND owner_id=$2 AND status='active'",[businessId,owner])).rows.length)throw Error('Business workspace unavailable.');
 if(!selected||input.editToken!==clientProfileEditToken(selected))throw Error('This client profile changed. Refresh and reopen Edit client before saving.');
 const firstName=String(input.firstName||'').trim(),lastName=String(input.lastName||'').trim();
 if(firstName.length>50||lastName.length>50||!firstName||!lastName)throw Error('Enter first and last name (up to 50 characters each).');
 const values=validateClientInput({...input,name:firstName+' '+lastName}),dob=String(input.dateOfBirth||'');
 if(dob&&(!/^\d{4}-\d{2}-\d{2}$/.test(dob)||!Number.isFinite(Date.parse(dob))||new Date(dob).toISOString().slice(0,10)!==dob||dob>new Date().toISOString().slice(0,10)))throw Error('Enter a valid date of birth.');
 if(clients.some(c=>c.id!==selected.id&&sameClientContact(c,values)))throw Error('Another client with that name and contact already exists.');
 const fields=editableClientProfileFields(config,selected),submitted=input.customAnswers||{};
 if(!submitted||typeof submitted!=='object'||Array.isArray(submitted)||Object.keys(submitted).some(id=>!fields.some(f=>f.id===id)))throw Error('Invalid client profile question.');
 const answers=sanitizeBookingAnswers(fields,{...clientProfileAnswers(selected),...submitted}),labels=Object.fromEntries(fields.map(f=>[f.id,f.label]));
 const imports={...selected.importColumns};
 if(input.importColumns!==undefined){if(!input.importColumns||typeof input.importColumns!=='object'||Array.isArray(input.importColumns)||Object.keys(input.importColumns).some(k=>!Object.hasOwn(imports,k)))throw Error('Invalid imported client field.');for(const [k,v] of Object.entries(input.importColumns)){if(!['string','boolean','number'].includes(typeof v)||String(v).length>500)throw Error('Imported client values must be up to 500 characters.');imports[k]=v;}}
 await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[businessId+':member-id-allocation']);
 await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[owner+':schedule']);
 await db.query('LOCK TABLE appointments,booking_requests,business_client_profiles,business_member_ids,customer_booking_ids,customer_memberships,booking_client_messages,booking_receipt_emails,membership_payment_emails,membership_payment_invitations,owner_form_notifications,business_communication_recipients IN SHARE ROW EXCLUSIVE MODE');
 const old=selected.memberNumber||'',oldReservation=old?(await db.query('SELECT * FROM business_member_ids WHERE business_id=$1 AND member_number=$2',[businessId,old])).rows[0]:null;
 const oldKey=oldReservation?.identity_key;let newKey=oldKey?.startsWith('registration:')?oldKey:(await db.query('SELECT member_identity_key($1,$2::date) AS key',[values.name,dob||null])).rows[0].key;
 const identityChanged=normalize(values.name)!==normalize(selected.name)||dob!==(selected.dateOfBirth||'');
 const requested=String(input.memberNumber||'').trim().toUpperCase();let number=old;
 if(old&&(oldKey?.startsWith('registration:')||!dob)){
  if(requested&&requested!==old)throw Error('Keep this client’s existing Unique ID.');
 }else if(!old&&!dob){
  number=await issueMemberId(db,{businessId,name:values.name,firstName,lastName,dateOfBirth:null,registrationIdentity:randomUUID(),requested});
  newKey='registration:'+await memberRegistrationIdentity(db,businessId,number);
 }else if(identityChanged||!old||requested&&requested!==old){
  number=birthdateMemberId(values.name,dob,firstName,lastName);
  if(requested&&requested!==old&&requested!==number)throw Error('The Unique ID must match first/last initials and MMDDYY.');
 }
 const ownNumbers=oldKey?(await db.query('SELECT member_number FROM business_member_ids WHERE business_id=$1 AND identity_key=$2',[businessId,oldKey])).rows.map(r=>r.member_number):old?[old]:number&&newKey.startsWith('registration:')?[number]:[];
 const collision=number?(await db.query('SELECT * FROM business_member_ids WHERE business_id=$1 AND member_number=$2',[businessId,number])).rows[0]:null;
 if(collision&&!ownNumbers.includes(number))throw Error('This Unique ID belongs to another client in this business.');
 if(identityChanged&&(await db.query('SELECT member_number FROM business_member_ids WHERE business_id=$1 AND identity_key=$2 AND NOT(member_number=ANY($3::text[])) AND retired_at IS NULL',[businessId,newKey,ownNumbers])).rows.length)throw Error('Another client already has that name and birth date.');
 const historyIds=(selected.history||[]).map(r=>r.id);
 const active=(await db.query("SELECT id,data FROM appointments WHERE owner=$1 AND status NOT IN ('Completed','Cancelled','No-show')",[owner])).rows.filter(a=>historyIds.includes(a.id)||old&&ownNumbers.includes(object(a.data).memberNumber));
 const activeIds=active.map(a=>a.id),memberRows=(await db.query('SELECT id FROM customer_memberships WHERE business_id=$1 AND (member_number=ANY($2::text[]) OR id=$3)',[businessId,ownNumbers,selected.id.startsWith('membership-')?selected.id.slice(11):''])).rows,memberIds=memberRows.map(m=>m.id);
 const coreChanged=identityChanged||values.email!==selected.email||values.phone!==selected.phone||number!==old;
 if(coreChanged){
  const checks=[['booking_client_messages','booking_id=ANY($1::text[])',[activeIds]],['booking_receipt_emails','business_id=$1 AND booking_key=ANY($2::text[])',[businessId,historyIds]],['membership_payment_emails','business_id=$1 AND membership_id=ANY($2::text[])',[businessId,memberIds]],['membership_payment_invitations','business_id=$1 AND membership_id=ANY($2::text[])',[businessId,memberIds]],['business_communication_recipients','business_id=$1 AND source_ids ? $2',[businessId,selected.id]]];
  for(const [table,where,args] of checks)if((await db.query(`SELECT 1 FROM ${table} WHERE ${where} AND status='processing' LIMIT 1`,args)).rows.length)throw Error('A client email is currently being sent. Retry the edit after delivery finishes.');
  for(const [table,where,args] of checks){const skipped=table==='business_communication_recipients'?'skipped':'superseded';await db.query(`UPDATE ${table} SET status='${skipped}',updated_at=now() WHERE ${where} AND status IN ('draft','queued','failed','not_configured')`,args);}
 }
 if(oldKey)await db.query('UPDATE business_member_ids SET identity_key=$1,retired_at=CASE WHEN member_number=$2 THEN NULL ELSE COALESCE(retired_at,now()) END WHERE business_id=$3 AND identity_key=$4',[newKey,number,businessId,oldKey]);
 if(number)await db.query('INSERT INTO business_member_ids(business_id,member_number,identity_key) VALUES($1,$2,$3) ON CONFLICT(business_id,member_number) DO UPDATE SET identity_key=excluded.identity_key,retired_at=NULL',[businessId,number,newKey]);
 const previous=[...new Set([...(selected.previousMemberNumbers||[]),...ownNumbers])].filter(n=>n!==number);
 if(number&&old&&number!==old){
  await db.query('UPDATE member_id_history_aliases SET current_number=$1 WHERE business_id=$2 AND current_number=$3',[number,businessId,old]);
  await db.query('DELETE FROM member_id_history_aliases WHERE business_id=$1 AND previous_number=$2',[businessId,number]);
  for(const n of previous)await db.query('INSERT INTO member_id_history_aliases(business_id,previous_number,current_number) VALUES($1,$2,$3) ON CONFLICT(business_id,previous_number) DO UPDATE SET current_number=excluded.current_number,changed_at=now()',[businessId,n,number]);
 }
 const id=profile?.id||randomUUID(),anchor=selected.history?.at(-1)?.id||null;
 const args=[values.name,values.email,values.phone,values.notes,number||null,dob||null,JSON.stringify(answers),JSON.stringify(labels),JSON.stringify(imports),firstName,lastName,JSON.stringify(previous),owner,id];
 if(profile)await db.query('UPDATE business_client_profiles SET name=$1,email=$2,phone=$3,notes=$4,member_number=$5,date_of_birth=$6::date,registration_answers=$7::jsonb,registration_field_labels=$8::jsonb,import_columns=$9::jsonb,first_name=$10,last_name=$11,previous_member_numbers=$12::jsonb,registration_identity=COALESCE(registration_identity,$15::uuid),updated_at=now() WHERE owner=$13 AND id=$14 AND deleted_at IS NULL',[...args,newKey.startsWith('registration:')?newKey.slice(13):null]);
 else await db.query('INSERT INTO business_client_profiles(name,email,phone,notes,member_number,date_of_birth,registration_answers,registration_field_labels,import_columns,first_name,last_name,previous_member_numbers,owner,id,source_key,anchor_appointment_id,registration_identity) VALUES($1,$2,$3,$4,$5,$6::date,$7::jsonb,$8::jsonb,$9::jsonb,$10,$11,$12::jsonb,$13,$14,$15,$16,$17::uuid)',[...args,selected.id,anchor,newKey.startsWith('registration:')?newKey.slice(13):null]);
 await db.query('UPDATE customer_memberships SET customer_name=$1,customer_email=$2,customer_phone=$3,date_of_birth=$4::date,member_number=$5,updated_at=now() WHERE business_id=$6 AND id=ANY($7::text[])',[values.name,values.email,values.phone,dob||null,number||null,businessId,memberIds]);
 const bookingIdentities=(await db.query('SELECT id FROM customer_booking_ids WHERE business_id=$1 AND member_number=ANY($2::text[])',[businessId,ownNumbers])).rows;
 await db.query('UPDATE customer_booking_ids SET first_name=$1,last_name=$2,email=$3,phone=$4,date_of_birth=$5::date,member_number=$6 WHERE business_id=$7 AND member_number=ANY($8::text[])',[firstName,lastName,values.email,values.phone,dob||null,number||null,businessId,ownNumbers]);
 if(number&&!bookingIdentities.length)await db.query('INSERT INTO customer_booking_ids(business_id,first_name,last_name,email,phone,date_of_birth,member_number,registration_identity) VALUES($1,$2,$3,$4,$5,$6::date,$7,$8::uuid)',[businessId,firstName,lastName,values.email,values.phone,dob||null,number,newKey.startsWith('registration:')?newKey.slice(13):null]);
 if(identityChanged||old&&old!==number)await db.query("UPDATE participation_waivers SET deleted_at=now(),deleted_by=$1,retention_status='identity_corrected' WHERE business_id=$2 AND customer_id=ANY($3::uuid[]) AND deleted_at IS NULL",[owner,businessId,bookingIdentities.map(x=>x.id)]);
 const pending=(await db.query("SELECT id,details FROM booking_requests WHERE business_id=$1 AND status='pending'",[businessId])).rows.filter(r=>historyIds.includes(r.id)||old&&ownNumbers.includes(object(r.details).memberNumber));
 for(const r of pending){const d=object(r.details),next={...d,originalSubmission:d.originalSubmission||{customerName:d.customerName,customerEmail:d.customerEmail,customerPhone:d.customerPhone,customAnswers:d.customAnswers,memberNumber:d.memberNumber,dateOfBirth:d.dateOfBirth},customerName:values.name,customerEmail:values.email,customerPhone:values.phone,firstName,lastName,dateOfBirth:dob,memberNumber:number,profileCorrectedAt:new Date().toISOString()};await db.query('UPDATE booking_requests SET details=$1 WHERE id=$2 AND business_id=$3',[JSON.stringify(next),r.id,businessId]);}
 for(const a of active){const d=object(a.data),next={...d,originalClientProfile:d.originalClientProfile||{name:d.name,email:d.email,phone:d.phone,dateOfBirth:d.dateOfBirth,memberNumber:d.memberNumber},name:values.name,email:values.email,phone:values.phone,firstName,lastName,dateOfBirth:dob,memberNumber:number};await db.query('UPDATE appointments SET data=$1 WHERE id=$2 AND owner=$3',[JSON.stringify(next),a.id,owner]);}
 await db.query("INSERT INTO events(id,owner,created,kind,data) VALUES($1,$2,$3,'client_profile_updated',$4)",[randomUUID(),owner,new Date().toISOString(),JSON.stringify({clientId:id,memberNumber:number,oldMemberNumber:old,before:{name:selected.name,email:selected.email,phone:selected.phone,dateOfBirth:selected.dateOfBirth,answers:clientProfileAnswers(selected),importColumns:selected.importColumns},after:{...values,firstName,lastName,dateOfBirth:dob,memberNumber:number,answers,importColumns:imports}})]);
 return {clientId:id,memberNumber:number};
}
