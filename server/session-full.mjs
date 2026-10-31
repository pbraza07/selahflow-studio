import {randomUUID} from 'node:crypto';
import {getPool} from './database.mjs';
import {validateBookableSessions} from './session-scheduling.mjs';
import {sessionInstances} from './session-recurrence.mjs';

/** Owner identity is supplied by the authenticated route, never the payload.
 * Use the booking schedule lock so closure and confirmation are serialized.
 */
export async function setSessionFullForOwner({owner,input,pool=getPool()}){
 if(!input||typeof input.sessionId!=='string'||!/^[a-zA-Z0-9_-]{1,90}$/.test(input.sessionId)||
    typeof input.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(input.date)||typeof input.full!=='boolean')
  throw Error('Choose a valid session and full status.');
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[owner+':schedule']);
  const business=(await client.query("SELECT id FROM businesses WHERE owner_id=$1 AND status='active'",[owner])).rows[0];
  if(!business)throw Error('This business is not active.');
  const persisted=(await client.query('SELECT data FROM settings WHERE owner=$1 FOR UPDATE',[owner])).rows[0];
  if(!persisted)throw Error('Business settings are unavailable.');
  const config=JSON.parse(persisted.data);
  const session=sessionInstances(config,input.date).find(s=>s.id===input.sessionId);
  if(!session)throw Error('Session changed or was removed. Refresh your calendar.');
  const ids=new Set(config.fullSessionIds||[]);
  if(input.full)ids.add(session.id);else ids.delete(session.id);
  config.fullSessionIds=[...ids];
  validateBookableSessions(config);
  await client.query('UPDATE settings SET data=$1 WHERE owner=$2',[JSON.stringify(config),owner]);
  await client.query('INSERT INTO events(id,owner,created,kind,data) VALUES($1,$2,$3,$4,$5)',
   [randomUUID(),owner,new Date().toISOString(),'session_full',JSON.stringify({sessionId:session.id,date:session.date,full:input.full})]);
  await client.query('COMMIT');
  return {ok:true,fullSessionIds:config.fullSessionIds};
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
