export const MEMBER_ID_POLICIES=['initials_birthdate'];
export function birthdateMemberId(name,dateOfBirth,firstName='',lastName=''){
 const words=String(name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().split(/\s+/);
 const initial=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim()[0]||'';
 const initials=(initial(firstName||words[0])+initial(lastName||words.at(-1))).toUpperCase();
 const dob=String(dateOfBirth||'');
 if(words.length<2||!/^[A-Z]{2}$/.test(initials))throw Error('First and last name must start with a letter to assign a Unique ID.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(dob)||!Number.isFinite(Date.parse(dob))||new Date(dob).toISOString().slice(0,10)!==dob||dob>new Date().toISOString().slice(0,10))throw Error('A valid date of birth is required to assign a Unique ID.');
 return initials+dob.slice(5,7)+dob.slice(8,10)+dob.slice(2,4);
}
/** Caller owns the transaction. All registration paths share this business lock. */
export async function issueMemberId(db,{businessId,name,dateOfBirth,requested='',replaceLegacy=false,registrationIdentity=null,firstName='',lastName=''}){
 await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[businessId+':member-id-allocation']);
 if(!(await db.query('SELECT id FROM businesses WHERE id=$1',[businessId])).rows[0])throw Error('Business not found.');
 if(registrationIdentity&&!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(registrationIdentity))throw Error('Invalid registration identity.');
 const identity=registrationIdentity?'registration:'+registrationIdentity.toLowerCase():(await db.query('SELECT member_identity_key($1,$2::date) AS key',[name,dateOfBirth])).rows[0].key;
 const prior=(await db.query("SELECT member_number FROM business_member_ids WHERE business_id=$1 AND identity_key=$2 AND retired_at IS NULL AND member_number ~ '^[A-Z]{2}([0-9]{4}|[0-9]{6})$' ORDER BY created_at,member_number LIMIT 1",[businessId,identity])).rows[0];
 const supplied=String(requested||'').trim().toUpperCase();
 if(supplied&&!/^[A-Z]{2}([0-9]{4}|[0-9]{6})$/.test(supplied))throw Error('Enter a valid Unique ID. New IDs contain two initials and MMDDYY.');
 if(supplied&&(!prior||prior.member_number!==supplied))throw Error('The supplied membership ID does not belong to this client. Leave it blank for a new client.');
 if(prior&&!replaceLegacy)return prior.member_number;
 const number=birthdateMemberId(name,dateOfBirth,firstName,lastName);
 const reserved=(await db.query('SELECT identity_key,retired_at FROM business_member_ids WHERE business_id=$1 AND member_number=$2',[businessId,number])).rows[0];
 if(reserved){
  if(reserved.identity_key===identity&&!reserved.retired_at)return number;
  throw Error('The Unique ID generated from these initials and birth date is already assigned in this business. Contact the business to review the collision.');
 }
 await db.query('INSERT INTO business_member_ids(business_id,member_number,identity_key) VALUES($1,$2,$3)',[businessId,number,identity]);
 return number;
}
