import {randomUUID} from 'node:crypto';
import {getPool} from './database.mjs';
import {
 appointmentData,activeAppointment,overlaps,easternClock,nextQuarterHour,
 sessionsForDate,validateBookableSessions,validateExistingSessionReservations,
 bookedSessionCount,sessionRemaining
} from './session-scheduling.mjs';
import {sessionInstances,originalSessionOccurrence} from './session-recurrence.mjs';

/** All operations are scoped to one authenticated, active owner and run
 * inside the same schedule lock used for confirming group bookings. This
 * ensures roster changes, date/time changes and new bookings cannot race.
 */
const validDate=date=>typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&
 !Number.isNaN(Date.parse(date+'T12:00:00Z'))&&
 new Date(date+'T12:00:00Z').toISOString().slice(0,10)===date;
const conflict=message=>{const error=new Error(message);error.status=409;return error;};
export function validateSessionMoveInput(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Enter a valid session change.');
 const {sessionId,sourceDate,date,staff,service,start,capacity,expectedStart,expectedStaff,expectedService,expectedCapacity,capacityEdited}=raw;
 if(typeof sessionId!=='string'||!/^[a-zA-Z0-9_-]{1,90}$/.test(sessionId)||
    !validDate(sourceDate)||!validDate(date)||typeof staff!=='string'||!staff||
    typeof service!=='string'||!service||
    !Number.isInteger(start)||start<0||start>=1440||start%15!==0||
    !Number.isInteger(capacity)||capacity<1||capacity>100||
    !Number.isInteger(expectedStart)||expectedStart<0||expectedStart>=1440||
    typeof expectedStaff!=='string'||!expectedStaff||
    typeof expectedService!=='string'||!expectedService||
    (expectedCapacity!==undefined&&(!Number.isInteger(expectedCapacity)||expectedCapacity<1||expectedCapacity>100))||
    (capacityEdited!==undefined&&typeof capacityEdited!=='boolean'))
  throw Error('Choose a valid session, date, time, service, team member and 1–100 customers.');
 return {sessionId,sourceDate,date,staff,service,start,capacity,expectedStart,expectedStaff,expectedService,
  ...(expectedCapacity!==undefined?{expectedCapacity}:{}),
  ...(capacityEdited!==undefined?{capacityEdited}:{})};
}
/** Reassigning a coach must not reset capacity. New capacity is accepted only
 * if the owner explicitly switched on Edit capacity. Older clients that lack
 * this flag retain the former behavior so existing integrations still work.
 */
export function transferredSessionCapacity(current,move){
 if(move.expectedCapacity!==undefined&&move.expectedCapacity!==current.capacity)
  throw conflict('Session capacity changed since the editor was opened. Refresh and try again.');
 return move.capacityEdited===false?current.capacity:move.capacity;
}
export function rescheduledConfig(config,current,move){
 const next=structuredClone(config);
 const destination={date:move.date,start:move.start,staff:move.staff,service:move.service,
  capacity:transferredSessionCapacity(current,move)};
 const original=originalSessionOccurrence(config,current.id);
 if(!original)throw conflict('Session was changed. Refresh and try again.');
 if(original.recurring){
  if(!Array.isArray(next.sessionOverrides))next.sessionOverrides=[];
  const entry={
   id:current.id,seriesId:original.seriesId,originalDate:original.date,
   ...destination,updatedAt:new Date().toISOString()
  };
  const index=next.sessionOverrides.findIndex(s=>s.id===current.id);
  if(index>=0)next.sessionOverrides[index]=entry;
  else next.sessionOverrides.push(entry);
 }else{
  const index=(next.bookableSessions||[]).findIndex(s=>s.id===current.id);
  if(index<0)throw conflict('Session was removed. Refresh and try again.');
  next.bookableSessions[index]={...next.bookableSessions[index],...destination};
 }
 validateBookableSessions(next);
 return next;
}
const getData=row=>appointmentData(row);
const movedHistory=(history,from,to)=>[
 ...(Array.isArray(history)?history.slice(-19):[]),
 {from,to,at:new Date().toISOString()}
];
/**
 * Only confirmed, future bookings are moved. Original booking IDs, names,
 * email/phone, custom answers, payment references, status and quoted charges
 * remain intact. Pending approval requests move to the same occurrence too.
 */
