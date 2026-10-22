import {sessionsForDate} from './session-scheduling.mjs';
export function validAssignmentDate(date){return typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date+'T12:00:00Z'))&&new Date(date+'T12:00:00Z').toISOString().slice(0,10)===date;}
export async function saveTeamOccurrence(db,{businessId,config,input}){
 if(!validAssignmentDate(input.date))throw Error('Choose a valid session date.');
 const session=sessionsForDate(config,input.date).find(s=>s.id===input.sessionId&&s.start===input.start);
 if(!session||!Array.isArray(input.staffIds)||input.staffIds.length>100||input.staffIds.some(id=>!(config.staff||[]).some(s=>s.id===id)))throw Error('Choose this business’s session date, time and team members.');
 await db.query('INSERT INTO session_team_occurrences(business_id,session_id,session_date,start_minute,staff_ids,note) VALUES($1,$2,$3,$4,$5::jsonb,$6) ON CONFLICT(business_id,session_id,session_date,start_minute) DO UPDATE SET staff_ids=excluded.staff_ids,note=excluded.note,updated_at=now()',[businessId,session.id,input.date,session.start,JSON.stringify([...new Set(input.staffIds)]),String(input.note||'').slice(0,1000)]);
 return {ok:true,date:input.date,start:session.start};
}
