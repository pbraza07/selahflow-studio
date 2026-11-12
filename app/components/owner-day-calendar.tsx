'use client';
import type {CSSProperties} from 'react';
import {timeLabel} from '../../lib/defaults';
import {layoutCalendarEvents,calendarTimeRange,CALENDAR_PIXELS_PER_MINUTE,CALENDAR_MIN_EVENT_HEIGHT,CALENDAR_LANE_WIDTH} from '../../server/calendar-layout.mjs';
type Any=any;
type Props={config:Any;appointments:Any[];sessions:Any[];date:string;staffFilter:string;serviceAccent:(name:string)=>string|undefined;sessionLeft:(session:Any)=>number;onAppointment:(appointment:Any)=>void;onSession:(session:Any)=>void;onPlan:(selection:{date:string;staff?:string;start?:number})=>void};

export default function OwnerDayCalendar({config,appointments,sessions,date,staffFilter,serviceAccent,sessionLeft,onAppointment,onSession,onPlan}:Props){
 const booked=appointments.filter(a=>a.date===date&&a.status!=='Cancelled'&&(staffFilter==='all'||a.staff===staffFilter));
 const published=sessions.filter(s=>s.date===date&&(staffFilter==='all'||s.staff===staffFilter));
 const team=(config.staff||[]).filter((s:Any)=>staffFilter==='all'||s.id===staffFilter).slice();
 // Retain historical bookings even if their team member is no longer in settings.
 for(const entry of [...booked,...published])if(!team.some((s:Any)=>s.id===entry.staff))team.push({id:entry.staff,name:'Former team member',initials:'—',color:'neutral'});
 const columns=team.map((staff:Any)=>{
  const staffSessions=published.filter(s=>s.staff===staff.id);
  const belongs=(a:Any,s:Any)=>a.sessionId===s.id&&a.date===s.date&&a.staff===s.staff&&a.start===s.start;
  const events=[
   ...booked.filter(a=>a.staff===staff.id&&!staffSessions.some(s=>belongs(a,s))).map(a=>({key:'booking-'+a.id,kind:'booking',start:a.start,duration:a.duration,data:a})),
   ...staffSessions.map(s=>({key:'session-'+s.id,kind:'session',start:s.start,duration:config.services.find((v:Any)=>v.id===s.service)?.duration||30,clients:booked.filter(a=>belongs(a,s)),data:s})),
   ...(config.teamTimeOff||[]).filter((b:Any)=>b.staff===staff.id&&date>=b.from&&date<=b.to).map((b:Any)=>({key:'off-'+b.id,kind:'off',start:b.start,duration:b.end-b.start,data:b}))
  ];
  const layout=layoutCalendarEvents(events);
  return {staff,layout,width:Math.max(1,...layout.map(e=>e.lanes))*(staffSessions.length?320:CALENDAR_LANE_WIDTH)};
 });
 const range=calendarTimeRange(config.open,config.close,columns.flatMap((c:Any)=>c.layout));
 const hours=Array.from({length:(range.end-range.start)/60},(_,i)=>range.start+i*60);
 const height=(range.end-range.start)*CALENDAR_PIXELS_PER_MINUTE+CALENDAR_MIN_EVENT_HEIGHT;
 return <><p className="sf-calendar-layout-help">{booked.length} booked appointment{booked.length===1?'':'s'} · Clients appear inside their bookable session. Select a client for details or the session heading for its full roster. Scroll within a session to see every client. Separate overlapping appointments appear side by side.</p>
 <div className="calendar-scroll sf-owner-day-scroll" tabIndex={0} role="region" aria-label="Daily schedule with all overlapping bookings">
  <div className="calendar-grid sf-owner-day-grid" style={{gridTemplateColumns:'65px '+columns.map((c:Any)=>`minmax(${c.width}px, 1fr)`).join(' ')}}>
   <div className="cal-head">Time</div>{columns.map(({staff}:Any)=><div className="cal-head" key={staff.id}><span className={'avatar '+staff.color}>{staff.initials}</span><b translate="no">{staff.name}</b></div>)}
   <div className="time-column" style={{height}}>{hours.map(start=><div key={start}>{timeLabel(start)}</div>)}</div>
   {columns.map(({staff,layout}:Any)=><div className="cal-column" key={staff.id} style={{height}}>
    {hours.map(start=><button type="button" className="sf-team-calendar-trigger" style={{top:(start-range.start)*CALENDAR_PIXELS_PER_MINUTE,height:100}} key={start} aria-label={'Plan '+staff.name+' on '+date+' at '+timeLabel(start)} onClick={()=>onPlan({date,staff:staff.id,start})}>＋</button>)}
    {layout.map((event:Any)=>{
     const a=event.data,service=event.kind==='session'?config.services.find((s:Any)=>s.id===a.service):null;
     const style={top:(event.start-range.start)*CALENDAR_PIXELS_PER_MINUTE,height:event.height,left:`calc(${100*event.lane/event.lanes}% + 4px)`,width:`calc(${100/event.lanes}% - 8px)`,right:'auto',...(event.kind==='session'?{'--sf-service-accent':serviceAccent(service?.name||'')||'#387459'}:event.kind==='booking'?{borderLeftColor:serviceAccent(a.services?.[0])}: {})} as CSSProperties;
     const times=timeLabel(a.start)+' – '+(a.start+event.duration===1440?'Midnight':timeLabel(a.start+event.duration));
     if(event.kind==='off')return <button type="button" key={event.key} className="sf-team-time-off-event sf-calendar-lane-event" style={style} onClick={()=>onPlan({date,staff:staff.id})}><b>Time off</b><span>{times}</span><span translate="no">{a.reason||'Personal time'}</span></button>;
     if(event.kind==='session')return <section key={event.key} data-calendar-session={event.key} className="cal-event sf-session-event sf-calendar-lane-event sf-session-with-clients" style={style} aria-label={(service?.name||'Session')+' bookings'}>
      <button type="button" data-calendar-event={event.key} className="sf-session-heading" onClick={()=>onSession(a)} aria-label={'View registered customers for '+(service?.name||'Session')+' on '+a.date+' at '+timeLabel(a.start)}><b translate="no">{service?.name||'Session'}</b><span>{times} · {sessionLeft(a)}/{a.capacity} slots left{a.manuallyFull?' · Session full':''}</span></button>
      <div className="sf-session-clients" role="group" aria-label="Clients booked in this session">{event.clients.length?event.clients.map((client:Any)=><button type="button" key={client.id} data-calendar-event={'booking-'+client.id} className="sf-session-client" onClick={()=>onAppointment(client)} aria-label={client.name+', '+times+', '+client.status}><b translate="no">{client.name}</b><span>{client.status}</span></button>):<span className="sf-session-empty">No clients booked yet</span>}</div>
     </section>;
     return <button type="button" key={event.key} data-calendar-event={event.key} className={'cal-event sf-calendar-lane-event '+staff.color} style={style} onClick={()=>onAppointment(a)} aria-label={a.name+', '+times+', '+(a.services||[]).join(', ')+', '+a.status}><b translate="no">{a.name}</b><span>{times}</span><span translate="no">{(a.services||[]).join(', ')}</span><span>{a.status}</span></button>;
    })}
   </div>)}
  </div>
 </div></>;
}
