'use client';
import {useMemo,useState} from 'react';
import ExpandableDetailsGroup from './expandable-details-group';
import SortableTable from './sortable-table';
import type {Visit} from './owner-client-directory';
import {filterBookingStatusRows} from '../../server/booking-status.mjs';
import {displayAnswer} from '../../server/client-registration-fields.mjs';
import {timeLabel} from '../../lib/defaults';

type Booking=Visit&{clientName:string;clientEmail:string;clientPhone:string;clientMemberNumber:string};
const humanDate=(date:string)=>date?new Date(date+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}):'—';
const timestamp=(date:string)=>new Date(date).toLocaleString('en-US',{timeZone:'America/New_York'})+' Eastern';
const money=(amount:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(amount||0);
export default function OwnerBookingStatus({bookings}:{bookings:Booking[]}){
 const [search,setSearch]=useState(''),[status,setStatus]=useState(''),[payment,setPayment]=useState(''),[from,setFrom]=useState(''),[to,setTo]=useState(''),[attendedOnly,setAttendedOnly]=useState(false);
 const statuses=useMemo(()=>[...new Set(bookings.map(row=>row.status))].sort(),[bookings]);
 const rows=useMemo(()=>filterBookingStatusRows(bookings,{search,status,payment,from,to,attendedOnly}) as Booking[],[bookings,search,status,payment,from,to,attendedOnly]);
 return <section className="sf-client-history sf-booking-status" aria-labelledby="booking-status-heading">
  <div className="sf-client-history-heading"><div><h3 id="booking-status-heading">Booking Status</h3><p>All incoming bookings across this business’s clients, including pending requests. New submissions appear first. Updates refresh automatically every 15 seconds while this tab is active.</p></div></div>
  <div className="sf-booking-status-filters">
   <label>Search bookings<input type="search" aria-label="Search all bookings" placeholder="Client, ID, contact, service or team…" value={search} onChange={e=>setSearch(e.target.value)}/></label>
   <label>Booking status<select value={status} onChange={e=>setStatus(e.target.value)}><option value="">All booking statuses</option>{statuses.map(value=><option key={value}>{value}</option>)}</select></label>
   <label>Payment<select value={payment} onChange={e=>setPayment(e.target.value)}><option value="">All payments</option><option value="pending">Pending</option><option value="completed">Completed</option></select></label>
   <label>Activity from<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>Activity through<input type="date" min={from||undefined} value={to} onChange={e=>setTo(e.target.value)}/></label>
   <label className="sf-client-history-filter"><input type="checkbox" checked={attendedOnly} onChange={e=>setAttendedOnly(e.target.checked)}/> Attended only</label>
   <button type="button" className="outline" onClick={()=>{setSearch('');setStatus('');setPayment('');setFrom('');setTo('');setAttendedOnly(false);}}>Clear booking filters</button>
  </div>
  <p role="status">{rows.length} of {bookings.length} bookings · Payment: Pending (red), Completed (green)</p>
  {rows.length?<ExpandableDetailsGroup><div className="sf-client-history-scroll"><SortableTable className="sf-client-history-table">
   <thead><tr><th>Client</th><th>Activity date / time</th><th>Service used</th><th>Service type</th><th>Session</th><th>Team</th><th>Status / booking timeline</th><th>Payment</th><th>Quote</th></tr></thead>
   <tbody>{rows.map(v=><tr key={v.id}>
    <td><b>{v.clientName||'Client'}</b>{v.clientMemberNumber&&<small>ID {v.clientMemberNumber}</small>}{v.clientEmail&&<small>{v.clientEmail}</small>}{v.clientPhone&&<small>{v.clientPhone}</small>}{v.submittedAt&&<small>Submitted {timestamp(v.submittedAt)}</small>}</td>
    <td data-sort-value={v.date+' '+String(v.time).padStart(4,'0')}><b>{humanDate(v.date)}</b><small>{timeLabel(v.time)} Eastern</small></td>
    <td>{v.serviceNames.join(', ')||'Unspecified'}{!!v.answers?.length&&<details className="sf-client-visit-answers"><summary>Booking answers ({v.answers.length})</summary>{v.answers.map(a=><div key={a.id}><strong>{a.label}:</strong> {displayAnswer(a.value)}</div>)}</details>}{!!v.originalAnswers?.length&&<details className="sf-client-visit-answers"><summary>Original registration answers ({v.originalAnswers.length})</summary>{v.originalAnswers.map(a=><div key={a.id}><strong>{a.label}:</strong> {displayAnswer(a.value)}</div>)}</details>}</td>
    <td>{v.serviceTypes.join(', ')||'Not categorized'}</td><td>{v.sessionType}</td><td>{v.staff||'—'}</td>
    <td><span className={'sf-client-visit-status '+(v.attended?'attended':['No-show','Cancelled','Declined'].includes(v.status)?'missed':'scheduled')}>{v.status}{v.attended?' · Attended':''}</span><details><summary>+ Booking timeline</summary>{v.bookingTimeline?.map((entry,i)=><p key={i}>{entry.status}{entry.at?' · '+timestamp(entry.at):''}</p>)}</details></td>
    <td><span className={'sf-booking-payment '+(v.paymentTracking==='completed'?'completed':'pending')}>{v.paymentTracking==='completed'?'Completed':'Pending'}</span></td><td>{money(v.quotedPrice)}</td>
   </tr>)}</tbody>
  </SortableTable></div></ExpandableDetailsGroup>:<p className="sf-client-empty">{bookings.length?'No bookings match these filters.':'Incoming bookings will appear here for all clients.'}</p>}
 </section>;
}
