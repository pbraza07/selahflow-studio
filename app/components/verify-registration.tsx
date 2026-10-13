'use client';
import {useState} from 'react';
import {CalendarCheck} from 'lucide-react';
export default function VerifyRegistration({api,onVerified}:{api:string;onVerified:(date:string)=>void}){
 const [memberNumber,setMemberNumber]=useState(''),[result,setResult]=useState<{date:string;status:string}|null>(null),[searched,setSearched]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function lookup(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');setSearched(false);setResult(null);
 try{const r=await fetch(api,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'registration_latest_status',memberNumber:memberNumber.trim().toUpperCase()})});const d=await r.json();if(!r.ok)throw Error(d.error||'Unable to check appointment.');setResult(d.latest);setSearched(true);if(d.latest?.date)onVerified(d.latest.date);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <section className="card" style={{margin:'20px 0',padding:18,border:'1px solid #c5d4cb',borderRadius:14}}>
 <h3><CalendarCheck size={20}/> Check My Registration</h3>
 <p className="muted">Enter your unique membership ID to view your most recent appointment and confirmation status.</p>
 <form onSubmit={lookup} style={{display:'grid',gap:12}}>
 <label>Membership ID<input required value={memberNumber} maxLength={6} pattern="[A-Za-z]{2}[0-9]{4}" placeholder="AB0315" autoComplete="off" onChange={e=>setMemberNumber(e.target.value.toUpperCase())}/></label>
 <button type="submit" className="primary" disabled={busy}>{busy?'Checking…':'Check appointment status'}</button>
 </form>
 {error&&<p role="alert" style={{color:'#b42318'}}>{error}</p>}
 {searched&&<div role="status" style={{marginTop:14,padding:12,borderRadius:10,background:'#eaf3ee'}}>{result?<><strong>{result.status}</strong><p>Appointment date: {result.date}</p></>:<p>No matching appointment found. Check your membership ID or contact the business.</p>}</div>}
 </section>;
}
