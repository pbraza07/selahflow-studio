'use client';
import {CalendarPlus} from 'lucide-react';
type Props={id:string;business:string;service:string;staff:string;date:string;start:number;duration:number;address?:string;clientName?:string;pending?:boolean};
function eventTimes(p:Props){
 const [y,m,d]=p.date.split('-').map(Number);
 const local=new Date(Date.UTC(y,m-1,d,Math.floor(p.start/60),p.start%60));
 const offset=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',timeZoneName:'shortOffset'}).formatToParts(new Date(Date.UTC(y,m-1,d,16))).find(x=>x.type==='timeZoneName')?.value||'GMT-4';
 const match=offset.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
 const minutes=match?(Number(match[2])*60+Number(match[3]||0))*(match[1]==='-'?-1:1):-240;
 const begin=new Date(local.getTime()-minutes*60000);
 return [begin,new Date(begin.getTime()+p.duration*60000)];
}
const stamp=(d:Date)=>d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
export default function AddToCalendar(p:Props){
 const [start,end]=eventTimes(p);
 const title=p.service+' — '+p.business;
 const details='Client: '+(p.clientName||'Client')+'\nAppointment: '+p.service+'\nAssigned team member: '+p.staff+'\nBusiness: '+p.business+'\nBooking reference: '+p.id;
 const google=new URL('https://calendar.google.com/calendar/render');
 google.searchParams.set('action','TEMPLATE');google.searchParams.set('text',title);
 google.searchParams.set('dates',stamp(start)+'/'+stamp(end));google.searchParams.set('details',details);
 google.searchParams.set('location',p.address||'');
 function download(){
  const escape=(s:string)=>s.replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
  const ics=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//SelahFlow//Booking Calendar//EN','BEGIN:VEVENT','UID:'+escape(p.id)+'@selahflow.app','DTSTAMP:'+stamp(new Date()),'DTSTART:'+stamp(start),'DTEND:'+stamp(end),'SUMMARY:'+escape(title),'DESCRIPTION:'+escape(details),'LOCATION:'+escape(p.address||'') ,'END:VEVENT','END:VCALENDAR'].join('\r\n')+'\r\n';
  const url=URL.createObjectURL(new Blob([ics],{type:'text/calendar;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='selahflow-appointment.ics';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
 }
 return <div style={{display:'flex',gap:10,flexWrap:'wrap',justifyContent:'center',margin:'16px 0'}}>
  <button type="button" className="primary" onClick={download}><CalendarPlus size={17}/> Sync to iPhone Calendar</button>
  <a className="outline" href={google.toString()} target="_blank" rel="noopener noreferrer"><CalendarPlus size={17}/> Sync to Google / Android Calendar</a>
  <small style={{width:'100%'}}>Calendar entry includes the appointment details, client name, and assigned team member.</small>
 </div>;
}
