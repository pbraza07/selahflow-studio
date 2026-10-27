'use client';
import {useEffect,useState} from 'react';
import {CalendarCheck} from 'lucide-react';
import RegistrationLookupResult from './registration-lookup-result';
import RegistrationPayment,{type RegistrationPaymentState} from './registration-payment';
export type MembershipSummary={name:string;type:string;status:string;sessionsLeft:number;sessionsIncluded:number;sessionsUsed:number};
export default function VerifyRegistration({api,onVerified}:{api:string;onVerified:(date:string)=>void}){
 const [memberNumber,setMemberNumber]=useState(''),[membership,setMembership]=useState<MembershipSummary|null>(null),[result,setResult]=useState<{date:string;status:string;service?:string;serviceType?:string}|null>(null),[searched,setSearched]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [payment,setPayment]=useState<RegistrationPaymentState|null>(null);
 const [expanded,setExpanded]=useState(false);
 useEffect(()=>{const show=()=>{if(window.location.hash==='#registration-status'){setExpanded(true);document.getElementById('registration-status')?.scrollIntoView({block:'start'});}};show();window.addEventListener('hashchange',show);return()=>window.removeEventListener('hashchange',show);},[]);
 async function lookup(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');setSearched(false);setResult(null);setMembership(null);
 try{const r=await fetch(api,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'registration_latest_status',memberNumber:memberNumber.trim().toUpperCase()})});const d=await r.json();if(!r.ok)throw Error(d.error||'Unable to check appointment.');setResult(d.latest);setMembership(d.membership||null);setPayment(d.payment||null);setSearched(true);if(d.latest?.date)onVerified(d.latest.date);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <details open={expanded} onToggle={e=>setExpanded(e.currentTarget.open)} id="registration-status" className="card" style={{margin:'20px 0',padding:18,border:'1px solid #c5d4cb',borderRadius:14,scrollMarginTop:24}}>
 <summary className="sf-registration-summary"><CalendarCheck size={20} aria-hidden="true"/><span>Already registered? Check membership &amp; appointment</span></summary>
 <p className="muted">Enter your unique membership ID to see your membership type, package, sessions left, booked service, service type, and latest appointment status. Only your ID is needed for this check.</p>
 <form onSubmit={lookup} style={{display:'grid',gap:12}}>
 <label>Membership ID<input required disabled={busy} value={memberNumber} maxLength={8} pattern="[A-Za-z]{2}([0-9]{4}|[0-9]{6})" placeholder="AB031513" autoComplete="off" onChange={e=>{setMemberNumber(e.target.value.toUpperCase());setSearched(false);}}/></label>
 <button type="submit" className="primary" disabled={busy}>{busy?'Checking…':'Check membership & appointment'}</button>
 </form>
 {error&&<p role="alert" style={{color:'#b42318'}}>{error}</p>}
 {searched&&<><RegistrationLookupResult membership={membership} result={result}/><RegistrationPayment key={memberNumber+':'+payment?.bookingId+':'+payment?.state} payment={payment} memberNumber={memberNumber.trim().toUpperCase()}/></>}
 </details>;
}
