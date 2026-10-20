import {authorizeClientDeletion} from './deletion-authorization.mjs';
import {createHash} from 'node:crypto';
import {assertStagingDatabase,isStaging} from './staging-safety.mjs';
import {deleteClientPermanently} from './delete-client.mjs';
import {issueMemberId} from './member-id-policy.mjs';
const object=x=>{try{return typeof x==='string'?JSON.parse(x):x||{};}catch{return {};}};
const day=x=>x instanceof Date?x.toISOString().slice(0,10):String(x||'').slice(0,10);
const identity=(name,dob)=>String(name||'').trim().replace(/\s+/g,' ').toLowerCase()+'|'+day(dob);
const digest=x=>createHash('sha256').update(x).digest('hex');
/** Explicit staging operator task. Permanent removal and counts-only verification commit together; never email/name-only matching. */
export async function resetStagingRegistration(pool,target,env=process.env){
 if(!isStaging(env))throw Error('Registration reset is restricted to staging.');
 assertStagingDatabase(env);
 if(!/^[a-f0-9-]{36}$/i.test(target?.profileId||'')||!/^[a-z0-9-]{1,80}$/.test(target?.businessSlug||'')||!/^[A-Z0-9]{6,8}$/.test(target?.originalMemberNumber||''))throw Error('Invalid staging registration reset target.');
 const operationId=digest('registration-reset-v103|'+JSON.stringify(target));
 const db=await pool.connect();
 try{
  await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[operationId]);
  const prior=(await db.query('SELECT result FROM staging_registration_resets WHERE operation_id=$1',[operationId])).rows[0];
  if(prior){await db.query('COMMIT');return {...object(prior.result),alreadyApplied:true};}
  const business=(await db.query("SELECT id,owner_id FROM businesses WHERE slug=$1 AND status='active'",[target.businessSlug])).rows[0];
  if(!business)throw Error('Reset business unavailable.');
  await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[business.id+':member-id-allocation']);
  const profile=(await db.query('SELECT * FROM business_client_profiles WHERE id=$1 AND owner=$2',[target.profileId,business.owner_id])).rows[0];
  const original=(await db.query('SELECT * FROM business_member_ids WHERE business_id=$1 AND member_number=$2',[business.id,target.originalMemberNumber])).rows[0];
  const current=profile&&(await db.query('SELECT identity_key FROM business_member_ids WHERE business_id=$1 AND member_number=$2',[business.id,profile.member_number])).rows[0];
  if(!profile||!original||current?.identity_key!==original.identity_key)throw Error('Exact reset registration identity could not be verified.');
  await authorizeClientDeletion(db,{businessId:business.id,profileId:profile.id});
  const result=await deleteClientPermanently(db,{owner:business.owner_id,businessId:business.id,client:{id:profile.id,name:profile.name,dateOfBirth:day(profile.date_of_birth),memberNumber:profile.member_number}});
  await db.query('SAVEPOINT fresh_registration_probe');
  const split=original.identity_key.lastIndexOf('|'),name=original.identity_key.slice(0,split),dateOfBirth=original.identity_key.slice(split+1);
  const probe=await issueMemberId(db,{businessId:business.id,name,dateOfBirth});
  result.freshRegistrationVerified=/^[A-Z]{2}[0-9]{4}$/.test(probe);
  await db.query('ROLLBACK TO SAVEPOINT fresh_registration_probe');
  if(!result.freshRegistrationVerified)throw Error('Fresh six-character registration could not be verified.');
  await db.query('INSERT INTO staging_registration_resets(operation_id,business_id,profile_id,result) VALUES($1,$2,$3,$4::jsonb)',[operationId,business.id,target.profileId,JSON.stringify(result)]);
  await db.query('COMMIT');return result;
 }catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
}
