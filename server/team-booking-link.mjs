/** Validate a public team link against the current business catalog and roster. */
export function teamBookingLink(config,query,today){
 const member=(config.staff||[]).find(s=>s.id===query.get('staff')&&s.bookingVisible!==false);
 if(!member)return null;
 const service=(config.services||[]).find(s=>s.id===query.get('service')&&member.services?.includes(s.id)&&(!s.durationUnit||['minutes','hours'].includes(s.durationUnit)));
 const day=query.get('date'),raw=query.get('start'),start=raw===null?null:Number(raw);
 const date=day&&/^\d{4}-\d{2}-\d{2}$/.test(day)&&!Number.isNaN(Date.parse(day+'T12:00:00Z'))&&new Date(day+'T12:00:00Z').toISOString().slice(0,10)===day&&day>=today?day:null;
 return {staff:member.id,service:service?.id||null,date,start:date&&raw!==null&&raw.trim()!==''&&Number.isInteger(start)&&start>=0&&start<1440?start:null};
}
