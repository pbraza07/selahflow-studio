'use client';
export default function AttendanceActions({appointment,busy,onStatus}:{appointment:any;busy:boolean;onStatus:(a:any,status:string)=>void}){
 if(!appointment||['Cancelled','Completed'].includes(appointment.status))return null;
 return <span className="sf-attendance-actions">{appointment.status!=='Checked in'&&<button type="button" className="outline" disabled={busy||appointment.sample} onClick={()=>onStatus(appointment,'Checked in')}>Check in</button>}{appointment.status!=='No-show'&&<button type="button" className="outline" disabled={busy||appointment.sample} onClick={()=>onStatus(appointment,'No-show')}>No-show</button>}</span>;
}
