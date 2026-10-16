import {hashPassword,tokenHash} from './security.mjs';

// Called inside the administrator's locked, authorized reset transaction.
export async function resetOwnerCredentials(client,target,tempPassword){
 await client.query('UPDATE users SET password_hash=$1,must_change_password=TRUE WHERE id=$2',
  [hashPassword(tempPassword),target.id]);
 await client.query('DELETE FROM sessions WHERE user_id=$1',[target.id]);
 await client.query('DELETE FROM login_attempts WHERE key = ANY($1::text[])',
  [[tokenHash(target.email.trim().toLowerCase()),'password-change:'+target.id]]);
}
