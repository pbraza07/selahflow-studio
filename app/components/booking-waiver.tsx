'use client';
import {useEffect,useState} from 'react';
import ParticipationWaiver,{type WaiverSignature} from './participation-waiver';
import {accessibleText} from '../../server/themes.mjs';
import {waiverToday} from '../../server/waiver-content.mjs';
export default function BookingWaiver({slug}:{slug:string}){
 const [token,setToken]=useState(''),[data,setData]=useState<any>(null),[dob,setDob]=useState(''),[firstName,setFirstName]=useState(''),[lastName,setLastName]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 const [signature,setSignature]=useState<WaiverSignature>({signature:'',role:'',date:waiverToday(),accepted:false,version:'',documentHash:''});
 useEffect(()=>{
  const token=new URLSearchParams(window.location.hash.slice(1)).get('token')||'';setToken(token);let active=true;
  if(!token){setError('Open the private waiver link in your email. Contact the business if you need help.');return;}
  fetch('/api/public/booking-waiver',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({action:'preview',slug,token})}).then(async r=>{const d=await r.json();if(!active)return;if(!r.ok)throw Error(d.error);setData(d);setFirstName(d.firstName||'');setLastName(d.lastName||'');setError('');}).catch(e=>{if(active)setError(e.message);});
  return()=>{active=false;};
 },[slug,revision]);
 async function submit(e:React.FormEvent){e.preventDefault();if(busy)return;setBusy(true);setError('');try{
  const r=await fetch('/api/public/booking-waiver',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'sign',slug,token,dateOfBirth:dob,firstName,lastName,signature})}),d=await r.json();if(!r.ok)throw Error(d.error);setData({...data,signed:true});
 }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <main style={{maxWidth:800,margin:'32px auto',padding:24}}><h1>{data?.business||'Participation waiver'}</h1>{error&&<p role="alert">{error}</p>}{!data&&!error&&<p role="status">Opening your private waiver…</p>}{data?.signed?<section role="status"><h2>Your waiver is on file</h2><p>Your booking remains saved. Thank you.</p></section>:data&&<>
  <h2>Review and sign your waiver</h2><p>Your past appointment on {data.date} is already saved. Signing uses today’s date and does not change the appointment date or charge you.</p>
  {data.identityNeedsUpdate?<p role="alert">Please ask the business to add the participant’s birth date to their client record, then reopen this link.</p>:<form onSubmit={submit}>
   <div className="form-grid"><label>Participant first name<input required readOnly={data.identityExists} maxLength={50} value={firstName} onChange={e=>setFirstName(e.target.value)}/></label><label>Participant last name<input required readOnly={data.identityExists} maxLength={50} value={lastName} onChange={e=>setLastName(e.target.value)}/></label></div>
   <label>Confirm participant date of birth<input type="date" required max={waiverToday()} value={dob} onChange={e=>{setDob(e.target.value);setSignature({...signature,role:'',signature:'',accepted:false});}}/></label>
   <ParticipationWaiver document={data.document} dob={dob} participantName={data.participantName} value={signature} onChange={setSignature} signed={false} checking={false} error="" onRetry={()=>setRevision(v=>v+1)}/>
   <button className="primary" type="submit" disabled={busy||!dob||data.document.acceptingSignatures===false} style={{background:data.document.colors?.button,color:accessibleText(data.document.colors?.button||'#111'),minHeight:48}}>{busy?'Saving signature…':'Sign and save waiver'}</button>
  </form>}
 </>}<p><a href={'/book/'+encodeURIComponent(slug)}>Return to business booking</a></p></main>;
}
