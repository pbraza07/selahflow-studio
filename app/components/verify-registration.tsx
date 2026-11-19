'use client';
import {useEffect,useState} from 'react';
import {timeLabel} from '../../lib/defaults';
import {CalendarCheck} from 'lucide-react';
import RegistrationLookupResult from './registration-lookup-result';
import RegistrationPayment,{type RegistrationPaymentState} from './registration-payment';
export type MembershipSummary={name:string;type:string;status:string;sessionsLeft:number;sessionsIncluded:number;sessionsUsed:number};
type Session={date:string;start:number;duration:number;service:string;serviceType:string;status:string};
function SessionList({title,items,empty}:{title:string;items:Session[];empty:string}){
 return <section className="sf-registration-session-list"><h3>{title}</h3>{items.length?<ol>{items.map((item,i)=><li key={i}><strong>{item.service}</strong><span>{item.serviceType} · {item.status}</span><time>{new Date(item.date+'T12:00:00Z').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric',timeZone:'UTC'})} · {timeLabel(item.start)} Eastern · {item.duration} min</time></li>)}</ol>:<p>{empty}</p>}</section>;
}
export default function VerifyRegistration({api,onVerified,membershipOnly=false}:{membershipOnly?:boolean;api:string;onVerified?:(date:string)=>void}){
 const [memberNumber,setMemberNumber]=useState(''),[membership,setMembership]=useState<MembershipSummary|null>(null),[result,setResult]=useState<{date:string;status:string;service?:string;serviceType?:string}|null>(null),[searched,setSearched]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [sessions,setSessions]=useState<{past:Session[];upcoming:Session[]}|null>(null);
 const [payment,setPayment]=useState<RegistrationPaymentState|null>(null);
 const [expanded,setExpanded]=useState(membershipOnly);
 useEffect(()=>{const show=()=>{if(window.location.hash==='#registration-status'){setExpanded(true);document.getElementById('registration-status')?.scrollIntoView({block:'start'});}};show();window.addEventListener('hashchange',show);return()=>window.removeEventListener('hashchange',show);},[]);
 async function lookup(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');setSearched(false);setResult(null);setMembership(null);
 try{const r=await fetch(api,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'registration_latest_status',membershipOnly,memberNumber:memberNumber.trim().toUpperCase()})});const d=await r.json();if(!r.ok)throw Error(d.error||'Unable to check booking status.');setSessions(d.sessions||null);setResult(d.latest);setMembership(d.membership||null);setPayment(d.payment||null);setSearched(true);if(d.latest?.date)onVerified?.(d.latest.date);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <details open={expanded} onToggle={e=>setExpanded(e.currentTarget.open)} id="registration-status" className="card" style={{margin:'20px 0',padding:18,border:'1px solid #c5d4cb',borderRadius:14,scrollMarginTop:24}}>
 <summary className="sf-registration-summary"><CalendarCheck size={20} aria-hidden="true"/><span>{membershipOnly?'Check Membership Status':'Check booking & membership status'}</span></summary>
 <p className="muted">{membershipOnly?'Enter your client ID to see your membership balance and recent and upcoming sessions.': 'Enter the client ID issued by this business to see your latest booking and any membership details. The same ID is used for memberships; you do not need an active membership to check a booking.'}</p>
 <form onSubmit={lookup} style={{display:'grid',gap:12}}>
 <label>Client ID (membership ID)<input required disabled={busy} value={memberNumber} maxLength={8} pattern="[A-Za-z]{2}([0-9]{4}|[0-9]{6})" placeholder="AB031513" autoComplete="off" onChange={e=>{setMemberNumber(e.target.value.toUpperCase());setSearched(false);}}/></label>
 <button type="submit" className="primary" disabled={busy}>{busy?'Checking…':membershipOnly?'Check Membership Status':'Check booking & membership status'}</button>
 </form>
 {error&&<p role="alert" style={{color:'#b42318'}}>{error}</p>}
 {searched&&membershipOnly&&<div role="status" className="sf-registration-membership-summary">{membership?<><strong translate="no">{membership.name}</strong><span>{membership.type} · {membership.status.replaceAll('_',' ')}</span><strong>{membership.sessionsLeft} sessions remaining</strong><span>{membership.sessionsUsed} of {membership.sessionsIncluded} used</span></>:<p>No membership found for this client ID.</p>}</div>}
 {searched&&!membershipOnly&&<><RegistrationLookupResult membership={membership} result={result}/><RegistrationPayment key={memberNumber+':'+payment?.bookingId+':'+payment?.state} payment={payment} memberNumber={memberNumber.trim().toUpperCase()}/></>}
 {searched&&sessions&&<><SessionList title="Last 5 sessions" items={sessions.past} empty="No past sessions recorded."/><SessionList title="Next 5 sessions" items={sessions.upcoming} empty="No upcoming sessions scheduled."/></>}
 </details>;
}
