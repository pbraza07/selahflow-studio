'use client';
import {useEffect,useState} from 'react';
type Summary={id:string;status:string;business:string;date:string;start:number;duration:number;services:string[];customer:string;price:number};
export default function BookingDecision({token}:{token:string}){
 const [details,setDetails]=useState<Summary|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 async function load(){try{const r=await fetch('/api/booking/respond',{headers:{Authorization:'Bearer '+token},cache:'no-store'}),d=await r.json();if(!r.ok)throw Error(d.error||'Review link unavailable.');setDetails(d);setError('');}catch(e){setError((e as Error).message);}}
 useEffect(()=>{load();},[token]);
 async function decide(accept:boolean){
  if(!window.confirm(accept?'Accept this booking and add it to the confirmed calendar?':'Decline this request without creating an appointment?'))return;
  setBusy(true);setError('');try{const r=await fetch('/api/booking/respond',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({accept})}),d=await r.json();if(!r.ok)throw Error(d.error||'Unable to review booking.');
  setNotice(accept?'Booking accepted and automatically added to the business calendar.':'Request declined. The business calendar was not changed.');await load();
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 const time=details?String(Math.floor(details.start/60)%12||12)+':'+String(details.start%60).padStart(2,'0')+(details.start<720?' AM':' PM')+' Eastern':'';
 return <main className="sf-team-review-page"><header><a href="/"><img src="/brand/logo.svg?v=1.3.99" width="220" height="55" alt="SelahFlow"/></a><span>Secure booking decision</span></header>
 <section className="sf-team-review-body"><h1>Booking review</h1><p>Opening this link does not accept or decline. Use one of the buttons below to confirm your choice.</p>
 {error&&<p className="alert" role="alert">{error}</p>}{notice&&<p className="notice" role="status">{notice}</p>}
 {!details&&!error&&<p>Loading request…</p>}
 {details&&<div className="sf-approval-card"><h2>{details.business}</h2><p><b>Status:</b> {details.status}</p><p><b>Customer:</b> {details.customer}</p><p><b>Service:</b> {(details.services||[]).join(', ')}</p><p><b>Date/time:</b> {details.date} at {time}</p><p><b>Duration:</b> {details.duration} minutes</p><p><b>Quote:</b> {new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(details.price||0)}</p>
 {details.status==='pending'?<div className="sf-approval-buttons"><button type="button" className="primary" disabled={busy} onClick={()=>decide(true)}>Accept and confirm appointment</button><button type="button" className="outline" disabled={busy} onClick={()=>decide(false)}>Decline (no calendar change)</button></div>:<p role="status">This request has already been reviewed. No further action is available.</p>}
 </div>}
 <p><small>This link is private and expires after 72 hours. Acceptance may fail if the time is unavailable. Do not forward it to anyone else.</small></p></section></main>;
}
