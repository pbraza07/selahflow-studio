export const MEMBER_ID_POLICIES=['initials_birthdate'];
export function memberInitials(name,firstName='',lastName=''){
 const words=String(name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().split(/\s+/);
 const initial=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim()[0]||'';
 const initials=(initial(firstName||words[0])+initial(lastName||words.at(-1))).toUpperCase();
 if(words.length<2||!/^[A-Z]{2}$/.test(initials))throw Error('First and last name must start with a letter to assign a Unique ID.');
 return initials;
}
export function birthdateMemberId(name,dateOfBirth,firstName='',lastName=''){
 const initials=memberInitials(name,firstName,lastName),dob=String(dateOfBirth||'');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(dob)||!Number.isFinite(Date.parse(dob))||new Date(dob).toISOString().slice(0,10)!==dob||dob>new Date().toISOString().slice(0,10))throw Error('A valid date of birth is required to assign a Unique ID.');
 return initials+dob.slice(5,7)+dob.slice(8,10)+dob.slice(2,4);
}
/** Caller owns the transaction. All registration paths share this business lock.
 * @param {any} db
 * @param {any} options
 */
export async function issueMemberId(db,{businessId,name,dateOfBirth,requested='',replaceLegacy=false,registrationIdentity=null,firstName='',lastName=''}){
 await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[businessId+':member-id-allocation']);
 if(!(await db.query('SELECT id FROM businesses WHERE id=$1',[businessId])).rows[0])throw Error('Business not found.');
 if(registrationIdentity&&!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(registrationIdentity))throw Error('Invalid registration identity.');
 const dob=String(dateOfBirth||'').trim();
 // An existing ID is permission to recover only its matching saved identity.
 let matchedIdentity=null;
 const suppliedNumber=String(requested||'').trim().toUpperCase();
 if(suppliedNumber){
  const matched=(await db.query(`SELECT r.identity_key FROM business_member_ids r WHERE r.business_id=$1 AND r.member_number=$2 AND r.retired_at IS NULL AND EXISTS(
   SELECT 1 FROM customer_booking_ids c WHERE c.business_id=r.business_id AND c.member_number=r.member_number AND member_identity_key(c.first_name||' '||c.last_name,c.date_of_birth)=member_identity_key($3,$4::date)
   UNION ALL SELECT 1 FROM customer_memberships m WHERE m.business_id=r.business_id AND m.member_number=r.member_number AND member_identity_key(m.customer_name,m.date_of_birth)=member_identity_key($3,$4::date)
   UNION ALL SELECT 1 FROM business_client_profiles p JOIN businesses b ON b.owner_id=p.owner WHERE b.id=r.business_id AND p.member_number=r.member_number AND p.deleted_at IS NULL AND member_identity_key(p.name,p.date_of_birth)=member_identity_key($3,$4::date)
  )`,[businessId,suppliedNumber,name,dob||null])).rows[0];
  if(matched){matchedIdentity=matched.identity_key;if(matchedIdentity.startsWith('registration:'))registrationIdentity=matchedIdentity.slice(13);}
 }
 if(!dob&&!registrationIdentity&&!matchedIdentity)throw Error('A registration reference is required to create a client ID without a birth date.');
 const identity=matchedIdentity||(registrationIdentity?'registration:'+registrationIdentity.toLowerCase():(await db.query('SELECT member_identity_key($1,$2::date) AS key',[name,dob||null])).rows[0].key);
 const prior=(await db.query("SELECT member_number FROM business_member_ids WHERE business_id=$1 AND identity_key=$2 AND retired_at IS NULL AND member_number ~ '^[A-Z]{2}([0-9]{4}|[0-9]{6})$' ORDER BY created_at,member_number LIMIT 1",[businessId,identity])).rows[0];
 const supplied=String(requested||'').trim().toUpperCase();
 if(supplied&&!/^[A-Z]{2}([0-9]{4}|[0-9]{6})$/.test(supplied))throw Error('Enter a valid Unique ID. Use two initials followed by the assigned four- or six-digit number.');
 if(supplied&&(!prior||prior.member_number!==supplied))throw Error('The supplied membership ID does not belong to this client. Leave it blank for a new client.');
 if(prior&&!replaceLegacy)return prior.member_number;
 let number;
 if(dob)number=birthdateMemberId(name,dob,firstName,lastName);
 else{
  const initials=memberInitials(name,firstName,lastName);
  const next=(await db.query(`SELECT n FROM businesses b CROSS JOIN LATERAL generate_series(b.member_id_sequence+1,9999) n WHERE b.id=$1 AND NOT EXISTS(SELECT 1 FROM business_member_ids r WHERE r.business_id=b.id AND r.member_number=$2||n::text) ORDER BY n LIMIT 1`,[businessId,initials])).rows[0];
  if(!next)throw Error('Cannot assign a Unique ID: this business has used all four-digit client sequence numbers. Contact support before adding another client without a birth date.');
  await db.query('UPDATE businesses SET member_id_sequence=$2 WHERE id=$1',[businessId,Number(next.n)]);
  number=initials+next.n;
 }

 const reserved=(await db.query('SELECT identity_key,retired_at FROM business_member_ids WHERE business_id=$1 AND member_number=$2',[businessId,number])).rows[0];
 if(reserved){
  if(reserved.identity_key===identity&&!reserved.retired_at)return number;
  throw Error('The Unique ID generated from these initials and birth date is already assigned in this business. Contact the business to review the collision.');
 }
 await db.query('INSERT INTO business_member_ids(business_id,member_number,identity_key) VALUES($1,$2,$3)',[businessId,number,identity]);
 return number;
}

/** Private registry metadata stays internal; canonical rows share this immutable key. */
export async function memberRegistrationIdentity(db,businessId,number){
 const row=(await db.query('SELECT identity_key FROM business_member_ids WHERE business_id=$1 AND member_number=$2 AND retired_at IS NULL',[businessId,number])).rows[0];
 return row?.identity_key?.startsWith('registration:')?row.identity_key.slice(13):null;
}
