import {deleteClientPermanently} from './delete-client.mjs';
/** Authenticated owner flow. The route resolves the exact client inside its transaction.
 * Operator maintenance retains its separate backup/restore authorization requirement. */
export async function deleteOwnerClient(db,{owner,businessId,client,clientId,confirmPhrase,api=undefined}){
 if(confirmPhrase!=='DELETE CLIENT')throw Error('Confirm permanent client deletion.');
 if(!(await db.query("SELECT id FROM businesses WHERE id=$1 AND owner_id=$2 AND status='active'",[businessId,owner])).rows[0])throw Error('Client not found in this business.');
 if(!client){
  const done=(await db.query('SELECT id FROM client_deletion_audit WHERE business_id=$1 AND target_digest=md5($2) LIMIT 1',[businessId,String(clientId||'')])).rows[0];
  if(done)return {alreadyDeleted:true};
  throw Error('Client not found in this business. Refresh your directory.');
 }
 if(!clientId||client.id!==clientId)throw Error('This client changed. Refresh before deleting.');
 return deleteClientPermanently(db,{owner,businessId,client,closeOpenCheckouts:true,api});
}
