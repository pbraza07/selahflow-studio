import {sessionInstances,expandAllSessions,validateRecurrence} from './session-recurrence.mjs';
/** Pure, business-scoped session and appointment availability helpers.
 * Pending booking requests do not consume capacity until accepted.
 */
/** Business-local clock, independent of the Render server's UTC clock.
 * Same-day slots start on the next quarter hour with no arbitrary one-hour delay.
 */
export function easternClock(at=new Date()) {
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',
  month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(at);
 const values=Object.fromEntries(parts.filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
 return {date:values.year+'-'+values.month+'-'+values.day,
   minutes:Number(values.hour)*60+Number(values.minute)};
}
export function nextQuarterHour(minutes) {
 if(!Number.isFinite(minutes)||minutes<0||minutes>=1440)throw Error('Invalid local clock minutes.');
 return Math.ceil((minutes+1)/15)*15;
}
export function appointmentData(appointment) {
  if (!appointment) return {};
  if (appointment.sessionId !== undefined) return appointment;
  try {
    return typeof appointment.data === 'string' ? JSON.parse(appointment.data) : (appointment.data || {});
  } catch {
    return {};
  }
}
export function activeAppointment(appointment) {
  return !['Cancelled', 'No-show'].includes(appointment.status);
}
export function overlaps(start, duration, otherStart, otherDuration) {
  return start < otherStart + otherDuration && otherStart < start + duration;
}
export function bookedSessionCount(appointments, sessionId) {
  return appointments.filter(a => activeAppointment(a) && appointmentData(a).sessionId === sessionId).length;
}
export function sessionRemaining(session, appointments) {
  return Math.max(0, Number(session.capacity) - bookedSessionCount(appointments, session.id));
}
export function sessionsForDate(config, date, staffId) {
  const services = Array.isArray(config.services) ? config.services : [];
  return sessionInstances(config,date,staffId)
    .map(x => ({...x, duration:services.find(s => s.id === x.service)?.duration || 0}))
    .filter(x => x.duration > 0);
}
export function selectedSession(config, date, staffId, services, start) {
  if (services.length !== 1) return null;
  return sessionsForDate(config, date, staffId)
    .find(x => x.service === services[0].id && x.start === start) || null;
}
export function validateBookableSessions(config) {
  const sessions = config.bookableSessions ?? [];
  if (!Array.isArray(sessions) || sessions.length > 200)
    throw Error('A business may configure up to 200 sessions.');
  const ids = new Set();
  for (const session of sessions) {
    const service = (config.services || []).find(x => x.id === session.service);
    const member = (config.staff || []).find(x => x.id === session.staff);
    if (!session || typeof session.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(session.id) ||
        ids.has(session.id) || typeof session.date !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(session.date) ||
        Number.isNaN(Date.parse(session.date + 'T12:00:00Z')) ||
        new Date(session.date + 'T12:00:00Z').toISOString().slice(0,10) !== session.date ||
        !Number.isInteger(session.start) || session.start % 15 !== 0 ||
        !Number.isInteger(session.capacity) || session.capacity < 1 || session.capacity > 100 ||
        !service || !member || !member.services.includes(service.id) ||
        !Number.isInteger(service.duration) || service.duration < 15 || service.duration > 480 ||
        !['minutes','hours'].includes(service.durationUnit || 'minutes') ||
        session.start < config.open * 60 ||
        session.start + service.duration + config.buffer > config.close * 60)
      throw Error('Check each session date, service, team member, start time, capacity and business hours.');
    validateRecurrence(session);
    ids.add(session.id);
  }
  // Validation expands a bounded two-year date horizon. Each occurrence is
  // checked against one-offs and other recurring series for staff collisions.
  const occurrenceIds=new Set(),byStaffDay=new Map();
  for(const instance of expandAllSessions(config)){
    if(occurrenceIds.has(instance.id))throw Error('Recurring session occurrence IDs must be unique.');
    occurrenceIds.add(instance.id);
    const key=instance.staff+'|'+instance.date;
    if(!byStaffDay.has(key))byStaffDay.set(key,[]);
    byStaffDay.get(key).push(instance);
  }
  for(const occurrences of byStaffDay.values()){
    occurrences.sort((a,b)=>a.start-b.start);
    for(let i=1;i<occurrences.length;i++){
      const previous=occurrences[i-1],current=occurrences[i];
      const duration=config.services.find(s=>s.id===previous.service).duration+config.buffer;
      if(overlaps(previous.start,duration,current.start,
        config.services.find(s=>s.id===current.service).duration+config.buffer))
        throw Error('Sessions for the same team member cannot overlap, including cleanup time.');
    }
  }
  return sessions;
}
export function validateExistingSessionReservations(oldInput,newInput,appointments) {
 const oldConfig=Array.isArray(oldInput)?{bookableSessions:oldInput}:oldInput||{};
 const newConfig=Array.isArray(newInput)?{bookableSessions:newInput}:newInput||{};
 const counts=new Map();
 for(const appointment of appointments||[]){
  if(!activeAppointment(appointment))continue;
  const id=appointmentData(appointment).sessionId;
  if(!id)continue;
  const date=appointment.date||oldConfig.bookableSessions?.find(x=>x.id===id)?.date;
  if(!date)continue;
  const old=sessionInstances(oldConfig,date).find(x=>x.id===id);
  if(!old)continue; // Legacy bookings with obsolete settings remain untouched.
  const key=date+'|'+id;
  counts.set(key,{old,date,id,count:(counts.get(key)?.count||0)+1});
 }
 for(const {old,date,id,count} of counts.values()){
  const next=sessionInstances(newConfig,date).find(x=>x.id===id);
  if(!next||next.date!==old.date||next.staff!==old.staff||
     next.start!==old.start||next.service!==old.service||
     next.capacity<count)
    throw Error('This session has confirmed customers. Keep its schedule and capacity at or above the booked count.');
  if(oldConfig.services?.length&&newConfig.services?.length){
   const oldDuration=oldConfig.services.find(s=>s.id===old.service)?.duration;
   const nextDuration=newConfig.services.find(s=>s.id===next.service)?.duration;
   if(oldDuration!==nextDuration)
    throw Error('A service with confirmed session customers cannot change duration.');
  }
 }
}
export function bookingDateRange(anchor, mode) {
  if (typeof anchor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(anchor) ||
      Number.isNaN(Date.parse(anchor + 'T12:00:00Z')) ||
      new Date(anchor + 'T12:00:00Z').toISOString().slice(0,10) !== anchor)
    throw Error('Choose a valid calendar date.');
  if (!['day','week','month'].includes(mode)) throw Error('Choose a calendar view.');
  const ref = new Date(anchor + 'T12:00:00Z');
  if (mode === 'week') ref.setUTCDate(ref.getUTCDate() - ref.getUTCDay());
  if (mode === 'month') ref.setUTCDate(1);
  const count = mode === 'day' ? 1 : mode === 'week' ? 7 :
    new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 0)).getUTCDate();
  return Array.from({length:count}, (_,i) => {
    const d = new Date(ref);
    d.setUTCDate(ref.getUTCDate() + i);
    return d.toISOString().slice(0,10);
  });
}
export function computeDayAvailability({config, date, staff, services, appointments, reservedSlots, today, nowMinutes, capacityOpen}) {
  const active = (appointments || []).filter(activeAppointment);
  const groupAppointments = active.filter(a => appointmentData(a).sessionId);
  const allSessions = sessionsForDate(config,date,staff);
  const matching = allSessions.filter(x => services.length === 1 && x.service === services[0].id);
  const minutes = new Set(reservedSlots || []);
  const slots = [];
  const sessionAvailability = {};
  const fullSessions = matching.map(s => ({
    id:s.id, date:s.date, staff:s.staff, service:s.service, start:s.start,
    capacity:s.capacity, remaining:sessionRemaining(s,active)
  }));
  if (date < today) return {slots,sessionAvailability,sessions:fullSessions,earliestStart:null,firstAvailable:null};
  const duration = services.reduce((n,s) => n + s.duration,0);
  const buffer = config.buffer || 0;
  const earliest = date === today ? nextQuarterHour(nowMinutes) : 0;
  for (let start = Math.ceil(config.open * 60 / 15) * 15;
       start + duration + buffer <= config.close * 60; start += 15) {
    if (start < earliest) continue;
    const session = matching.find(s => s.start === start);
    const staffCollision = active.some(a =>
      a.staff === staff &&
      overlaps(start,duration+buffer,Number(a.start),Number(a.duration)+buffer) &&
      (!session || appointmentData(a).sessionId !== session.id)
    );
    const occupied = [...minutes].some(t => t >= start && t < start + duration + buffer);
    if (session) {
      const remaining = sessionRemaining(session,active);
      sessionAvailability[start] = {remaining,capacity:session.capacity,id:session.id};
      if (remaining > 0 && !occupied && !staffCollision) slots.push(start);
    } else {
      const reservedForSession = allSessions.some(s =>
        overlaps(start,duration+buffer,s.start,s.duration+buffer));
      const otherGroupBooking = groupAppointments.some(a => a.staff === staff &&
        overlaps(start,duration+buffer,Number(a.start),Number(a.duration)+buffer));
      const ordinaryAppointments = active.filter(a => !appointmentData(a).sessionId);
      if (!occupied && !reservedForSession && !staffCollision && !otherGroupBooking &&
          capacityOpen(ordinaryAppointments,services,start,duration)) slots.push(start);
    }
  }
  return {slots,sessionAvailability,sessions:fullSessions,earliestStart:date===today?earliest:null,firstAvailable:slots[0]??null};
}
