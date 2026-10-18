import {selectedSession,sessionRemaining} from './session-scheduling.mjs';
export const SESSION_FULL_MESSAGE='Session is now full. Please choose another session.';
/** Pending requests have no reserved seat. Confirmed attendees already consume capacity. */
export async function sessionIsFull(db,{owner,config,date,staff,services,start}){
 const session=selectedSession(config,date,staff,services,Number(start));
 if(!session)return false;
 const appointments=(await db.query('SELECT status,data FROM appointments WHERE owner=$1 AND date=$2',[owner,date])).rows;
 return sessionRemaining(session,appointments)===0;
}
