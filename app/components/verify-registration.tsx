'use client';
import {useState} from 'react';
import {CalendarCheck} from 'lucide-react';
import RegistrationLookupResult from './registration-lookup-result';
export type MembershipSummary={name:string;type:string;status:string;sessionsLeft:number;sessionsIncluded:number;sessionsUsed:number};
export default function VerifyRegistration({api,onVerified}:{api:string;onVerified:(date:string)=>void}){
 const [memberNumber,setMemberNumber]=useState(''),[membership,setMembership]=useState<MembershipSummary|null>(null),[result,setResult]=useState<{date:string;status:string}|null>(null),[searched,setSearched]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function lookup(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');setSearched(false);setResult(null);setMembership(null);
 try{const r=await fetch(api,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'registration_latest_status',memberNumber:memberNumber.trim().toUpperCase()})});const d=await r.json();if(!r.ok)throw Error(d.error||'Unable to check appointment.');setResult(d.latest);setMembership(d.membership||null);setSearched(true);if(d.latest?.date)onVerified(d.latest.date);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <section className="card" style={{margin:'20px 0',padding:18,border:'1px solid #c5d4cb',borderRadius:14}}>
 <h3><CalendarCheck size={20}/> Check My Registration</h3>
 <p className="muted">Enter your unique membership ID to see your membership type, package, sessions left, and latest appointment status. Only your ID is needed for this check.</p>
 <form onSubmit={lookup} style={{display:'grid',gap:12}}>
 <label>Membership ID<input required disabled={busy} value={memberNumber} maxLength={6} pattern="[A-Za-z]{2}[0-9]{4}" placeholder="AB0315" autoComplete="off" onChange={e=>{setMemberNumber(e.target.value.toUpperCase());setSearched(false);}}/></label>
 <button type="submit" className="primary" disabled={busy}>{busy?'Checking…':'Check membership & appointment'}</button>
 </form>
 {error&&<p role="alert" style={{color:'#b42318'}}>{error}</p>}
 {searched&&<RegistrationLookupResult membership={membership} result={result}/>}
 </section>;
}
