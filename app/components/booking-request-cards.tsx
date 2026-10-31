'use client';
import {Pencil} from 'lucide-react';
export type BookingRequest={
 id:string;date:string;staff_id:string;start_minute:number;duration:number;reviewer:string;status:string;created_at:string;
 details:{customerName:string;customerEmail:string;customerPhone:string;services:string[];staffId:string;date:string;start:number;quotedPrice:number;customAnswers?:Record<string,string|boolean>;sessionId?:string|null;customFieldLabels?:Record<string,string>;correctedAt?:string;correctedBy?:string;originalSubmission?:{customerName:string;customerEmail:string;customerPhone:string;customAnswers:Record<string,string|boolean>}};
 sessionInfo?:{id:string;booked:number;capacity:number;remaining:number;waiting:number}|null;
};
export const approvalTime=(minute:number)=>((Math.floor(minute/60)%12)||12)+':'+String(minute%60).padStart(2,'0')+(minute<720?' AM':' PM');
function activityDate(date:string){
 const d=new Date(date+'T12:00:00Z');
 return Number.isFinite(d.getTime())?d.toLocaleDateString('en-US',{timeZone:'UTC',weekday:'short',month:'long',day:'numeric',year:'numeric'}):date;
}
function receiptTime(iso:string){
 const d=new Date(iso);
 return Number.isFinite(d.getTime())?d.toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}):iso;
}
const money=(value:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(value)||0);
export default function BookingRequestCards({
 items,busy,onReview,onEdit,team,customFields=[],approvalFields,approvalLabel
}:{
 items:BookingRequest[];busy:string;approvalLabel?:string;onReview:(id:string,accept:boolean)=>void;onEdit?:(item:BookingRequest)=>void;
 team?:{id:string;name:string}[];customFields?:{id:string;label:string}[];approvalFields?:string[];
}){
 const visible=(id:string)=>approvalFields===undefined||approvalFields.includes(id);
 return <div className="sf-approval-list">{items.map(item=><article className="sf-approval-card" key={item.id}>
  <div className="sf-approval-title">
   <div><strong>{item.details.customerName||'New customer'}</strong><span>Requested {activityDate(item.date)} · {approvalTime(item.start_minute)} Eastern · {item.duration} minutes</span></div>
   <span className="sf-request-badge">Awaiting review{item.details.correctedAt?' · Edited':''}</span>
  </div>
  <div className="sf-approval-activity" aria-label="Requested activity schedule">
   <div><small>Activity date</small><b>{activityDate(item.date)}</b></div>
   <div><small>Start time</small><b>{approvalTime(item.start_minute)} Eastern</b></div>
   <div><small>Duration</small><b>{item.duration} minutes</b></div>
  </div>
  {item.sessionInfo&&<section className="sf-approval-seats" aria-label="Session booking capacity">
   <div><strong>{item.sessionInfo.booked} / {item.sessionInfo.capacity} customers booked</strong><span>{item.sessionInfo.remaining}/{item.sessionInfo.capacity} slots left</span></div>
   <div className="sf-approval-capacity-track" aria-hidden="true"><span style={{width:Math.max(0,Math.min(100,item.sessionInfo.capacity>0?100*item.sessionInfo.booked/item.sessionInfo.capacity:0))+'%'}}/></div>
   <small>{item.sessionInfo.waiting} booking request{item.sessionInfo.waiting===1?'':'s'} awaiting review for this session (including this request). Pending requests do not hold seats.</small>
  </section>}
  <div className="sf-approval-detail-grid">
   {visible('services')&&<div><small>Service / activity</small><b>{(item.details.services||[]).join(', ')||'Not specified'}</b></div>}
   {visible('team')&&<div><small>Team member</small><b>{team?.find(s=>s.id===item.staff_id)?.name||item.staff_id}</b></div>}
   {visible('customerEmail')&&item.details.customerEmail&&<div><small>Customer email</small><b>{item.details.customerEmail}</b></div>}
   {visible('customerPhone')&&item.details.customerPhone&&<div><small>Customer phone</small><b>{item.details.customerPhone}</b></div>}
   {customFields.filter(f=>visible(f.id)&&item.details.customAnswers?.[f.id]!==undefined).map(f=><div key={f.id}><small>{f.label}</small><b>{typeof item.details.customAnswers?.[f.id]==='boolean'?(item.details.customAnswers?.[f.id]?'Yes':'No'):String(item.details.customAnswers?.[f.id])}</b></div>)}
   {visible('quotedPrice')&&<div><small>Service quote</small><b>{money(item.details.quotedPrice||0)} <span className="sf-approval-unpaid">· No payment collected</span></b></div>}
   {visible('receivedAt')&&<div><small>Request received</small><b>{receiptTime(item.created_at)}</b></div>}
  </div>
  <details className="sf-approval-all-submitted"><summary>View all customer-provided booking information</summary>
   <div className="sf-approval-detail-grid">
    <div><small>Name provided</small><b>{item.details.customerName}</b></div>
    <div><small>Email provided</small><b>{item.details.customerEmail}</b></div>
    <div><small>Phone provided</small><b>{item.details.customerPhone||'Not provided'}</b></div>
    <div><small>Service(s)</small><b>{(item.details.services||[]).join(', ')}</b></div>
    <div><small>Activity date and time</small><b>{activityDate(item.date)} · {approvalTime(item.start_minute)} Eastern</b></div>
    <div><small>Quote</small><b>{money(item.details.quotedPrice||0)}</b></div>
    {Object.entries(item.details.customAnswers||{}).map(([id,value])=><div key={id}><small>{item.details.customFieldLabels?.[id]||customFields.find(f=>f.id===id)?.label||id}</small><b>{typeof value==='boolean'?(value?'Yes':'No'):String(value)}</b></div>)}
    {item.details.originalSubmission&&<div><small>Original customer name before any corrections</small><b>{item.details.originalSubmission.customerName}</b></div>}
   </div>
  </details>
  <div className="sf-approval-buttons">{onEdit&&<button type="button" className="outline sf-booking-edit-button" disabled={!!busy} onClick={()=>onEdit(item)}><Pencil size={16}/> Edit booking details</button>}<button type="button" className="primary" disabled={!!busy} onClick={()=>onReview(item.id,true)}>{busy===item.id?'Processing…':approvalLabel||'Accept and add to calendar'}</button><button type="button" className="outline" disabled={!!busy} onClick={()=>onReview(item.id,false)}>Decline (no calendar change)</button></div>
 </article>)}</div>;
}
