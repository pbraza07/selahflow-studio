import {randomUUID} from 'node:crypto';

/**
 * Common booking/membership customer identity, called inside the existing
 * business-scoped registration transaction after issueMemberId().
 * A pending membership receives the SAME business-unique six-character ID and
 * customer profile that a first booking would create. No credits or charges.
 */
export async function ensureMemberBookingIdentity(db,{businessId,ownerId,firstName,lastName,email,dateOfBirth,phone='',memberNumber,customAnswers={},source='Membership signup',registrationIdentity=null}){
 const given=String(firstName||'').trim(),family=String(lastName||'').trim();
 const name=(given+' '+family).trim(),contact=String(email||'').trim().toLowerCase(),mobile=String(phone||'').trim().slice(0,40);
 if(registrationIdentity){
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(registrationIdentity)||!/^[A-Z]{2}[0-9]{4}$/.test(memberNumber||''))throw Error('Invalid registration identity.');
  const business=(await db.query("SELECT 1 FROM businesses WHERE id=$1 AND owner_id=$2 AND status='active'",[businessId,ownerId])).rows[0];
  if(!business)throw Error('Business identity does not match this customer.');
  const existing=(await db.query('SELECT member_number FROM customer_booking_ids WHERE business_id=$1 AND registration_identity=$2::uuid FOR UPDATE',[businessId,registrationIdentity])).rows[0];
  if(existing&&existing.member_number!==memberNumber)throw Error('Registration identity has a different Unique ID.');
  if(!existing)await db.query('INSERT INTO customer_booking_ids(business_id,first_name,last_name,email,date_of_birth,phone,member_number,registration_identity) VALUES($1,$2,$3,$4,$5::date,$6,$7,$8::uuid)',[businessId,given,family,contact,dateOfBirth||null,mobile,memberNumber,registrationIdentity]);
  const profile=(await db.query('SELECT member_number FROM business_client_profiles WHERE owner=$1 AND registration_identity=$2::uuid FOR UPDATE',[ownerId,registrationIdentity])).rows[0];
  if(profile&&profile.member_number!==memberNumber)throw Error('Registration profile has a different Unique ID.');
  if(!profile)await db.query('INSERT INTO business_client_profiles(id,owner,name,email,phone,notes,import_columns,member_number,date_of_birth,registration_identity) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9::date,$10::uuid)',[randomUUID(),ownerId,name,contact,mobile,source,JSON.stringify(customAnswers||{}),memberNumber,dateOfBirth||null,registrationIdentity]);
  return memberNumber;
 }
 if(!given||!family||!/^\d{4}-\d{2}-\d{2}$/.test(String(dateOfBirth||''))||!/^[A-Z]{2}[0-9]{4}$/.test(memberNumber||''))
  throw Error('A valid name, birth date and six-character Unique ID are required.');
 const business=(await db.query("SELECT 1 FROM businesses WHERE id=$1 AND owner_id=$2 AND status='active'",[businessId,ownerId])).rows[0];
 if(!business)throw Error('Business identity does not match this customer.');
 const existing=(await db.query('SELECT id,member_number FROM customer_booking_ids WHERE business_id=$1 AND lower(first_name)=lower($2) AND lower(last_name)=lower($3) AND date_of_birth=$4::date FOR UPDATE',[businessId,given,family,dateOfBirth])).rows[0];
 if(existing&&existing.member_number!==memberNumber)throw Error('This client already has a different Unique ID for this business. Contact the business to reconcile it.');
 if(!existing){
  const other=(await db.query('SELECT 1 FROM customer_booking_ids WHERE business_id=$1 AND member_number=$2',[businessId,memberNumber])).rows[0];
  if(other)throw Error('This Unique ID already belongs to another customer in this business.');
  await db.query("INSERT INTO customer_booking_ids(business_id,first_name,last_name,email,date_of_birth,phone,member_number) VALUES($1,$2,$3,$4,$5::date,$6,$7) ON CONFLICT DO NOTHING",[businessId,given,family,contact,dateOfBirth,mobile,memberNumber]);
  const saved=(await db.query('SELECT member_number FROM customer_booking_ids WHERE business_id=$1 AND lower(first_name)=lower($2) AND lower(last_name)=lower($3) AND date_of_birth=$4::date',[businessId,given,family,dateOfBirth])).rows[0];
  if(!saved||saved.member_number!==memberNumber)throw Error('An existing customer identity uses a different Unique ID. Contact the business.');
 }
 const normalizedName=name.replace(/\s+/g,' ').toLowerCase();
 const profile=(await db.query("SELECT id FROM business_client_profiles WHERE owner=$1 AND deleted_at IS NULL AND (member_number=$2 OR (member_number IS NULL AND lower(trim(name))=$3 AND lower(trim(email))=$4 AND (date_of_birth IS NULL OR date_of_birth=$5::date))) ORDER BY CASE WHEN member_number=$2 THEN 0 ELSE 1 END,created_at LIMIT 1 FOR UPDATE",[ownerId,memberNumber,normalizedName,contact,dateOfBirth])).rows[0];
 if(profile){
  await db.query("UPDATE business_client_profiles SET member_number=$1,date_of_birth=COALESCE(date_of_birth,$2::date),phone=CASE WHEN trim(phone)='' THEN $3 ELSE phone END,archived=false,updated_at=now() WHERE owner=$4 AND id=$5",[memberNumber,dateOfBirth,mobile,ownerId,profile.id]);
 }else{
  await db.query("INSERT INTO business_client_profiles(id,owner,name,email,phone,notes,import_columns,member_number,date_of_birth) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9::date)",[randomUUID(),ownerId,name,contact,mobile,source,JSON.stringify(customAnswers||{}),memberNumber,dateOfBirth]);
 }
 return memberNumber;
}
