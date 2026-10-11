'use client';
import {useState} from 'react';
import {CalendarCheck} from 'lucide-react';
import {timeLabel} from '../../lib/defaults';
export default function VerifyRegistration({api,onVerified}:{api:string;onVerified:(date:string)=>void}){
 const [reference,setReference]=useState(''),[email,setEmail]=useState(''),[result,setResult]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function check(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');setResult(null);
 try{const r=await fetch(api,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'verify_registration',reference:reference.trim(),email:email.trim()})});const d=await r.json();if(!r.ok)throw Error(d.error||'Unable to verify registration.');setResult(d);onVerified(d.date);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <section className="card" style={{margin:'20px 0',padding:18,border:'1px solid #c5d4cb',borderRadius:14}}>
 <h3><CalendarCheck size={20}/> Check My Registration</h3>
 <p className="muted">Verify your own booking status using the reference provided when you registered and the same email address.</p>
 <form onSubmit={check} style={{display:'grid',gap:12}}>
 <label>Booking reference<input required value={reference} maxLength={50} autoComplete="off" onChange={e=>setReference(e.target.value)}/></label>
 <label>Booking email<input required type="email" value={email} maxLength={200} autoComplete="email" onChange={e=>setEmail(e.target.value)}/></label>
 <button type="submit" className="primary" disabled={busy}>{busy?'Checking…':'Check my registration'}</button>
 </form>
 {error&&<p role="alert" style={{color:'#b42318'}}>{error}</p>}
 {result&&<div role="status" style={{marginTop:14,padding:12,background:'#eaf3ee',borderRadius:10}}>
 <strong>Registration: {result.status}</strong>
 <p>{result.date} · {typeof result.start==='number'?timeLabel(result.start):''}</p>
 <p>{result.status==='Awaiting approval'?'The business has not yet confirmed your request. This time is not reserved.':result.status==='Confirmed'||result.status==='Checked in'?'Your registration is confirmed.':'Contact the business for further details.'}</p>
 <small>The calendar is positioned on your session date. Only your verified status is shown.</small>
 </div>}
 </section>;
}
