/** Evidence is provisioned by a reviewed operator task, never a client boolean. */
export async function authorizeClientDeletion(db,{businessId,profileId,operationId=null}){
 const result=await db.query(`UPDATE client_deletion_authorizations SET consumed_at=now()
 WHERE business_id=$1 AND profile_id=$2 AND ($3::text IS NULL OR operation_id::text=$3)
 AND database_name=current_database() AND consumed_at IS NULL
 AND verified_at>now()-interval '24 hours' AND verified_at<=now() AND expires_at>now()
 RETURNING operation_id`,[businessId,profileId,operationId||null]);
 if(result.rows.length!==1)throw Error('Deletion requires a current verified backup, isolated restore and exact-record authorization. No client data was deleted.');
 return result.rows[0].operation_id;
}
