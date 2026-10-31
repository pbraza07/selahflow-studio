'use client';
import {useEffect,useState} from 'react';
import {Bell,ChevronDown,CalendarDays} from 'lucide-react';
import TeamBookingReview from './team-booking-review';
type Notice={id:string;date:string;start:number;teamMember:string;customerName:string;services:string[];unread:boolean};
const time=(minutes:number)=>new Date(2000,0,1,Math.floor(minutes/60),minutes%60).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
export default function TeamAppointmentBell({onOpen,onChanged}:{onOpen:()=>void;onChanged:()=>Promise<void>}){
 const [items,setItems]=useState<Notice[]>([]),[unread,setUnread]=useState(0),[pending,setPending]=useState(0),[open,setOpen]=useState(false),[error,setError]=useState('');
 async function load(){try{const r=await fetch('/api/team/notifications',{cache:'no-store'}),d=await r.json();if(!r.ok)throw Error('Appointment confirmations are unavailable. Please refresh or sign in again.');setItems(d.items||[]);setUnread(d.unread||0);setError('');}catch(e){setItems([]);setError((e as Error).message);}}
 useEffect(()=>{void load();const timer=setInterval(()=>void load(),15000);return()=>clearInterval(timer);},[]);
 async function toggle(){const next=!open;setOpen(next);if(next&&unread){const ids=items.filter(i=>i.unread).map(i=>i.id);try{const r=await fetch('/api/team/notifications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'markRead',ids})});if(r.ok){setUnread(0);setItems(v=>v.map(i=>({...i,unread:false})));}}catch{}}}
 async function changed(){await Promise.all([load(),onChanged()]);}
 return <section className="sf-team-booking-center" aria-label="Bookings and approvals">
  <button type="button" className="sf-team-booking-toggle" onClick={()=>void toggle()} aria-expanded={open} aria-controls="team-booking-details">
   <span className="sf-team-booking-icon"><Bell size={24}/></span><span className="sf-team-booking-label"><strong>Bookings & approvals</strong><span>{pending?`${pending} request${pending===1?'':'s'} awaiting your review`:'View booking details and appointment confirmations'}{unread>0?` · ${unread} new confirmation${unread===1?'':'s'}`:''}</span></span>{pending+unread>0&&<span className="sf-team-booking-count" aria-label={`${pending} pending requests and ${unread} unread confirmations`}>{pending+unread>99?'99+':pending+unread}</span>}<ChevronDown size={20} aria-hidden="true" style={{transform:open?'rotate(180deg)':undefined}}/>
  </button>
  <div id="team-booking-details" hidden={!open} className="sf-team-booking-details">
   <TeamBookingReview embedded onCount={setPending} onChanged={changed}/>
   <section className="sf-team-confirmations"><h2>My appointment confirmations</h2><p>Only appointments assigned to you appear here. Times are Eastern.</p>{error&&<p role="alert" className="error">{error}</p>}{items.length?<div className="sf-team-confirmation-list">{items.map(i=><article key={i.id}><strong>{i.customerName}</strong><span>{i.date} · {time(i.start)} Eastern</span><span>{i.services.join(', ')||'Appointment'} · {i.teamMember}</span></article>)}</div>:!error&&<p>No assigned appointment confirmations.</p>}<button type="button" className="outline" onClick={()=>{setOpen(false);onOpen();}}><CalendarDays size={17}/> Open my calendar</button></section>
  </div>
 </section>;
}
