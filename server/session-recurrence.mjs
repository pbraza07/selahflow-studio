/**
 * Recurring bookable sessions are business-local calendar dates, not UTC
 * timestamps. Each occurrence retains independent seats and booked customers.
 * The first date preserves the original session ID for backwards compatibility;
 * later dates have deterministic IDs: SERIES_ID__YYYYMMDD.
 */
export const RECURRENCE_FREQUENCIES=['daily','weekly','monthly'];
const dateOK=date=>typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&
 !Number.isNaN(Date.parse(date+'T12:00:00Z'))&&
 new Date(date+'T12:00:00Z').toISOString().slice(0,10)===date;
const dateUTC=date=>Date.parse(date+'T12:00:00Z');
const plusDate=(date,days)=>new Date(dateUTC(date)+days*86400000).toISOString().slice(0,10);
export function validateRecurrence(session){
 if(session.repeat===undefined||session.repeat===null||session.repeat===false)return null;
 const rule=session.repeat;
 if(!rule||typeof rule!=='object'||Array.isArray(rule)||
    !RECURRENCE_FREQUENCIES.includes(rule.frequency)||
    !Number.isInteger(rule.every)||rule.every<1||rule.every>12||
    !dateOK(session.date)||!dateOK(rule.until)||rule.until<session.date)
  throw Error('Choose a recurrence frequency, repeat interval and valid end date no earlier than the first session.');
 const days=Math.round((dateUTC(rule.until)-dateUTC(session.date))/86400000);
 if(days>730)throw Error('Recurring session end date must be within two years of its start date.');
 return rule;
}
export function recurrenceOccursOn(session,date){
 if(!dateOK(date)||!dateOK(session?.date)||date<session.date)return false;
 if(date===session.date)return true;
 const rule=validateRecurrence(session);
 if(!rule||date>rule.until)return false;
 if(rule.frequency==='daily'){
  const days=Math.round((dateUTC(date)-dateUTC(session.date))/86400000);
  return days%rule.every===0;
 }
 if(rule.frequency==='weekly'){
  const days=Math.round((dateUTC(date)-dateUTC(session.date))/86400000);
  return days%(rule.every*7)===0;
 }
 const first=new Date(dateUTC(session.date)),current=new Date(dateUTC(date));
 // A session on January 31 occurs only in months with day 31. It must never
 // slip to February 28/March 3 due to JavaScript Date rollover.
 const months=(current.getUTCFullYear()-first.getUTCFullYear())*12+
  current.getUTCMonth()-first.getUTCMonth();
 return current.getUTCDate()===first.getUTCDate()&&months>=0&&months%rule.every===0;
}
export function recurringSessionForDate(session,date){
 if(!recurrenceOccursOn(session,date))return null;
 if(date===session.date)return {...session,seriesId:session.id,recurring:!!session.repeat};
 return {...session,date,id:session.id+'__'+date.replaceAll('-',''),
   seriesId:session.id,recurring:true};
}
/**
 * Resolve one original calendar occurrence by its stable identifier. Used for
 * validating per-occurrence overrides, never to look up private customer data.
 */
export function originalSessionOccurrence(config,id){
 for(const base of config.bookableSessions||[]){
  if(base.id===id)return recurringSessionForDate(base,base.date);
  if(!base.repeat)continue;
  for(const date of recurrenceDates(base)){
   const occurrence=recurringSessionForDate(base,date);
   if(occurrence?.id===id)return occurrence;
  }
 }
 return null;
}
/** An override moves one recurring date without changing the underlying rule.
 * Its stable ID follows the booking, not the date, preserving customer records.
 */
export function sessionInstances(config,date,staffId){
 const overrides=Array.isArray(config.sessionOverrides)?config.sessionOverrides:[];
 const overriddenIds=new Set(overrides.map(o=>o.id));
 const generated=(Array.isArray(config.bookableSessions)?config.bookableSessions:[])
  .map(s=>recurringSessionForDate(s,date))
  .filter(s=>s&&!overriddenIds.has(s.id));
 const moved=overrides.filter(s=>s.date===date).map(s=>({...s,recurring:true,overridden:true}));
 return [...generated,...moved].filter(s=>!staffId||s.staff===staffId);
}
export function recurrenceDates(session){
 if(!dateOK(session?.date))return [];
 const rule=validateRecurrence(session);
 if(!rule)return [session.date];
 const out=[];
 for(let date=session.date;date<=rule.until;date=plusDate(date,1)){
  if(recurrenceOccursOn(session,date))out.push(date);
 }
 return out;
}
export function seriesOccurrences(config,seriesId){
 const base=(config.bookableSessions||[]).find(x=>x.id===seriesId);
 if(!base)return [];
 const candidates=new Set([
  ...recurrenceDates(base),
  ...(config.sessionOverrides||[]).filter(x=>x.seriesId===seriesId).map(x=>x.date)
 ]);
 return [...candidates].flatMap(date=>sessionInstances(config,date).filter(x=>x.seriesId===seriesId))
  .sort((a,b)=>a.date.localeCompare(b.date)||a.start-b.start);
}
export function expandAllSessions(config,maxOccurrences=25000){
 let count=0;
 const sessions=[],overrideIds=new Set((config.sessionOverrides||[]).map(x=>x.id));
 for(const base of config.bookableSessions||[]){
  for(const date of recurrenceDates(base)){
   const item=recurringSessionForDate(base,date);
   if(overrideIds.has(item.id))continue;
   if(++count>maxOccurrences)throw Error('Too many recurring sessions. Reduce the number of series or shorten their end dates.');
   sessions.push(item);
  }
 }
 for(const item of config.sessionOverrides||[]){
  if(++count>maxOccurrences)throw Error('Too many recurring sessions. Reduce the number of series or shorten their end dates.');
  sessions.push({...item,recurring:true,overridden:true});
 }
 return sessions;
}
