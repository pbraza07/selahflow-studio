'use client';
import {useState} from 'react';
import {CalendarCheck} from 'lucide-react';
export default function VerifyRegistration({api,onVerified}:{api:string;onVerified:(date:string)=>void}){
 const [name,setName]=useState(''),[email,setEmail]=useState(''),[result,setResult]=useState<{date:string;status:string}|null>(null),[searched,setSearched]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function lookup(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');setSearched(false);setResult(null);
 try{const r=await fetch(api,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'registration_latest_status',name:name.trim(),email:email.trim()})});const d=await r.json();if(!r.ok)throw Error(d.error||'Unable to check appointment.');setResult(d.latest);setSearched(true);if(d.latest?.date)onVerified(d.latest.date);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <section className="card" style={{margin:'20px 0',padding:18,border:'1px solid #c5d4cb',borderRadius:14}}>
 <h3><CalendarCheck size={20}/> Check My Registration</h3>
 <p className="muted">Enter the name and email used when booking. View only the most recent appointment date and confirmation status. No email code required.</p>
 <form onSubmit={lookup} style={{display:'grid',gap:12}}>
 <label>Customer full name<input required value={name} maxLength={100} autoComplete="name" onChange={e=>setName(e.target.value)}/></label>
 <label>Booking email<input required type="email" value={email} maxLength={200} autoComplete="email" onChange={e=>setEmail(e.target.value)}/></label>
 <button type="submit" className="primary" disabled={busy}>{busy?'Checking…':'Check appointment status'}</button>
 </form>
 {error&&<p role="alert" style={{color:'#b42318'}}>{error}</p>}
 {searched&&<div role="status" style={{marginTop:14,padding:12,borderRadius:10,background:'#eaf3ee'}}>{result?<><strong>{result.status}</strong><p>Appointment date: {result.date}</p></>:<p>No matching appointment found. Check your name and email or contact the business.</p>}</div>}
 </section>;
}