export async function rescheduleSessionForOwner({owner,input,pool=getPool()}){
 const move=validateSessionMoveInput(input);
 let client;
 try{
  client=await pool.connect();
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[owner+':schedule']);
  const business=(await client.query(
   "SELECT id FROM businesses WHERE owner_id=$1 AND status='active'",[owner])).rows[0];
  if(!business)throw Error('This business is not active.');
  const persisted=(await client.query('SELECT data FROM settings WHERE owner=$1 FOR UPDATE',[owner])).rows[0];
  if(!persisted)throw Error('Business settings are unavailable.');
  const config=JSON.parse(persisted.data);
  const current=sessionInstances(config,move.sourceDate).find(s=>s.id===move.sessionId);
  if(!current)throw conflict('Session is no longer on that date. Refresh your calendar and try again.');
  if(current.start!==move.expectedStart||current.staff!==move.expectedStaff||current.service!==move.expectedService||
    (move.expectedCapacity!==undefined&&move.expectedCapacity!==current.capacity))
   throw conflict('Session details have changed. Refresh your calendar before rescheduling.');
  const today=easternClock(),currentService=(config.services||[]).find(s=>s.id===current.service);
  const service=(config.services||[]).find(s=>s.id===move.service);
  const staff=(config.staff||[]).find(s=>s.id===move.staff);
  if(!currentService||!service||!staff||!staff.services?.includes(service.id)||
     !Number.isInteger(service.duration)||service.duration<15||service.duration>480||
     !['minutes','hours'].includes(service.durationUnit||'minutes'))
   throw Error('Choose an existing appointment service and an eligible team member.');
  if(move.sourceDate<today.date)
   throw Error('Past sessions and attendance history cannot be rescheduled.');
  if(move.date<today.date||(move.date===today.date&&move.start<nextQuarterHour(today.minutes)))
   throw Error('Choose an available future date and a time at or after the next 15-minute interval.');
  const cutoff=new Date(Date.now()+366*86400000).toISOString().slice(0,10);
  if(move.date>cutoff)throw Error('The rescheduled date must be within the next year.');
  if(move.start<config.open*60||move.start+service.duration+(config.buffer||0)>config.close*60)
   throw Error('Session must fit the selected business hours, including cleanup time.');

  const next=rescheduledConfig(config,current,move);
  const instances=sessionsForDate(next,move.date,move.staff);
  const target=instances.find(s=>s.id===move.sessionId);
  if(!target||target.date!==move.date||target.start!==move.start||
     target.staff!==move.staff||target.service!==move.service)
   throw conflict('Unable to resolve the new session. Refresh before trying again.');

  const existing=(await client.query(
   "SELECT id,date,staff,start,duration,status,data FROM appointments WHERE owner=$1 AND (date=$2 OR date=$3) FOR UPDATE",
   [owner,move.sourceDate,move.date])).rows;
  const impacted=existing.filter(a=>a.date===move.sourceDate&&
   getData(a).sessionId===current.id&&activeAppointment(a));
  // Capacity belongs to the session occurrence, never to a team member.
  // Count bookings by stable session ID independently of the staff filter.
  const originalCapacity=current.capacity;
  const originalBooked=bookedSessionCount(impacted,current.id);
  const originalRemaining=sessionRemaining(current,impacted);
  const destinationCapacity=transferredSessionCapacity(current,move);
  if(impacted.some(a=>['Completed','Checked in'].includes(a.status)))
   throw conflict('A customer has already checked in or completed this session. Keep attendance history unchanged.');
  if(originalBooked>destinationCapacity)
   throw conflict('This session has '+originalBooked+' confirmed customers. Capacity must remain at least '+originalBooked+'.');
  const movedIds=new Set(impacted.map(a=>a.id));
  const remaining=existing.filter(a=>!movedIds.has(a.id));
  validateExistingSessionReservations(config,next,remaining);
  const overlap=remaining.some(a=>a.date===move.date&&activeAppointment(a)&&a.staff===move.staff&&
   overlaps(move.start,service.duration+(config.buffer||0),Number(a.start),Number(a.duration)+(config.buffer||0)));
  if(overlap)throw conflict('The selected team member already has another customer booking at the new date or time.');
  const slots=(await client.query(
   "SELECT sl.appointment,sl.minute FROM slots sl WHERE sl.owner=$1 AND sl.date=$2 AND sl.staff=$3 AND sl.minute >= $4 AND sl.minute < $5",
   [owner,move.date,move.staff,move.start,move.start+service.duration+(config.buffer||0)])).rows;
  if(slots.some(row=>!movedIds.has(row.appointment)))
   throw conflict('The selected time is reserved for another appointment.');

  const pending=(await client.query(
   "SELECT id,date,staff_id,start_minute,duration,details,status FROM booking_requests WHERE owner_id=$1 AND status='pending' AND (date=$2 OR date=$3) FOR UPDATE",
   [owner,move.sourceDate,move.date])).rows.filter(r=>
    r.date===move.sourceDate&&JSON.parse(r.details||'{}').sessionId===current.id);
  const from={date:current.date,staff:current.staff,start:current.start,service:current.service,duration:currentService.duration};
  const to={date:move.date,staff:move.staff,start:move.start,service:move.service,duration:service.duration};

  // The updated session retains exactly the same booking IDs and bookings;
  // changing only the assigned staff cannot alter booked/available seats.
  const targetCount=bookedSessionCount(impacted,target.id);
  const newRemaining=Math.max(0,target.capacity-targetCount);
  if(targetCount!==originalBooked||
    (move.capacityEdited===false&&
     (target.capacity!==originalCapacity||newRemaining!==originalRemaining)))
   throw conflict('Session seats could not be preserved. Refresh and try again.');
  for(const appointment of impacted){
   const data=getData(appointment);
   const updated={...data,services:[service.name],serviceIds:[service.id],
    sessionMoveHistory:movedHistory(data.sessionMoveHistory,from,to)};
   // Keep the existing booking ID and financial quote. A session reschedule
   // is not a payment, refund, or customer cancellation.
   await client.query(
    'UPDATE appointments SET date=$1,staff=$2,start=$3,duration=$4,data=$5 WHERE id=$6 AND owner=$7',
    [move.date,move.staff,move.start,service.duration,JSON.stringify(updated),appointment.id,owner]);
  }
  for(const request of pending){
   const details=JSON.parse(request.details||'{}');
   const updated={...details,date:move.date,staffId:move.staff,start:move.start,
    duration:service.duration,services:[service.name],serviceIds:[service.id],
    sessionMoveHistory:movedHistory(details.sessionMoveHistory,from,to)};
   await client.query(
    "UPDATE booking_requests SET date=$1,staff_id=$2,start_minute=$3,duration=$4,details=$5 WHERE id=$6 AND owner_id=$7 AND status='pending'",
    [move.date,move.staff,move.start,service.duration,JSON.stringify(updated),request.id,owner]);
  }
  // Historical group bookings created by earlier versions could retain
  // individual minute locks. A shared-seat group session must not leave those
  // locks behind on the former coach, or have them copied to the new coach.
  // The group capacity/occupancy is enforced by booking IDs instead.
  if(impacted.length)await client.query(
   'DELETE FROM slots WHERE owner=$1 AND appointment = ANY($2::text[])',
   [owner,impacted.map(a=>a.id)]);
  await client.query('UPDATE settings SET data=$1 WHERE owner=$2',[JSON.stringify(next),owner]);
  await client.query('INSERT INTO events(id,owner,created,kind,data) VALUES($1,$2,$3,$4,$5)',
   [randomUUID(),owner,new Date().toISOString(),'session_rescheduled',JSON.stringify({
    sessionId:current.id,seriesId:current.seriesId,from,to,
    confirmedCustomersRetained:impacted.length,pendingRequestsRetained:pending.length,
    seatsBefore:{capacity:originalCapacity,booked:originalBooked,remaining:originalRemaining},
    seatsAfter:{capacity:target.capacity,booked:targetCount,remaining:newRemaining}
   })]);
  await client.query('COMMIT');
  return {ok:true,sessionId:current.id,seriesId:current.seriesId,from,to,
   confirmedCustomersRetained:impacted.length,pendingRequestsRetained:pending.length,
   seatsBefore:{capacity:originalCapacity,booked:originalBooked,remaining:originalRemaining},
   seatsAfter:{capacity:target.capacity,booked:targetCount,remaining:newRemaining},
   message:'Session updated. '+impacted.length+' confirmed customer(s) and '+pending.length+
    ' pending request(s) remain attached to the same session.'};
 }catch(error){
  if(client)try{await client.query('ROLLBACK');}catch{}
  throw error;
 }finally{client?.release();}
}
