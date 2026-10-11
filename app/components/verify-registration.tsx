'use client';
import {useState} from 'react';
import {CalendarCheck} from 'lucide-react';
import {timeLabel} from '../../lib/defaults';
export default function VerifyRegistration({api,onVerified}:{api:string;onVerified:(date:string)=>void}){
 const [email,setEmail]=useState(''),[code,setCode]=useState(''),[sent,setSent]=useState(false),[registrations,setRegistrations]=useState<any[]|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function requestCode(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');setRegistrations(null);
 try{const r=await fetch(api,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'registration_code_request',email:email.trim()})});const d=await r.json();if(!r.ok)throw Error(d.error||'Unable to send code.');setSent(true);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function verify(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');
 try{const r=await fetch(api,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'registration_email_lookup',email:email.trim(),code})});const d=await r.json();if(!r.ok)throw Error(d.error||'Unable to verify email.');setRegistrations(d.registrations||[]);if(d.registrations?.[0]?.date)onVerified(d.registrations[0].date);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <section className="card" style={{margin:'20px 0',padding:18,border:'1px solid #c5d4cb',borderRadius:14}}>
 <h3><CalendarCheck size={20}/> Check My Registration</h3>
 <p className="muted">Enter your booking email to check your registrations. We'll send a one-time verification code to protect your privacy. No booking reference needed.</p>
 <form onSubmit={sent?verify:requestCode} style={{display:'grid',gap:12}}>
 <label>Booking email<input required type="email" value={email} maxLength={200} autoComplete="email" onChange={e=>{setEmail(e.target.value);setSent(false);setCode('');setRegistrations(null);}}/></label>
 {sent&&<label>Six-digit email verification code<input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" value={code} onChange={e=>setCode(e.target.value.replace(/[^0-9]/g,''))}/></label>}
 <button type="submit" className="primary" disabled={busy}>{busy?'Please wait…':sent?'Verify and show registrations':'Email me a verification code'}</button>
 </form>
 {sent&&<p className="muted">Check your inbox for the six-digit code. It expires in 10 minutes.</p>}
 {error&&<p role="alert" style={{color:'#b42318'}}>{error}</p>}
 {registrations&&<div role="status" style={{marginTop:14}}><h4>My registrations</h4>{registrations.length===0?<p>No registrations found for this email at this business.</p>:registrations.map((r:any)=><button type="button" key={r.reference} className="outline" style={{display:'block',width:'100%',textAlign:'left',marginBottom:8,padding:12}} onClick={()=>onVerified(r.date)}><strong>{r.status}</strong><div>{r.date} · {typeof r.start==='number'?timeLabel(r.start):''}</div><small>{r.service}</small></button>)}</div>}
 </section>;
}
