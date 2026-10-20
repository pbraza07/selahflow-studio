import {deleteClientPermanently} from './delete-client.mjs';
import {authorizeClientDeletion} from './deletion-authorization.mjs';
/** Explicit, exact-record maintenance only. Never invoked during startup. */
export async function repairClientIntegrity(pool,target){
 if(!target?.businessId||!target?.profileId||!target?.operationId)throw Error('Exact business, profile and verified backup/restore authorization are required.');
 const db=await pool.connect();
 try{
  await db.query('BEGIN');
  const business=(await db.query("SELECT id,owner_id FROM businesses WHERE id=$1 AND status='active'",[target.businessId])).rows[0];
  if(!business)throw Error('Business not found.');
  await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[business.id+':member-id-allocation']);
  const profile=(await db.query('SELECT * FROM business_client_profiles WHERE owner=$1 AND id=$2 FOR UPDATE',[business.owner_id,target.profileId])).rows[0];
  if(!profile||profile.member_number!==target.memberNumber)throw Error('Exact authorized client no longer matches.');
  await authorizeClientDeletion(db,{businessId:business.id,profileId:profile.id,operationId:target.operationId});
  const result=await deleteClientPermanently(db,{owner:business.owner_id,businessId:business.id,client:{id:profile.id,name:profile.name,dateOfBirth:profile.date_of_birth,memberNumber:profile.member_number}});
  await db.query('COMMIT');return result;
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
