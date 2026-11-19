import {seriesOccurrences,sessionInstances} from './session-recurrence.mjs';
import {easternClock} from './session-scheduling.mjs';

export function archiveRemovedSessions(previous,next,clock=easternClock()){
 const retained=new Set(next.bookableSessions.map(s=>s.id));
 const history=[...(previous.archivedOccurrences||[])];
 for(const series of previous.bookableSessions||[]){
  if(retained.has(series.id))continue;
  for(const occurrence of seriesOccurrences(previous,series.id)){
   if(occurrence.date>clock.date||occurrence.date===clock.date&&occurrence.start>clock.minutes)continue;
   const service=previous.services?.find(s=>s.id===occurrence.service);
   history.push({...occurrence,archived:true,serviceName:service?.name,duration:service?.duration,
    staffName:previous.staff?.find(s=>s.id===occurrence.staff)?.name});
  }
 }
 return history;
}

export function ownerCalendarSessions(config,date,staff){
 return [...sessionInstances(config,date,staff),...(config.archivedOccurrences||[]).filter(s=>s.date===date&&(!staff||staff===s.staff))];
}

/** Remove a bookable definition and its published reschedules, preserving
 * appointment/request/payment/consent records (which live outside settings).
 */
export function removeBookableSession(config,id){
 const removedFields=new Set(),bookingFields=new Set();
 const bookingCustomFields=(config.bookingCustomFields||[]).flatMap(field=>{
  if(!field.sessionIds?.includes(id))return [field];
  const sessionIds=field.sessionIds.filter(value=>value!==id);
  if(sessionIds.length)return [{...field,sessionIds}];
  bookingFields.add(field.id);
  if((field.forms||['booking','membership']).includes('membership'))return [{...field,forms:['membership'],sessionIds:[],serviceIds:[]}];
  removedFields.add(field.id);return [];
 });
 const omit=(values,removed)=>(values||[]).filter(value=>!removed.has(value));
 const required=record=>record?Object.fromEntries(Object.entries(record).filter(([key])=>!removedFields.has(key))):record;
 return {...config,bookableSessions:(config.bookableSessions||[]).filter(row=>row.id!==id).map(row=>({...row,...(row.questionRequired?{questionRequired:required(row.questionRequired)}:{})})),
  sessionOverrides:(config.sessionOverrides||[]).filter(row=>row.seriesId!==id&&row.id!==id),
  fullSessionIds:(config.fullSessionIds||[]).filter(value=>value!==id&&!value.startsWith(id+'__')),
  bookingCustomFields,bookingQuestionOrder:omit(config.bookingQuestionOrder,bookingFields),
  membershipQuestionOrder:omit(config.membershipQuestionOrder,removedFields),
  ...(Array.isArray(config.bookingPushFields)?{bookingPushFields:omit(config.bookingPushFields,bookingFields)}:{}),
  ...(config.bookingApprovalVisibleFields?{bookingApprovalVisibleFields:omit(config.bookingApprovalVisibleFields,bookingFields)}:{}),
  ...(config.bookingQuestionNotifications?{bookingQuestionNotifications:Object.fromEntries(Object.entries(config.bookingQuestionNotifications).filter(([key])=>!bookingFields.has(key)))}:{}),
  ...(config.membershipQuestionNotifications?{membershipQuestionNotifications:required(config.membershipQuestionNotifications)}:{}),
  services:(config.services||[]).map(row=>({...row,...(row.questionRequired?{questionRequired:required(row.questionRequired)}:{})}))};
}
export function cleanRemovedBookableSessions(previous,next){
 if(!Array.isArray(next?.bookableSessions))return next;
 return (previous.bookableSessions||[]).filter(row=>!next.bookableSessions.some(item=>item.id===row.id)).reduce((config,row)=>removeBookableSession(config,row.id),next);
}
