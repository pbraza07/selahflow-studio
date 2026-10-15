import {randomInt} from 'node:crypto';
export const MEMBER_ID_POLICIES=['initials_birthdate','initials_sequence','random'];
/** Caller owns the transaction. All registration paths share this business lock. */
export async function issueMemberId(db,{businessId,name,dateOfBirth,requested=''}){
 await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[businessId+':member-id-allocation']);
 const business=(await db.query('SELECT member_id_policy FROM businesses WHERE id=$1',[businessId])).rows[0];
 if(!business)throw Error('Business not found.');
 const identity=(await db.query('SELECT member_identity_key($1,$2::date) AS key',[name,dateOfBirth])).rows[0].key;
 const prior=(await db.query('SELECT member_number FROM business_member_ids WHERE business_id=$1 AND identity_key=$2 ORDER BY created_at,member_number LIMIT 1',[businessId,identity])).rows[0];
 const supplied=String(requested||'').trim().toUpperCase();
 if(supplied&&(!prior||prior.member_number!==supplied))throw Error('The supplied membership ID does not belong to this client. Leave it blank for a new client.');
 if(prior)return prior.member_number;
 const words=name.trim().split(/\s+/),initials=((words[0]?.[0]||'X')+(words.at(-1)?.[0]||'X')).toUpperCase().replace(/[^A-Z]/g,'X');
 const policy=business.member_id_policy;
 const used=new Set((await db.query('SELECT member_number FROM business_member_ids WHERE business_id=$1',[businessId])).rows.map(r=>r.member_number));
 let number;
 if(policy==='initials_birthdate'){
  const base=initials+dateOfBirth.slice(5,7)+dateOfBirth.slice(8,10);
  if(!used.has(base))number=base;
 }
 if(!number&&policy!=='random')for(let n=1;n<=9999;n++){
  const candidate=initials+String(n).padStart(4,'0');
  if(!used.has(candidate)){number=candidate;break;}
 }
 // Random start, exhaustive scan: never give up merely because of a collision.
 if(!number){
  const size=26*26*10000,start=randomInt(size);
  for(let n=0;n<size;n++){
   const v=(start+n)%size,prefix=Math.floor(v/10000);
   const candidate=String.fromCharCode(65+Math.floor(prefix/26),65+prefix%26)+String(v%10000).padStart(4,'0');
   if(!used.has(candidate)){number=candidate;break;}
  }
 }
 if(!number)throw Error('No membership IDs remain available for this business.');
 await db.query('INSERT INTO business_member_ids(business_id,member_number,identity_key) VALUES($1,$2,$3)',[businessId,number,identity]);
 return number;
}
